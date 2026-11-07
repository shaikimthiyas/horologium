/**
 * Horologium Map Controller
 * Manages vector SVG rendering, graticule grid, solar terminator, reticle, and zoom/pan
 */
import { generateTerminatorPath, svgPointToGeographic, longitudeToUtcOffset } from '../../utils/timeMath.js';
import { getCountryData } from '../../data/countries.data.js';
import { positionWithinViewport } from '../../utils/dom.js';

export class MapController {
  constructor(options = {}) {
    this.mapViewport = document.getElementById('mapViewport');
    this.svgElement = document.getElementById('allSvg');
    this.graticulesGroup = document.getElementById('graticulesGroup');
    this.solarTerminatorEl = document.getElementById('solarTerminator');
    this.activeMeridianLine = document.getElementById('activeMeridianLine');
    this.tooltipEl = document.getElementById('name');
    this.tooltipFlag = document.getElementById('tooltipFlag');
    this.tooltipCountry = document.getElementById('tooltipCountry');
    this.tooltipEditorial = document.getElementById('tooltipEditorial');

    this.cursorCoordVal = document.getElementById('cursorCoordVal');
    this.cursorMeridianVal = document.getElementById('cursorMeridianVal');

    this.onSelectCountry = options.onSelectCountry || (() => {});

    this.pathsByCountry = new Map();
    this.allPathsList = [];
    this.currentSelectedCountry = null;
    this.showGraticules = true;

    // Zoom & Pan state
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.init();
  }

  init() {
    this.indexSvgPaths();
    this.renderGraticules();
    this.setupInteractions();
  }

  indexSvgPaths() {
    const paths = document.querySelectorAll('.allPaths');
    this.allPathsList = Array.from(paths);

    this.allPathsList.forEach(path => {
      const countryId = path.id;
      if (!countryId) return;

      if (!this.pathsByCountry.has(countryId)) {
        this.pathsByCountry.set(countryId, []);
      }
      this.pathsByCountry.get(countryId).push(path);
    });
  }

  renderGraticules() {
    if (!this.graticulesGroup) return;
    this.graticulesGroup.innerHTML = '';

    const width = 2000;
    const height = 857;

    // Longitude lines every 15° (1h timezone bands)
    for (let lon = -180; lon <= 180; lon += 15) {
      const x = ((lon + 180) / 360) * width;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toFixed(1));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', height.toString());
      line.setAttribute('class', lon === 0 ? 'map-equator-meridian' : 'map-graticule-line');
      this.graticulesGroup.appendChild(line);
    }

