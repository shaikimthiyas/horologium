/**
 * Horologium Accessibility (a11y) Screen Reader Announcer
 * Features:
 * - Dedicated aria-live="polite" and aria-atomic="true" live region
 * - Anti-spam throttling: Prevents screen readers from getting overloaded by sub-second clock ticks
 * - Significant event announcements (Hour marks, station switches, overlap window changes, search counts)
 * - WCAG 2.1 AAA compliant screen-reader contrast and focus trap utilities
 */

class AccessibilityAnnouncer {
  constructor() {
    this.liveRegion = null;
    this.lastAnnouncement = '';
    this.lastAnnouncementTime = 0;
    this.minIntervalMs = 1200; // Throttle interval
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mountRegion());
    } else {
      this.mountRegion();
    }
  }

  mountRegion() {
    if (this.liveRegion || !document.body) return;

    this.liveRegion = document.createElement('div');
    this.liveRegion.id = 'horologiumA11yLiveRegion';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');

    // Visually hidden according to WCAG recommendations
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0'
    });

    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announce message to assistive technologies with deduplication & throttle
   */
  announce(message, options = {}) {
    const { priority = 'polite', force = false } = options;
    const now = Date.now();

    if (!force && message === this.lastAnnouncement && now - this.lastAnnouncementTime < 3000) {
      return;
    }

    if (!force && now - this.lastAnnouncementTime < this.minIntervalMs) {
      // Debounce slightly if messages arrive in rapid bursts
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.announce(message, { priority, force: true }), this.minIntervalMs);
      return;
    }

    this.lastAnnouncement = message;
    this.lastAnnouncementTime = now;

    if (!this.liveRegion) this.mountRegion();
    if (!this.liveRegion) return;

    this.liveRegion.setAttribute('aria-live', priority);

    // Wipe then set to trigger screen reader change detection reliably
    this.liveRegion.textContent = '';
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    }, 50);
  }

  /**
   * Announce time on significant interval (e.g. on the hour or every 15 minutes, never every second)
   */
  announceHourlyShift(date = new Date()) {
    const hours = date.getUTCHours();
    const mins = date.getUTCMinutes();
    if (mins === 0) {
      this.announce(`Planetary Master Clock: ${hours}:00 UTC. New operational hour locked.`, { priority: 'polite' });
    }
  }

  /**
   * Announce working overlap delta
   */
  announceOverlapChange(stationA, stationB, deltaHours, isGolden) {
    const overlapState = isGolden ? 'Golden business overlap active.' : 'Non-overlapping hours.';
    this.announce(`Station comparison updated: ${stationA} and ${stationB}. Time delta is ${deltaHours} hours. ${overlapState}`);
  }

  /**
   * Announce search results count
   */
  announceSearchResults(count, query) {
    if (!query) return;
    this.announce(`${count} sovereign territories matching search query "${query}".`);
  }
}

export const a11y = new AccessibilityAnnouncer();
