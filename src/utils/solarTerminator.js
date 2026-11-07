/**
 * Horologium Solar Terminator & Astronomical Cartography Engine
 * Pure mathematical algorithms for multi-band twilight, solar analemma, 
 * subsolar zenith beacon, great-circle geodesic paths, and solar elevation.
 */

// Earth orbital constants
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;
const FIBER_SPEED_KM_S = 200000; // Speed of light in optical fiber (~200,000 km/s)
const FIBER_INDEX = 1.35; // Routing & refraction overhead

/**
 * Calculate Solar Declination angle (delta) in degrees for a given date
 * Standard astronomical approximation formula:
 * delta = -23.44° * cos(360°/365 * (dayOfYear + 10))
 */
export function getSolarDeclination(date) {
  const d = date || new Date();
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const declinationRad = -23.44 * DEG_TO_RAD * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  return declinationRad * RAD_TO_DEG;
}

export const calculateSolarDeclination = getSolarDeclination;

/**
 * Calculate subsolar longitude in degrees based on UTC time
 * At 12:00:00 UTC, Sun is at Prime Meridian (0°)
 */
export function getSubsolarLongitude(date) {
  const d = date || new Date();
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return -(utcHours - 12) * 15;
}

/**
 * Calculate Equation of Time (EoT) in minutes
 * Difference between apparent solar time and mean solar time throughout the year
 */