    // Latitude lines
    const latitudes = [-66.5, -45, -23.5, 0, 23.5, 45, 66.5];
    latitudes.forEach(lat => {
      const y = ((90 - lat) / 180) * height;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y.toFixed(1));
      line.setAttribute('class', lat === 0 ? 'map-equator-meridian' : 'map-graticule-line');
      this.graticulesGroup.appendChild(line);
    });
  }

  toggleGraticules() {
    this.showGraticules = !this.showGraticules;
    if (this.graticulesGroup) {
      this.graticulesGroup.style.display = this.showGraticules ? 'block' : 'none';
    }
    return this.showGraticules;
  }

  updateTerminator(date) {
    if (!this.solarTerminatorEl) return;
    const res = generateTerminatorPath(date);
    this.solarTerminatorEl.setAttribute('d', res.pathD);
    return res;
  }

  setupInteractions() {
    if (!this.mapViewport || !this.svgElement) return;

    // Pointer move across viewport
    this.mapViewport.addEventListener('mousemove', (e) => {
      const rect = this.svgElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const svgX = (clientX / rect.width) * 2000;
      const svgY = (clientY / rect.height) * 857;

      const { lat, lon } = svgPointToGeographic(svgX, svgY);

      if (this.cursorCoordVal) {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lonDir = lon >= 0 ? 'E' : 'W';
        this.cursorCoordVal.textContent = `LAT ${Math.abs(lat).toFixed(2)}° ${latDir} · LON ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
      }

      if (this.cursorMeridianVal) {
        const offset = longitudeToUtcOffset(lon);
        const sign = offset >= 0 ? '+' : '−';
        this.cursorMeridianVal.textContent = `UTC${sign}${String(Math.abs(offset)).padStart(2, '0')}:00`;
      }

      if (this.activeMeridianLine) {
        this.activeMeridianLine.setAttribute('x1', svgX.toFixed(1));
        this.activeMeridianLine.setAttribute('x2', svgX.toFixed(1));
        this.activeMeridianLine.style.opacity = '1';
      }

      if (this.tooltipEl && this.tooltipEl.style.opacity === '1') {
        positionWithinViewport(this.tooltipEl, e.clientX, e.clientY);
      }
    });

    this.mapViewport.addEventListener('mouseleave', () => {
      if (this.activeMeridianLine) this.activeMeridianLine.style.opacity = '0';
      if (this.tooltipEl) this.tooltipEl.style.opacity = '0';
    });

    // Country hover and click
    this.allPathsList.forEach(path => {
      path.addEventListener('mouseenter', (e) => {
        const country = path.id;
        this.highlightCountry(country, true);
        this.showTooltip(country, e.clientX, e.clientY);
      });

      path.addEventListener('mouseleave', () => {
        const country = path.id;
        this.highlightCountry(country, false);
        if (this.tooltipEl) this.tooltipEl.style.opacity = '0';
      });

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectCountry(path.id);
      });
    });

    // Drag to pan
    this.mapViewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.map-dock-instrument') || e.target.closest('#name')) return;
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Wheel zoom
    this.mapViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      this.zoomLevel = Math.min(Math.max(0.7, this.zoomLevel + delta), 4.5);
      this.applyTransform();
    }, { passive: false });
  }

  showTooltip(countryName, x, y) {
    if (!this.tooltipEl) return;
    const meta = getCountryData(countryName);
    if (this.tooltipFlag) this.tooltipFlag.textContent = meta ? meta.flag : '🌐';
    if (this.tooltipCountry) this.tooltipCountry.textContent = countryName.toUpperCase();
    if (this.tooltipEditorial) this.tooltipEditorial.textContent = meta && meta.capital ? `// ${meta.capital}` : '';

    positionWithinViewport(this.tooltipEl, x, y);
    this.tooltipEl.style.opacity = '1';
  }

  highlightCountry(countryName, isHovered) {
    const segments = this.pathsByCountry.get(countryName) || [];
    segments.forEach(p => {
      if (p.classList.contains('selected-country')) return;
      if (isHovered) {
        p.style.fill = 'var(--map-land-hover)';
        p.style.stroke = 'var(--border-focus)';
      } else {
        p.style.fill = '';
        p.style.stroke = '';
      }
    });
  }

  selectCountry(countryName) {
    if (!countryName) return;

    if (this.currentSelectedCountry && this.pathsByCountry.has(this.currentSelectedCountry)) {
      this.pathsByCountry.get(this.currentSelectedCountry).forEach(p => {
        p.classList.remove('selected-country');
        p.style.fill = '';
        p.style.stroke = '';
      });
    }

    this.currentSelectedCountry = countryName;

    if (this.pathsByCountry.has(countryName)) {
      this.pathsByCountry.get(countryName).forEach(p => {
        p.classList.add('selected-country');
      });
    }

    this.onSelectCountry(countryName);
  }

  focusOnCountry(countryName) {
    const paths = this.pathsByCountry.get(countryName);
    if (!paths || paths.length === 0) return;

    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      paths.forEach(p => {
        const bbox = p.getBBox();
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      this.panX = (1000 - centerX) * 0.45;
      this.panY = (428 - centerY) * 0.45;
      this.zoomLevel = Math.max(1.3, this.zoomLevel);
      this.applyTransform();
    } catch (e) {
      // SVG getBBox fallback
    }
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.35, 4.5);
    this.applyTransform();
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.35, 0.7);
    this.applyTransform();
  }

  resetView() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.svgElement) return;
    this.svgElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
  }
}
