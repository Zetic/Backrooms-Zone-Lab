import test from 'node:test';
import assert from 'node:assert/strict';
import { EPS, line, arc, circle, rectangle, polygon, transform, signedArea, validateFootprint, contains, ringContains, intersections, edgeDistance, bounds, interiorsOverlap, footprintSubset } from '../src/geometry.js';

const near = (a, b, tolerance = EPS) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);
test('rotated irregular and concave polygons remain valid', () => {
  const f = polygon([[0, 0], [8, 0], [8, 2], [3, 2], [3, 6], [0, 6]]);
  for (const angle of [0, 13.12345, 37, 90, 179.9, 270, -23]) {
    const moved = transform(f, [-7.12345, 3.2], angle);
    assert.deepEqual(validateFootprint(moved), []);
    near(signedArea(moved.outer), 28, 2e-5);
  }
  assert.equal(contains(f, [1, 4]), 'inside');
  assert.equal(contains(f, [5, 4]), 'outside');
  assert.equal(contains(f, [3, 4]), 'boundary');
});
test('circle and semicircle areas use exact arcs', () => {
  const c = circle(3);
  assert.deepEqual(validateFootprint(c), []);
  near(signedArea(c.outer), Math.PI * 9);
  const semi = { outer: [line([-3, 0], [3, 0]), arc([0, 0], 3, 0, 180)], holes: [] };
  assert.deepEqual(validateFootprint(semi), []);
  near(signedArea(semi.outer), Math.PI * 9 / 2);
  assert.equal(contains(semi, [0, 1]), 'inside');
  assert.equal(contains(semi, [0, -1]), 'outside');
});
test('circle containment agrees with analytic radius across rotated seams and tangencies', () => {
  for (const angle of [0, 23, 90, 137, -65]) {
    const f = transform(circle(2.3), [4, 3], angle);
    for (let x = -3; x <= 3; x += .2) for (let y = -3; y <= 3; y += .2) {
      const d = Math.hypot(x, y), result = contains(f, [x + 4, y + 3]);
      assert.equal(result, Math.abs(d - 2.3) <= EPS ? 'boundary' : d < 2.3 ? 'inside' : 'outside', `${angle}: ${x},${y}`);
    }
  }
});
test('clockwise holes exclude their interiors and preserve annulus area', () => {
  const f = { outer: circle(5).outer, holes: [[arc([0, 0], 2, 0, -180), arc([0, 0], 2, -180, -180)]] };
  assert.deepEqual(validateFootprint(f), []);
  near(signedArea(f.outer) + signedArea(f.holes[0]), Math.PI * 21);
  for (const p of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) assert.equal(contains(f, p), 'outside');
  assert.equal(contains(f, [3, 0]), 'inside');
  assert.equal(contains(f, [2, 0]), 'boundary');
});
test('line-line crossing, endpoint contact, and collinear overlap', () => {
  assert.deepEqual(intersections(line([0, 0], [2, 2]), line([0, 2], [2, 0])).points, [[1, 1]]);
  assert.equal(intersections(line([0, 0], [2, 0]), line([2, 0], [3, 0])).overlap, false);
  assert.equal(intersections(line([0, 0], [2, 0]), line([1, 0], [3, 0])).overlap, true);
  assert.deepEqual(intersections(line([0, 0], [2, 0]), line([0, 1], [2, 1])).points, []);
});
test('line-arc intersections include tangencies and clip to arc span', () => {
  const upper = arc([0, 0], 2, 0, 180);
  assert.equal(intersections(line([-3, 0], [3, 0]), upper).points.length, 2);
  assert.equal(intersections(line([-3, 2], [3, 2]), upper).points.length, 1);
  assert.equal(intersections(line([-3, -1], [3, -1]), upper).points.length, 0);
  assert.equal(intersections(line([-3, 2.001], [3, 2.001]), upper).points.length, 0);
});
test('arc-arc intersections distinguish tangency, disjointness, and coincident span', () => {
  const a = arc([0, 0], 2, 0, 180);
  assert.equal(intersections(a, arc([2, 0], 2, 0, 180)).points.length, 1);
  assert.equal(intersections(a, arc([4, 0], 2, 0, 180)).points.length, 1);
  assert.equal(intersections(a, arc([5, 0], 2, 0, 180)).points.length, 0);
  assert.equal(intersections(a, arc([0, 0], 2, 90, 90)).overlap, true);
  assert.equal(intersections(a, arc([0, 0], 2, 180, 180)).overlap, false);
});
test('bounds include arc extrema and boundary distances are analytic', () => {
  assert.deepEqual(bounds(circle(3)), { minX: -3, maxX: 3, minY: -3, maxY: 3 });
  near(edgeDistance(arc([0, 0], 2, 0, 180), [0, 3]), 1);
  near(edgeDistance(arc([0, 0], 2, 0, 180), [0, -3]), Math.sqrt(13));
});
test('invalid winding, crossings, disconnected, degenerate, and nested holes fail', () => {
  const cases = [
    polygon([[0, 0], [0, 4], [4, 4], [4, 0]]),
    polygon([[0, 0], [4, 4], [0, 4], [4, 0]]),
    { outer: [line([0, 0], [2, 0]), line([3, 0], [0, 0])], holes: [] },
    { outer: [line([0, 0], [0, 0]), line([0, 0], [1, 0])], holes: [] },
    { outer: [arc([0, 0], 3, 0, 360)], holes: [] },
    { outer: circle(5).outer, holes: [transform(circle(1), [10, 0], 0).outer] },
    { outer: rectangle(4, 4).outer, holes: [polygon([[0, 1], [0, 2], [1, 2], [1, 1]]).outer] },
    { outer: circle(5).outer, holes: [[arc([0, 0], 3, 0, -180), arc([0, 0], 3, -180, -180)], [arc([0, 0], 1, 0, -180), arc([0, 0], 1, -180, -180)]] }
  ];
  cases.forEach(f => assert.ok(validateFootprint(f).length > 0));
});
test('positive-area overlap permits shared walls and tangencies', () => {
  const a = rectangle(4, 4);
  assert.equal(interiorsOverlap(a, transform(a, [4, 0], 0)), false);
  assert.equal(interiorsOverlap(a, transform(a, [3.99, 0], 0)), true);
  assert.equal(interiorsOverlap(a, transform(a, [1, 1], 23)), true);
  assert.equal(interiorsOverlap(circle(2), transform(circle(2), [4, 0], 0)), false);
  assert.equal(interiorsOverlap(circle(2), transform(circle(2), [3.9, 0], 0)), true);
  assert.equal(interiorsOverlap(circle(2), circle(2)), true);
  const annulus = { outer: circle(5).outer, holes: [[arc([0, 0], 2, 0, -180), arc([0, 0], 2, -180, -180)]] };
  assert.equal(interiorsOverlap(annulus, circle(2)), false);
  assert.equal(interiorsOverlap(annulus, circle(2.1)), true);
});
test('footprint subset catches narrow notches, holes, curved edges, and coincident boundaries', () => {
  assert.equal(footprintSubset(rectangle(5, 5), rectangle(5, 5)), true);
  assert.equal(footprintSubset(rectangle(5, 5), transform(rectangle(2, 2), [1, 1], 10)), true);
  assert.equal(footprintSubset(circle(5), rectangle(6, 6)), false);
  const notched = polygon([[0, 0], [10, 0], [10, 10], [3.61, 10], [3.61, 1], [3.6, 1], [3.6, 10], [0, 10]]);
  assert.equal(footprintSubset(notched, transform(rectangle(8, 2), [1, 1], 0)), false);
  const holed = { outer: rectangle(10, 10).outer, holes: [polygon([[3, 3], [3, 4], [4, 4], [4, 3]]).outer] };
  assert.equal(footprintSubset(holed, transform(rectangle(5, 5), [2, 2], 0)), false);
});
test('arc self intersections are rejected without polygon approximation', () => {
  const f = { outer: [arc([0, 0], 2, 0, 180), line([-2, 0], [2, 1]), line([2, 1], [2, 0])], holes: [] };
  assert.ok(validateFootprint(f).some(e => e.includes('self-intersect')));
});
