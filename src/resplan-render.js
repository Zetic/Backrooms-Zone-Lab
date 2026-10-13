import { bounds } from './geometry.js';
import { footprintPath, escapeHtml } from './render.js';

export function resplanSvg(plan, { labels = true, semantics = false, selected } = {}) {
  const visible = plan.features.filter(f => !['inner', 'land'].includes(f.category)), boxes = visible.map(f => bounds(f.footprint));
  const minX = Math.min(...boxes.map(b => b.minX)) - 1, minY = Math.min(...boxes.map(b => b.minY)) - 1;
  const maxX = Math.max(...boxes.map(b => b.maxX)) + 1, maxY = Math.max(...boxes.map(b => b.maxY)) + 1;
  const shapes = category => visible.filter(f => category.includes(f.category)).map(f => {
    const s = plan.spaces.find(s => s.id === f.id);
    return `<path class="feature ${f.category}${s ? ' room' : ''}${selected === f.id ? ' selected' : ''}"${s ? ` data-space="${escapeHtml(f.id)}" tabindex="0" role="button" aria-label="Inspect ${escapeHtml(s.label)}"` : ''} d="${footprintPath(f.footprint)}" fill-rule="evenodd"><title>${escapeHtml(s?.label ?? f.id)}${s ? ' · ' + s.usableFloor.areaM2.toFixed(1) + ' m²' : ''}</title></path>`;
  }).join('');
  const text = labels ? plan.spaces.map(s => {
    const b = bounds(s.footprint), x = s.labelAnchor[0], y = -s.labelAnchor[1];
    const font = Math.max(.12, Math.min(.28, (b.maxX - b.minX) / (s.label.length * .65)));
    return `<text x="${x}" y="${y}" font-size="${font}" class="label">${escapeHtml(s.label)}</text>`;
  }).join('') : '';
  const scale = maxX - minX > 15 ? 5 : 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="floor-map${semantics ? ' semantic' : ''}" viewBox="${minX} ${-maxY} ${maxX - minX} ${maxY - minY + 1.1}" aria-label="ResPlan source floor plan ${plan.source.planId}">
<metadata>${escapeHtml(JSON.stringify({ source: plan.source, calibration: plan.sourceRecord.calibration, input: plan.input, physicallyCompiled: false }))}</metadata>
<style>.feature{fill:#dac58e;stroke:#a9956c;stroke-width:.025}.room{cursor:pointer}.semantic .bedroom{fill:#c3cda3}.semantic .bathroom{fill:#c5d9d9}.semantic .kitchen{fill:#d7bbaa}.feature.wall{fill:#695e49;stroke:none}.feature.door,.feature.front_door{fill:#80c6a5;stroke:#476954}.feature.window{fill:#83baca;stroke:#447f96}.feature.garden{fill:#768b69}.feature.pool{fill:#83baca}.feature.parking{fill:#aaa88a}.feature.selected{fill:#f4dc77;stroke:#faedb5;stroke-width:.08}.label{fill:#534d40;text-anchor:middle;font-family:system-ui,sans-serif;pointer-events:none}.credit{fill:#aabbbd;font-family:system-ui,sans-serif;font-size:.23px}</style>
<rect x="${minX}" y="${-maxY}" width="${maxX - minX}" height="${maxY - minY + 1.1}" fill="#151f24"/>
<g transform="scale(1,-1)">${shapes(['garden', 'pool', 'parking', 'veranda', 'balcony'])}${shapes(['living', 'bedroom', 'bathroom', 'kitchen', 'storage', 'stair'])}${shapes(['wall'])}${shapes(['door', 'front_door', 'window'])}</g>${text}
<g transform="translate(${minX + .35},${-minY + .3})"><path d="M 0 0 H ${scale} M 0 -.08 V .08 M ${scale} -.08 V .08" stroke="#aabbbd" stroke-width=".035"/><text x="${scale / 2}" y="-.15" text-anchor="middle" class="credit">${scale} estimated m</text><text y=".5" class="credit">ResPlan ${plan.source.planId} · The ResPlan Authors · CC BY 4.0 · adapted geometry</text></g></svg>`;
}