export function getEquationOfTime(date) {
  const d = date || new Date();
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const B = (2 * Math.PI / 365) * (dayOfYear - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Calculate instant solar altitude angle (alpha) in degrees for any latitude/longitude
 * sin(alpha) = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(lon - subsolarLon)
 */
export function calculateSolarAltitude(lat, lon, date) {
  const d = date || new Date();
  const decRad = getSolarDeclination(d) * DEG_TO_RAD;
  const subsolarLon = getSubsolarLongitude(d);
  
  const latRad = lat * DEG_TO_RAD;
  const deltaLonRad = (lon - subsolarLon) * DEG_TO_RAD;

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
                 Math.cos(latRad) * Math.cos(decRad) * Math.cos(deltaLonRad);
  
  const clampedSin = Math.max(-1, Math.min(1, sinAlt));
  return Math.asin(clampedSin) * RAD_TO_DEG;
}

/**
 * Classify astronomical solar illumination state based on solar altitude angle
 */
export function classifySolarState(altitudeDeg) {
  if (altitudeDeg > 0) {
    return {
      state: 'daylight',
      label: `☀ Daylight (+${altitudeDeg.toFixed(1)}° Alt)`,
      badge: '☀ DAY',
      color: 'var(--status-nominal)'
    };
  }
  if (altitudeDeg >= -6) {
    return {
      state: 'civil_twilight',
      label: `◐ Civil Twilight (${altitudeDeg.toFixed(1)}° Alt)`,
      badge: '◐ CIVIL',
      color: '#F59E0B'
    };
  }
  if (altitudeDeg >= -12) {
    return {
      state: 'nautical_twilight',
      label: `◐ Nautical Twilight (${altitudeDeg.toFixed(1)}° Alt)`,
      badge: '◐ NAUT',
      color: '#3B82F6'
    };
  }
  return {
    state: 'night',
    label: `☾ Astronomical Night (${altitudeDeg.toFixed(1)}° Alt)`,
    badge: '☾ NIGHT',
    color: '#818CF8'
  };
}

/**
 * Convert pixel coordinates on SVG viewBox to Geographic Lat/Lon
 */
export function svgPointToGeographic(svgX, svgY, width = 2000, height = 857) {
  const lon = -180 + (svgX / width) * 360;
  const lat = 90 - (svgY / height) * 180;
  return { lat, lon };
}

/**
 * Convert Geographic Lat/Lon to pixel coordinates on SVG viewBox
 */
export function geographicToSvgPoint(lat, lon, width = 2000, height = 857) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

/**
 * Estimate UTC timezone offset hours from longitude (-180 to +180)
 */
export function longitudeToUtcOffset(lon) {
  return Math.round(lon / 15);
}

/**
 * Calculate Local Solar Time (LST) for a given longitude and UTC time
 * Solar noon occurs when the Sun is directly overhead at that meridian
 */
export function calculateLocalSolarTime(lon, date) {
  const d = date || new Date();
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const eotHours = getEquationOfTime(d) / 60;
  let lstHours = utcHours + (lon / 15) + eotHours;
  while (lstHours < 0) lstHours += 24;
  while (lstHours >= 24) lstHours -= 24;

  const hours = Math.floor(lstHours);
  const minutes = Math.floor((lstHours - hours) * 60);
  const seconds = Math.floor(((lstHours - hours) * 60 - minutes) * 60);
  return {
    hours,
    minutes,
    seconds,
    formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  };
}

/**
 * Helper to compute an astronomical twilight polygon for solar altitude angle alpha
 */
function computeTwilightCurve(declinationRad, subsolarLon, alphaDeg, width, height, steps) {
  const alphaRad = alphaDeg * DEG_TO_RAD;
  const A = Math.sin(declinationRad);
  const C = Math.sin(alphaRad);
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const lon = -180 + (i / steps) * 360;
    const deltaLonRad = (lon - subsolarLon) * DEG_TO_RAD;

    const B = Math.cos(declinationRad) * Math.cos(deltaLonRad);
    const R = Math.sqrt(A * A + B * B);
    let latDeg = 0;

    if (R > 0.00001) {
      const ratio = Math.max(-1, Math.min(1, C / R));
      const psi = Math.asin(ratio);
      const theta = Math.atan2(B, A);
      let phi = (psi - theta) * RAD_TO_DEG;

      while (phi > 90) phi -= 180;
      while (phi < -90) phi += 180;
      latDeg = Math.max(-89.9, Math.min(89.9, phi));
    }

    const y = Math.min(Math.max(((90 - latDeg) / 180) * height, 0), height);
    points.push({ x, y, lat: latDeg, lon });
  }

  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `;
  for (let i = 1; i < points.length; i++) {
    pathD += `L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} `;
  }

  // Open line curve along the boundary (useful for glowing horizon stroke)
  const lineD = pathD.trim();

  // Closed shadow polygon: covers polar region depending on declination
  const declinationDeg = declinationRad * RAD_TO_DEG;
  if (declinationDeg < 0) {
    pathD += `L ${width} 0 L 0 0 Z`;
  } else {
    pathD += `L ${width} ${height} L 0 ${height} Z`;
  }

  return { polygonD: pathD.trim(), lineD, points };
}

/**
 * Generate closed SVG path polygon for Astronomical Solar Terminator (alpha = 0)
 * Maintained with 100% backward compatibility for existing callers and tests.
 */
export function generateTerminatorPath(date, width = 2000, height = 857, steps = 80) {
  const d = date || new Date();
  const declinationDeg = getSolarDeclination(d);
  const declinationRad = declinationDeg * DEG_TO_RAD;
  const subsolarLon = getSubsolarLongitude(d);

  const res = computeTwilightCurve(declinationRad, subsolarLon, 0, width, height, steps);

  return {
    pathD: res.polygonD,
    declinationDeg,
    subsolarLon
  };
}

/**
 * Generate Solar Analemma Figure-8 SVG path centered at a subsolar longitude
 */
export function generateAnalemmaPath(subsolarLon, width = 2000, height = 857) {
  const points = [];
  for (let d = 1; d <= 365; d += 3) {
    const B = (2 * Math.PI / 365) * (d - 81);
    const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const decDeg = -23.44 * Math.cos((2 * Math.PI / 365) * (d + 10));

    // Equation of time in minutes converts to longitude degrees (1 min = 0.25 deg)
    const lon = subsolarLon + (eotMin / 4);
    const pt = geographicToSvgPoint(decDeg, lon, width, height);
    points.push(pt);
  }

  if (points.length === 0) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `;
  for (let i = 1; i < points.length; i++) {
    d += `L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} `;
  }
  d += 'Z';
  return d;
}

