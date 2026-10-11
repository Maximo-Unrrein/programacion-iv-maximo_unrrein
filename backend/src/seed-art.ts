/** Ilustraciones SVG generadas para las publicaciones de ejemplo del seed. */

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function stars(seed: number, count: number, w: number, h: number, color = '#F5F8FF') {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const size = (r() * 1.6 + 0.4).toFixed(2);
    return `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${size}" fill="${color}" opacity="${(r() * 0.7 + 0.2).toFixed(2)}"/>`;
  }).join('');
}

const W = 1000;
const H = 1250;

export const ARTWORKS: Record<string, string> = {
  horizon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070F"/><stop offset="0.7" stop-color="#0B1020"/><stop offset="1" stop-color="#16244A"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="1" r="0.75"><stop offset="0" stop-color="#397BFF" stop-opacity="0.65"/><stop offset="1" stop-color="#397BFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="planet" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#1B2A55"/><stop offset="0.35" stop-color="#0B1020"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars(7, 220, W, H * 0.75)}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <ellipse cx="500" cy="2050" rx="1500" ry="1100" fill="url(#planet)" stroke="#8BAFFF" stroke-width="5"/>
  <ellipse cx="500" cy="2050" rx="1500" ry="1100" fill="none" stroke="#397BFF" stroke-width="40" opacity="0.25"/>
  <circle cx="760" cy="300" r="70" fill="#8BAFFF" opacity="0.9"/><circle cx="740" cy="285" r="70" fill="#0B1020"/>
</svg>`,

  nebula: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="a" cx="0.3" cy="0.35" r="0.55"><stop offset="0" stop-color="#8BAFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#8BAFFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0.7" cy="0.6" r="0.6"><stop offset="0" stop-color="#397BFF" stop-opacity="0.9"/><stop offset="1" stop-color="#397BFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="c" cx="0.45" cy="0.8" r="0.5"><stop offset="0" stop-color="#7A5CFF" stop-opacity="0.6"/><stop offset="1" stop-color="#7A5CFF" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#070A15"/>
  <g filter="url(#blur)"><rect width="${W}" height="${H}" fill="url(#c)"/><rect width="${W}" height="${H}" fill="url(#b)"/><rect width="${W}" height="${H}" fill="url(#a)"/></g>
  ${stars(42, 260, W, H)}
  <circle cx="520" cy="560" r="5" fill="#fff"/><circle cx="520" cy="560" r="22" fill="#fff" opacity="0.15"/>
</svg>`,

  grid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1020"/><stop offset="0.55" stop-color="#121C38"/><stop offset="0.56" stop-color="#05070F"/><stop offset="1" stop-color="#0B1020"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8BAFFF"/><stop offset="1" stop-color="#397BFF"/></linearGradient>
    <clipPath id="half"><rect width="${W}" height="690"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars(99, 120, W, 600)}
  <g clip-path="url(#half)"><circle cx="500" cy="690" r="260" fill="url(#sun)"/>
  ${[610, 635, 655, 672].map((y, i) => `<rect x="200" y="${y}" width="600" height="${4 + i * 3}" fill="#121C38"/>`).join('')}</g>
  <g stroke="#397BFF" stroke-width="2" opacity="0.8">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="500" y1="690" x2="${-700 + i * 200}" y2="${H}"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => {
      const y = 690 + Math.pow(i + 1, 1.9) * 9;
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`;
    }).join('')}
  </g>
</svg>`,

  orbit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="core" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8BAFFF"/><stop offset="0.6" stop-color="#397BFF"/><stop offset="1" stop-color="#2A5FD6"/></radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#397BFF" stop-opacity="0.5"/><stop offset="1" stop-color="#397BFF" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0B1020"/>
  ${stars(5, 180, W, H)}
  <circle cx="500" cy="625" r="330" fill="url(#halo)"/>
  <g fill="none" stroke="#8BAFFF" transform="rotate(-18 500 625)">
    <ellipse cx="500" cy="625" rx="420" ry="140" opacity="0.5" stroke-width="2"/>
    <ellipse cx="500" cy="625" rx="320" ry="100" opacity="0.35" stroke-width="2" stroke-dasharray="6 14"/>
    <ellipse cx="500" cy="625" rx="230" ry="70" opacity="0.6" stroke-width="3"/>
    <circle cx="920" cy="625" r="12" fill="#F5F8FF" stroke="none"/>
    <circle cx="270" cy="625" r="8" fill="#8BAFFF" stroke="none"/>
  </g>
  <circle cx="500" cy="625" r="120" fill="url(#core)"/>
</svg>`,
};
