import { cp, mkdir, rm } from 'node:fs/promises';
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['index.html', 'generic.html', 'resplan.html', 'gallery.html', 'office.html', 'styles.css', 'src', 'exchange', 'docs', 'data']) await cp(new URL(`../${path}`, import.meta.url), new URL(path, output), { recursive: true });
console.log('Static workbench built to dist/ (no external runtime dependencies).');
