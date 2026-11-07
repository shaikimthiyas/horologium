/**
 * Horologium Map Controller (High-Craft Astronomical & Cartographic Engine)
 * Manages dual-theme vector cartography, 3-band atmospheric twilight,
 * golden-hour sunrise/sunset refraction line, night-masked bioluminescent city lights,
 * subsolar zenith beacon, annual solar analemma figure-8, 15° meridian time-band loupe,
 * and great-circle geodesic flight arcs.
 */

import {
  generateTwilightBands,
  calculateSolarAltitude,
  classifySolarState,
  calculateLocalSolarTime,
  calculateGreatCircleArc,
  svgPointToGeographic,
  geographicToSvgPoint,
  longitudeToUtcOffset,
  MAJOR_GLOBAL_CITIES
} from '../../utils/timeMath.js';
import { getCountryData } from '../../data/countries.data.js';
import { positionWithinViewport } from '../../utils/dom.js';

export class MapController {
  constructor(options = {}) {
    this.mapViewport = document.getElementById('mapViewport');
    this.svgElement = document.getElementById('allSvg');

    // Layers & Groups
    this.graticulesGroup = document.getElementById('graticulesGroup');
    this.celestialRailsGroup = document.getElementById('celestialRailsGroup');
    this.bathymetryShelfGroup = document.getElementById('bathymetryShelfGroup');
    this.nightCitiesGroup = document.getElementById('nightCitiesGroup');
    this.twilightBandsGroup = document.getElementById('twilightBandsGroup');
    this.celestialMechanicsGroup = document.getElementById('celestialMechanicsGroup');
    this.geodesicArcsGroup = document.getElementById('geodesicArcsGroup');
    this.pinnedCityBeaconsGroup = document.getElementById('pinnedCityBeaconsGroup');
    this.meridianLoupeGroup = document.getElementById('meridianLoupeGroup');

    // Dynamic SVG paths
    this.nightMaskPath = document.getElementById('nightMaskPath');
    this.civilTwilightPath = document.getElementById('civilTwilightPath');
    this.nauticalTwilightPath = document.getElementById('nauticalTwilightPath');
    this.astronomicalNightPath = document.getElementById('astronomicalNightPath');
    this.solarTerminatorEl = document.getElementById('solarTerminator');
    this.goldenHourGlow = document.getElementById('goldenHourGlow');
    this.goldenHourCore = document.getElementById('goldenHourCore');
    this.solarAnalemmaPath = document.getElementById('solarAnalemmaPath');
    this.subsolarBeaconGroup = document.getElementById('subsolarBeaconGroup');
    this.antisolarNadirGroup = document.getElementById('antisolarNadirGroup');

    // Loupe & Meridian needle
    this.meridianLoupeRect = document.getElementById('meridianLoupeRect');
    this.meridianLoupeLeftLine = document.getElementById('meridianLoupeLeftLine');
    this.meridianLoupeRightLine = document.getElementById('meridianLoupeRightLine');
    this.activeMeridianLine = document.getElementById('activeMeridianLine');

    // Telemetry & Tooltip
    this.tooltipEl = document.getElementById('name');
    this.tooltipFlag = document.getElementById('tooltipFlag');
    this.tooltipCountry = document.getElementById('tooltipCountry');
    this.tooltipEditorial = document.getElementById('tooltipEditorial');
    this.tooltipSolarTime = document.getElementById('tooltipSolarTime');
    this.tooltipSolarBadge = document.getElementById('tooltipSolarBadge');

    this.cursorCoordVal = document.getElementById('cursorCoordVal');
    this.cursorMeridianVal = document.getElementById('cursorMeridianVal');

    this.onSelectCountry = options.onSelectCountry || (() => {});

    this.pathsByCountry = new Map();
    this.allPathsList = [];
    this.currentSelectedCountry = null;
    this.showGraticules = true;
    this.currentDate = new Date();

    // Default reference cities for geodesic comparison
    this.referenceCity = { id: 'LON', name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 };
    this.selectedCity = { id: 'TYO', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 };

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
    this.renderBathymetryShelf();
    this.renderGraticules();
    this.renderCelestialRails();
    this.renderNightCityClusters();
    this.renderPinnedCityBeacons();
    this.updateGeodesicArc(this.referenceCity, this.selectedCity);
    this.updateTerminator(this.currentDate);
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

  /**
   * Render subtle continental shelf bathymetry contour behind landmasses
   */
  renderBathymetryShelf() {
    if (!this.bathymetryShelfGroup || this.allPathsList.length === 0) return;
    this.bathymetryShelfGroup.innerHTML = '';

    // Sample major coastline segments for performance
    const fragment = document.createDocumentFragment();
    this.allPathsList.forEach((p, idx) => {
      if (idx % 2 === 0) {
        const shelf = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shelf.setAttribute('d', p.getAttribute('d'));
        shelf.setAttribute('class', 'bathymetry-shelf-path');
        fragment.appendChild(shelf);
      }
    });
    this.bathymetryShelfGroup.appendChild(fragment);
  }

  /**
   * Render 15° meridian lines (1-hour timezone bands) & latitude graticules
   */
  renderGraticules() {
    if (!this.graticulesGroup) return;
    this.graticulesGroup.innerHTML = '';

    const width = 2000;
    const height = 857;
    const fragment = document.createDocumentFragment();

    // Longitude lines every 15° (1h timezone bands)
    for (let lon = -180; lon <= 180; lon += 15) {
      const x = ((lon + 180) / 360) * width;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toFixed(1));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', height.toString());
      line.setAttribute('class', lon === 0 ? 'map-equator-meridian' : 'map-graticule-line');
      fragment.appendChild(line);

      // UTC Hour Labels along bottom inner edge every 30°
      if (lon % 30 === 0 && lon >= -180 && lon <= 180) {
        const offset = Math.round(lon / 15);
        const sign = offset > 0 ? '+' : (offset < 0 ? '−' : '±');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x.toFixed(1));
        text.setAttribute('y', (height - 10).toString());
        text.setAttribute('class', 'meridian-hour-label');
        text.textContent = `UTC${sign}${Math.abs(offset)}`;
        fragment.appendChild(text);
      }
    }

