/**
 * Horologium Chrome Extension Popup Controller
 */

const DEFAULT_STATIONS = [
  { city: 'London', tz: 'Europe/London', country: 'GB' },
  { city: 'New York', tz: 'America/New_York', country: 'US' },
  { city: 'Geneva', tz: 'Europe/Zurich', country: 'CH' },
  { city: 'New Delhi', tz: 'Asia/Kolkata', country: 'IN' },
  { city: 'Tokyo', tz: 'Asia/Tokyo', country: 'JP' }
];

function updateClocks() {
  const now = new Date();

  // UTC Header
  const utcHours = String(now.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
  const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
  const utcEl = document.getElementById('extUtc');
  if (utcEl) utcEl.textContent = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

  const container = document.getElementById('cityList');
  if (!container) return;

  container.innerHTML = '';
  DEFAULT_STATIONS.forEach(station => {
    try {
      const timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: station.tz,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(now);

      const offsetStr = new Intl.DateTimeFormat('en-US', {
        timeZone: station.tz,
        timeZoneName: 'shortOffset'
      }).format(now).split(' ').pop();

      const row = document.createElement('div');
      row.className = 'city-row';
      row.innerHTML = `
        <div class="city-info">
          <span class="city-title">${station.city}</span>
          <span class="city-meta">${station.tz} · ${offsetStr}</span>
        </div>
        <span class="city-time">${timeStr}</span>
      `;
      container.appendChild(row);
    } catch (_) {}
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateClocks();
  setInterval(updateClocks, 1000);
});
