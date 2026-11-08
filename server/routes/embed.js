/**
 * Horologium Standalone Iframe Embed Service
 * Serves zero-dependency, responsive embeddable widgets for Notion, Confluence,
 * Google Docs, WordPress, GitHub pages, and enterprise SaaS dashboards.
 */
import { Router } from 'express';
import { calculateSolarDeclination, getSubsolarLongitude, generateTerminatorPath } from '../../src/utils/timeMath.js';

export const embedRouter = Router();

// Allow external iframe embedding by stripping restrictive frame headers
embedRouter.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *; default-src 'self' 'unsafe-inline' https:;");
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

/**
 * Embeddable World Clock Card
 * GET /embed/clock?tz=Asia/Tokyo&city=Tokyo&theme=obsidian&format=24h
 */
embedRouter.get('/clock', (req, res) => {
  const tz = String(req.query.tz || 'UTC');
  const city = String(req.query.city || tz.split('/').pop().replace(/_/g, ' '));
  const theme = String(req.query.theme || 'obsidian').toLowerCase();
  const format = String(req.query.format || '24h');
  const isDark = theme !== 'light' && theme !== 'silvered';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${city} Clock // Horologium</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${isDark ? '#0A0D14' : '#F8FAFC'};
      color: ${isDark ? '#EDEFF2' : '#0F172A'};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      overflow: hidden;
    }
    .clock-card {
      width: 100%;
      max-width: 380px;
      background: ${isDark ? '#111520' : '#FFFFFF'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'};
      border-radius: 12px;
      padding: 20px 24px;
      box-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.05)'};
      position: relative;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .city-name {
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.01em;
    }
    .tz-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: ${isDark ? '#00F5D4' : '#0284C7'};
      background: ${isDark ? 'rgba(0, 245, 212, 0.1)' : 'rgba(2, 132, 199, 0.08)'};
      border: 1px solid ${isDark ? 'rgba(0, 245, 212, 0.25)' : 'rgba(2, 132, 199, 0.2)'};
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .time-readout {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      font-variant-numeric: tabular-nums;
    }
    .date-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: ${isDark ? '#8E95A2' : '#64748B'};
    }
    .horo-tag {
      font-size: 10px;
      letter-spacing: 0.05em;
      text-decoration: none;
      color: ${isDark ? '#64748B' : '#94A3B8'};
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .horo-tag:hover { color: #00F5D4; }
    .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #10B981; box-shadow: 0 0 6px #10B981;
    }
  </style>
</head>
<body>
  <div class="clock-card">
    <div class="header">
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="dot"></span>
        <span class="city-name">${city}</span>
      </div>
      <span class="tz-badge" id="tzOffset">--</span>
    </div>
    <div class="time-readout" id="clockTime">--:--:--</div>
    <div class="date-row">
      <span id="clockDate">--</span>
      <a href="https://horologium.io" target="_blank" rel="noopener" class="horo-tag">
        <span>HOROLOGIUM</span>
      </a>
    </div>
  </div>
  <script>
    const tz = "${tz}";
    const is12h = "${format}" === "12h";

    function update() {
      try {
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: is12h
        }).format(now);

        const dateStr = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          month: "short",
          day: "numeric"
        }).format(now);

        const offsetStr = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "shortOffset"
        }).format(now).split(" ").pop();

        document.getElementById("clockTime").textContent = timeStr;
        document.getElementById("clockDate").textContent = dateStr;
        document.getElementById("tzOffset").textContent = offsetStr;
      } catch (err) {
        document.getElementById("clockTime").textContent = new Date().toUTCString().slice(17, 25);
      }
    }
    update();
    setInterval(update, 1000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * Embeddable 24-Hour Meeting Overlap Planner
 * GET /embed/overlap?stationA=Europe/London&stationB=Asia/Tokyo&theme=obsidian
 */
embedRouter.get('/overlap', (req, res) => {
  const stationA = String(req.query.stationA || 'Europe/London');
  const stationB = String(req.query.stationB || 'Asia/Tokyo');
  const cityA = stationA.split('/').pop().replace(/_/g, ' ');
  const cityB = stationB.split('/').pop().replace(/_/g, ' ');
  const theme = String(req.query.theme || 'obsidian').toLowerCase();
  const isDark = theme !== 'light' && theme !== 'silvered';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Overlap // Horologium</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${isDark ? '#0A0D14' : '#F8FAFC'};
      color: ${isDark ? '#EDEFF2' : '#0F172A'};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      overflow: hidden;
    }
    .planner-card {
      width: 100%;
      max-width: 580px;
      background: ${isDark ? '#111520' : '#FFFFFF'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'};
      border-radius: 12px;
      padding: 18px 22px;
      box-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.05)'};
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .stations-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .station-box {
      background: ${isDark ? '#0A0D14' : '#F1F5F9'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0'};
      border-radius: 8px;
      padding: 10px 14px;
    }
    .station-name {
      font-size: 11px;
      color: ${isDark ? '#8E95A2' : '#64748B'};
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .station-time {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 20px;
      font-weight: 700;
      color: ${isDark ? '#00F5D4' : '#0284C7'};
      font-variant-numeric: tabular-nums;
    }
    .timeline-track {
      display: grid;
      grid-template-columns: repeat(24, 1fr);
      height: 28px;
      background: ${isDark ? '#080A0F' : '#E2E8F0'};
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#CBD5E1'};
    }
    .timeline-hour {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9px;
      cursor: pointer;
      transition: background 120ms;
      color: ${isDark ? '#64748B' : '#94A3B8'};
    }
    .timeline-hour.overlap {
      background: ${isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)'};
      color: ${isDark ? '#34D399' : '#059669'};
      font-weight: 600;
    }
    .timeline-hour.selected {
      background: #2563EB !important;
      color: #FFFFFF !important;
      font-weight: 700;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: ${isDark ? '#8E95A2' : '#64748B'};
    }
    .badge-golden {
      color: #10B981;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="planner-card">
    <div class="header">
      <span class="title">Meeting Overlap Calculator</span>
      <span class="badge-golden" id="overlapSummary">Calculating...</span>
    </div>
    <div class="stations-grid">
      <div class="station-box">
        <div class="station-name">${cityA} (Station A)</div>
        <div class="station-time" id="timeA">--:--</div>
      </div>
      <div class="station-box">
        <div class="station-name">${cityB} (Station B)</div>
        <div class="station-time" id="timeB">--:--</div>
      </div>
    </div>
    <div class="timeline-track" id="timelineTrack"></div>
    <div class="footer">
      <span>Scrubbed Hour: <strong id="scrubbedLabel">Live</strong></span>
      <a href="https://horologium.io/horo/" target="_blank" rel="noopener" style="color:inherit; text-decoration:none;">
        Powered by <strong>Horologium</strong> →
      </a>
    </div>
  </div>
  <script>
    const tzA = "${stationA}";
    const tzB = "${stationB}";
    let selectedHour = new Date().getUTCHours();

    function renderTimeline() {
      const track = document.getElementById("timelineTrack");
      track.innerHTML = "";

      let goldenCount = 0;
      for (let h = 0; h < 24; h++) {
        const d = new Date();
        d.setUTCHours(h, 0, 0, 0);

        const hourA = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tzA, hour: "numeric", hour12: false }).format(d), 10);
        const hourB = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tzB, hour: "numeric", hour12: false }).format(d), 10);

        const isWorkA = hourA >= 9 && hourA < 18;
        const isWorkB = hourB >= 9 && hourB < 18;
        const isOverlap = isWorkA && isWorkB;
        if (isOverlap) goldenCount++;

        const cell = document.createElement("div");
        cell.className = "timeline-hour" + (isOverlap ? " overlap" : "") + (h === selectedHour ? " selected" : "");
        cell.textContent = String(h).padStart(2, "0");
        cell.title = "UTC " + h + ":00 | " + hourA + ":00 " + "${cityA}" + " | " + hourB + ":00 " + "${cityB}";
        cell.onclick = () => {
          selectedHour = h;
          renderTimeline();
          updateStationReadout();
        };
        track.appendChild(cell);
      }

      document.getElementById("overlapSummary").textContent = goldenCount > 0
        ? goldenCount + "h Mutual Overlap"
        : "No Standard Overlap";
    }

    function updateStationReadout() {
      const d = new Date();
      d.setUTCHours(selectedHour, 0, 0, 0);

      const strA = new Intl.DateTimeFormat("en-US", { timeZone: tzA, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
      const strB = new Intl.DateTimeFormat("en-US", { timeZone: tzB, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

      document.getElementById("timeA").textContent = strA;
      document.getElementById("timeB").textContent = strB;
      document.getElementById("scrubbedLabel").textContent = "UTC " + String(selectedHour).padStart(2, "0") + ":00";
    }

    renderTimeline();
    updateStationReadout();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * Embeddable Day & Night Astronomical Solar Terminator Mini-Map
 * GET /embed/terminator?theme=obsidian
 */
embedRouter.get('/terminator', (req, res) => {
  const theme = String(req.query.theme || 'obsidian').toLowerCase();
  const isDark = theme !== 'light' && theme !== 'silvered';

  const now = new Date();
  const dec = calculateSolarDeclination(now);
  const subLon = getSubsolarLongitude(now);
  const terminatorPath = generateTerminatorPath(now, 600, 300);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day & Night Map // Horologium</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${isDark ? '#0A0D14' : '#F8FAFC'};
      color: ${isDark ? '#EDEFF2' : '#0F172A'};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 12px;
      overflow: hidden;
    }
    .map-container {
      width: 100%;
      max-width: 620px;
      background: ${isDark ? '#111520' : '#FFFFFF'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'};
      border-radius: 12px;
      padding: 16px;
      box-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.05)'};
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 600;
    }
    svg {
      width: 100%;
      height: auto;
      border-radius: 8px;
      background: ${isDark ? '#080A0F' : '#E0F2FE'};
      display: block;
    }
  </style>
</head>
<body>
  <div class="map-container">
    <div class="header">
      <span>Astronomical Solar Terminator</span>
      <span style="font-family:monospace; font-size:11px; color:#F59E0B;">Zenith: ${dec >= 0 ? '+' : ''}${dec.toFixed(1)}°</span>
    </div>
    <svg viewBox="0 0 600 300">
      <!-- Landmass outlines -->
      <path d="M 60,60 L 140,50 L 150,110 L 100,120 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <path d="M 120,140 L 170,150 L 160,250 L 130,230 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <path d="M 270,70 L 330,60 L 320,110 L 280,100 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <path d="M 280,120 L 350,130 L 330,240 L 300,240 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <path d="M 360,70 L 500,60 L 520,160 L 410,170 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <path d="M 450,190 L 520,180 L 510,240 L 460,240 Z" fill="${isDark ? '#1E293B' : '#CBD5E1'}" />
      <!-- Solar night shadow polygon -->
      <path d="${terminatorPath}" fill="${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.38)'}" stroke="#F59E0B" stroke-width="1.5" />
    </svg>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
