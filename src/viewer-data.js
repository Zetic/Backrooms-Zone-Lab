import { buildMesh } from './mesh.js';

// CPU work can run in a module worker; WebGL receives only ready-to-upload buffers.
export function prepareViewerData(plan, options) {
  const mesh = buildMesh(plan, options), ids = new Map(plan.spaces.map((s, i) => [s.id, i + 1]));
  const vertices = new Float32Array(mesh.faces.reduce((n, face) => n + face.points.length * 12, 0));
  let offset = 0;
  for (const face of mesh.faces) {
    const id = ids.get(face.spaceId) ?? 0, pick = [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255];
    for (const position of face.points) { vertices.set([...position, ...face.normal, ...face.color, ...pick], offset); offset += 12; }
  }
  const lines = new Float32Array(mesh.lines.length * 24); offset = 0;
  for (const line of mesh.lines) for (const position of [line.a, line.b]) { lines.set([...position, 0, 0, 0, ...line.color, 0, 0, 0], offset); offset += 12; }
  return { vertices, lines };
}
