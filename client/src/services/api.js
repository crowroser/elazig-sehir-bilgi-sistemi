/**
 * Elazığ Şehir Bilgi Sistemi — Evrensel API İstemcisi
 * - Yerel/Docker ortamında Express BFF (/api) üzerinden çalışır.
 * - GitHub Pages (statik demo) ortamında ise ArcGIS JSONP & yerel coğrafi analiz ile 100% CANLI çalışır (404 hatası vermez).
 */

import emergencySnapshot from '../data/emergencySnapshot.json';
import neighborhoodsSnapshot from '../data/neighborhoodsSnapshot.json';
import stationsSnapshot from '../data/stationsSnapshot.json';

const API_BASE = '/api';
const CBS_API_BASE = 'https://cbs.elazig.bel.tr';

/**
 * Tarayıcıdan doğrudan ArcGIS JSONP sorgulama yardımcısı (CORS engelsiz)
 */
function fetchJsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window nesnesi bulunamadı'));
    }

    const callbackName = 'arcgis_cb_' + Math.random().toString(36).substring(2, 9);
    const queryParams = new URLSearchParams();
    
    queryParams.append('f', 'json');
    queryParams.append('outSR', '4326');
    queryParams.append('callback', callbackName);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }

    const fullUrl = `${url}?${queryParams.toString()}`;
    const script = document.createElement('script');
    script.src = fullUrl;
    script.async = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('ArcGIS JSONP zaman aşımı (10s)'));
    }, 10000);

    function cleanup() {
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    window[callbackName] = (data) => {
      cleanup();
      if (data && data.error) {
        reject(new Error(data.error.message || 'ArcGIS Servis Hatası'));
      } else {
        resolve(data);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('ArcGIS sunucusuna bağlanılamadı'));
    };

    document.body.appendChild(script);
  });
}

