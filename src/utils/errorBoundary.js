/**
 * Horologium Global Chronometer Error Boundary & Safe Mode Engine
 * 
 * Intercepts uncaught exceptions and unhandled promise rejections.
 * Prevents blank-screen crashes by providing:
 * 1. Diagnostic telemetry report generation with system context.
 * 2. Swiss-horology mechanical "Chronometer Safe Mode" UI overlay.
 * 3. Graceful degradation and non-destructive reload/reset controls.
 */

export class ErrorBoundary {
  constructor(options = {}) {
    this.appName = options.appName || 'Horologium Calibre-01';
    this.fsm = options.fsm || null;
    this.errors = [];
    this.maxErrors = options.maxErrors || 20;
    this.ignorePatterns = [
      /ResizeObserver loop limit exceeded/i,
      /ResizeObserver loop completed with undelivered notifications/i,
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /safari-extension:\/\//i
    ];
    this.onErrorCallback = options.onError || null;
    this.isSafeModeActive = false;
    this.modalId = 'horologiumSafeModeModal';

    this._boundHandleError = this._handleWindowError.bind(this);
    this._boundHandleRejection = this._handleRejection.bind(this);

    if (options.autoInstall !== false && typeof window !== 'undefined') {
      this.install();
    }
  }

  /**
   * Install global error and rejection listeners
   */
  install() {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', this._boundHandleError);
    window.addEventListener('unhandledrejection', this._boundHandleRejection);
  }