    // Standard Latitude lines
    const latitudes = [-66.5, -45, 45, 66.5];
    latitudes.forEach(lat => {
      const y = ((90 - lat) / 180) * height;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y.toFixed(1));
      line.setAttribute('class', 'map-graticule-line');
      fragment.appendChild(line);
    });

    this.graticulesGroup.appendChild(fragment);
  }

  /**
   * Render Labeled Celestial Rails: Tropic of Cancer, Equator, and Tropic of Capricorn
   */
  renderCelestialRails() {
    if (!this.celestialRailsGroup) return;
    this.celestialRailsGroup.innerHTML = '';

    const width = 2000;
    const height = 857;
    const fragment = document.createDocumentFragment();

    const rails = [
      { lat: 23.44, label: '23.4°N · TROPIC OF CANCER', class: 'celestial-rail-line' },
      { lat: 0.0, label: '0.0° · EQUATOR', class: 'celestial-rail-equator' },
      { lat: -23.44, label: '23.4°S · TROPIC OF CAPRICORN', class: 'celestial-rail-line' }
    ];

    rails.forEach(rail => {
      const y = ((90 - rail.lat) / 180) * height;

      // Guideline
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('x2', width.toString());
      line.setAttribute('y2', y.toFixed(1));
      line.setAttribute('class', rail.class);
      fragment.appendChild(line);

      // Margin Labels (Left and Right)
      const labelLeft = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelLeft.setAttribute('x', '16');
      labelLeft.setAttribute('y', (y - 5).toFixed(1));
      labelLeft.setAttribute('class', 'celestial-rail-label');
      labelLeft.textContent = rail.label;
      fragment.appendChild(labelLeft);

      const labelRight = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelRight.setAttribute('x', (width - 16).toString());
      labelRight.setAttribute('y', (y - 5).toFixed(1));
      labelRight.setAttribute('text-anchor', 'end');
      labelRight.setAttribute('class', 'celestial-rail-label');
      labelRight.textContent = rail.label;
      fragment.appendChild(labelRight);
    });

    this.celestialRailsGroup.appendChild(fragment);
  }

  /**
   * Render ~80 Global Metropolitan Hubs inside the Night-Umbra Mask
   * Automatically illuminated by the GPU when sunset sweeps over them!
   */
  renderNightCityClusters() {
    if (!this.nightCitiesGroup) return;
    this.nightCitiesGroup.innerHTML = '';

    const fragment = document.createDocumentFragment();

    MAJOR_GLOBAL_CITIES.forEach(city => {
      const pt = geographicToSvgPoint(city.lat, city.lon, 2000, 857);

      // Radial glow
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', pt.x.toFixed(1));
      glow.setAttribute('cy', pt.y.toFixed(1));
      glow.setAttribute('r', '4.5');
      glow.setAttribute('class', 'night-city-glow');
      fragment.appendChild(glow);

      // Core micro-light
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('r', '1.5');
      dot.setAttribute('class', 'night-city-dot');
      dot.setAttribute('data-city-id', city.id);
      fragment.appendChild(dot);
    });

    this.nightCitiesGroup.appendChild(fragment);
  }

  /**
   * Render Pinned Cities interactive beacons
   */
  renderPinnedCityBeacons() {
    if (!this.pinnedCityBeaconsGroup) return;
    this.pinnedCityBeaconsGroup.innerHTML = '';

    const pinnedCities = [
      { id: 'LON', name: 'London', code: 'LON', lat: 51.5074, lon: -0.1278 },
      { id: 'NYC', name: 'New York', code: 'NYC', lat: 40.7128, lon: -74.0060 },
      { id: 'TYO', name: 'Tokyo', code: 'TYO', lat: 35.6762, lon: 139.6503 },
      { id: 'DEL', name: 'New Delhi', code: 'DEL', lat: 28.6139, lon: 77.2090 },
      { id: 'SYD', name: 'Sydney', code: 'SYD', lat: -33.8688, lon: 151.2093 }
    ];

    const fragment = document.createDocumentFragment();

    pinnedCities.forEach(city => {
      const pt = geographicToSvgPoint(city.lat, city.lon, 2000, 857);
      const isSelected = this.selectedCity && this.selectedCity.id === city.id;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
      g.style.cursor = 'pointer';

      if (isSelected) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('r', '10');
        ring.setAttribute('class', 'pinned-city-beacon-active-ring');
        g.appendChild(ring);
      }

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', isSelected ? '5' : '3.5');
      dot.setAttribute('class', 'pinned-city-beacon-dot');
      g.appendChild(dot);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '8');
      label.setAttribute('y', '3');
      label.setAttribute('class', 'pinned-city-label-pill');
      label.textContent = city.code;
      g.appendChild(label);

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCity = city;
        this.renderPinnedCityBeacons();
        this.updateGeodesicArc(this.referenceCity, this.selectedCity);
      });

      fragment.appendChild(g);
    });

    this.pinnedCityBeaconsGroup.appendChild(fragment);
  }

  /**
   * Update Great-Circle Geodesic Arc connecting reference city to compared city
   */
  updateGeodesicArc(city1, city2) {
    if (!this.geodesicArcsGroup || !city1 || !city2) return;
    this.geodesicArcsGroup.innerHTML = '';

    const arc = calculateGreatCircleArc(city1, city2, 2000, 857, 50);

    // Backdrop line
    const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    backdrop.setAttribute('d', arc.pathD);
    backdrop.setAttribute('class', 'geodesic-path-backdrop');
    this.geodesicArcsGroup.appendChild(backdrop);

    // Active animated pulse line
    const active = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    active.setAttribute('d', arc.pathD);
    active.setAttribute('class', 'geodesic-path-active');
    this.geodesicArcsGroup.appendChild(active);
  }

  toggleGraticules() {
    this.showGraticules = !this.showGraticules;
    if (this.graticulesGroup) {
      this.graticulesGroup.style.display = this.showGraticules ? 'block' : 'none';
    }
    if (this.celestialRailsGroup) {
      this.celestialRailsGroup.style.display = this.showGraticules ? 'block' : 'none';
    }
    return this.showGraticules;
  }

  /**
   * Update 3-Band Atmospheric Twilight, Golden Hour Ribbon, Subsolar Beacon & Analemma
   */
  updateTerminator(date) {
    this.currentDate = date || new Date();
    const bands = generateTwilightBands(this.currentDate, 2000, 857, 120);

    // 1. Multi-Band Twilight Paths
    if (this.civilTwilightPath) {
      this.civilTwilightPath.setAttribute('d', bands.civilPolygonD);
    }
    if (this.nauticalTwilightPath) {
      this.nauticalTwilightPath.setAttribute('d', bands.nauticalPolygonD);
    }
    if (this.astronomicalNightPath) {
      this.astronomicalNightPath.setAttribute('d', bands.astronomicalPolygonD);
    }

    // 2. Night Umbra Mask for bioluminescent cities
    if (this.nightMaskPath) {
      this.nightMaskPath.setAttribute('d', bands.civilPolygonD);
    }

    // 3. Golden Hour Refraction Line along 0° horizon
    if (this.goldenHourGlow) {
      this.goldenHourGlow.setAttribute('d', bands.goldenHourLineD);
    }
    if (this.goldenHourCore) {
      this.goldenHourCore.setAttribute('d', bands.goldenHourLineD);
    }

    // 4. Backward compatibility for legacy element & unit tests
    if (this.solarTerminatorEl) {
      this.solarTerminatorEl.setAttribute('d', bands.civilPolygonD);
    }

    // 5. Solar Analemma Figure-8 Curve
    if (this.solarAnalemmaPath) {
      this.solarAnalemmaPath.setAttribute('d', bands.analemmaPathD);
    }

    // 6. Subsolar Zenith Beacon (Live Sun position at 90° overhead)
    if (this.subsolarBeaconGroup) {
      const sunPt = bands.subsolarPoint;
      this.subsolarBeaconGroup.innerHTML = `
        <g transform="translate(${sunPt.x.toFixed(1)}, ${sunPt.y.toFixed(1)})">
          <circle class="subsolar-pulse-ring" r="28" />
          <circle class="subsolar-compass-ring" r="14" />
          <circle class="subsolar-sun-core" r="4.5" />
          <line x1="-18" y1="0" x2="-8" y2="0" stroke="#F59E0B" stroke-width="1" />
          <line x1="8" y1="0" x2="18" y2="0" stroke="#F59E0B" stroke-width="1" />
          <line x1="0" y1="-18" x2="0" y2="-8" stroke="#F59E0B" stroke-width="1" />
          <line x1="0" y1="8" x2="0" y2="18" stroke="#F59E0B" stroke-width="1" />
        </g>
      `;
    }

    // 7. Antisolar Nadir Crosshair
    if (this.antisolarNadirGroup) {
      const nadirPt = bands.antisolarPoint;
      this.antisolarNadirGroup.innerHTML = `
        <g transform="translate(${nadirPt.x.toFixed(1)}, ${nadirPt.y.toFixed(1)})" opacity="0.45">
          <circle r="6" fill="none" stroke="var(--accent-secondary)" stroke-width="1" stroke-dasharray="2 2" />
          <circle r="1.5" fill="var(--accent-secondary)" />
        </g>
      `;
    }

    return {
      pathD: bands.civilPolygonD,
      declinationDeg: bands.declinationDeg,
      subsolarLon: bands.subsolarLon,
      bands
    };
  }

  setupInteractions() {
    if (!this.mapViewport || !this.svgElement) return;

    // Pointer move across viewport: 15° Meridian Loupe & Solar Telemetry
    this.mapViewport.addEventListener('mousemove', (e) => {
      const rect = this.svgElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const svgX = (clientX / rect.width) * 2000;
      const svgY = (clientY / rect.height) * 857;

      const { lat, lon } = svgPointToGeographic(svgX, svgY, 2000, 857);

      // Coordinates HUD Readout
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

      // Interactive 15° Meridian Time-Band Loupe
      if (this.meridianLoupeGroup && this.meridianLoupeRect) {
        const bandIndex = Math.floor((lon + 180) / 15);
        const bandLonLeft = -180 + bandIndex * 15;
        const bandXLeft = ((bandLonLeft + 180) / 360) * 2000;
        const bandWidth = (15 / 360) * 2000; // 83.33px

        this.meridianLoupeRect.setAttribute('x', bandXLeft.toFixed(1));
        this.meridianLoupeRect.setAttribute('width', bandWidth.toFixed(1));

        if (this.meridianLoupeLeftLine) {
          this.meridianLoupeLeftLine.setAttribute('x1', bandXLeft.toFixed(1));
          this.meridianLoupeLeftLine.setAttribute('x2', bandXLeft.toFixed(1));
        }
        if (this.meridianLoupeRightLine) {
          this.meridianLoupeRightLine.setAttribute('x1', (bandXLeft + bandWidth).toFixed(1));
          this.meridianLoupeRightLine.setAttribute('x2', (bandXLeft + bandWidth).toFixed(1));
        }
        this.meridianLoupeGroup.style.opacity = '1';
      }

      if (this.activeMeridianLine) {
        this.activeMeridianLine.setAttribute('x1', svgX.toFixed(1));
        this.activeMeridianLine.setAttribute('x2', svgX.toFixed(1));
        this.activeMeridianLine.style.opacity = '1';
      }

      // Update Floating Tooltip Position & Solar Telemetry
      if (this.tooltipEl && this.tooltipEl.style.opacity === '1') {
        this.updateTooltipSolarData(lat, lon);
        positionWithinViewport(this.tooltipEl, e.clientX, e.clientY);
      }
    });

    this.mapViewport.addEventListener('mouseleave', () => {
      if (this.activeMeridianLine) this.activeMeridianLine.style.opacity = '0';
      if (this.meridianLoupeGroup) this.meridianLoupeGroup.style.opacity = '0';
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

  updateTooltipSolarData(lat, lon) {
    if (!this.tooltipSolarTime || !this.tooltipSolarBadge) return;

    const solarTime = calculateLocalSolarTime(lon, this.currentDate);
    const altitude = calculateSolarAltitude(lat, lon, this.currentDate);
    const solarState = classifySolarState(altitude);

    this.tooltipSolarTime.textContent = `SOLAR ${solarTime.formatted}`;
    this.tooltipSolarBadge.textContent = solarState.badge;
    this.tooltipSolarBadge.style.color = solarState.color;
    this.tooltipSolarBadge.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
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

    // Check if this country matches any known city for geodesic arc comparison
    const matchedCity = MAJOR_GLOBAL_CITIES.find(c => c.country.toLowerCase() === countryName.toLowerCase());
    if (matchedCity) {
      this.selectedCity = matchedCity;
      this.renderPinnedCityBeacons();
      this.updateGeodesicArc(this.referenceCity, this.selectedCity);
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
      // SVG getBBox fallback in headless environments
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