/**
 * Generate 3-Stage Atmospheric Twilight Bands & Celestial Landmarks
 * Produces:
 * 1. Civil Twilight (alpha = -6°)
 * 2. Nautical Twilight (alpha = -12°)
 * 3. Astronomical Night Umbra (alpha = -18°)
 * 4. Golden Hour Horizon Ribbon (alpha = 0°)
 * 5. Subsolar Zenith Beacon & Solar Analemma Figure-8
 */
export function generateTwilightBands(date, width = 2000, height = 857, steps = 120) {
  const d = date || new Date();
  const declinationDeg = getSolarDeclination(d);
  const declinationRad = declinationDeg * DEG_TO_RAD;
  const subsolarLon = getSubsolarLongitude(d);
  const eotMinutes = getEquationOfTime(d);

  // 1. Four twilight thresholds
  const horizon = computeTwilightCurve(declinationRad, subsolarLon, 0, width, height, steps);
  const civil = computeTwilightCurve(declinationRad, subsolarLon, -6, width, height, steps);
  const nautical = computeTwilightCurve(declinationRad, subsolarLon, -12, width, height, steps);
  const astronomical = computeTwilightCurve(declinationRad, subsolarLon, -18, width, height, steps);

  // 2. Subsolar point (Zenith where Sun is 90° overhead)
  const subsolarPoint = {
    ...geographicToSvgPoint(declinationDeg, subsolarLon, width, height),
    lat: declinationDeg,
    lon: subsolarLon
  };

  // 3. Antisolar point (Midnight nadir)
  let antiLon = subsolarLon + 180;
  if (antiLon > 180) antiLon -= 360;
  const antisolarPoint = {
    ...geographicToSvgPoint(-declinationDeg, antiLon, width, height),
    lat: -declinationDeg,
    lon: antiLon
  };

  // 4. Solar Analemma Figure-8
  const analemmaPathD = generateAnalemmaPath(subsolarLon, width, height);

  return {
    declinationDeg,
    subsolarLon,
    eotMinutes,
    goldenHourLineD: horizon.lineD,
    civilPolygonD: civil.polygonD,
    nauticalPolygonD: nautical.polygonD,
    astronomicalPolygonD: astronomical.polygonD,
    subsolarPoint,
    antisolarPoint,
    analemmaPathD
  };
}

/**
 * Calculate Great-Circle Geodesic Flight Path & Telemetry between two coordinates
 * Uses spherical linear interpolation (Slerp) with antimeridian discontinuity handling.
 */
export function calculateGreatCircleArc(point1, point2, width = 2000, height = 857, steps = 40) {
  const phi1 = point1.lat * DEG_TO_RAD;
  const lam1 = point1.lon * DEG_TO_RAD;
  const phi2 = point2.lat * DEG_TO_RAD;
  const lam2 = point2.lon * DEG_TO_RAD;

  const v1 = [Math.cos(phi1) * Math.cos(lam1), Math.cos(phi1) * Math.sin(lam1), Math.sin(phi1)];
  const v2 = [Math.cos(phi2) * Math.cos(lam2), Math.cos(phi2) * Math.sin(lam2), Math.sin(phi2)];

  const dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  const segments = [[]];
  let currentSegment = segments[0];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let vx, vy, vz;
    if (sinOmega < 0.0001) {
      vx = v1[0]; vy = v1[1]; vz = v1[2];
    } else {
      const w1 = Math.sin((1 - t) * omega) / sinOmega;
      const w2 = Math.sin(t * omega) / sinOmega;
      vx = w1 * v1[0] + w2 * v2[0];
      vy = w1 * v1[1] + w2 * v2[1];
      vz = w1 * v1[2] + w2 * v2[2];
    }

    const lat = Math.asin(Math.max(-1, Math.min(1, vz))) * RAD_TO_DEG;
    const lon = Math.atan2(vy, vx) * RAD_TO_DEG;

    const pt = geographicToSvgPoint(lat, lon, width, height);

    if (currentSegment.length > 0) {
      const lastX = currentSegment[currentSegment.length - 1].x;
      if (Math.abs(pt.x - lastX) > width * 0.5) {
        // Crosses 180° antimeridian; start a clean new subpath to prevent screen tear
        currentSegment = [];
        segments.push(currentSegment);
      }
    }
    currentSegment.push({ ...pt, lat, lon });
  }

  let pathD = '';
  for (const seg of segments) {
    if (seg.length === 0) continue;
    pathD += `M ${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)} `;
    for (let j = 1; j < seg.length; j++) {
      pathD += `L ${seg[j].x.toFixed(1)} ${seg[j].y.toFixed(1)} `;
    }
  }

  const distanceKm = Math.round(EARTH_RADIUS_KM * omega);
  const fiberLatencyMs = Math.round((distanceKm / FIBER_SPEED_KM_S) * 1000 * FIBER_INDEX);

  return {
    pathD: pathD.trim(),
    distanceKm,
    fiberLatencyMs,
    segments
  };
}

