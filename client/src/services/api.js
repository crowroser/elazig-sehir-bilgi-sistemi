/**
 * Elazığ Şehir Bilgi Sistemi API İstemcisi
 */

const API_BASE = '/api';

async function fetchJson(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `İstek başarısız (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// -------------------------------------------------------------
// OTOBÜS API'Sİ (Elazığ Kart)
// -------------------------------------------------------------

export async function fetchAllStations() {
  const res = await fetchJson('/bus/stations');
  return res.data || [];
}

export async function fetchNearestStations(lat, lng, limit = 5) {
  const res = await fetchJson(`/bus/stations/nearest?lat=${lat}&lng=${lng}&limit=${limit}`);
  return res.data || [];
}

export async function fetchStationRemaining(stopId) {
  const res = await fetchJson(`/bus/station/${stopId}/remaining`);
  return res.data || [];
}

export async function fetchRealtimeBuses(routeCode) {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/realtime`);
  return res.data || [];
}

export async function fetchRouteSchedule(routeCode, direction = 'G') {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/schedule?direction=${direction}`);
  return res.data || { allTrips: [], nextTrips: [] };
}

export async function fetchRouteStops(routeCode) {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/stops`);
  return res.data || [];
}

export async function fetchRoutePrice(routeCode) {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/price`);
  return res.data || [];
}

export async function fetchRouteCoordinates(routeCode) {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/coordinates`);
  return res.data || { forward: [], backward: [] };
}

export async function fetchRouteOverview(routeCode, direction = 'G') {
  const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/overview?direction=${direction}`);
  return res.data || {};
}

export async function identifyLocation(lat, lng) {
  const res = await fetchJson(`/cbs/identify?lat=${lat}&lng=${lng}`);
  return res.data || null;
}

export async function fetchEmergencyAreas() {
  const res = await fetchJson('/cbs/emergency-assembly');
  return res.data || [];
}

export async function fetchNeighborhoods(includeGeom = true) {
  const res = await fetchJson(`/cbs/neighborhoods?geometry=${includeGeom}`);
  return res.data || [];
}

export async function fetchGreenAreas() {
  const res = await fetchJson('/cbs/green-areas');
  return res.data || [];
}

export async function fetchPoiList() {
  const res = await fetchJson('/cbs/poi');
  return res.data || [];
}

export async function searchAddresses({ query, mahalle, csbm, limit = 25 }) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (mahalle) params.append('mahalle', mahalle);
  if (csbm) params.append('csbm', csbm);
  if (limit) params.append('limit', String(limit));

  const res = await fetchJson(`/cbs/search/address?${params.toString()}`);
  return res.data || [];
}

export async function searchBuildings({ objectid, mahalle, ada, parsel, limit = 10 }) {
  const params = new URLSearchParams();
  if (objectid) params.append('objectid', String(objectid));
  if (mahalle) params.append('mahalle', mahalle);
  if (ada) params.append('ada', ada);
  if (parsel) params.append('parsel', parsel);
  if (limit) params.append('limit', String(limit));

  const res = await fetchJson(`/cbs/search/building?${params.toString()}`);
  return res.data || [];
}

export async function fetchBuildingPhotos(objectId) {
  const res = await fetchJson(`/cbs/building/${objectId}/attachments`);
  return res.data || [];
}

export async function fetchHealthStatus() {
  return await fetchJson('/health');
}
