/**
 * Marzullo's Intersection Algorithm (Truechimer Consensus & Fault Tolerance)
 * 
 * Formal algorithmic implementation for Distributed Chronometry & NTP Systems.
 * Invented by Keith Marzullo (1984) for determining an accurate time interval
 * from a collection of noisy or partially faulty time sources.
 * 
 * Given M sources where at most f are faulty ("falsetickers"), Marzullo's
 * algorithm computes the smallest interval overlapping the largest subset of sources.
 */

export function computeMarzulloConsensus(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return {
      status: 'EMPTY_SET',
      consensusOffset: 0,
      confidenceHalfWidth: 0,
      interval: [0, 0],
      truechimers: [],
      falsetickers: [],
      sampleCount: 0
    };
  }

  // 1. Construct intervals: [offset - error, offset + error]
  // where error = delay / 2 + dispersion
  const intervals = sources.map((s, idx) => {
    const id = s.id || s.server || `source-${idx}`;
    const offset = Number(s.offset ?? s.skewMs ?? 0);
    const delay = Math.max(0, Number(s.delay ?? s.roundTripMs ?? 0));
    const dispersion = Math.max(0, Number(s.dispersion ?? 1)); // nominal 1ms dispersion minimum
    const errorBound = (delay / 2) + dispersion;

    return {
      id,
      server: s.server || id,
      offset,
      errorBound,
      low: offset - errorBound,
      high: offset + errorBound,
      raw: s
    };
  });

  if (intervals.length === 1) {
    const single = intervals[0];
    return {
      status: 'SINGLE_SOURCE',
      consensusOffset: single.offset,
      confidenceHalfWidth: single.errorBound,
      interval: [single.low, single.high],
      truechimers: [single.id],
      falsetickers: [],
      sampleCount: 1
    };
  }

  // 2. Build endpoint tuples: low is start (-1), high is end (+1)
  // For identical coordinate values, starts (-1) should be processed before ends (+1)
  // so that touching boundary points are included in closed intervals.
  const points = [];
  for (const item of intervals) {
    points.push({ val: item.low, type: -1, id: item.id });
    points.push({ val: item.high, type: +1, id: item.id });
  }

  points.sort((a, b) => {
    if (a.val !== b.val) return a.val - b.val;
    return a.type - b.type; // -1 (start) before +1 (end)
  });

  // 3. Sweep over endpoints to find maximum overlap clique
  let currentCount = 0;
  let maxCount = 0;
  let bestLow = points[0].val;
  let bestHigh = points[points.length - 1].val;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.type === -1) {
      currentCount++;
      if (currentCount > maxCount) {
        maxCount = currentCount;
        bestLow = pt.val;
      }
    } else {
      if (currentCount === maxCount) {
        bestHigh = pt.val;
      }
      currentCount--;
    }
  }

  // Safety fallback if intervals did not cleanly close
  if (bestLow > bestHigh) {
    bestHigh = bestLow;
  }

  const consensusInterval = [bestLow, bestHigh];
  const consensusOffset = Number(((bestLow + bestHigh) / 2).toFixed(3));
  const confidenceHalfWidth = Number(((bestHigh - bestLow) / 2).toFixed(3));

  // 4. Classify sources into Truechimers (overlap consensus) and Falsetickers
  const truechimers = [];
  const falsetickers = [];

  for (const item of intervals) {
    // Check if [item.low, item.high] intersects [bestLow, bestHigh]
    const overlaps = item.low <= bestHigh && item.high >= bestLow;
    if (overlaps) {
      truechimers.push({
        id: item.id,
        server: item.server,
        offset: item.offset,
        errorBound: item.errorBound
      });
    } else {
      falsetickers.push({
        id: item.id,
        server: item.server,
        offset: item.offset,
        errorBound: item.errorBound,
        divergenceMs: item.low > bestHigh ? item.low - bestHigh : bestLow - item.high
      });
    }
  }

  return {
    status: falsetickers.length === 0 ? 'HARMONIC_CONSENSUS' : 'FALSETICKER_REJECTED',
    consensusOffset,
    confidenceHalfWidth,
    interval: [Number(bestLow.toFixed(3)), Number(bestHigh.toFixed(3))],
    truechimers,
    falsetickers,
    maxOverlapCount: maxCount,
    totalSources: intervals.length
  };
}
