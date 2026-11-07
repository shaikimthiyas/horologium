/**
 * Horologium Astronomical & Temporal Mathematics
 * Pure mathematical utilities for solar declination, terminator curves, and offsets
 */

/**
 * Calculate Solar Declination angle in degrees for a given date
 * Formula: declination = -23.44° * cos(360°/365 * (dayOfYear + 10))
 */
export function getSolarDeclination(date) {
  const d = date || new Date();
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  const declinationRad = -23.44 * (Math.PI / 180) * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  return declinationRad * (180 / Math.PI);
}

export const calculateSolarDeclination = getSolarDeclination;

/**
 * Calculate subsolar longitude in degrees based on UTC time
 */
export function getSubsolarLongitude(date) {
  const d = date || new Date();
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return -(utcHours - 12) * 15;
}

/**
 * Generate closed SVG path polygon for the Astronomical Day/Night Solar Terminator
 */
export function generateTerminatorPath(date, width = 2000, height = 857, steps = 80) {
  const d = date || new Date();
  const declinationDeg = getSolarDeclination(d);
  const declinationRad = declinationDeg * (Math.PI / 180);
  const subsolarLon = getSubsolarLongitude(d);

  const points = [];
  const tanDec = Math.tan(declinationRad);

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const lon = -180 + (i / steps) * 360;
    const deltaLonRad = (lon - subsolarLon) * (Math.PI / 180);

    let latRad = 0;
    if (Math.abs(tanDec) > 0.0001) {
      latRad = Math.atan(-Math.cos(deltaLonRad) / tanDec);
    }
    const latDeg = latRad * (180 / Math.PI);
    const y = Math.min(Math.max(((90 - latDeg) / 180) * height, 0), height);
    points.push({ x, y });
  }

  let pathD = `M ${points[0].x} ${points[0].y} `;
  for (let i = 1; i < points.length; i++) {
    pathD += `L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} `;
  }

  if (declinationDeg < 0) {
    pathD += `L ${width} 0 L 0 0 Z`;
  } else {
    pathD += `L ${width} ${height} L 0 ${height} Z`;
  }

  return {
    pathD,
    declinationDeg,
    subsolarLon
  };
}

/**
 * Convert pixel coordinates on SVG viewBox (2000x857) to Geographic Lat/Lon
 */
export function svgPointToGeographic(svgX, svgY, width = 2000, height = 857) {
  const lon = -180 + (svgX / width) * 360;
  const lat = 90 - (svgY / height) * 180;
  return { lat, lon };
}

/**
 * Estimate UTC timezone offset hours from longitude (-180 to +180)
 */
export function longitudeToUtcOffset(lon) {
  return Math.round(lon / 15);
}
