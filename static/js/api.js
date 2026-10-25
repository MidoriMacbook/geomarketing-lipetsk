import { state } from './state.js';

const catalogTimers = new WeakMap();

export function cancelRequest() {
  state.requestVersion++;
  if (state.activeRequest) state.activeRequest.abort();
  state.activeRequest = null;
}

export function beginCatalogRequest() {
  if (state.catalogRequest) state.catalogRequest.abort();
  const controller = new AbortController();
  state.catalogRequest = controller;
  catalogTimers.set(controller, setTimeout(() => controller.abort(), 15000));
  return controller;
}

export function finishCatalogRequest(controller) {
  clearTimeout(catalogTimers.get(controller));
  if (state.catalogRequest === controller) state.catalogRequest = null;
}

export function beginCalculationRequest() {
  const request = {
    controller: new AbortController(),
    timedOut: false
  };
  state.activeRequest = request.controller;
  request.timeout = setTimeout(() => {
    request.timedOut = true;
    request.controller.abort();
  }, 100000);
  return request;
}

export function finishCalculationRequest(request) {
  clearTimeout(request.timeout);
}

export async function fetchCatalog(signal) {
  const response = await fetch('/api/catalog', {
    signal
  });
  if (!response.ok) throw new Error('catalog');
  return response.json();
}

export async function fetchCalculation(params, signal) {
  const response = await fetch(`/api/calculate?${params}`, {
    signal
  });
  if (!response.ok) {
    let msg;
    try {
      msg = (await response.json()).message;
    }
    catch {}
    const error = new Error(msg||`Сервер ответил кодом ${response.status}`);
    error.user = [400, 503].includes(response.status);
    throw error;
  }
  return response.json();
}
