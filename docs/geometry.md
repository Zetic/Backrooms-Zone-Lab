# Geometry foundation

Canonical boundaries consist of straight edges and circular arcs, including closed rings with holes. Arcs are not organic smoothing or polylines. SVG drawing uses native arc commands; exported data retains radius, center, start angle, and sweep.

Intersections use line-line, quadratic line-circle, and circle-circle formulae, then clip to segment/arc spans. Coincident lines/arcs distinguish shared-length overlap from isolated endpoint contact. Circle containment uses a horizontal ray split into y-monotonic arc intervals, with half-open crossing conventions at vertices and tangencies. Boundary distance uses exact projections/radial distances. Signed area integrates each edge, including circular sectors.

Clearance containment splits candidate and host boundaries at analytic intersection points, then classifies the resulting intervals. This catches small concave notches and interior holes that fixed sample points can miss. Positive-area overlap similarly classifies boundary intervals; coincident boundaries use local interior-side probes. AABB rejection is an optimization, not the authoritative curved footprint.

## Tolerance and scope

- Geometry coordinate/angle quantum: `1e-6`.
- Predicate distance tolerance: `1e-5` metres.
- Coincident-boundary overlap side probes: eight times the predicate tolerance.
- Exact circular representation does not mean arbitrary-precision arithmetic: computation uses JavaScript double precision.
- Near-degenerate geometry and distinctions at/below tolerance are not reliable architectural features. Prefer dimensions and gaps substantially greater than `0.00016 m`.
- Initial coordinates are zone-local building-scale values. Large-world coordinates and extreme radii require future numeric-range tests or a robust adaptive kernel.
- The kernel validates rings and extruded XY/Z overlaps; it is not a Boolean solid modeler, an arbitrary curved-surface kernel, or a navigation mesh generator.

The tests cover concave and rotated shapes, circles/sectors/holes, tangencies, clockwise hole seams, disconnected boundaries, self-crossings, nested/touching holes, shared-wall contact, protected voids, and deliberately damaged contract geometry.
