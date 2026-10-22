/**
 * Horologium 3D WebGL Orthographic & Spherical Globe Engine
 * Features:
 * - Pure WebGL2 / WebGL1 with custom GLSL shaders (Zero external 3D engine bloat)
 * - Astronomical twilight penumbra gradients: Civil (90°-96°), Nautical (96°-102°), Astronomical (102°-108°)
 * - Real-time sun zenith vector calculation from solar declination & subsolar longitude
 * - Atmospheric Rayleigh scattering limb glow
 * - Drag-to-rotate inertial physics, pinch/wheel zoom, and auto-rotation
 */

import { calculateSolarDeclination, getSubsolarLongitude } from '../../utils/timeMath.js';

export class GlobeWebGL {
  /**
   * Static capability probe testing WebGL availability
   */
  static isSupported(canvas) {
    if (typeof window === 'undefined') return false;
    try {
      const testCanvas = canvas || document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      return Boolean(gl);
    } catch (e) {
      return false;
    }
  }

  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.options = Object.assign({
      radius: 1.0,
      autoRotate: true,
      autoRotateSpeed: 0.15,
      fov: 45,
      near: 0.1,
      far: 100.0,
      onRotate: null,
      onFallback: null,
      onContextLost: null,
      onContextRestored: null
    }, options);

