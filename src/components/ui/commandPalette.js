/**
 * Horologium Command Palette (Cmd+K)
 * Fuzzy / substring country, capital, and timezone search modal
 */
import { COUNTRIES_DATA, getCountryData } from '../../data/countries.data.js';

export class CommandPalette {
  constructor(options = {}) {
    this.searchModal = document.getElementById('searchModal');
    this.searchTriggerBtn = document.getElementById('searchTriggerBtn');
    this.commandSearchInput = document.getElementById('commandSearchInput');
    this.commandSearchResults = document.getElementById('commandSearchResults');

    this.onSelectCountry = options.onSelectCountry || (() => {});
    this.countriesList = Object.keys(COUNTRIES_DATA).sort();

    this.init();
  }

  init() {
    if (!this.searchModal) return;

    if (this.searchTriggerBtn) {
      this.searchTriggerBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    this.searchModal.addEventListener('click', (e) => {
      if (e.target === this.searchModal) {
        this.close();
      }
    });

    if (this.commandSearchInput) {
      this.commandSearchInput.addEventListener('input', () => {
        this.handleSearch();
      });
    }

    if (this.commandSearchResults) {
      this.commandSearchResults.addEventListener('click', (e) => {
        const row = e.target.closest('.search-result-row');
        if (row) {
          const country = row.getAttribute('data-country');
          if (country) {
            this.onSelectCountry(country);
            this.close();
          }
        }
      });
    }

    // Keyboard Shortcuts: Cmd+K / Ctrl+K and Escape
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.open();
      } else if (e.key === 'Escape' && this.searchModal.classList.contains('open')) {
        this.close();
      }
    });
  }

  open() {
    if (!this.searchModal || !this.commandSearchInput) return;
    this.searchModal.classList.add('open');
    this.commandSearchInput.value = '';
    this.renderResults(this.countriesList.slice(0, 8));
    setTimeout(() => this.commandSearchInput.focus(), 50);
  }

  close() {
    if (!this.searchModal) return;
    this.searchModal.classList.remove('open');
  }

  handleSearch() {
    const query = this.commandSearchInput.value.trim().toLowerCase();
    if (!query) {
      this.renderResults(this.countriesList.slice(0, 8));
      return;
    }

    const matches = this.countriesList.filter(c => {
      const meta = getCountryData(c) || {};
      return c.toLowerCase().includes(query) ||
             (meta.capital && meta.capital.toLowerCase().includes(query)) ||
             (meta.utc && meta.utc.toLowerCase().includes(query)) ||
             (meta.abbr && meta.abbr.toLowerCase().includes(query)) ||
             (meta.code && meta.code.toLowerCase().includes(query));
    }).slice(0, 10);

    this.renderResults(matches);
  }

  renderResults(items) {
    if (!this.commandSearchResults) return;

    if (items.length === 0) {
      this.commandSearchResults.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-family: var(--font-mono); font-size: 11px;">
          NO GEODESIC MATCHES IDENTIFIED
        </div>
      `;
      return;
    }

    this.commandSearchResults.innerHTML = items.map(c => {
      const meta = getCountryData(c) || {};
      const flag = meta.flag || '🌐';
      const capital = meta.capital ? ` • ${meta.capital}` : '';
      const utc = meta.utc || 'UTC';
      return `
        <div class="search-result-row" data-country="${c}">
          <div>
            <span style="font-size: 14px; margin-right: 6px;">${flag}</span>
            <span class="search-result-city">${c}</span>
            <span class="search-result-country">${capital}</span>
          </div>
          <span class="search-result-tz">${utc}</span>
        </div>
      `;
    }).join('');
  }
}
