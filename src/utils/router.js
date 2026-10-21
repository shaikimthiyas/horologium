/**
 * HOROLOGIUM DESIGN SYSTEM (v1.0.0-PRO) // ROUTER & NAVIGATION ARCHITECTURE
 * Clean Enterprise Route Handlers with URL Persistence
 */
import { ROUTES } from '../config/constants.js';

export { ROUTES };

export function getQueryParam(paramName) {
  const params = new URLSearchParams(window.location.search);
  return params.get(paramName);
}

export function setQueryParamWithoutReload(key, value) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, '', url.toString());
}

export function navigateTo(routePath, params = {}) {
  const targetUrl = new URL(routePath, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      targetUrl.searchParams.set(k, String(v));
    }
  });
  window.location.href = targetUrl.toString();
}
