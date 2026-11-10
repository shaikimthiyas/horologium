/**
 * Horologium Enterprise Federated Search Engine
 * High-speed unified search indexing all 220 sovereign territories,
 * world capitals, IANA timezones, UTC offsets, and navigation consoles.
 */

import { COUNTRIES_DATA } from '../../src/data/countries.data.js';

// Pre-index consoles
const NAVIGATION_CONSOLES = [
  { id: 'gateway', title: 'Mission Gateway (Home)', href: '/', desc: 'Planetary world clock & dual station overlap', keywords: ['home', 'gateway', 'clock', 'overlap', 'meridian'] },
  { id: 'flight-deck', title: 'World Map (Flight Deck)', href: '/flight-deck/', desc: '3D orthographic globe & solar terminator', keywords: ['map', 'globe', 'flight deck', 'orthographic', 'terminator', 'day night', 'tourbillon'] },
  { id: 'geodesic-registry', title: 'Geodesic Directory', href: '/geodesic-registry/', desc: '220 sovereign territories & timezone search', keywords: ['directory', 'registry', 'countries', 'capitals', 'timezones', 'territories', 'search'] },
  { id: 'developers', title: 'Developer Platform', href: '/developers/', desc: 'API keys, metrics & embeddable widgets', keywords: ['developer', 'portal', 'api key', 'sdk', 'widgets', 'embed', 'token', 'quota'] },
  { id: 'api-explorer', title: 'Interactive API Explorer', href: '/api-explorer/', desc: 'OpenAPI 3.1 & Postman collection', keywords: ['api', 'docs', 'swagger', 'openapi', 'postman', 'documentation', 'endpoints'] },
  { id: 'status', title: 'System Status & SLA', href: '/status/', desc: 'Stratum-1 truechimer consensus telemetry', keywords: ['status', 'uptime', 'sla', 'probes', 'health', 'stratum', 'telemetry', 'marzullo'] },
  { id: 'protocol-liaison', title: 'Protocol Liaison', href: '/protocol-liaison/', desc: 'Inquiry & telemetry communications', keywords: ['contact', 'liaison', 'message', 'support', 'inquiry', 'transmission'] },
  { id: 'about', title: 'Colophon & Technical Specs', href: '/about/', desc: 'Shaik Imthiyas sovereign architecture', keywords: ['about', 'colophon', 'author', 'specs', 'shaik imthiyas', 'architecture'] },
  { id: 'privacy', title: 'Data Sovereignty & Privacy', href: '/privacy/', desc: 'Zero-knowledge chronometry policy', keywords: ['privacy', 'terms', 'legal', 'sovereignty', 'zero knowledge', 'gdpr', 'policy'] },
  { id: 'operator-gateway', title: 'Operator Access', href: '/operator-gateway/', desc: 'NTP telemetry clearance & auth', keywords: ['operator', 'auth', 'login', 'security', 'clearance', 'access', 'admin'] }
];

// Pre-index country and timezone catalogue
const TERRITORIES = Object.entries(COUNTRIES_DATA).map(([country, info]) => ({
  country,
  code: info.code,
  flag: info.flag,
  capital: info.capital || '',
  tz: info.tz,
  utc: info.utc,
  abbr: info.abbr || ''
}));

export function searchRegistry(req, res) {
  const rawQuery = (req.query.q || req.query.query || '').trim();
  const category = (req.query.category || 'all').toLowerCase();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  if (!rawQuery) {
    return res.json({
      query: '',
      category,
      total: 0,
      results: []
    });
  }

  const q = rawQuery.toLowerCase();
  const qOffset = q.replace(/^utc/i, '').replace(/\s+/g, ''); // e.g. "+5:30", "+05:30", "-8"
  const candidates = [];

  // 1. Territories & World Capitals
  if (category === 'all' || category === 'territories') {
    for (const item of TERRITORIES) {
      let score = 0;
      const cLower = item.country.toLowerCase();
      const capLower = item.capital.toLowerCase();
      const codeLower = item.code.toLowerCase();

      if (cLower === q || capLower === q || codeLower === q) {
        score = 100;
      } else if (cLower.startsWith(q) || capLower.startsWith(q)) {
        score = 85;
      } else if (cLower.includes(q) || capLower.includes(q) || codeLower.includes(q)) {
        score = 65;
      }

      if (score > 0) {
        candidates.push({
          id: `territory-${item.code.toLowerCase()}`,
          type: 'territory',
          title: item.country,
          subtitle: `Capital: ${item.capital || 'N/A'} • ${item.code} • ${item.utc}`,
          country: item.country,
          capital: item.capital,
          code: item.code,
          flag: item.flag,
          timezone: item.tz,
          utcOffset: item.utc,
          score,
          url: `/geodesic-registry/?query=${encodeURIComponent(item.country)}`
        });
      }
    }
  }

  // 2. IANA Timezones & UTC Offsets
  if (category === 'all' || category === 'timezones') {
    // Unique timezones set
    const seenTz = new Set();
    for (const item of TERRITORIES) {
      if (seenTz.has(item.tz)) continue;
      seenTz.add(item.tz);

      let score = 0;
      const tzLower = item.tz.toLowerCase();
      const abbrLower = item.abbr.toLowerCase();
      const utcLower = item.utc.toLowerCase();

      if (tzLower === q || abbrLower === q) {
        score = 95;
      } else if (tzLower.endsWith(`/${q}`) || tzLower.startsWith(q)) {
        score = 80;
      } else if (tzLower.includes(q) || abbrLower.includes(q)) {
        score = 60;
      } else if (qOffset && (utcLower.includes(qOffset) || utcLower.replace(/^utc/i, '').includes(qOffset))) {
        score = 75;
      }

      if (score > 0) {
        candidates.push({
          id: `tz-${item.tz.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          type: 'timezone',
          title: item.tz,
          subtitle: `${item.country} • ${item.utc} (${item.abbr})`,
          timezone: item.tz,
          flag: item.flag,
          utcOffset: item.utc,
          abbreviation: item.abbr,
          score,
          url: `/flight-deck/?tz=${encodeURIComponent(item.tz)}`
        });
      }
    }
  }

  // 3. Navigation Consoles
  if (category === 'all' || category === 'navigation') {
    for (const nav of NAVIGATION_CONSOLES) {
      let score = 0;
      const titleLower = nav.title.toLowerCase();
      const idLower = nav.id.toLowerCase();

      if (idLower === q || titleLower === q) {
        score = 95;
      } else if (titleLower.startsWith(q) || nav.keywords.some(k => k === q)) {
        score = 85;
      } else if (titleLower.includes(q) || nav.desc.toLowerCase().includes(q) || nav.keywords.some(k => k.includes(q))) {
        score = 65;
      }

      if (score > 0) {
        candidates.push({
          id: `nav-${nav.id}`,
          type: 'navigation',
          title: nav.title,
          subtitle: nav.desc,
          url: nav.href,
          score
        });
      }
    }
  }

  // Deduplicate and rank descending by score, then alphabetically
  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const results = candidates.slice(0, limit);

  return res.json({
    query: rawQuery,
    category,
    total: candidates.length,
    returned: results.length,
    results
  });
}
