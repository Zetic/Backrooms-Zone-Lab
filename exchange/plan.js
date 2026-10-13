// Plan drawing consumes the exchange file. It never adds physical architecture.
(function () {
  'use strict';
  const api = globalThis.ZoneExchange;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function plan(zone, floor, options = {}) {
    const prefix = escape(options.idPrefix ?? '');
    const facts = api.facts(zone), [x0, y0, x1, y1] = facts.bounds, u = 20, pad = 70;
    const checks = options.checks ?? api.validate(zone), bad = new Set(checks.errors.flatMap(e => [e.space, ...(e.spaces ?? [])]));
    const badJoins = new Set(checks.errors.map(e => e.join));
    const x = value => value * u, y = value => -value * u;
    const line = (ax, ay, bx, by, attrs) => `<line x1="${x(ax)}" y1="${y(ay)}" x2="${x(bx)}" y2="${y(by)}" ${attrs}/>`;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(zone.name)} plan at ${floor} centimetres" viewBox="${x(x0) - pad} ${y(y1) - pad} ${x(x1 - x0) + 2 * pad} ${x(y1 - y0) + 2 * pad}">`,
      `<style>text{font-family:system-ui,sans-serif;fill:#e8edf5}.space{stroke:#8194a7;stroke-width:2}.room{fill:#384658}.hall{fill:#2c6063}.stair{fill:#655a38}.bad{stroke:#ff8177;stroke-width:6}.title{font-size:13px;text-anchor:middle}.minor{font-size:10px;fill:#bdcbd9}.context{stroke:#697787;stroke-dasharray:8 5;stroke-width:2}</style>`,
      `<defs><pattern id="${prefix}void" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10L10 0" stroke="#45505f" stroke-width="1"/></pattern><marker id="${prefix}arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#eacb80"/></marker></defs>`,
      `<rect x="${x(x0) - pad}" y="${y(y1) - pad}" width="${x(x1 - x0) + 2 * pad}" height="${x(y1 - y0) + 2 * pad}" fill="#19222e"/>`
    ];
    for (const s of zone.spaces) {
      const stair = s.kind === 'stair', atFoot = s.floor === floor, atHead = stair && s.floor + s.rise === floor;
      const tall = !stair && s.floor < floor && s.floor + api.ceiling(s, zone) > floor;
      if (!atFoot && !atHead && !tall) continue;
      const r = s.rect, cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
      const context = atHead || tall, cls = context ? 'context' : 'space ' + s.kind;
      parts.push(`<g data-space="${escape(s.id)}" tabindex="0"><title>${escape(s.title)} · ${escape(s.id)} · ${(r[2] - r[0]) / 2} × ${(r[3] - r[1]) / 2} m · floor ${s.floor} cm${context ? ' · void above lower support' : ''}</title><rect class="${cls}${bad.has(s.id) ? ' bad' : ''}" ${context ? `fill="url(#${prefix}void)"` : ''} x="${x(r[0])}" y="${y(r[3])}" width="${x(r[2] - r[0])}" height="${x(r[3] - r[1])}"/>`);
      if (s.outline && checks.valid) {
        let from = s.outline[0], path = `M${x(from[0])} ${y(from[1])}`;
        for (const node of s.outline.slice(1)) {
          if (Array.isArray(node)) { path += `L${x(node[0])} ${y(node[1])}`; from = node; }
          else { const arc = api.outlineArc(from, node); path += `A${x(arc.radius)} ${x(arc.radius)} 0 0 ${arc.sweep > 0 ? 0 : 1} ${x(node.to[0])} ${y(node.to[1])}`; from = node.to; }
        }
        parts.push(`<path class="design-outline" d="${path}Z" fill="none" stroke="#e6c78d" stroke-width="3" stroke-dasharray="7 4"><title>Preserved design outline; rectangular allocation is the current Unreal realization.</title></path>`);
      }
      if (stair) {
        const horizontal = s.foot === 'e' || s.foot === 'w', sign = s.foot === 's' || s.foot === 'w' ? 1 : -1;
        const lo = horizontal ? r[0] + 2 : r[1] + 2, hi = horizontal ? r[2] - 2 : r[3] - 2;
        for (let tick = lo; tick <= hi; tick += 1) parts.push(horizontal ? line(tick, r[1] + 0.3, tick, r[3] - 0.3, 'stroke="#a99562"') : line(r[0] + 0.3, tick, r[2] - 0.3, tick, 'stroke="#a99562"'));
        parts.push(horizontal ? line(sign > 0 ? lo : hi, cy, sign > 0 ? hi : lo, cy, `stroke="#eacb80" stroke-width="3" marker-end="url(#${prefix}arrow)"`) : line(cx, sign > 0 ? lo : hi, cx, sign > 0 ? hi : lo, `stroke="#eacb80" stroke-width="3" marker-end="url(#${prefix}arrow)"`));
      }
      const title = context ? (stair ? 'Stairwell' : 'Void over ' + s.title) : s.title;
      const available = x(r[2] - r[0]) - 8, limit = Math.max(5, Math.floor(available / 7)), rows = [];
      for (const word of title.split(/\s+/)) {
        if (rows.length && (rows[rows.length - 1] + ' ' + word).length <= limit) rows[rows.length - 1] += ' ' + word;
        else rows.push(word);
      }
      const fitText = text => text.length * 7 > available ? ` textLength="${available}" lengthAdjust="spacingAndGlyphs"` : '';
      const shown = rows.slice(0, 3);
      for (let row = 0; row < shown.length; ++row) parts.push(`<text class="title" x="${x(cx)}" y="${y(cy) - 10 - (shown.length - 1 - row) * 14}"${fitText(shown[row])}>${escape(shown[row])}</text>`);
      const dimension = context ? 'no floor here' : ((r[2] - r[0]) / 2 + ' × ' + (r[3] - r[1]) / 2 + ' m');
      parts.push(`<text class="title minor" x="${x(cx)}" y="${y(cy) + 8}"${fitText(dimension)}>${dimension}</text></g>`);
    }
    const colors = { door: '#f1c985', wide: '#a1d0e8', open: '#a7e4bc', climb: '#d6a2ed', drop: '#ff977f', view: '#a5aab3' };
    for (const l of checks.links) {
      if (l.fa !== floor && l.fb !== floor) continue;
      const j = zone.joins[l.index], at = j.at ?? (l.wall.low + l.wall.high) / 2;
      const half = l.mode === 'open' ? (l.wall.high - l.wall.low) / 2 : l.width / 100;
      const lo = l.mode === 'open' ? l.wall.low : Math.max(l.wall.low, Math.min(l.wall.high - 2 * half, at - half)), hi = l.mode === 'open' ? l.wall.high : lo + 2 * half;
      const attrs = `stroke="${badJoins.has(l.index) ? '#ff8177' : colors[l.mode]}" stroke-width="${badJoins.has(l.index) ? 10 : 7}"${l.mode === 'view' ? ' stroke-dasharray="4 4"' : ''}`;
      parts.push(`<g data-join="${l.index}"><title>${escape(l.a)} ↔ ${escape(l.b)}: ${l.mode}${l.mode === 'drop' ? ' downward only' : ''}${j.required ? ' · required' : ' · optional'}; position is a compiler hint</title>`);
      parts.push(l.wall.axis === 'x' ? line(lo, l.wall.plane, hi, l.wall.plane, attrs) : line(l.wall.plane, lo, l.wall.plane, hi, attrs));
      const cx = l.wall.axis === 'x' ? (lo + hi) / 2 : l.wall.plane, cy = l.wall.axis === 'x' ? l.wall.plane : (lo + hi) / 2;
      parts.push(`<text class="minor" x="${x(cx) + 5}" y="${y(cy) - 7}">${l.mode}</text></g>`);
    }
    for (const e of zone.entrances ?? []) {
      const s = zone.spaces.find(s => s.id === e.space);
      if (s.floor !== floor) continue;
      const ex = e.side === 'e' ? s.rect[2] : e.side === 'w' ? s.rect[0] : e.at, ey = e.side === 'n' ? s.rect[3] : e.side === 's' ? s.rect[1] : e.at;
      parts.push(`<g><title>${escape(e.title)} · uncut entrance opportunity</title><circle cx="${x(ex)}" cy="${y(ey)}" r="9" fill="#19222e" stroke="#eacb80" stroke-width="3"/><text class="minor" x="${x(ex) + 12}" y="${y(ey) - 12}">${escape(e.title)}</text></g>`);
    }
    const start = zone.spaces.find(s => s.id === zone.start.space);
    if (start.floor === floor) parts.push(`<circle cx="${x(zone.start.x)}" cy="${y(zone.start.y)}" r="7" fill="#eaf3ff"/><text class="minor" x="${x(zone.start.x) + 11}" y="${y(zone.start.y) + 17}">start</text>`);
    parts.push(`<text x="${x(x0)}" y="${y(y1) - 30}" font-size="17">${escape(zone.name)} · floor ${(floor / 100).toFixed(1)} m</text>`);
    parts.push(line(x0, y0 - 1.5, x0 + 10, y0 - 1.5, 'stroke="#e8edf5" stroke-width="4"'));
    parts.push(`<text class="minor" x="${x(x0)}" y="${y(y0) + 48}">5 m · +Y north · rectangles include wall allocation</text></svg>`);
    return parts.join('');
  }
  function galleryPlan(title, dials, samples, floor) {
    const settings = JSON.stringify(dials), longSettings = settings.length > 150, lines = [];
    if (longSettings) { let line = ''; for (const [key, value] of Object.entries(dials)) { const item = key + ': ' + value; if (line && (line + ' · ' + item).length > 170) { lines.push(line); line = item; } else line += (line ? ' · ' : '') + item; } if (line) lines.push(line); }
    const top = 60 + lines.length * 16, height = top + 1080;
    const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="' + height + '" viewBox="0 0 1440 ' + height + '"><rect width="1440" height="' + height + '" fill="#19222e"/>', '<text x="20" y="28" fill="#e8edf5" font-family="sans-serif" font-size="18">' + escape(longSettings ? title : title + ' · ' + settings) + '</text>'];
    lines.forEach((line, i) => parts.push('<text x="20" y="' + (48 + i * 16) + '" fill="#afbecf" font-family="sans-serif" font-size="12">' + escape(line) + '</text>'));
    samples.forEach((s, i) => {
      const x = i % 3 * 480, y = top + Math.floor(i / 3) * 360;
      if (s.error) { parts.push('<text x="' + (x + 15) + '" y="' + (y + 30) + '" fill="#ff9b91">Seed ' + s.seed + ' refused</text>'); return; }
      const floors = api.facts(s.zone).floors, shownFloor = floors.includes(floor) ? floor : floors[0];
      parts.push('<text x="' + (x + 15) + '" y="' + (y + 20) + '" fill="#e8edf5" font-family="sans-serif">Seed ' + s.seed + ' · ' + s.report.kept + '/' + s.report.rules.length + ' rules kept</text>');
      parts.push(plan(s.zone, shownFloor, { idPrefix: 'export-' + s.seed + '-' }).replace('<svg ', '<svg x="' + x + '" y="' + (y + 30) + '" width="480" height="320" '));
    });
    parts.push('</svg>'); return parts.join('');
  }
  Object.assign(api, { plan, escape, galleryPlan });
}());
