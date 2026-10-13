import { floorSvg } from './render.js';
export function genericSvg(plan, { labels = false, idPrefix = 'generic', ...options } = {}) {
  const style = '<style>.space-path{fill:#dac58e;stroke:#a9956c;stroke-width:.035;cursor:pointer}.space-path.public{fill:#e8d69f}.space-path.service{fill:#c9bd9a}.space-path.circulation{fill:#d1bd8f}.space-path.selected{fill:#99c5bd}.space-path.unreachable{fill:#db8181}.space-label{font:.38px system-ui,sans-serif;fill:#534d40;text-anchor:middle;pointer-events:none}.port-label{font:.32px system-ui,sans-serif;fill:#a8d2c9;text-anchor:middle}.port-line{stroke:#8bc7bf;stroke-width:.18}.wall-solid{fill:#ad996b;stroke:none}.door-floor{fill:#d1bd8f;stroke:none}.door-gap{stroke:#d1bd8f;stroke-width:.2}.local-door{stroke:#eedcaf;stroke-width:.035}</style>';
  return floorSvg(plan, 0, { labels, navigation: false, ...options })
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/(<svg[^>]*>)/, '$1' + style)
    .replaceAll('grid-0', idPrefix + '-grid').replaceAll('hatch-0', idPrefix + '-hatch');
}
