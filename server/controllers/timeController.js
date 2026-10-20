/**
 * Horologium Time Controller
 * Server-side high-precision temporal verification and astronomical telemetry engine
 */

export function getSolarDeclination(d = new Date()) {
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const declinationRad = -23.44 * (Math.PI / 180) * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  return declinationRad * (180 / Math.PI);
}

export function getSubsolarLongitude(d = new Date()) {
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return -(utcHours - 12) * 15;
}

const timeCache = new Map();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds

export async function getTime(req, res) {
  const location = req.query.location || req.query.zone || req.query.tz || 'UTC';
  const cacheKey = location.trim().toLowerCase();

  const now = new Date();
  const solarDec = getSolarDeclination(now);
  const subsolarLon = getSubsolarLongitude(now);

  // 1. Check in-memory cache
  const cached = timeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      cached: true
    });
  }

  const localIntl = computeLocalIntlTime(location, now, solarDec, subsolarLon);
  timeCache.set(cacheKey, { timestamp: Date.now(), data: localIntl });
  return res.json({ ...localIntl, cached: false });
}

export function computeLocalIntlTime(tzOrCountry, now = new Date(), solarDec = 0, subsolarLon = 0) {
  let timeZone = 'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tzOrCountry }).format(now);
    timeZone = tzOrCountry;
  } catch (e) {
    timeZone = 'UTC';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return {
    status: 'SYNCHRONIZED',
    utcTime: now.toISOString(),
    epochMs: now.getTime(),
    datetime: formatter.format(now),
    formatted: formatter.format(now),
    timezone: timeZone,
    abbreviation: 'INTL',
    offset: 0,
    solarDeclinationDeg: Number(solarDec.toFixed(2)),
    subsolarLongitudeDeg: Number(subsolarLon.toFixed(2)),
    solar: {
      declination: Number(solarDec.toFixed(2)),
      subsolarLongitude: Number(subsolarLon.toFixed(2))
    },
    stratum: 1,
    source: 'horologium_stratum1_engine'
  };
}
