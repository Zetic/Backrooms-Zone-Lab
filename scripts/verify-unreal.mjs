// Optional integration gate against the owner's portable compiler, no Engine needed.
// npm run verify:unreal -- --core=C:/Dev/Backrooms/Source/Backrooms/Workshop
// Generates a temporary C++ harness from exchange data, then builds/runs with MSVC.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cases, shapingCases, officeCases } from './exchange.mjs';
const api = globalThis.ZoneExchange;
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const split = arg.indexOf('='); return [arg.slice(0, split), arg.slice(split + 1)]; }));
if (!args['--core']) throw new Error('Pass --core=<directory containing TemplateModel.h and the portable C++ sources>.');
const core = resolve(args['--core']), output = resolve(args['--out'] ?? fileURLToPath(new URL('../.verification/', import.meta.url)));
const vcvars = args['--vcvars'] ?? 'C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build/vcvars64.bat';
// These paths are written to a command file. Refuse shell metacharacters rather than interpolating them.
for (const path of [core, output, vcvars]) if (/["&|<>%!\r\n]/.test(path)) throw new Error('Unsupported character in build path.');
await mkdir(output, { recursive: true });
const selected = args['--templates']?.split(',');
const samples = [...cases(), ...shapingCases(), ...officeCases()].filter(c => !selected || selected.includes(c.template.id)).map(c => ({ name: c.template.id + '-' + c.setting + '-' + c.spec.seed, spec: c.spec, zone: c.template.make(c.spec) }));
if (!samples.length) throw new Error('No templates matched --templates.');
samples.push({ name: 'documented-flat', zone: JSON.parse(await readFile(new URL('../exchange/flat.zone.json', import.meta.url), 'utf8')) });
const negative = structuredClone((samples.find(s => s.name === 'house-defaults-1') ?? samples.find(s => s.name.endsWith('-defaults-1'))).zone);
negative.id = 'negative-zone'; for (const s of negative.spaces) { s.rect = s.rect.map(n => n - 200); s.floor -= 580; }
negative.start.x -= 200; negative.start.y -= 200; negative.entrances.forEach(e => e.at -= 200);
samples.push({ name: 'negative-coordinates-and-heights', zone: negative });
const string = s => JSON.stringify(s), roles = ['living', 'bedroom', 'closet', 'bath', 'kitchen', 'storage'];
const aliases = { main: 'bedroom', ensuite: 'bath', wc: 'bath', utility: 'storage', store: 'storage' };
// Optional parity additionally requires the local ZoneLabVersion 2 sources.
const parity = args['--lab-parity'] === 'true';
if (parity && !samples.some(s => s.spec && s.zone.source?.template === 'house-v2')) throw new Error('--lab-parity needs House cases; no native Office generator exists yet.');
const functions = samples.map(({ name, zone, spec }, index) => {
  const checks = api.validate(zone); if (!checks.valid) throw new Error(name + ': ' + JSON.stringify(checks.errors));
  const lines = [`bool case${index}(){`, `const char* name=${string(name)}; const std::string zone=${string(zone.id)}; Arrangement arrangement; std::vector<LayPiece> pieces; std::vector<Instance> instances; std::vector<Footprint> footprints;`];
  for (const s of zone.spaces) {
    const f = s.features ?? {}, shape = ['rect', 'L', 'T', 'U', 'ring'].indexOf(f.shape ?? 'rect');
    lines.push(`{LayPiece p; p.area=zone; p.role=${string(s.id)}; p.theme=${string(s.theme ?? zone.theme)}; p.seed=Stream(${zone.source?.seed ?? 1}u,"room/"+p.role,"seed"); p.rect=Ranch::Rect{${s.rect.join(',')}}; p.floor=${s.floor}; p.ceiling=${api.ceiling(s, zone)};`);
    if (s.kind === 'stair') {
      const run = ((s.foot === 'n' || s.foot === 's') ? s.rect[3] - s.rect[1] : s.rect[2] - s.rect[0]) - 4;
      lines.push(`p.definition="ramp"; p.params={{"rise",${s.rise}},{"run",${run}}}; p.foot='${s.foot}';`);
    } else lines.push(`p.definition="space"; p.params={{"shape",${shape}},{"columns",${f.columns ?? 0}},{"divider",${f.divider ? 1 : 0}},{"screen",${f.screen ? 1 : 0}},{"level",0},{"interior",0},{"role",${roles.indexOf(aliases[s.role] ?? s.role) + 1}}};`);
    lines.push('Instance i; Footprint f; std::string why; if(!LayOne(p,i,f,&why)){std::printf("FAIL %s lay: %s\\n",name,why.c_str());return false;} pieces.push_back(p); instances.push_back(i); footprints.push_back(f); arrangement.instances.push_back(i); }');
  }
  for (const j of zone.joins) {
    const a = zone.spaces.findIndex(s => s.id === j.a), b = zone.spaces.findIndex(s => s.id === j.b);
    lines.push(`{Link link; std::string why; if(!LayLink(pieces[${a}],instances[${a}],footprints[${a}],pieces[${b}],instances[${b}],footprints[${b}],${string(j.mode)},${j.required ?? false},link,&why)){std::printf("FAIL %s join ${j.a}/${j.b}: %s\\n",name,why.c_str());return false;} arrangement.links.push_back(link);}`);
  }
  if (parity && zone.source?.template === 'house-v2' && spec) {
    lines.push(`{ZoneLab::Spec spec;spec.kind="house";spec.seed=${spec.seed}u;spec.dials={${Object.entries(spec.dials).map(([k, v]) => `{${string(k)},${v}}`).join(',')}};const auto native=ZoneLab::Make(spec);`);
    lines.push('if(!native.zone.error.empty()||native.spaces.size()!=pieces.size()){std::printf("FAIL %s local House size/error\\n",name);return false;}');
    lines.push('for(size_t k=0;k<pieces.size();++k){const auto& p=pieces[k];const auto& n=native.spaces[k];if(n.instance!="house/"+p.role||n.rect.x0!=p.rect.x0||n.rect.y0!=p.rect.y0||n.rect.x1!=p.rect.x1||n.rect.y1!=p.rect.y1||n.floor!=p.floor||native.zone.arrangement.instances[k].ceiling!=p.ceiling){std::printf("FAIL %s local House geometry at %zu\\n",name,k);return false;}}');
    lines.push('if(connections(native.zone.arrangement.links)!=connections(arrangement.links)){std::printf("FAIL %s local House connections\\n",name);return false;}}');
  }
  lines.push(`return physical(name,arrangement,zone+${string('/' + zone.start.space)});}`);
  return lines.join('\n');
});
const source = `#include "TemplateCompose.h"
${parity ? '#include "ZoneLab.h"' : ''}
#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>
using namespace Templates;
std::vector<std::string> connections(const std::vector<Link>& links){
  std::vector<std::string> out;for(auto& l:links){auto a=l.a.instance.substr(l.a.instance.find('/')+1),b=l.b.instance.substr(l.b.instance.find('/')+1);if(b<a)std::swap(a,b);out.push_back(a+"/"+b+"/"+l.mode+"/"+std::to_string(l.width)+"/"+std::to_string(l.head)+"/"+std::to_string(l.required));}std::sort(out.begin(),out.end());return out;
}
bool physical(const char* name,Arrangement arrangement,const std::string& start){
  const Scene scene=Generate(arrangement);
  if(!scene.physical.valid()){std::printf("FAIL %s: physical invalid\\n",name);return false;}
  for(auto& d:scene.diagnostics)if(d.error){std::printf("FAIL %s: %s: %s\\n",name,d.identity.c_str(),d.message.c_str());return false;}
  if(scene.accepted.size()!=arrangement.links.size()){std::printf("FAIL %s: accepted %zu/%zu joins\\n",name,scene.accepted.size(),arrangement.links.size());return false;}
  const auto reached=Reachable(scene,start,Human);
  for(auto& i:arrangement.instances){
    if(std::find(reached.begin(),reached.end(),i.id)==reached.end()){std::printf("FAIL %s: cannot reach %s\\n",name,i.id.c_str());return false;}
    const auto back=Reachable(scene,i.id,Human);
    if(std::find(back.begin(),back.end(),start)==back.end()){std::printf("FAIL %s: no return from %s\\n",name,i.id.c_str());return false;}
  }
  std::reverse(arrangement.instances.begin(),arrangement.instances.end());std::reverse(arrangement.links.begin(),arrangement.links.end());
  if(Generate(arrangement).digest!=scene.digest){std::printf("FAIL %s: listing order changes compiled digest\\n",name);return false;}
  return true;
}
${functions.join('\n')}
int main(){
  const unsigned draws[]={Stream(1,"",""),Stream(1,"zonelab/house","seed"),Stream(1,"zonelab/level0","seed"),Stream(42,"attempt","0"),Stream(4294967295u,"room/0,0,12,10","seed"),Stream(123456789,"join/0,0,8,8/8,0,16,8","order")};
  const unsigned expected[]={937033933u,2761775253u,950527661u,2198064874u,1657424870u,25009617u};
  for(int i=0;i<6;++i)if(draws[i]!=expected[i]){std::printf("FAIL stream %d\\n",i);return 1;}
  int passed=0;
  ${samples.map((_, i) => `passed+=case${i}()?1:0;`).join('\n  ')}
  std::printf("Unreal portable exchange: %d/${samples.length} compiled, all joins accepted, Human reach/return and reversed-order digests; six stream draws match.\\n",passed);
  return passed==${samples.length}?0:1;
}
`;
const cpp = join(output, 'ZoneExchangeCheck.cpp'); await writeFile(cpp, source);
if (args['--emit-only'] === 'true') { console.log('Harness: ' + cpp); process.exit(0); }
if (process.platform !== 'win32') throw new Error('Automatic MSVC build needs Windows; --emit-only=true produces a harness for another C++20 compiler.');
const executable = join(output, 'ZoneExchangeCheck.exe'), log = join(output, 'compiler.log');
const files = ['TemplateModel', 'TemplateShape', 'TemplateRecipes', 'TemplateCompose', 'TemplateDirector', 'RanchGenerator', 'RanchGeometry', ...(parity ? ['ZoneLab', 'ZoneLabHouse', 'ZoneTest'] : [])].map(file => '"' + join(core, file + '.cpp') + '"').join(' ');
const command = join(output, 'build.cmd');
await writeFile(command, `@echo off\r\ncall "${vcvars}" >nul 2>&1\r\nif errorlevel 1 exit /b 1\r\ncl /nologo /std:c++20 /EHsc /O2 /utf-8 /bigobj /MP /I"${core}" /Fo"${output}/" /Fe"${executable}" "${cpp}" ${files} >"${log}" 2>&1\r\nexit /b %errorlevel%\r\n`);
const build = spawnSync('cmd.exe', ['/d', '/c', command], { encoding: 'utf8', timeout: 180000 });
if (build.status !== 0) {
  console.error(build.error?.message ?? build.stderr);
  const detail = await readFile(log, 'utf8').catch(() => 'Compiler setup failed.'); console.error(detail.split(/\r?\n/).filter(line => /error|fatal|warning/i.test(line)).slice(0, 30).join('\n')); process.exit(1);
}
const run = spawnSync(executable, [], { encoding: 'utf8', timeout: 180000 });
await writeFile(join(output, 'unreal-result.log'), run.stdout + run.stderr);
const report = { format: 'backrooms-zone-unreal-check', version: 1, core, total: samples.length, templates: selected ?? 'all', passed: run.status === 0, houseParity: parity, summary: run.stdout.trim(), compilerLog: log };
await writeFile(join(output, 'unreal-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(run.stdout.trim()); if (run.error || run.status !== 0) { console.error(run.error?.message ?? run.stderr); process.exitCode = 1; }
