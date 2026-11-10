/**
 * Horologium Pinned Telemetry Matrix (Bento Grid)
 * Multi-zone horological cells with 24-hour working hours daylight indicator
 */
import { getCountryData } from '../../data/countries.data.js';
import { APP_CONFIG } from '../../config/constants.js';

export class TelemetryMatrix {
  constructor(options = {}) {
    this.container = document.getElementById('matrixGrid');
    this.onSelectCity = options.onSelectCity || (() => {});
    this.pinnedCities = [...APP_CONFIG.DEFAULT_PINNED_CITIES];
    this.focalCountry = APP_CONFIG.DEFAULT_FOCAL_COUNTRY;
    this.is24h = true;
  }

  setFocalCountry(countryName) {
    this.focalCountry = countryName;
  }

  setFormat(is24h) {
    this.is24h = is24h;
  }

  async loadRemotePins() {
    try {
      const res = await fetch('/api/pins');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.pins) && data.pins.length > 0) {
          this.pinnedCities = data.pins.map(p => ({
            id: p.id,
            city: p.city || p.name,
            country: p.country,
            tz: p.tz || p.timezone
          }));
        }
      }
    } catch (e) {
      // Keep defaults on network error
    }
  }

  async togglePin(station) {
    const city = station.city || station.name;
    const country = station.country || 'Global Station';
    const tz = station.tz || station.timezone;

    const existingIdx = this.pinnedCities.findIndex(p => p.tz === tz || (p.city === city && p.country === country));

    if (existingIdx !== -1) {
      const existingPin = this.pinnedCities[existingIdx];
      this.pinnedCities.splice(existingIdx, 1);
      this.render();

      if (existingPin.id) {
        try {
          const token = typeof localStorage !== 'undefined' ? localStorage.getItem('horologium_operator_token') : null;
          await fetch(`/api/pins/${existingPin.id}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
        } catch (_) {}
      }
      return false;
    } else {
      const newPin = { city, country, tz, sort_order: this.pinnedCities.length + 1 };
      this.pinnedCities.push(newPin);
      this.render();

      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('horologium_operator_token') : null;
        const res = await fetch('/api/pins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(newPin)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.id) newPin.id = data.id;
        }
      } catch (_) {}
      return true;
    }
  }

  render(activeDate) {
    if (!this.container) return;

    let displayList = [...this.pinnedCities];
    if (this.focalCountry) {
      const focalMeta = getCountryData(this.focalCountry);
      if (focalMeta) {
        const existingIdx = displayList.findIndex(item => item.country === this.focalCountry);
        const focalItem = {
          city: focalMeta.capital || this.focalCountry,
          country: this.focalCountry,
          tz: focalMeta.tz,
          isFocal: true
        };
        if (existingIdx !== -1) {
          displayList.splice(existingIdx, 1);
        }
        displayList.unshift(focalItem);
      }
    }

    this.container.innerHTML = displayList.map(item => {
      const meta = getCountryData(item.country) || {};
      const tz = item.tz || meta.tz || 'UTC';

      let timeStr = '--:--:--';
      let hour24 = 12;
      let minute = 0;

      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: this.is24h ? '2-digit' : 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: !this.is24h
        });
        timeStr = formatter.format(activeDate);

        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        }).formatToParts(activeDate);

        hour24 = parseInt(parts.find(p => p.type === 'hour')?.value || '12', 10);
        minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      } catch (e) {
        timeStr = activeDate.toLocaleTimeString();
      }

      const partsTz = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(activeDate);
      const tzShort = partsTz.find(p => p.type === 'timeZoneName')?.value || meta.abbr || 'UTC';

      const offsetParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(activeDate);
      const gmtOffset = (offsetParts.find(p => p.type === 'timeZoneName')?.value || meta.utc || 'UTC').replace('GMT', 'UTC');

      // Relative offset badge
      const userDate = new Date(activeDate.toLocaleString('en-US'));
      const cityDate = new Date(activeDate.toLocaleString('en-US', { timeZone: tz }));
      const diffHours = (cityDate.getTime() - userDate.getTime()) / (1000 * 60 * 60);
      const roundedDiff = Math.round(diffHours * 10) / 10;

      let diffBadge = 'LOCAL';
      let diffClass = '';
      if (roundedDiff > 0) {
        diffBadge = `+${roundedDiff} HRS`;
        diffClass = 'ahead';
      } else if (roundedDiff < 0) {
        diffBadge = `${roundedDiff} HRS`;
        diffClass = 'behind';
      }

      // 24-hour ruler current tick percentage (0% to 100%)
      const currentPct = ((hour24 * 60 + minute) / 1440) * 100;

      return `
        <div class="horology-cell ${item.isFocal ? 'is-focal' : ''}" data-country="${item.country}">
          <div class="cell-top-row">
            <span class="cell-utc-micro">${gmtOffset} · ${tzShort}</span>
            <span class="cell-diff-badge ${diffClass}">${diffBadge}</span>
          </div>
          <div class="cell-mid-row">
            <span class="cell-city-name">${item.city}</span>
            <span class="cell-country-name">${item.country}</span>
          </div>
          <div class="cell-bottom-row">
            <div class="cell-live-clock font-mono">${timeStr}</div>
            <div class="cell-daylight-ruler" title="Working hours 09:00-17:00 (Radar Green)">
              <!-- 09:00 (37.5%) to 17:00 (70.8%) active window -->
              <div class="daylight-active-segment" style="left: 37.5%; width: 33.3%;"></div>
              <div class="daylight-current-tick" style="left: ${currentPct.toFixed(1)}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.container.querySelectorAll('.horology-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const country = cell.getAttribute('data-country');
        if (country) {
          this.onSelectCity(country);
        }
      });
    });
  }
}