/**
 * Curated Global Metropolitan Hubs (~80 major population centers)
 * Designed for bioluminescent night-side illumination and pinned telemetry
 */
export const MAJOR_GLOBAL_CITIES = [
  // Europe
  { id: 'LON', name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { id: 'PAR', name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { id: 'BER', name: 'Berlin', country: 'Germany', lat: 52.5200, lon: 13.4050 },
  { id: 'FRA', name: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821 },
  { id: 'MAD', name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { id: 'ROM', name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { id: 'AMS', name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  { id: 'DUB', name: 'Dublin', country: 'Ireland', lat: 53.3498, lon: -6.2603 },
  { id: 'VIE', name: 'Vienna', country: 'Austria', lat: 48.2082, lon: 16.3738 },
  { id: 'ZUR', name: 'Zurich', country: 'Switzerland', lat: 47.3769, lon: 8.5417 },
  { id: 'WAR', name: 'Warsaw', country: 'Poland', lat: 52.2297, lon: 21.0122 },
  { id: 'STO', name: 'Stockholm', country: 'Sweden', lat: 59.3293, lon: 18.0686 },
  { id: 'OSL', name: 'Oslo', country: 'Norway', lat: 59.9139, lon: 10.7522 },
  { id: 'COP', name: 'Copenhagen', country: 'Denmark', lat: 55.6761, lon: 12.5683 },
  { id: 'HEL', name: 'Helsinki', country: 'Finland', lat: 60.1699, lon: 24.9384 },
  { id: 'ATH', name: 'Athens', country: 'Greece', lat: 37.9838, lon: 23.7275 },
  { id: 'IST', name: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  { id: 'MOW', name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  { id: 'LED', name: 'St. Petersburg', country: 'Russia', lat: 59.9343, lon: 30.3351 },
  { id: 'IEV', name: 'Kyiv', country: 'Ukraine', lat: 50.4501, lon: 30.5234 },

  // Americas
  { id: 'NYC', name: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060 },
  { id: 'BOS', name: 'Boston', country: 'United States', lat: 42.3601, lon: -71.0589 },
  { id: 'WAS', name: 'Washington D.C.', country: 'United States', lat: 38.9072, lon: -77.0369 },
  { id: 'CHI', name: 'Chicago', country: 'United States', lat: 41.8781, lon: -87.6298 },
  { id: 'MIA', name: 'Miami', country: 'United States', lat: 25.7617, lon: -80.1918 },
  { id: 'HOU', name: 'Houston', country: 'United States', lat: 29.7604, lon: -95.3698 },
  { id: 'DEN', name: 'Denver', country: 'United States', lat: 39.7392, lon: -104.9903 },
  { id: 'LAX', name: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437 },
  { id: 'SFO', name: 'San Francisco', country: 'United States', lat: 37.7749, lon: -122.4194 },
  { id: 'SEA', name: 'Seattle', country: 'United States', lat: 47.6062, lon: -122.3321 },
  { id: 'YYZ', name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { id: 'YUL', name: 'Montreal', country: 'Canada', lat: 45.5017, lon: -73.5673 },
  { id: 'YVR', name: 'Vancouver', country: 'Canada', lat: 49.2827, lon: -123.1207 },
  { id: 'MEX', name: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
  { id: 'BOG', name: 'Bogota', country: 'Colombia', lat: 4.7110, lon: -74.0721 },
  { id: 'LIM', name: 'Lima', country: 'Peru', lat: -12.0464, lon: -77.0428 },
  { id: 'SAO', name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
  { id: 'RIO', name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lon: -43.1729 },
  { id: 'BUE', name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { id: 'SCL', name: 'Santiago', country: 'Chile', lat: -33.4489, lon: -70.6693 },
  { id: 'CCS', name: 'Caracas', country: 'Venezuela', lat: 10.4806, lon: -66.9036 },

  // Asia / Pacific
  { id: 'TYO', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { id: 'OSA', name: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023 },
  { id: 'SEL', name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.9780 },
  { id: 'BJS', name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  { id: 'SHA', name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737 },
  { id: 'CAN', name: 'Guangzhou', country: 'China', lat: 23.1291, lon: 113.2644 },
  { id: 'HKG', name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { id: 'TPE', name: 'Taipei', country: 'Taiwan', lat: 25.0330, lon: 121.5654 },
  { id: 'MNL', name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842 },
  { id: 'BKK', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { id: 'SIN', name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { id: 'KUL', name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lon: 101.6869 },
  { id: 'JKT', name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  { id: 'DEL', name: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.2090 },
  { id: 'BOM', name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777 },
  { id: 'BLR', name: 'Bengaluru', country: 'India', lat: 12.9716, lon: 77.5946 },
  { id: 'CCU', name: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639 },
  { id: 'MAA', name: 'Chennai', country: 'India', lat: 13.0827, lon: 80.2707 },
  { id: 'KHI', name: 'Karachi', country: 'Pakistan', lat: 24.8607, lon: 67.0011 },
  { id: 'DAC', name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lon: 90.4125 },
  { id: 'SYD', name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { id: 'MEL', name: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631 },
  { id: 'BNE', name: 'Brisbane', country: 'Australia', lat: -27.4698, lon: 153.0251 },
  { id: 'PER', name: 'Perth', country: 'Australia', lat: -31.9505, lon: 115.8605 },
  { id: 'AKL', name: 'Auckland', country: 'New Zealand', lat: -36.8485, lon: 174.7633 },

  // Middle East & Central Asia
  { id: 'DXB', name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 },
  { id: 'AUH', name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4539, lon: 54.3773 },
  { id: 'DOH', name: 'Doha', country: 'Qatar', lat: 25.2854, lon: 51.5310 },
  { id: 'RUH', name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lon: 46.6753 },
  { id: 'JED', name: 'Jeddah', country: 'Saudi Arabia', lat: 21.4858, lon: 39.1925 },
  { id: 'TLV', name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lon: 34.7818 },
  { id: 'THR', name: 'Tehran', country: 'Iran', lat: 35.6892, lon: 51.3890 },
  { id: 'TAS', name: 'Tashkent', country: 'Uzbekistan', lat: 41.2995, lon: 69.2401 },
  { id: 'ALA', name: 'Almaty', country: 'Kazakhstan', lat: 43.2220, lon: 76.8512 },

  // Africa
  { id: 'CAI', name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { id: 'LOS', name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  { id: 'JNB', name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lon: 28.0473 },
  { id: 'CPT', name: 'Cape Town', country: 'South Africa', lat: -33.9249, lon: 18.4241 },
  { id: 'NBO', name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  { id: 'ADD', name: 'Addis Ababa', country: 'Ethiopia', lat: 9.0320, lon: 38.7469 },
  { id: 'CMN', name: 'Casablanca', country: 'Morocco', lat: 33.5731, lon: -7.5898 },
  { id: 'ACC', name: 'Accra', country: 'Ghana', lat: 5.6037, lon: -0.1870 },
  { id: 'KIN', name: 'Kinshasa', country: 'DR Congo', lat: -4.4419, lon: 15.2663 },
  { id: 'LAD', name: 'Luanda', country: 'Angola', lat: -8.8390, lon: 13.2894 }
];
