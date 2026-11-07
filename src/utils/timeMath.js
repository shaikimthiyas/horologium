/**
 * Horologium Astronomical & Temporal Mathematics
 * Pure mathematical utilities for solar declination, terminator curves, and offsets.
 * Re-exports core algorithms from solarTerminator engine for full backward compatibility.
 */

export {
  getSolarDeclination,
  calculateSolarDeclination,
  getSubsolarLongitude,
  getEquationOfTime,
  calculateSolarAltitude,
  classifySolarState,
  calculateLocalSolarTime,
  svgPointToGeographic,
  geographicToSvgPoint,
  longitudeToUtcOffset,
  generateTerminatorPath,
  generateAnalemmaPath,
  generateTwilightBands,
  calculateGreatCircleArc,
  MAJOR_GLOBAL_CITIES
} from './solarTerminator.js';