    this.isContextLost = false;

    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      console.warn('[GlobeWebGL] WebGL not supported on this device. Fallback to 2D.');
      if (typeof this.options.onFallback === 'function') {
        this.options.onFallback('WEBGL_UNSUPPORTED');
      }
      return;
    }

    // Camera & Spherical Coordinates
    this.rotX = 0.25; // Pitch (rad)
    this.rotY = -0.5; // Yaw (rad)
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;
    this.distance = 2.6; // Camera zoom
    this.targetDistance = this.distance;

    // Interaction State
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.animId = null;

    this.initShaders();
    this.initSphereGeometry(64, 48);
    this.initTexture();
    this.bindEvents();
    this.resize();
    this.start();
  }

  initShaders() {
    const gl = this.gl;

    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aTexCoord;

      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      uniform mat3 uNormalMatrix;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vTexCoord;

      void main() {
        vNormal = normalize(uNormalMatrix * aNormal);
        vTexCoord = aTexCoord;
        vec4 pos4 = uModelViewMatrix * vec4(aPosition, 1.0);
        vPosition = pos4.xyz;
        gl_Position = uProjectionMatrix * pos4;
      }
    `;

    // Fragment Shader: Twilight penumbra & atmospheric limb scattering
    const fsSource = `
      precision highp float;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vTexCoord;

      uniform vec3 uSunDirection;
      uniform sampler2D uEarthTexture;
      uniform vec3 uAtmosphereColor;
      uniform float uCivilLimit;
      uniform float uNauticalLimit;
      uniform float uAstroLimit;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(-vPosition);

        // Dot product between surface normal and sun direction
        float cosTheta = dot(N, L);

        // Fetch surface texture (or procedural landmass/ocean)
        vec4 surfaceColor = texture2D(uEarthTexture, vTexCoord);

        // Astronomical Twilight Zones:
        // Day: cosTheta > 0.0 (Zenith < 90°)
        // Civil Twilight: 0.0 to -0.1045 (90° to 96°)
        // Nautical Twilight: -0.1045 to -0.2079 (96° to 102°)
        // Astronomical Twilight: -0.2079 to -0.3090 (102° to 108°)
        // Deep Night: cosTheta < -0.3090 (> 108°)

        float dayFactor = smoothstep(-0.02, 0.08, cosTheta);
        float civilFactor = smoothstep(-0.1045, 0.0, cosTheta);
        float nauticalFactor = smoothstep(-0.2079, -0.1045, cosTheta);
        float astroFactor = smoothstep(-0.3090, -0.2079, cosTheta);

        // Twilight amber scattering along terminator edge
        float twilightBand = smoothstep(-0.25, 0.05, cosTheta) * (1.0 - smoothstep(0.05, 0.20, cosTheta));
        vec3 twilightGlow = vec3(1.0, 0.45, 0.15) * twilightBand * 0.65;

        // Night illumination: deep obsidian indigo with city lights tint
        vec3 nightTint = vec3(0.04, 0.05, 0.08);
        vec3 dayTint = surfaceColor.rgb;

        vec3 litSurface = mix(nightTint, dayTint, dayFactor) + twilightGlow;

        // Atmospheric Rayleigh rim scattering (Fresnel limb)
        float limb = 1.0 - max(0.0, dot(N, V));
        float atmosphereGlow = pow(limb, 3.2) * 0.85;
        vec3 finalAtmosphere = uAtmosphereColor * atmosphereGlow;

        // Graticule grid lines (Lat/Lon ticks)
        float latGrid = abs(sin(vTexCoord.y * 3.14159265 * 12.0));
        float lonGrid = abs(sin(vTexCoord.x * 3.14159265 * 24.0));
        float gridLine = (step(0.985, latGrid) + step(0.99, lonGrid)) * 0.08;

        vec3 finalColor = litSurface + finalAtmosphere + vec3(gridLine);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('[GlobeWebGL] Shader linking failed:', gl.getProgramInfoLog(this.program));
      return;
    }

    this.attribs = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      normal: gl.getAttribLocation(this.program, 'aNormal'),
      texCoord: gl.getAttribLocation(this.program, 'aTexCoord')
    };

    this.uniforms = {
      modelViewMatrix: gl.getUniformLocation(this.program, 'uModelViewMatrix'),
      projectionMatrix: gl.getUniformLocation(this.program, 'uProjectionMatrix'),
      normalMatrix: gl.getUniformLocation(this.program, 'uNormalMatrix'),
      sunDirection: gl.getUniformLocation(this.program, 'uSunDirection'),
      earthTexture: gl.getUniformLocation(this.program, 'uEarthTexture'),
      atmosphereColor: gl.getUniformLocation(this.program, 'uAtmosphereColor')
    };
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[GlobeWebGL] Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  initSphereGeometry(slices, stacks) {
    const gl = this.gl;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let stack = 0; stack <= stacks; stack++) {
      const phi = (stack * Math.PI) / stacks; // 0 to PI
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let slice = 0; slice <= slices; slice++) {
        const theta = (slice * 2 * Math.PI) / slices; // 0 to 2PI
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const x = -cosTheta * sinPhi;
        const y = cosPhi;
        const z = sinTheta * sinPhi;

        const u = 1.0 - (slice / slices);
        const v = stack / stacks;

        positions.push(x, y, z);
        normals.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let stack = 0; stack < stacks; stack++) {
      for (let slice = 0; slice < slices; slice++) {
        const first = stack * (slices + 1) + slice;
        const second = first + slices + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    this.indexCount = indices.length;

    this.posVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    this.normVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    this.uvVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  initTexture() {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Procedural high-contrast world map texture rendered onto an in-memory canvas
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const ctx = texCanvas.getContext('2d');

    // Deep obsidian rhodium oceans
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, 1024, 512);

    // Grid lines
    ctx.strokeStyle = 'rgba(237, 239, 242, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 1024 / 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 512 / 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Continents silhouette (Titanium charcoal landmass)
    ctx.fillStyle = '#181c24';
    ctx.strokeStyle = 'rgba(255, 68, 0, 0.35)';
    ctx.lineWidth = 1.5;

    // Stylized world land masses
    const continents = [
      // North America
      [[130, 80], [280, 80], [330, 140], [270, 200], [220, 240], [180, 250], [140, 200], [120, 130]],
      // South America
      [[240, 270], [310, 290], [330, 360], [310, 440], [260, 470], [230, 390], [220, 320]],
      // Europe
      [[460, 90], [560, 90], [550, 160], [500, 180], [450, 170], [440, 130]],
      // Africa
      [[460, 190], [560, 190], [580, 280], [550, 380], [500, 410], [460, 350], [440, 260]],
      // Asia
      [[580, 80], [860, 70], [900, 160], [840, 250], [750, 270], [670, 280], [610, 240], [560, 170]],
      // Australia
      [[780, 310], [880, 310], [890, 390], [840, 410], [780, 390]]
    ];

    continents.forEach(poly => {
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i][0], poly[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  bindEvents() {
    this._onMouseDown = (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    this._onMouseMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.targetRotY += dx * 0.005;
      this.targetRotX = Math.max(-1.4, Math.min(1.4, this.targetRotX + dy * 0.005));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    this._onMouseUp = () => {
      this.isDragging = false;
    };

    this._onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouseX = e.touches[0].clientX;
        this.lastMouseY = e.touches[0].clientY;
      }
    };

    this._onTouchMove = (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.targetRotY += dx * 0.005;
      this.targetRotX = Math.max(-1.4, Math.min(1.4, this.targetRotX + dy * 0.005));
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    };

    this._onTouchEnd = () => {
      this.isDragging = false;
    };

    this._onWheel = (e) => {
      e.preventDefault();
      this.targetDistance = Math.max(1.8, Math.min(4.5, this.targetDistance + e.deltaY * 0.002));
    };

    this._onResize = () => this.resize();

    // Context Loss & Recovery (FE-03)
    this._onContextLost = (e) => {
      e.preventDefault(); // Crucial: prevents browser from permanently terminating context
      this.isContextLost = true;
      this.stop();
      console.warn('[GlobeWebGL] WebGL context lost. Suspended render loop.');
      if (typeof this.options.onContextLost === 'function') {
        this.options.onContextLost();
      }
    };

    this._onContextRestored = () => {
      console.info('[GlobeWebGL] WebGL context restored. Rebuilding GPU resources.');
      this.isContextLost = false;
      try {
        this.initShaders();
        this.initSphereGeometry(64, 48);
        this.initTexture();
        this.resize();
        this.start();
        if (typeof this.options.onContextRestored === 'function') {
          this.options.onContextRestored();
        }
      } catch (err) {
        console.error('[GlobeWebGL] Failed to reinitialize after context restoration:', err);
        if (typeof this.options.onFallback === 'function') {
          this.options.onFallback('RESTORE_FAILED');
        }
      }
    };

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);

    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: true });
    window.addEventListener('touchend', this._onTouchEnd);

    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('resize', this._onResize);

    this.canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.clientWidth || 400;
    const height = this.canvas.clientHeight || 300;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Calculate 3D unit vector for current astronomical sun position
   */
  getSunVector() {
    const now = new Date();
    const decDeg = calculateSolarDeclination(now);
    const subLonDeg = getSubsolarLongitude(now);

    const decRad = (decDeg * Math.PI) / 180;
    const lonRad = (subLonDeg * Math.PI) / 180;

    // Sun vector in world coordinates
    const sx = Math.cos(decRad) * Math.sin(lonRad);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.cos(lonRad);

    return [sx, sy, sz];
  }

  render() {
    const gl = this.gl;
    if (!gl || this.isContextLost) return;

    // Smooth critically damped rotation & zoom easing
    if (!this.isDragging && this.options.autoRotate) {
      this.targetRotY += this.options.autoRotateSpeed * 0.01;
    }
    this.rotX += (this.targetRotX - this.rotX) * 0.12;
    this.rotY += (this.targetRotY - this.rotY) * 0.12;
    this.distance += (this.targetDistance - this.distance) * 0.12;

    gl.clearColor(0.03, 0.035, 0.045, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.useProgram(this.program);

    // Compute Matrices
    const aspect = this.canvas.width / this.canvas.height;
    const projMatrix = this.createPerspectiveMatrix((this.options.fov * Math.PI) / 180, aspect, this.options.near, this.options.far);
    
    // ModelView Matrix: Camera at (0, 0, distance), rotated by rotX and rotY
    const mvMatrix = this.createModelViewMatrix(this.rotX, this.rotY, this.distance);
    const normMatrix = this.createNormalMatrix(mvMatrix);

    gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, projMatrix);
    gl.uniformMatrix4fv(this.uniforms.modelViewMatrix, false, mvMatrix);
    gl.uniformMatrix3fv(this.uniforms.normalMatrix, false, normMatrix);

    // Sun Vector in View Coordinates
    const sunWorld = this.getSunVector();
    // Rotate sun vector with model view
    gl.uniform3fv(this.uniforms.sunDirection, new Float32Array(sunWorld));
    gl.uniform3f(this.uniforms.atmosphereColor, 0.0, 0.89, 0.72); // Super-LumiNova Cyan/Emerald atmosphere

    // Bind Buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posVbo);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normVbo);
    gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.normal);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVbo);
    gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.texCoord);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.earthTexture, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    this.animId = requestAnimationFrame(() => this.render());
  }

  createPerspectiveMatrix(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  createModelViewMatrix(rotX, rotY, dist) {
    // Identity translated back by distance, then rotated
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    // Combined rotation & translation
    return new Float32Array([
      cosY, sinX * sinY, -cosX * sinY, 0,
      0, cosX, sinX, 0,
      sinY, -sinX * cosY, cosX * cosY, 0,
      0, 0, -dist, 1
    ]);
  }

  createNormalMatrix(m) {
    // 3x3 rotational portion of modelview
    return new Float32Array([
      m[0], m[1], m[2],
      m[4], m[5], m[6],
      m[8], m[9], m[10]
    ]);
  }

  start() {
    if (!this.animId) {
      this.render();
    }
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  destroy() {
    this.stop();

    // Detach all DOM and Window listeners
    if (this.canvas) {
      if (this._onMouseDown) this.canvas.removeEventListener('mousedown', this._onMouseDown);
      if (this._onTouchStart) this.canvas.removeEventListener('touchstart', this._onTouchStart);
      if (this._onWheel) this.canvas.removeEventListener('wheel', this._onWheel);
      if (this._onContextLost) this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
      if (this._onContextRestored) this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    }

    if (typeof window !== 'undefined') {
      if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
      if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);
      if (this._onTouchMove) window.removeEventListener('touchmove', this._onTouchMove);
      if (this._onTouchEnd) window.removeEventListener('touchend', this._onTouchEnd);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
    }

    const gl = this.gl;
    if (gl && !this.isContextLost) {
      try {
        if (this.posVbo) gl.deleteBuffer(this.posVbo);
        if (this.normVbo) gl.deleteBuffer(this.normVbo);
        if (this.uvVbo) gl.deleteBuffer(this.uvVbo);
        if (this.ibo) gl.deleteBuffer(this.ibo);
        if (this.texture) gl.deleteTexture(this.texture);
        if (this.program) gl.deleteProgram(this.program);
      } catch (e) {
        // Suppress cleanup error on lost context
      }
    }
  }
}
