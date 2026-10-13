// Portable zone-template method. Rule reports are diagnostics, never canonical zone fields.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const templateKey = t => t.id + '-v' + (t.version ?? 1);
  function rule(id, name, kept, detail = '', relaxations = [], dials = {}) {
    const permits = relaxations.filter(r => (dials[r.dial] ?? 0) >= r.at);
    return { id, name, kept: Boolean(kept), detail: kept ? '' : detail,
      relaxed: permits.length > 0, relaxedBy: permits.map(r => r.name + ' ' + r.at).join(' or ') };
  }
  function ruleReport(t, zone, recordedDials) {
    // Fixed/edited imports are evaluated as they stand, with their recorded dial policy.
    const dials = Object.fromEntries(t.dials.map(d => [d.id, recordedDials?.[d.id] ?? zone.source?.dials?.[d.id] ?? d.value]));
    const rules = t.rules ? t.rules(zone, dials) : [];
    return { template: templateKey(t), rules, kept: rules.filter(r => r.kept).length,
      valid: rules.every(r => r.kept || r.relaxed), broken: rules.filter(r => !r.kept) };
  }
  function generateTemplate(t, spec, build, physicalCheck = api.validate) {
    const input = api.inputs(t, spec); if (input.error) return input;
    const seed = api.stream(input.seed, 'zonelab/' + t.id, 'seed'), failures = [];
    const limit = t.attempts ?? 4;
    if (!Number.isInteger(limit) || limit < 1 || limit > 64) return { error: 'Template attempts must be bounded at 1–64.' };
    const workLimit = t.workLimit ?? 20000;
    if (!Number.isInteger(workLimit) || workLimit < 1 || workLimit > 1000000) return { error: 'Template work limit must be a whole number at 1–1000000.' };
    for (let attempt = 0; attempt < limit; ++attempt) {
      const s = api.stream(seed, 'attempt', String(attempt));
      let work = 0;
      const context = { ...input, attempt,
        pick: (name, lo, hi) => hi <= lo ? lo : lo + api.stream(s, t.id, name) % (hi - lo + 1),
        chance: (name, percent) => api.stream(s, t.id, name) % 100 < percent,
        step(n = 1) { if (!Number.isInteger(n) || n < 1) throw new Error('Work steps must be positive whole numbers.'); work += n; if (work > workLimit) throw new Error('Template work bound exceeded.'); } };
      try {
        const zone = build(context);
        if (zone?.error) throw new Error(zone.error);
        const checks = physicalCheck(zone);
        if (!checks.valid) throw new Error(checks.errors.map(e => e.message).join('; '));
        const report = ruleReport(t, zone, input.dials);
        if (!report.valid) throw new Error(report.rules.filter(r => !r.kept && !r.relaxed).map(r => r.name + ': ' + r.detail).join('; '));
        return zone;
      } catch (error) { failures.push('attempt ' + attempt + ': ' + error.message); }
    }
    return { error: t.name + ': no attempt accepted. ' + failures.join(' | '), attempts: limit };
  }
  function exportTemplate(t) {
    const metadata = JSON.stringify(Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v !== 'function')), null, 2);
    const methods = Object.entries(t).filter(([, v]) => typeof v === 'function').map(([key, fn]) => {
      const source = fn.toString(), expression = !source.startsWith('function') && /^[a-zA-Z_$][\w$]*\s*\(/.test(source) ? 'function ' + source : source;
      return JSON.stringify(key) + ': ' + expression;
    });
    return '// Portable template. Load stream.js, checks.js and method.js first.\n(function () {\n  \'use strict\';\n  const api = globalThis.ZoneExchange;\n  const ' + t.id + ' = ' + metadata.slice(0, -1) + ',\n' + methods.join(',\n') + '\n};\n  api.templates.push(' + t.id + ');\n}());\n';
  }
  Object.assign(api, { templateKey, rule, ruleReport, generateTemplate, exportTemplate });
}());
