import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generatorArchive } from '../src/source-archive.js';
import { generateGenericDesign } from '../src/generic.js';
import { canonicalExport } from '../src/zone.js';
test('downloaded generator ZIP includes its transitive source and reproduces the accepted layout without packages', async () => {
  const spec = { seed: 7, dials: { rooms: 0 } }, archive = await generatorArchive(spec, async url => ({ ok: true, text: () => readFile(url, 'utf8') }));
  const bytes = new Uint8Array(await archive.arrayBuffer()), view = new DataView(bytes.buffer), decoder = new TextDecoder(), directory = await mkdtemp(join(tmpdir(), 'generic-replay-')); let offset = 0, count = 0;
  try {
    while (view.getUint32(offset, true) === 0x04034b50) {
      const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true), name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength)), start = offset + 30 + nameLength + extraLength;
      assert.ok(!name.startsWith('/') && !name.includes('..'));
      const file = join(directory, name); await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes.slice(start, start + size)); ++count; offset = start + size;
    }
    assert.ok(count > 10); assert.equal(view.getUint32(offset, true), 0x02014b50);
    await promisify(execFile)(process.execPath, ['regenerate.mjs'], { cwd: directory, timeout: 60000 });
    const regenerated = await readFile(join(directory, 'layout.zone.json'), 'utf8');
    assert.equal(regenerated, canonicalExport(generateGenericDesign(spec)));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
