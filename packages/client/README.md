# @horologium/client

> Official Universal Client SDK for Horologium Planetary Time, Stratum-1 Marzullo synchronization, and timezone overlap matrix calculation.

[![npm version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://www.npmjs.com/package/@horologium/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

## Installation

```bash
npm install @horologium/client
```

Or using Yarn / pnpm:

```bash
pnpm add @horologium/client
```

## Quick Start

```typescript
import { HorologiumClient } from '@horologium/client';

const client = new HorologiumClient({
  apiKey: 'hlg_live_your_api_key_here',
  endpoint: 'https://horologium.io/api'
});

// 1. Stratum-1 Atomic Synchronization
const atomic = await client.getAtomicTime();
console.log(`UTC: ${atomic.utc} (Latency: ${atomic.rttMs}ms)`);

// 2. Cross-Border Meeting Overlap Matrix
const overlap = client.calculateOverlap('Europe/London', 'America/New_York');
console.log(`Difference: ${overlap.differenceHours}h`);
console.log(`Golden Window Hours: ${overlap.goldenOverlapHours.join(', ')}`);

// 3. Astronomical Solar Coordinates
const solar = client.getSolarPosition();
console.log(`Solar Declination: ${solar.declinationDeg}°`);
```

## Browser Direct / CDN Usage

```html
<script type="module">
  import { HorologiumClient } from 'https://horologium.io/sdk/horologium.js';
  const client = new HorologiumClient();
  const time = await client.getAtomicTime();
  console.log(time);
</script>
```

## Authorship & License

Engineered with Swiss horological precision by **Shaik Imthiyas**.  
Licensed under the [MIT License](../../LICENSE).
