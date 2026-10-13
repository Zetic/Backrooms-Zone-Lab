// Dependency-free stored ZIP. Generator archives contain the actual local modules,
// a Node entry point, package metadata and the exact accepted input.
export function storedZip(files) {
  const encoder = new TextEncoder(), chunks = [], directory = []; let offset = 0;
  const header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
  const crc32 = bytes => { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; ++i) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(content), crc = crc32(data), local = header(30, 0x04034b50), lv = new DataView(local.buffer);
    lv.setUint16(4, 20, true); lv.setUint16(6, 0x800, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true);
    chunks.push(local, name, data);
    const central = header(46, 0x02014b50), cv = new DataView(central.buffer);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    directory.push(central, name); offset += local.length + name.length + data.length;
  }
  const length = directory.reduce((n, b) => n + b.length, 0), end = header(22, 0x06054b50), ev = new DataView(end.buffer), count = Object.keys(files).length;
  ev.setUint16(8, count, true); ev.setUint16(10, count, true); ev.setUint32(12, length, true); ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}

export async function generatorArchive(spec, fetchFile = fetch) {
  const root = new URL('../', import.meta.url), files = { 'package.json': '{"type":"module","engines":{"node":">=22"}}\n', 'input.json': JSON.stringify(spec, null, 2) + '\n',
    'regenerate.mjs': "import {readFile,writeFile} from 'node:fs/promises';\nimport {generateGenericDesign} from './src/generic.js';\nimport {canonicalExport} from './src/zone.js';\nconst spec=JSON.parse(await readFile(new URL('./input.json',import.meta.url),'utf8'));\nawait writeFile(new URL('./layout.zone.json',import.meta.url),canonicalExport(generateGenericDesign(spec)));\n",
    'README.txt': 'Versioned Generic generator and full geometry dependencies. Run node regenerate.mjs with Node 22 or newer to reproduce layout.zone.json from input.json. No installation or external packages are needed.\n' };
  const queue = ['src/generic.js', 'src/zone.js'];
  while (queue.length) {
    const path = queue.shift(); if (Object.hasOwn(files, path)) continue;
    const url = new URL(path, root), response = await fetchFile(url);
    if (!response.ok) throw new Error('Could not load generator source: ' + path);
    const code = await response.text(); files[path] = code;
    for (const match of code.matchAll(/^import\s+(?:[^'"\n]*?from\s*)?['"]([^'"]+)['"]/gm)) {
      const dependency = new URL(match[1], url);
      if (!dependency.href.startsWith(root.href)) throw new Error('Generator source dependency is outside this project.');
      queue.push(dependency.href.slice(root.href.length));
    }
  }
  return storedZip(files);
}
