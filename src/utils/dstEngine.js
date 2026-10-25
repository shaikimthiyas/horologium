/**
 * Horologium Daylight Saving Time (DST) & Chronometry Engine (Calibre-01)
 * 
 * Provides pure mathematical determination of seasonal DST transitions,
 * standard offsets, and temporal shifts across all IANA timezones.
 * Conforms to RFC 9557 and native ECMAScript Intl.DateTimeFormat.
 */

/**
 * Parse an RFC / Intl shortOffset string (e.g. "GMT+5:30", "UTC-4", "GMT") into signed integer minutes.
 * @param {string} tzPart
 * @returns {number} Offset in minutes from UTC (e.g. +330, -240, 0)
 */
export function parseShortOffsetToMinutes(tzPart) {
  if (!tzPart || tzPart === 'GMT' || tzPart === 'UTC') return 0;
  const match = tzPart.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = parseInt(match[3] || '0', 10);
  return sign * (hours * 60 + mins);
}

/**
 * Format signed integer minutes into canonical RFC 9557 / ISO offset string (e.g. "UTC+05:30", "UTC-04:00", "UTC±00:00")
 * @param {number} offsetMinutes
 * @returns {string}
 */
export function formatOffsetMinutes(offsetMinutes) {
  if (offsetMinutes === 0 || Object.is(offsetMinutes, -0)) {
    return 'UTC±00:00';
  }
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Compute the instantaneous timezone offset in signed minutes for an IANA timezone at a specific Date.
 * @param {string} timeZone IANA timezone (e.g. "America/New_York", "Europe/London", "Asia/Kolkata")
 * @param {Date} date
 * @returns {number} Offset in minutes from UTC
 */
export function getTimeZoneOffsetMinutes(timeZone, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
    return parseShortOffsetToMinutes(tzPart);
  } catch (_) {
    return 0;
  }
}

/**
 * Determine complete Daylight Saving Time metrics for an IANA timezone at target date.
 * Evaluates seasonal solstice offsets (January vs July) to identify DST existence and current active state.
 * 
 * @param {string} timeZone IANA timezone string
 * @param {Date} targetDate Instant to evaluate
 * @returns {object} { hasDst, isDst, currentOffsetMinutes, standardOffsetMinutes, dstShiftMinutes, offsetString, statusLabel, badgeText, badgeClass }
 */
export function getDstStatus(timeZone, targetDate = new Date()) {
  const d = targetDate instanceof Date && !isNaN(targetDate) ? targetDate : new Date();
  const year = d.getUTCFullYear();

  // January (Northern winter / Southern summer) & July (Northern summer / Southern winter)
  const janDate = new Date(Date.UTC(year, 0, 15, 12, 0, 0));
  const julDate = new Date(Date.UTC(year, 6, 15, 12, 0, 0));

  const janOffset = getTimeZoneOffsetMinutes(timeZone, janDate);
  const julOffset = getTimeZoneOffsetMinutes(timeZone, julDate);

  const currentOffsetMinutes = getTimeZoneOffsetMinutes(timeZone, d);
  const offsetString = formatOffsetMinutes(currentOffsetMinutes);

  // If seasonal offsets are identical, this territory does not observe DST
  if (janOffset === julOffset) {
    return {
      timeZone,
      hasDst: false,
      isDst: false,
      currentOffsetMinutes,
      standardOffsetMinutes: currentOffsetMinutes,
      dstShiftMinutes: 0,
      offsetString,
      statusLabel: `STANDARD TIME (${offsetString})`,
      badgeText: 'NO DST',
      badgeClass: 'badge-dst-none'
    };
  }

  // Territory observes DST: standard time is the minimum offset, DST is the maximum offset
  const standardOffsetMinutes = Math.min(janOffset, julOffset);
  const maxDstOffset = Math.max(janOffset, julOffset);
  const isDst = currentOffsetMinutes === maxDstOffset;
  const dstShiftMinutes = isDst ? (maxDstOffset - standardOffsetMinutes) : 0;

  return {
    timeZone,
    hasDst: true,
    isDst,
    currentOffsetMinutes,
    standardOffsetMinutes,
    dstShiftMinutes,
    offsetString,
    statusLabel: isDst
      ? `DAYLIGHT SAVING TIME (+${dstShiftMinutes}m ACTIVE)`
      : `STANDARD TIME (${offsetString})`,
    badgeText: isDst ? `● DST +${dstShiftMinutes / 60}h` : '● STD',
    badgeClass: isDst ? 'badge-dst-active' : 'badge-dst-std'
  };
}

/**
 * Calculate the time delta between two timezones in minutes at a given date.
 */
export function getTimeZoneDeltaMinutes(sourceTimeZone, targetTimeZone, date = new Date()) {
  const sourceOffset = getTimeZoneOffsetMinutes(sourceTimeZone, date);
  const targetOffset = getTimeZoneOffsetMinutes(targetTimeZone, date);
  return targetOffset - sourceOffset;
}
