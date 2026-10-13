#!/usr/bin/env python3
"""Convert ResPlan's geometry-only pickle to lazy, browser-readable JSON shards.

Requires shapely>=2 and numpy. No upstream Python code is executed. The pickle
reader allows only Shapely's WKB decoder and NumPy's numeric scalar constructors.
"""
import argparse
import hashlib
import json
import math
import pickle
import random
import zipfile
from pathlib import Path

import numpy as np
try:
    from numpy._core.multiarray import scalar as numpy_scalar
except ImportError:
    from numpy.core.multiarray import scalar as numpy_scalar
from shapely import from_wkb
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

CATEGORIES = ('living', 'bedroom', 'bathroom', 'kitchen', 'storage', 'stair',
              'balcony', 'parking', 'garden', 'pool', 'veranda', 'wall', 'door',
              'front_door', 'window', 'inner', 'land')
ROOMS = {'living', 'bedroom', 'bathroom', 'kitchen', 'storage', 'stair', 'balcony', 'veranda'}


class GeometryUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) == ('shapely.io', 'from_wkb'):
            return from_wkb
        if (module, name) == ('numpy', 'dtype'):
            return np.dtype
        if module in ('numpy._core.multiarray', 'numpy.core.multiarray') and name == 'scalar':
            return numpy_scalar
        raise pickle.UnpicklingError(f'Unsupported pickle class: {module}.{name}')

    def persistent_load(self, pid):
        raise pickle.UnpicklingError('Persistent pickle references are not supported.')


def polygons(geometry):
    if geometry is None or geometry.is_empty:
        return []
    if geometry.geom_type == 'Polygon':
        return [geometry]
    if geometry.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [p for part in geometry.geoms for p in polygons(part)]
    raise ValueError(f'Unsupported geometry: {geometry.geom_type}')


def coordinates(poly):
    poly = orient(poly, sign=1)
    def ring(r):
        return [[float(x), float(y)] for x, y in list(r.coords)[:-1]]
    return {'outer': ring(poly.exterior), 'holes': [ring(r) for r in poly.interiors]}


