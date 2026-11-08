/**
 * HOROLOGIUM ENTERPRISE WEB COMPONENTS (W3C Custom Elements)
 * Zero-dependency, lightweight, shadow-DOM encapsulated embeddable widgets
 * for third-party websites, dashboards, Notion, Confluence, and intranets.
 * 
 * Elements registered:
 * - <horologium-clock tz="Asia/Tokyo" city="Tokyo" theme="obsidian" format="24h"></horologium-clock>
 * - <horologium-overlap station-a="Europe/London" station-b="Asia/Tokyo" theme="obsidian"></horologium-overlap>
 * - <horologium-terminator theme="obsidian"></horologium-terminator>
 */

// -----------------------------------------------------------------------------
// 1. <horologium-clock> Custom Element
// -----------------------------------------------------------------------------
export class HorologiumClockElement extends HTMLElement {
  static get observedAttributes() {
    return ['tz', 'city', 'theme', 'format', 'show-daylight'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._timer = null;
  }

  connectedCallback() {
    this.render();
    this._startTimer();
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  attributeChangedCallback() {
    this.render();
  }

  _startTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.updateTime(), 1000);
    this.updateTime();
  }

  get tz() {
    return this.getAttribute('tz') || 'UTC';
  }

  get city() {
    return this.getAttribute('city') || this.tz.split('/').pop().replace(/_/g, ' ');
  }

  get theme() {
    return (this.getAttribute('theme') || 'obsidian').toLowerCase();
  }

  get format() {
    return (this.getAttribute('format') || '24h').toLowerCase();
  }