  /**
   * Remove global error and rejection listeners
   */
  uninstall() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('error', this._boundHandleError);
    window.removeEventListener('unhandledrejection', this._boundHandleRejection);
  }

  /**
   * Register active ClockFSM for synchronized telemetry
   */
  registerFSM(fsm) {
    this.fsm = fsm;
  }

  /**
   * Execute a function within the safe error boundary
   */
  runGuarded(fn, fallbackValue = null, context = 'guarded_block') {
    try {
      return fn();
    } catch (err) {
      this.recordError(err, { context, isFatal: false });
      return fallbackValue;
    }
  }

  /**
   * Record and triage an error
   */
  recordError(error, metadata = {}) {
    const errorMsg = error?.message || String(error);

    // Filter benign browser noise
    if (this._isIgnored(errorMsg)) {
      return null;
    }

    const errorRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      name: error?.name || 'Error',
      message: errorMsg,
      stack: error?.stack || null,
      context: metadata.context || 'global',
      isFatal: metadata.isFatal !== false,
      fsmState: this.fsm ? this.fsm.state : 'N/A'
    };

    this.errors.unshift(errorRecord);
    if (this.errors.length > this.maxErrors) {
      this.errors.length = this.maxErrors;
    }

    console.error(`[${this.appName} ErrorBoundary]`, errorRecord);

    if (typeof this.onErrorCallback === 'function') {
      try {
        this.onErrorCallback(errorRecord);
      } catch (e) {
        // Suppress callback failure
      }
    }

    if (errorRecord.isFatal && typeof document !== 'undefined' && !this.isSafeModeActive) {
      this.renderSafeModeUI(errorRecord);
    }

    return errorRecord;
  }

  /**
   * Retrieve all captured error records
   */
  getCapturedErrors() {
    return [...this.errors];
  }

  /**
   * Clear error queue
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Generate diagnostic system report for troubleshooting or copy-paste
   */
  generateDiagnosticReport(currentError = null) {
    const hasWindow = typeof window !== 'undefined';
    const hasDoc = typeof document !== 'undefined';

    return {
      schema: 'https://horologium.chronos.net/schemas/diagnostics-v1.json',
      generatedAt: new Date().toISOString(),
      application: this.appName,
      fsmTelemetry: this.fsm ? this.fsm.getTelemetry() : null,
      environment: {
        online: hasWindow ? navigator?.onLine : 'unknown',
        userAgent: hasWindow ? navigator?.userAgent : 'Node.js',
        url: hasWindow ? window?.location?.href : 'N/A',
        screen: hasWindow ? `${window?.innerWidth}x${window?.innerHeight}` : 'N/A',
        memory: (hasWindow && window?.performance?.memory) ? {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize
        } : null
      },
      activeError: currentError || this.errors[0] || null,
      recentErrorsCount: this.errors.length,
      recentErrors: this.errors.slice(0, 5)
    };
  }

  /**
   * Mount Swiss-horology Chronometer Safe Mode modal
   */
  renderSafeModeUI(errorRecord) {
    if (typeof document === 'undefined') return;

    this.isSafeModeActive = true;
    let modal = document.getElementById(this.modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = this.modalId;
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'safeModeTitle');
      document.body.appendChild(modal);
    }

    const reportJson = JSON.stringify(this.generateDiagnosticReport(errorRecord), null, 2);

    modal.innerHTML = `
      <div class="safe-mode-backdrop" style="position:fixed;inset:0;background:rgba(5,6,9,0.92);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:1.5rem;font-family:var(--font-sans, system-ui, sans-serif);color:#F0F2F5;">
        <div class="safe-mode-chassis" style="max-width:640px;width:100%;background:#0A0B0E;border:1px solid #E5484D;border-radius:6px;box-shadow:0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(229,72,77,0.25);overflow:hidden;">
          <div style="background:rgba(229,72,77,0.12);border-bottom:1px solid rgba(229,72,77,0.3);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="display:inline-block;width:10px;height:10px;background:#E5484D;border-radius:50%;box-shadow:0 0 8px #E5484D;"></span>
              <h2 id="safeModeTitle" style="margin:0;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:#FFFFFF;">
                Chronometer Safe Mode Engaged
              </h2>
            </div>
            <span style="font-family:var(--font-mono, monospace);font-size:0.75rem;color:#E5484D;background:rgba(229,72,77,0.15);padding:0.2rem 0.5rem;border-radius:4px;border:1px solid rgba(229,72,77,0.3);">
              FAILSAFE
            </span>
          </div>

          <div style="padding:1.25rem;">
            <p style="margin:0 0 1rem 0;font-size:0.875rem;line-height:1.5;color:#A0A5B5;">
              An unhandled anomaly was captured in the client chronometry pipeline. The global error boundary intercepted the failure to preserve monotonic timer integrity.
            </p>

            <div style="background:#050608;border:1px solid #1E2028;border-radius:4px;padding:0.875rem;margin-bottom:1.25rem;">
              <div style="font-family:var(--font-mono, monospace);font-size:0.8rem;color:#E5484D;margin-bottom:0.4rem;word-break:break-all;">
                <strong>${this._escapeHtml(errorRecord.name)}:</strong> ${this._escapeHtml(errorRecord.message)}
              </div>
              <div style="font-family:var(--font-mono, monospace);font-size:0.725rem;color:#606575;">
                Context: ${this._escapeHtml(errorRecord.context)} | State: ${this._escapeHtml(errorRecord.fsmState)}
              </div>
            </div>

            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:flex-end;">
              <button id="btnCopyDiagReport" type="button" style="background:#161820;color:#F0F2F5;border:1px solid #2B2E3C;border-radius:4px;padding:0.55rem 1rem;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:var(--font-mono, monospace);transition:all 0.15s ease;">
                Copy Diagnostic JSON
              </button>
              <button id="btnDismissSafeMode" type="button" style="background:transparent;color:#A0A5B5;border:1px solid #2B2E3C;border-radius:4px;padding:0.55rem 1rem;font-size:0.8rem;cursor:pointer;">
                Dismiss & Continue
              </button>
              <button id="btnRestartChronometer" type="button" style="background:#E5484D;color:#FFFFFF;border:none;border-radius:4px;padding:0.55rem 1.15rem;font-size:0.8rem;font-weight:700;cursor:pointer;box-shadow:0 0 12px rgba(229,72,77,0.4);">
                Restart Chronometer
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire up buttons
    const btnCopy = modal.querySelector('#btnCopyDiagReport');
    if (btnCopy) {
      btnCopy.onclick = () => {
        if (navigator?.clipboard) {
          navigator.clipboard.writeText(reportJson).then(() => {
            btnCopy.textContent = 'Copied to Clipboard!';
            setTimeout(() => { btnCopy.textContent = 'Copy Diagnostic JSON'; }, 2000);
          }).catch(() => {});
        }
      };
    }

    const btnDismiss = modal.querySelector('#btnDismissSafeMode');
    if (btnDismiss) {
      btnDismiss.onclick = () => {
        this.dismissSafeMode();
      };
    }

    const btnRestart = modal.querySelector('#btnRestartChronometer');
    if (btnRestart) {
      btnRestart.onclick = () => {
        if (this.fsm) {
          this.fsm.reset();
        }
        window.location.reload();
      };
    }
  }

  /**
   * Hide Safe Mode overlay
   */
  dismissSafeMode() {
    this.isSafeModeActive = false;
    if (typeof document !== 'undefined') {
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.remove();
      }
    }
  }

  // --- Internal Listeners ---

  _handleWindowError(event) {
    const error = event.error || new Error(event.message || 'Script error');
    this.recordError(error, {
      context: 'window.onerror',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      isFatal: true
    });
  }

  _handleRejection(event) {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection'));
    this.recordError(error, {
      context: 'unhandledrejection',
      isFatal: true
    });
  }

  _isIgnored(message) {
    return this.ignorePatterns.some(pattern => pattern.test(message));
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