def convert_plan(plan, metres_per_unit=None):
    plan_id = str(plan['id'])
    if not plan_id.isdigit():
        raise ValueError('Plan ID must be numeric.')
    inner = plan.get('inner')
    area = float(plan.get('area', 0))
    if inner is None or inner.is_empty or inner.area <= 0:
        raise ValueError('Missing inner area.')
    if metres_per_unit is None:
        if not math.isfinite(area) or not 10 <= area <= 5000:
            raise ValueError('Reported area outside 10–5000; supply --metres-per-unit.')
        factor = math.sqrt(area / inner.area)
        calibration = 'reported-area / inner-polygon-area; estimated metres'
    else:
        factor = metres_per_unit
        calibration = 'explicit metres-per-source-unit override'
    if not math.isfinite(factor) or not 0.000001 <= factor <= 100 or not 1 <= inner.area * factor ** 2 <= 5000:
        raise ValueError('Invalid metric calibration.')
    min_x, min_y, _, _ = inner.bounds
    features = []
    for category in CATEGORIES:
        geometry = plan.get(category, plan.get('balacony') if category == 'balcony' else None)
        for i, poly in enumerate(polygons(geometry)):
            if not poly.is_valid or poly.area <= 0:
                raise ValueError(f'Invalid source polygon: {category}:{i}')
            original = coordinates(poly)
            if any(len(r) > 8192 for r in [original['outer'], *original['holes']]):
                raise ValueError(f'Source ring exceeds 8192 vertices: {category}:{i}')
            # Render precision only. Keep the original float64 coordinates too.
            display_poly = poly.simplify(0.0001 / factor, preserve_topology=True)
            if not isinstance(display_poly, Polygon) or not display_poly.is_valid:
                raise ValueError(f'Invalid display polygon: {category}:{i}')
            anchor = poly.representative_point()
            feature = {'id': f'{category}:{i}', 'category': category,
                       'geometry': original, 'anchor': [anchor.x, anchor.y]}
            display = coordinates(display_poly)
            if display != original:
                feature['displayGeometry'] = display
            features.append(feature)
    if sum(f['category'] == 'bedroom' for f in features) > 32 or sum(f['category'] in ROOMS for f in features) > 256:
        raise ValueError('Room counts exceed browser selection budget.')
    if not any(f['category'] in ROOMS for f in features):
        raise ValueError('No functional rooms.')
    if len(features) > 512 or sum(len(r) for f in features for r in [f['geometry']['outer'], *f['geometry']['holes']]) > 32000:
        raise ValueError('Source geometry exceeds browser import budget.')
    return {'id': plan_id, 'calibration': {'method': calibration, 'metresPerSourceUnit': factor,
            'sourceOrigin': [min_x, min_y], 'reportedArea': area, 'sourceInnerArea': float(inner.area),
            'displaySimplificationMetres': 0.0001}, 'features': features}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='Upstream ResPlan.zip or geometry-only ResPlan.pkl')
    parser.add_argument('--output', type=Path, default=Path('data/resplan'))
    parser.add_argument('--revision', required=True, help='Upstream git commit SHA (provenance)')
    parser.add_argument('--count', type=int, default=128, help='Sample count; 0 converts the full release')
    parser.add_argument('--sample-seed', type=int, default=5058)
    parser.add_argument('--shard-size', type=int, default=32)
    parser.add_argument('--metres-per-unit', type=float)
    parser.add_argument('--exclude-id', action='append', default=[], help='ID to remove, e.g. an upstream takedown')
    args = parser.parse_args()
    if args.count < 0 or not 1 <= args.shard_size <= 256:
        parser.error('count must be >=0; shard-size must be 1–256.')
    if len(args.revision) != 40 or any(c not in '0123456789abcdef' for c in args.revision):
        parser.error('revision must be a complete lowercase git SHA.')
    if args.input.stat().st_size > 512 * 1024 * 1024:
        parser.error('Input exceeds 512 MiB.')
    digest = hashlib.sha256(args.input.read_bytes()).hexdigest()
    if zipfile.is_zipfile(args.input):
        with zipfile.ZipFile(args.input) as archive:
            info = archive.getinfo('ResPlan.pkl')
            if info.file_size > 512 * 1024 * 1024:
                parser.error('Uncompressed pickle exceeds 512 MiB.')
            with archive.open(info) as handle:
                data = GeometryUnpickler(handle).load()
    else:
        with args.input.open('rb') as handle:
            data = GeometryUnpickler(handle).load()
    if not isinstance(data, list) or len(data) > 20000:
        parser.error('Expected a list of at most 20,000 floor plans.')
    data = sorted(data, key=lambda p: int(p['id']))
    if len({str(p['id']) for p in data}) != len(data):
        parser.error('Duplicate upstream plan IDs.')
    if any(not str(i).isdigit() for i in args.exclude_id):
        parser.error('Excluded IDs must be numeric.')
    excluded = set(args.exclude_id)
    candidates = [p for p in data if str(p['id']) not in excluded]
    if args.count and args.count < len(candidates):
        # A shuffled traversal replaces refused records rather than silently
        # reducing the requested sample size. Output IDs remain canonically sorted.
        random.Random(args.sample_seed).shuffle(candidates)
    accepted, refusals = [], []
    for plan in candidates:
        if args.count and len(accepted) >= args.count:
            break
        try:
            accepted.append(convert_plan(plan, args.metres_per_unit))
            if not args.count and len(accepted) % 1000 == 0:
                print(f'{len(accepted)} plans accepted…', flush=True)
        except (ValueError, TypeError, KeyError) as error:
            refusals.append({'id': str(plan.get('id')), 'reason': str(error)})
    if not accepted or (args.count and len(accepted) < args.count):
        parser.error(f'Only {len(accepted)} valid plans; requested {args.count}.')
    accepted.sort(key=lambda p: int(p['id']))
    args.output.mkdir(parents=True, exist_ok=True)
    entries = []
    for start in range(0, len(accepted), args.shard_size):
        filename = f'plans-{start // args.shard_size:04d}.json'
        shard = accepted[start:start + args.shard_size]
        write_json(args.output / filename, {'schemaVersion': 'br.resplan-shard/1', 'plans': shard})
        shard_digest = hashlib.sha256((args.output / filename).read_bytes()).hexdigest()
        for p in shard:
            entries.append({'id': p['id'], 'file': filename, 'sha256': shard_digest,
                            'bedrooms': sum(f['category'] == 'bedroom' for f in p['features']),
                            'rooms': sum(f['category'] in ROOMS for f in p['features']),
                            'areaM2': round(p['calibration']['sourceInnerArea'] * p['calibration']['metresPerSourceUnit'] ** 2, 6)})
    source = {'name': 'ResPlan', 'authors': 'The ResPlan Authors',
              'repository': 'https://github.com/m-agour/ResPlan', 'revision': args.revision,
              'archiveSha256': digest, 'license': 'CC BY 4.0',
              'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
              'upstreamLicenseUrl': f'https://github.com/m-agour/ResPlan/blob/{args.revision}/LICENSE',
              'modifications': 'JSON conversion; explicit area calibration; display contours simplified within 0.1 mm; original coordinates retained.'}
    write_json(args.output / 'catalog.json', {'schemaVersion': 'br.resplan-catalog/1', 'source': source,
               'releasePlanCount': len(data), 'sampleSeed': args.sample_seed if args.count else None,
               'excludedIds': sorted(excluded, key=int), 'refused': refusals, 'plans': entries})
    print(f'Converted {len(accepted)}/{len(data)} plans into {math.ceil(len(accepted) / args.shard_size)} shards; {len(refusals)} refusals. Catalog: {args.output / "catalog.json"}')


if __name__ == '__main__':
    main()
