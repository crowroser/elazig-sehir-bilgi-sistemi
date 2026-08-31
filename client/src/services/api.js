/**
 * Elazığ Şehir Bilgi Sistemi API İstemcisi
 * Hem canlı Node.js backend'i (BFF) ile hem de GitHub Pages statik demo ortamı ile tam uyumlu çalışır.
 */

import emergencySnapshot from '../data/emergencySnapshot.json';
import neighborhoodsSnapshot from '../data/neighborhoodsSnapshot.json';
import stationsSnapshot from '../data/stationsSnapshot.json';

const API_BASE = '/api';
const IS_STATIC_HOST = typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.hostname.includes('vercel.app'));

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
    // Statik barındırma (GitHub Pages) durumunda graceful fallback
    console.warn(`[API Info] ${endpoint} isteği backend'e ulaşılamadığı için statik veri ile karşılanıyor:`, err.message);
    throw err;
  }
}

// -------------------------------------------------------------
// OTOBÜS API'Sİ (Elazığ Kart)
// -------------------------------------------------------------

export async function fetchAllStations() {
  try {
    const res = await fetchJson('/bus/stations');
    return res.data || [];
  } catch {
    return stationsSnapshot || [];
  }
}

export async function fetchNearestStations(lat, lng, limit = 5) {
  try {
    const res = await fetchJson(`/bus/stations/nearest?lat=${lat}&lng=${lng}&limit=${limit}`);
    return res.data || [];
  } catch {
    // Statik mesafe hesabı
    const list = (stationsSnapshot || []).map((s) => {
      const dLat = (s.latitude - lat) * 111320;
      const dLng = (s.longitude - lng) * 40075000 * Math.cos((lat * Math.PI) / 180) / 360;
      const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
      return { ...s, distanceMeters: dist, distanceText: dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km` };
    });
    list.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return list.slice(0, limit);
  }
}

export async function fetchStationRemaining(stopId) {
  try {
    const res = await fetchJson(`/bus/station/${stopId}/remaining`);
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchRouteRealtime(routeCode) {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/realtime`);
    return res.data || [];
  } catch {
    return [];
  }
}

export const fetchRealtimeBuses = fetchRouteRealtime;

export async function fetchRouteSchedule(routeCode, direction = 'G') {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/schedule?direction=${direction}`);
    return res.data || { allTrips: [], nextTrips: [] };
  } catch {
    return { allTrips: [], nextTrips: [] };
  }
}

export async function fetchRouteStops(routeCode) {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/stops`);
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchRoutePrice(routeCode) {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/price`);
    return res.data || [];
  } catch {
    return [
      { id: 1, tip: 'TAM', fiyat: 15.0 },
      { id: 2, tip: 'İNDİRİMLİ', fiyat: 11.0 },
      { id: 3, tip: 'ÖĞRENCİ - ÖĞRETMEN', fiyat: 9.0 }
    ];
  }
}

export async function fetchRouteCoordinates(routeCode) {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/coordinates`);
    return res.data || { forward: [], backward: [] };
  } catch {
    return { forward: [], backward: [] };
  }
}

export async function fetchRouteOverview(routeCode, direction = 'G') {
  try {
    const res = await fetchJson(`/bus/route/${encodeURIComponent(routeCode)}/overview?direction=${direction}`);
    return res.data || {};
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// CBS API'Sİ (Kent Bilgi Sistemi & Acil Durum)
// -------------------------------------------------------------

export async function identifyLocation(lat, lng) {
  try {
    const res = await fetchJson(`/cbs/identify?lat=${lat}&lng=${lng}`);
    return res.data || null;
  } catch {
    // Statik ortamda en yakın mahalle ve toplanma alanını eşle
    const nearestEmerg = (emergencySnapshot || []).map((e) => {
      const dLat = (e.latitude - lat) * 111320;
      const dLng = (e.longitude - lng) * 40075000 * Math.cos((lat * Math.PI) / 180) / 360;
      const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
      return { ...e, distanceMeters: dist, distanceText: dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km` };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    return {
      coordinates: { lat, lng },
      mahalle: { ad: 'ELAZIĞ MERKEZ', muhtarAdi: 'Muhtarlık Bilgisi', muhtarTelefon: '-' },
      kadastro: null,
      yapi: null,
      numarataj: null,
      park: null,
      nearestEmergency: nearestEmerg || null
    };
  }
}

export async function fetchEmergencyAreas() {
  try {
    const res = await fetchJson('/cbs/emergency-assembly');
    return res.data || [];
  } catch {
    return emergencySnapshot || [];
  }
}

export async function fetchNeighborhoods(includeGeom = true) {
  try {
    const res = await fetchJson(`/cbs/neighborhoods?geometry=${includeGeom}`);
    return res.data || [];
  } catch {
    return neighborhoodsSnapshot || [];
  }
}

export async function searchAddress({ query = '', mahalle = '', csbm = '', limit = 25 }) {
  try {
    const params = new URLSearchParams({ query, mahalle, csbm, limit: String(limit) });
    const res = await fetchJson(`/cbs/search/address?${params.toString()}`);
    return res.data || [];
  } catch {
    return [];
  }
}
export const searchAddresses = searchAddress;

export async function searchBuilding({ objectid, mahalle, ada, parsel, limit = 10 }) {
  try {
    const params = new URLSearchParams();
    if (objectid) params.append('objectid', String(objectid));
    if (mahalle) params.append('mahalle', mahalle);
    if (ada) params.append('ada', ada);
    if (parsel) params.append('parsel', parsel);
    params.append('limit', String(limit));

    const res = await fetchJson(`/cbs/search/building?${params.toString()}`);
    return res.data || [];
  } catch {
    return [];
  }
}
export const searchBuildings = searchBuilding;

export async function fetchBuildingAttachments(objectId) {
  try {
    const res = await fetchJson(`/cbs/building/${objectId}/attachments`);
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchGreenAreas() {
  try {
    const res = await fetchJson('/cbs/green-areas');
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchPoiList() {
  try {
    const res = await fetchJson('/cbs/poi');
    return res.data || [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// SİSTEM SAĞLIK VE DURUM
// -------------------------------------------------------------

export async function fetchHealthStatus() {
  try {
    const res = await fetchJson('/health');
    return res;
  } catch {
    return {
      status: 'demo',
      message: 'GitHub Pages Statik Demo Modu Aktif',
      timestamp: new Date().toISOString(),
      busApi: { status: 'demo', latencyMs: 0 },
      cbsApi: { status: 'demo', latencyMs: 0 }
    };
  }
}
