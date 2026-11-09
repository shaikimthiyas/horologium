/**
 * @horologium/client - Official Universal Chronometry SDK
 * Sovereign Architect: Shaik Imthiyas
 */

export interface HorologiumClientOptions {
  apiKey?: string;
  endpoint?: string;
  enableOfflineCache?: boolean;
}

export interface AtomicTimeResult {
  utc: string;
  unixMs: number;
  offsetMs: number;
  rttMs: number;
  source: 'STRATUM_1_MARZULLO' | 'OFFLINE_MONOTONIC';
  monotonicallyIncreasing: boolean;
}

export interface OverlapHourSlot {
  hourUtc: number;
  baseHour: number;
  baseFormatted: string;
  remoteHour: number;
  remoteFormatted: string;
  isBaseBusiness: boolean;
  isRemoteBusiness: boolean;
  isSharedOverlap: boolean;
}

export interface OverlapResult {
  baseZone: string;
  remoteZone: string;
  differenceHours: number;
  hoursAhead: boolean;
  timeline: OverlapHourSlot[];
  goldenOverlapHours: number[];
}

export interface SolarPositionResult {
  declinationDeg: number;
  subsolarLonDeg: number;
  timestamp: string;
}

export declare class HorologiumClient {
  constructor(options?: HorologiumClientOptions);
  getAtomicTime(): Promise<AtomicTimeResult>;
  calculateOverlap(baseZone: string, remoteZone: string): OverlapResult;
  getSolarPosition(date?: Date): SolarPositionResult;
  subscribeToTicks(callback: (time: AtomicTimeResult) => void, intervalMs?: number): () => void;
}