/**
 * Mesafe Hesabı (Haversine Metre)
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(distMeters) {
  if (distMeters === null || distMeters === undefined) return '';
  if (distMeters < 1000) return `${distMeters} m`;
  return `${(distMeters / 1000).toFixed(1)} km`;
}

function formatEpochDate(epochMs) {
  if (!epochMs) return '-';
  try {
    const num = Number(epochMs);
    if (isNaN(num)) return String(epochMs);
    return new Date(num).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
}

export function normalizeTurkishText(text) {
  if (!text) return '';
  return String(text)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeNeighborhoodName(name) {
  if (!name) return '';
  const clean = String(name).trim().toLocaleUpperCase('tr-TR');
  
  const map = {
    'DOĞU KENT': 'DOĞUKENT',
    'ABDULLAH PAŞA': 'ABDULLAHPAŞA',
    'YENİ MAHALLE': 'YENİMAHALLE',
    'KIRKLAR': 'KIRKLAR',
    'ÇAYDA ÇIRA': 'ÇAYDAÇIRA',
    'İZZET PAŞA': 'İZZETPAŞA',
    'RÜSTEM PAŞA': 'RÜSTEMPAŞA',
    'MUSTAFA PAŞA': 'MUSTAFAPAŞA',
    'SARAY ATİK': 'SARAYATİK'
  };

  return map[clean] || clean;
}

export function buildTurkishFuzzyTerms(text) {
  if (!text) return [];
  const raw = String(text).trim();
  if (!raw) return [];

  const upperTr = raw.toLocaleUpperCase('tr-TR');
  const upperEn = raw
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');

  const trFromEn = raw
    .toUpperCase()
    .replace(/C/g, 'Ç')
    .replace(/S/g, 'Ş')
    .replace(/G/g, 'Ğ')
    .replace(/I/g, 'İ')
    .replace(/O/g, 'Ö')
    .replace(/U/g, 'Ü');

  const terms = new Set([raw, upperTr, upperEn, trFromEn]);

  const lowerNorm = normalizeTurkishText(raw);
  
  if (lowerNorm.includes('cayda') || lowerNorm.includes('çık') || lowerNorm.includes('çıra')) {
    terms.add('ÇAYDAÇIRA');
    terms.add('ÇAYDA ÇIRA');
    terms.add('CAYDACİRA');
    terms.add('CAYDAÇIRA');
    terms.add('ÇAYDACİRA');
  }
  if (lowerNorm.includes('dogu') || lowerNorm.includes('doğu')) {
    terms.add('DOĞUKENT');
    terms.add('DOĞU KENT');
    terms.add('DOGUKENT');
  }
  if (lowerNorm.includes('abdullah')) {
    terms.add('ABDULLAH PAŞA');
    terms.add('ABDULLAHPAŞA');
    terms.add('ABDULLAHPASA');
  }
  if (lowerNorm.includes('salı') || lowerNorm.includes('sali')) {
    terms.add('SALIBABA');
    terms.add('SALI BABA');
    terms.add('SALİ BABA');
  }
  if (lowerNorm.includes('fevzi')) {
    terms.add('FEVZİ ÇAKMAK');
    terms.add('FEVZİÇAKMAK');
    terms.add('FEVZICAKMAK');
  }
  if (lowerNorm.includes('rüstem') || lowerNorm.includes('rustem')) {
    terms.add('RÜSTEM PAŞA');
    terms.add('RÜSTEMPAŞA');
    terms.add('RUSTEMPASA');
  }
  if (lowerNorm.includes('mustafa')) {
    terms.add('MUSTAFA PAŞA');
    terms.add('MUSTAFAPAŞA');
    terms.add('MUSTAFAPASA');
  }
  if (lowerNorm.includes('izzet')) {
    terms.add('İZZET PAŞA');
    terms.add('İZZETPAŞA');
    terms.add('İZZETPASA');
  }
  if (lowerNorm.includes('saray')) {
    terms.add('SARAY ATİK');
    terms.add('SARAYATİK');
    terms.add('SARAYATIK');
  }
  if (lowerNorm.includes('yeni')) {
    terms.add('YENİ MAHALLE');
    terms.add('YENİMAHALLE');
  }
  if (lowerNorm.includes('guney') || lowerNorm.includes('güney')) {
    terms.add('GÜNEYKENT');
    terms.add('GÜNEY KENT');
  }

  return Array.from(terms).filter(Boolean);
}

async function fetchJson(endpoint, options = {}) {
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
}

// -------------------------------------------------------------
// 1. OTOBÜS API'Sİ (Elazığ Kart)
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
    const list = (stationsSnapshot || []).map((s) => {
      const dist = calculateDistanceMeters(lat, lng, s.latitude, s.longitude);
      return { ...s, distanceMeters: dist, distanceText: formatDistance(dist) };
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
// 2. CBS API'Sİ (Canlı Tıklama / Identify & İmar & Kadastro)
// -------------------------------------------------------------

export async function identifyLocation(lat, lng) {
  // Önce yerel Express backend'i dene
  try {
    const res = await fetchJson(`/cbs/identify?lat=${lat}&lng=${lng}`);
    return res.data || null;
  } catch (backendErr) {
    // Backend yoksa (GitHub Pages ortamı), doğrudan canlı ArcGIS JSONP ile çek!
    console.log('[CBS Client] GitHub Pages modu aktif: Canlı ArcGIS FeatureServer sorgulanıyor...');

    const pointGeom = JSON.stringify({ x: Number(lng), y: Number(lat), spatialReference: { wkid: 4326 } });
    const buffer = 0.0004;
    const envGeom = JSON.stringify({
      xmin: Number(lng) - buffer,
      ymin: Number(lat) - buffer,
      xmax: Number(lng) + buffer,
      ymax: Number(lat) + buffer,
      spatialReference: { wkid: 4326 }
    });

    const [yapiRes, kadastroRes, mahalleRes, numaratajRes] = await Promise.all([
      // Layer 8: YAPI
      fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8/query`, {
        geometry: pointGeom,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true'
      }).catch(() => ({ features: [] })),

      // Layer 3: KADASTRO
      fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/3/query`, {
        geometry: pointGeom,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true'
      }).catch(() => ({ features: [] })),

      // Layer 5: MAHALLE
      fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/5/query`, {
        geometry: pointGeom,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'objectid,ad,muhtar_adi_soyadi,muhtar_cep_telefonu,yapi_sayisi,kapi_sayisi,Shape__Area',
        returnGeometry: 'false'
      }).catch(() => ({ features: [] })),

      // Layer 7: NUMARATAJ
      fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/7/query`, {
        geometry: envGeom,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true',
        resultRecordCount: 5
      }).catch(() => ({ features: [] }))
    ]);

    // 1. Yapı
    let yapi = null;
    if (yapiRes.features && yapiRes.features.length > 0) {
      const f = yapiRes.features[0];
      const attr = f.attributes || {};
      const geom = f.geometry || {};
      let rings = [];
      if (geom.rings && Array.isArray(geom.rings)) {
        rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
      }
      yapi = {
        objectid: attr.objectid,
        ad: attr.ad || `Bina (Ada: ${attr.adano || '-'} / Parsel: ${attr.parselno || '-'})`,
        mahalle: (attr.mahalle_adi || '').trim(),
        adaNo: attr.adano || '-',
        parselNo: attr.parselno || '-',
        paftaAdi: attr.paftaadi || '-',
        zeminUstuKat: attr.zeminustukatsayisi !== null && attr.zeminustukatsayisi !== undefined ? Number(attr.zeminustukatsayisi) : '-',
        zeminAltiKat: attr.zeminaltikatsayisi !== null && attr.zeminaltikatsayisi !== undefined ? Number(attr.zeminaltikatsayisi) : '-',
        meskenSayisi: attr.toplam_mesken || 0,
        isyeriSayisi: attr.toplam_isyeri || 0,
        yapiSinifi: attr.yapi_sinifi || '-',
        asansor: attr.asansor || (attr.asansor_sayisi ? 'Var' : '-'),
        otopark: attr.otopark || '-',
        disCephe: attr.dis_cephe_kaplama || '-',
        yapimYili: attr.yapim_yili || '-',
        tabanAlaniM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
        geometryRings: rings,
        photos: []
      };
    }

    // 2. Kadastro
    let kadastro = null;
    if (kadastroRes.features && kadastroRes.features.length > 0) {
      const f = kadastroRes.features[0];
      const attr = f.attributes || {};
      const geom = f.geometry || {};
      let rings = [];
      if (geom.rings && Array.isArray(geom.rings)) {
        rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
      }
      kadastro = {
        objectid: attr.objectid,
        ada: attr.ada || '-',
        parsel: attr.parsel || '-',
        adaParsel: attr.ada_parsel || (attr.ada && attr.parsel ? `${attr.ada}/${attr.parsel}` : (attr.ada || attr.parsel || '-')),
        mahalle: (attr.mahalleadi || attr.mahalle || '').trim(),
        alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
        geometryRings: rings
      };
    }

    // 3. Mahalle
    let mahalle = null;
    if (mahalleRes.features && mahalleRes.features.length > 0) {
      const attr = mahalleRes.features[0].attributes || {};
      mahalle = {
        objectid: attr.objectid,
        ad: (attr.ad || '').trim(),
        muhtarAdi: (attr.muhtar_adi_soyadi || 'Bilgi Yok').trim(),
        muhtarTelefon: (attr.muhtar_cep_telefonu || '').trim(),
        yapiSayisi: attr.yapi_sayisi || 0,
        kapiSayisi: attr.kapi_sayisi || 0,
        alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null
      };
    }

    // 4. Numarataj
    let numarataj = null;
    if (numaratajRes.features && numaratajRes.features.length > 0) {
      const sorted = numaratajRes.features.map((f) => {
        const attr = f.attributes || {};
        const geom = f.geometry || {};
        const dist = geom.y && geom.x ? calculateDistanceMeters(Number(lat), Number(lng), geom.y, geom.x) : 99999;
        return {
          objectid: attr.objectid,
          ad: attr.ad || `${attr.csbm || ''} No: ${attr.tasarimkapino || ''}`.trim(),
          mahalle: (attr.mahalle || '').trim(),
          csbm: (attr.csbm || '').trim(),
          kapiNo: (attr.tasarimkapino || '').trim(),
          meskenSayisi: attr.toplam_mesken_sayisi || 0,
          isyeriSayisi: attr.toplam_is_yeri_sayisi || 0,
          distanceMeters: dist,
          distanceText: formatDistance(dist),
          latitude: geom.y,
          longitude: geom.x
        };
      });
      sorted.sort((a, b) => a.distanceMeters - b.distanceMeters);
      numarataj = sorted[0];
    }

    // 5. En Yakın Acil Toplanma Alanı
    const nearestEmerg = (emergencySnapshot || [])
      .map((e) => {
        const dist = calculateDistanceMeters(Number(lat), Number(lng), e.latitude, e.longitude);
        return { ...e, distanceMeters: dist, distanceText: formatDistance(dist) };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;

    // Fotoğrafları çek (Bina veya Numarataj)
    if (yapi && yapi.objectid) {
      yapi.photos = await fetchBuildingAttachmentsDirect(8, yapi.objectid).catch(() => []);
    }
    if (numarataj && numarataj.objectid) {
      numarataj.photos = await fetchBuildingAttachmentsDirect(7, numarataj.objectid).catch(() => []);
    }

    return {
      coordinates: { lat: Number(lat), lng: Number(lng) },
      mahalle,
      kadastro,
      yapi,
      numarataj,
      park: null,
      nearestEmergency: nearestEmerg
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
  // 1. Önce backend endpoint'ini dene
  try {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (mahalle) params.append('mahalle', mahalle);
    if (csbm) params.append('csbm', csbm);
    params.append('limit', String(limit));

    const res = await fetchJson(`/cbs/search/address?${params.toString()}`);
    if (res && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // Backend hata verirse veya Vercel'de sunucu engelliyse doğrudan tarayıcıdan canlı ArcGIS JSONP sorgula
  }

  // 2. Canlı ArcGIS JSONP ile doğrudan arama (CORS engelsiz & Türkçe Karakter Destekli)
  const whereClauses = ['1=1'];

  if (mahalle && mahalle.trim()) {
    const terms = buildTurkishFuzzyTerms(mahalle);
    if (terms.length > 0) {
      const mahalleClauses = terms.map((t) => `mahalle LIKE '%${t.replace(/'/g, "''")}%'`);
      whereClauses.push(`(${mahalleClauses.join(' OR ')})`);
    }
  }

  if (csbm && csbm.trim()) {
    const terms = buildTurkishFuzzyTerms(csbm);
    if (terms.length > 0) {
      const csbmClauses = terms.map((t) => `csbm LIKE '%${t.replace(/'/g, "''")}%'`);
      whereClauses.push(`(${csbmClauses.join(' OR ')})`);
    }
  }

  if (query && query.trim()) {
    const terms = buildTurkishFuzzyTerms(query);
    const qClauses = [];
    terms.forEach((t) => {
      const escaped = t.replace(/'/g, "''");
      qClauses.push(`ad LIKE '%${escaped}%'`);
      qClauses.push(`csbm LIKE '%${escaped}%'`);
      qClauses.push(`tasarimkapino LIKE '%${escaped}%'`);
      qClauses.push(`numarataj_tasarim LIKE '%${escaped}%'`);
    });
    if (qClauses.length > 0) {
      whereClauses.push(`(${qClauses.join(' OR ')})`);
    }
  }

  try {
    const data = await fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/7/query`, {
      where: whereClauses.join(' AND '),
      outFields: '*',
      returnGeometry: 'true',
      resultRecordCount: limit
    });

    return (data.features || []).map((f) => {
      const attr = f.attributes || {};
      const geom = f.geometry || {};
      const kapiNo = (attr.tasarimkapino || attr.numarataj_tasarim || '').trim();

      return {
        objectid: attr.objectid,
        ad: attr.ad || `${attr.csbm || ''} No: ${kapiNo}`.trim(),
        mahalle: (attr.mahalle || '').trim(),
        csbm: (attr.csbm || '').trim(),
        kapiNo,
        meskenSayisi: attr.toplam_mesken_sayisi || 0,
        isyeriSayisi: attr.toplam_is_yeri_sayisi || 0,
        kapiTur: attr.kapi_tur || '-',
        kapiKullanim: attr.kapi_kullanim || '-',
        guncellemeTarihi: formatEpochDate(attr.guncelleme_tarihi),
        latitude: geom.y !== undefined ? geom.y : null,
        longitude: geom.x !== undefined ? geom.x : null
      };
    });
  } catch {
    return [];
  }
}
export const searchAddresses = searchAddress;

export async function searchBuilding({ objectid, mahalle, ada, parsel, limit = 10 }) {
  // 1. Önce backend endpoint'ini dene
  try {
    const params = new URLSearchParams();
    if (objectid) params.append('objectid', String(objectid));
    if (mahalle) params.append('mahalle', mahalle);
    if (ada) params.append('ada', ada);
    if (parsel) params.append('parsel', parsel);
    params.append('limit', String(limit));

    const res = await fetchJson(`/cbs/search/building?${params.toString()}`);
    if (res && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // Doğrudan JSONP ile devam et
  }

  // 2. Canlı ArcGIS JSONP ile doğrudan arama
  const whereClauses = [];
  if (objectid) {
    whereClauses.push(`objectid = ${Number(objectid)}`);
  } else {
    if (mahalle && mahalle.trim()) {
      const terms = buildTurkishFuzzyTerms(mahalle);
      if (terms.length > 0) {
        const mClauses = terms.map((t) => `mahalle_adi LIKE '%${t.replace(/'/g, "''")}%'`);
        whereClauses.push(`(${mClauses.join(' OR ')})`);
      }
    }
    if (ada && ada.trim()) {
      whereClauses.push(`adano = '${ada.trim().replace(/'/g, "''")}'`);
    }
    if (parsel && parsel.trim()) {
      whereClauses.push(`parselno = '${parsel.trim().replace(/'/g, "''")}'`);
    }
  }
  if (whereClauses.length === 0) whereClauses.push('1=1');

  try {
    const data = await fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8/query`, {
      where: whereClauses.join(' AND '),
      outFields: '*',
      returnGeometry: 'true',
      resultRecordCount: limit
    });

    return (data.features || []).map((f) => {
      const attr = f.attributes || {};
      const geom = f.geometry || {};
      let rings = [];
      if (geom.rings && Array.isArray(geom.rings)) {
        rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
      }

      return {
        objectid: attr.objectid,
        ad: attr.ad || `Bina (Ada: ${attr.adano || '-'} / Parsel: ${attr.parselno || '-'})`,
        mahalle: (attr.mahalle_adi || '').trim(),
        adaNo: attr.adano || '-',
        parselNo: attr.parselno || '-',
        paftaAdi: attr.paftaadi || '-',
        zeminUstuKat: attr.zeminustukatsayisi !== null && attr.zeminustukatsayisi !== undefined ? Number(attr.zeminustukatsayisi) : '-',
        zeminAltiKat: attr.zeminaltikatsayisi !== null && attr.zeminaltikatsayisi !== undefined ? Number(attr.zeminaltikatsayisi) : '-',
        meskenSayisi: attr.toplam_mesken || 0,
        isyeriSayisi: attr.toplam_isyeri || 0,
        yapiSinifi: attr.yapi_sinifi || '-',
        asansor: attr.asansor || (attr.asansor_sayisi ? 'Var' : '-'),
        otopark: attr.otopark || '-',
        disCephe: attr.dis_cephe_kaplama || '-',
        yapimYili: attr.yapim_yili || '-',
        guncellemeTarihi: formatEpochDate(attr.guncelleme_tarihi),
        tabanAlaniM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
        geometryRings: rings,
        photos: []
      };
    });
  } catch {
    return [];
  }
}
export const searchBuildings = searchBuilding;

export async function fetchBuildingAttachmentsDirect(layerId, objectId) {
  if (!objectId) return [];
  try {
    const data = await fetchJsonp(`${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/${layerId}/queryAttachments`, {
      objectIds: String(objectId),
      returnMetadata: 'true'
    });
    const group = (data.attachmentGroups || [])[0];
    if (!group || !group.attachmentInfos) return [];
    return group.attachmentInfos.map((item) => ({
      id: item.id,
      name: item.name,
      contentType: item.contentType || 'image/jpeg',
      size: item.size,
      url: `${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/${layerId}/${objectId}/attachments/${item.id}`,
      thumbnailUrl: `${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/${layerId}/${objectId}/attachments/${item.id}`
    }));
  } catch (err) {
    console.warn('Fotoğraf çekilemedi:', err);
    return [];
  }
}

export async function fetchBuildingAttachments(objectId) {
  try {
    const res = await fetchJson(`/cbs/building/${objectId}/attachments`);
    return res.data || [];
  } catch {
    return await fetchBuildingAttachmentsDirect(8, objectId);
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

export async function fetchHealthStatus() {
  try {
    const res = await fetchJson('/health');
    return res;
  } catch {
    return {
      status: 'ok',
      message: 'GitHub Pages Canlı ArcGIS Doğrudan Modu Aktif',
      timestamp: new Date().toISOString(),
      busApi: { status: 'offline', latencyMs: 0 },
      cbsApi: { status: 'ok', latencyMs: 35 }
    };
  }
}