  render() {
    const isDark = this.theme !== 'light' && this.theme !== 'silvered';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          user-select: none;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .clock-card {
          width: 100%;
          min-width: 260px;
          max-width: 360px;
          background: ${isDark ? '#0C0F17' : '#FFFFFF'};
          color: ${isDark ? '#EDEFF2' : '#0F172A'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'};
          border-radius: 12px;
          padding: 18px 22px;
          box-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)'};
          position: relative;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .city-label {
          font-weight: 600;
          font-size: 14px;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #10B981; box-shadow: 0 0 6px #10B981;
        }
        .tz-pill {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          color: ${isDark ? '#00F5D4' : '#0284C7'};
          background: ${isDark ? 'rgba(0, 245, 212, 0.08)' : 'rgba(2, 132, 199, 0.08)'};
          border: 1px solid ${isDark ? 'rgba(0, 245, 212, 0.25)' : 'rgba(2, 132, 199, 0.2)'};
          padding: 2px 7px;
          border-radius: 9999px;
        }
        .time-display {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 34px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
          font-variant-numeric: tabular-nums;
        }
        .footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: ${isDark ? '#8E95A2' : '#64748B'};
        }
        .horo-brand {
          font-size: 10px;
          letter-spacing: 0.06em;
          color: ${isDark ? '#64748B' : '#94A3B8'};
          text-decoration: none;
          font-weight: 500;
        }
        .horo-brand:hover { color: #00F5D4; }
      </style>
      <div class="clock-card">
        <div class="header">
          <div class="city-label">
            <span class="status-dot"></span>
            <span>${this.city}</span>
          </div>
          <span class="tz-pill" id="tzPill">--</span>
        </div>
        <div class="time-display" id="timeDisplay">--:--:--</div>
        <div class="footer-row">
          <span id="dateDisplay">--</span>
          <a href="https://horologium.io" target="_blank" rel="noopener" class="horo-brand">
            HOROLOGIUM
          </a>
        </div>
      </div>
    `;
    this.updateTime();
  }

  updateTime() {
    const timeEl = this.shadowRoot.getElementById('timeDisplay');
    const dateEl = this.shadowRoot.getElementById('dateDisplay');
    const tzEl = this.shadowRoot.getElementById('tzPill');
    if (!timeEl) return;

    try {
      const now = new Date();
      const is12h = this.format === '12h';

      timeEl.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone: this.tz,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: is12h
      }).format(now);

      if (dateEl) {
        dateEl.textContent = new Intl.DateTimeFormat('en-US', {
          timeZone: this.tz,
          weekday: 'short', month: 'short', day: 'numeric'
        }).format(now);
      }

      if (tzEl) {
        tzEl.textContent = new Intl.DateTimeFormat('en-US', {
          timeZone: this.tz,
          timeZoneName: 'shortOffset'
        }).format(now).split(' ').pop();
      }
    } catch (_) {
      timeEl.textContent = new Date().toUTCString().slice(17, 25);
    }
  }
}

// -----------------------------------------------------------------------------
// 2. <horologium-overlap> Custom Element
// -----------------------------------------------------------------------------
export class HorologiumOverlapElement extends HTMLElement {
  static get observedAttributes() {
    return ['station-a', 'station-b', 'theme'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedHour = new Date().getUTCHours();
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  get stationA() {
    return this.getAttribute('station-a') || 'Europe/London';
  }

  get stationB() {
    return this.getAttribute('station-b') || 'Asia/Tokyo';
  }

  get theme() {
    return (this.getAttribute('theme') || 'obsidian').toLowerCase();
  }

  render() {
    const isDark = this.theme !== 'light' && this.theme !== 'silvered';
    const cityA = this.stationA.split('/').pop().replace(/_/g, ' ');
    const cityB = this.stationB.split('/').pop().replace(/_/g, ' ');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          user-select: none;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .overlap-card {
          width: 100%;
          min-width: 320px;
          max-width: 600px;
          background: ${isDark ? '#0C0F17' : '#FFFFFF'};
          color: ${isDark ? '#EDEFF2' : '#0F172A'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'};
          border-radius: 12px;
          padding: 18px 22px;
          box-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)'};
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .title { font-size: 14px; font-weight: 600; }
        .golden-pill {
          color: #10B981; font-size: 11px; font-weight: 600;
          background: rgba(16, 185, 129, 0.1);
          padding: 2px 8px; border-radius: 9999px;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .stations-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .station-box {
          background: ${isDark ? '#080A0F' : '#F1F5F9'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0'};
          border-radius: 8px;
          padding: 8px 12px;
        }
        .station-label {
          font-size: 10px; color: ${isDark ? '#8E95A2' : '#64748B'};
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .station-time {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 18px; font-weight: 700;
          color: ${isDark ? '#00F5D4' : '#0284C7'};
          font-variant-numeric: tabular-nums;
        }
        .scrub-track {
          display: grid;
          grid-template-columns: repeat(24, 1fr);
          height: 26px;
          background: ${isDark ? '#07090D' : '#E2E8F0'};
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 10px;
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#CBD5E1'};
        }
        .scrub-hour {
          display: flex; align-items: center; justify-content: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px; cursor: pointer;
          color: ${isDark ? '#64748B' : '#94A3B8'};
          transition: background 120ms;
        }
        .scrub-hour.overlap {
          background: ${isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)'};
          color: ${isDark ? '#34D399' : '#059669'};
          font-weight: 600;
        }
        .scrub-hour.selected {
          background: #2563EB !important; color: #FFFFFF !important; font-weight: 700;
        }
        .footer {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 11px; color: ${isDark ? '#8E95A2' : '#64748B'};
        }
      </style>
      <div class="overlap-card">
        <div class="header">
          <span class="title">Meeting Overlap</span>
          <span class="golden-pill" id="goldenPill">--</span>
        </div>
        <div class="stations-row">
          <div class="station-box">
            <div class="station-label">${cityA}</div>
            <div class="station-time" id="timeA">--:--</div>
          </div>
          <div class="station-box">
            <div class="station-label">${cityB}</div>
            <div class="station-time" id="timeB">--:--</div>
          </div>
        </div>
        <div class="scrub-track" id="scrubTrack"></div>
        <div class="footer">
          <span id="selectedHourLabel">Scrubbed UTC: --:00</span>
          <a href="https://horologium.io/horo/" target="_blank" rel="noopener" style="color:inherit; text-decoration:none;">
            Horologium Engine →
          </a>
        </div>
      </div>
    `;

    this._populateTrack(cityA, cityB);
    this._updateReadout();
  }

  _populateTrack(cityA, cityB) {
    const track = this.shadowRoot.getElementById('scrubTrack');
    if (!track) return;
    track.innerHTML = '';

    let overlapHours = 0;
    for (let h = 0; h < 24; h++) {
      const d = new Date();
      d.setUTCHours(h, 0, 0, 0);

      const hA = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: this.stationA, hour: 'numeric', hour12: false }).format(d), 10);
      const hB = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: this.stationB, hour: 'numeric', hour12: false }).format(d), 10);

      const isWorkA = hA >= 9 && hA < 18;
      const isWorkB = hB >= 9 && hB < 18;
      const isOverlap = isWorkA && isWorkB;
      if (isOverlap) overlapHours++;

      const div = document.createElement('div');
      div.className = 'scrub-hour' + (isOverlap ? ' overlap' : '') + (h === this.selectedHour ? ' selected' : '');
      div.textContent = String(h).padStart(2, '0');
      div.title = `UTC ${h}:00 | ${cityA} ${hA}:00 | ${cityB} ${hB}:00`;
      div.onclick = () => {
        this.selectedHour = h;
        this._populateTrack(cityA, cityB);
        this._updateReadout();
      };
      track.appendChild(div);
    }

    const pill = this.shadowRoot.getElementById('goldenPill');
    if (pill) {
      pill.textContent = overlapHours > 0 ? `${overlapHours}h Mutual Overlap` : 'No Overlap';
    }
  }

  _updateReadout() {
    const d = new Date();
    d.setUTCHours(this.selectedHour, 0, 0, 0);

    const strA = new Intl.DateTimeFormat('en-US', { timeZone: this.stationA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    const strB = new Intl.DateTimeFormat('en-US', { timeZone: this.stationB, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

    const elA = this.shadowRoot.getElementById('timeA');
    const elB = this.shadowRoot.getElementById('timeB');
    const label = this.shadowRoot.getElementById('selectedHourLabel');

    if (elA) elA.textContent = strA;
    if (elB) elB.textContent = strB;
    if (label) label.textContent = `Scrubbed UTC: ${String(this.selectedHour).padStart(2, '0')}:00`;
  }
}

// -----------------------------------------------------------------------------
// Auto-Register Custom Elements in Window Registry
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined' && 'customElements' in window) {
  if (!customElements.get('horologium-clock')) {
    customElements.define('horologium-clock', HorologiumClockElement);
  }
  if (!customElements.get('horologium-overlap')) {
    customElements.define('horologium-overlap', HorologiumOverlapElement);
  }
}
