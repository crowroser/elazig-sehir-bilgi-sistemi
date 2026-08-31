import { isInsideElazig, normalizeCoordinates, calculateDistanceMeters, formatDistance } from '../utils/geoUtils.js';

const BUS_API_BASE = 'https://elazigkart.elazig.bel.tr';

// Basit bellek içi önbellek (In-Memory Cache)
const cache = {
  stations: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }, // 10 dakika
  routeStats: new Map(), // 30 dakika
  routeCoordinates: new Map(), // 1 saat
  routePrices: new Map(), // 1 saat
  routeSchedules: new Map(), // 15 dakika
};

// Rate limiter / Sıralı İstek Kuyruğu
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 300; // İstekler arası minimum bekleme

async function waitThrottle() {
  const now = Date.now();
  const diff = now - lastRequestTime;
  if (diff < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - diff));
  }
  lastRequestTime = Date.now();
}

/**
 * Mojibake ve encoding korumalı güvenli POST isteği
 */
async function postBusApi(endpoint, body = {}, retries = 3) {
  const url = `${BUS_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await waitThrottle();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/json; charset=utf-8',
          'Accept-Charset': 'utf-8'
        },
        body: JSON.stringify(body)
      });

      // 429 Too Many Requests kontrolü ve otomatik yeniden deneme
      if (response.status === 429) {
        const waitMs = attempt * 1500;
        console.warn(`[Otobüs API] 429 Rate limit alındı (${endpoint}). ${waitMs}ms sonra tekrar deneniyor... (Deneme ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Hata: ${response.status} - ${response.statusText}`);
      }

      const rawBuffer = await response.arrayBuffer();
      const rawText = Buffer.from(rawBuffer).toString('utf8');

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (jsonErr) {
        // Mojibake fallback: Windows-1254 / ISO-8859-9 binary çözümü
        try {
          const fixedText = Buffer.from(rawText, 'binary').toString('utf8');
          parsed = JSON.parse(fixedText);
        } catch {
          throw jsonErr;
        }
      }

      return parsed?.result || [];
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Otobüs API] İstek başarısız (${endpoint}):`, err.message);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return [];
}

/**
 * 1. Tüm Aktif Durakları Getir (Önbellekli & Koordinat Validasyonlu)
 */
export async function getActiveStations() {
  const now = Date.now();
  if (cache.stations.data && now - cache.stations.timestamp < cache.stations.ttl) {
    return cache.stations.data;
  }

  const rawStations = await postBusApi('/api/static/activestation', {});

  // Veri temizleme & Normalizasyon
  const validStations = [];
  for (const item of rawStations) {
    if (!item || !item.stationId) continue;

    const coords = normalizeCoordinates(item.latitude, item.longitude);
    if (!coords) continue;

    // Elazığ Bounding Box kontrolü (D1..D42 sahte test verilerini eler)
    if (!isInsideElazig(coords.lat, coords.lng)) {
      continue;
    }

    validStations.push({
      stationId: Number(item.stationId),
      description: (item.description || '').trim(),
      isActive: Number(item.isActive) === 1,
      latitude: coords.lat,
      longitude: coords.lng
    });
  }

  // İstasyon ID'sine göre sırala
  validStations.sort((a, b) => a.stationId - b.stationId);

  cache.stations.data = validStations;
  cache.stations.timestamp = now;

  return validStations;
}

/**
 * Kullanıcı konumuna en yakın durakları bulur
 */
export async function getNearestStations(userLat, userLng, limit = 5) {
  const coords = normalizeCoordinates(userLat, userLng);
  if (!coords) {
    throw new Error('Geçersiz kullanıcı koordinatları');
  }

  const stations = await getActiveStations();

  const withDistances = stations.map((st) => {
    const dist = calculateDistanceMeters(coords.lat, coords.lng, st.latitude, st.longitude);
    return {
      ...st,
      distanceMeters: dist,
      distanceText: formatDistance(dist)
    };
  });

  withDistances.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return withDistances.slice(0, limit);
}

/**
 * 2. Bir Duraktan Geçen Hatlar ve Kalan Süreler
 */
export async function getStationRemainingTime(stopId) {
  if (!stopId) return [];

  const raw = await postBusApi('/api/static/stationremainingtime', { stopId: Number(stopId) });

  return (raw || []).map((item) => ({
    busLineCode: item.busLineCode || '',
    busLineNo: item.busLineNo || 0,
    busLineShortName: String(item.busLineShortName || item.busLineNo || ''),
    panelId: Number(item.panelId),
    remainingTimeCurr: item.remainingTimeCurr !== null && item.remainingTimeCurr !== undefined ? Number(item.remainingTimeCurr) : null,
    remainingTimeNext: item.remainingTimeNext !== null && item.remainingTimeNext !== undefined ? Number(item.remainingTimeNext) : null,
    isAccordingToTimeSchedule: item.isAccordingToTimeSchedule || 'A',
    busStatusCurr: item.busStatusCurr || 0,
    busStatusNext: item.busStatusNext || 0
  }));
}

/**
 * 3. Bir Hattaki Canlı Otobüs Konumları ve Durumları
 */
export async function getRealtimeBuses(routeCode) {
  if (!routeCode) return [];

  const raw = await postBusApi('/api/static/realtimedata', { routeCode: String(routeCode).trim() });

  return (raw || []).map((item) => {
    const coords = normalizeCoordinates(item.enlem, item.boylam);
    const hexColor = (item.renk || '00FF00').toUpperCase().replace('#', '');

    let statusText = 'Hareket Halinde';
    let statusTheme = 'success'; // yeşil

    if (hexColor === 'FFFF00') {
      statusText = 'Duraklamış / Bekliyor';
      statusTheme = 'warning'; // sarı
    } else if (hexColor === 'FF0000') {
      statusText = 'Sinyal Uyarısı / Rota Dışı';
      statusTheme = 'danger'; // kırmızı
    }

    return {
      state: item.state || 1,
      plaka: (item.plaka || '').trim(),
      latitude: coords ? coords.lat : Number(item.enlem),
      longitude: coords ? coords.lng : Number(item.boylam),
      renk: `#${hexColor}`,
      statusText,
      statusTheme,
      hiz: Number(item.hiz) || 0,
      maxHiz: Number(item.maxHiz) || 0,
      mesafe: Number(item.mesafe) || 0,
      surucu: (item.surucu || 'Bilinmiyor').trim(),
      gunlukYolcu: Number(item.gunlukYolcu) || 0,
      seferYolcu: Number(item.seferYolcu) || 0,
      durakYolcu: Number(item.durakYolcu) || 0,
      yon: Number(item.yon) || 0, // 0-360 pusula yönü
      istikamet: item.istikamet || 'G', // G: Gidiş, D: Dönüş
      editDate: item.editDate || '',
      imageUrl: item.imageUrl || '',
      klimaVarMi: Number(item.klimaVarMi) === 1,
      engelliUygunMu: Number(item.engelliUygunMu) === 1,
      hatkodu: item.hatkodu || routeCode,
      validatorNo: item.validatorNo || 0
    };
  });
}

/**
 * 4. Hat Sefer Saatleri (Günlük Tarife ve Sıradaki 3 Sefer Filtresi)
 */
export async function getRouteSchedule(routeCode, direction = 'G') {
  if (!routeCode) return { allTrips: [], nextTrips: [] };

  const cacheKey = `${routeCode}_${direction}`;
  const now = Date.now();
  const cached = cache.routeSchedules.get(cacheKey);

  if (cached && now - cached.timestamp < 15 * 60 * 1000) {
    return processScheduleNextTrips(cached.data);
  }

  const raw = await postBusApi('/api/linehours/routeschedule', {
    routeCode: String(routeCode).trim(),
    dayType: 0,
    isFirstStations: true,
    direction: direction || 'G',
    hour: ''
  });

  const trips = (raw || []).map((item) => ({
    sequenceNumber: Number(item.sequenceNumber) || 1,
    stationName: (item.stationName || '').trim(),
    routeCode: item.routeCode || routeCode,
    time: item.time || '',
    plannedStationIn: item.plannedStationIn || item.time || '',
    hour: Number(item.hour),
    minute: Number(item.minute),
    direction: item.direction || direction,
    ring: Boolean(item.ring)
  }));

  // Zamana göre sırala
  trips.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });

  cache.routeSchedules.set(cacheKey, { data: trips, timestamp: now });

  return processScheduleNextTrips(trips);
}

/**
 * Günlük sefer listesinden TR yerel saatine göre sonraki seferleri belirler
 */
function processScheduleNextTrips(trips) {
  // Türkiye yerel saati (UTC+3)
  const nowTr = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const currentMinutes = nowTr.getHours() * 60 + nowTr.getMinutes();

  const nextTrips = [];
  const pastTrips = [];

  for (const trip of trips) {
    const tripMinutes = trip.hour * 60 + trip.minute;
    const diffMinutes = tripMinutes - currentMinutes;

    if (diffMinutes >= 0) {
      nextTrips.push({
        ...trip,
        diffMinutes,
        diffText: diffMinutes === 0 ? 'Şimdi kalkıyor' : `${diffMinutes} dk sonra`
      });
    } else {
      pastTrips.push(trip);
    }
  }

  return {
    allTrips: trips,
    nextTrips: nextTrips.slice(0, 3), // Sıradaki ilk 3 sefer
    totalDailyTrips: trips.length,
    firstTrip: trips[0]?.time || '-',
    lastTrip: trips[trips.length - 1]?.time || '-'
  };
}

/**
 * 5. Hattın Tüm Durak Listesi (Sıralı)
 */
export async function getRouteStops(routeCode) {
  if (!routeCode) return [];

  const now = Date.now();
  const cached = cache.routeStats.get(routeCode);
  if (cached && now - cached.timestamp < 30 * 60 * 1000) {
    return cached.data;
  }

  const raw = await postBusApi('/api/static/routestat', { routeCode: String(routeCode).trim() });

  const stops = (raw || []).map((item) => {
    const coords = normalizeCoordinates(item.latitude, item.longitude);
    return {
      stopId: Number(item.stopId),
      stopName: (item.stopName || '').trim(),
      sequence: Number(item.sequence),
      latitude: coords ? coords.lat : null,
      longitude: coords ? coords.lng : null,
      direction: item.direction || 'G'
    };
  });

  stops.sort((a, b) => a.sequence - b.sequence);

  cache.routeStats.set(routeCode, { data: stops, timestamp: now });
  return stops;
}

/**
 * 6. Hat Ücret Bilgisi (Tarife)
 */
export async function getRoutePrice(routeCode) {
  if (!routeCode) return [];

  const now = Date.now();
  const cached = cache.routePrices.get(routeCode);
  if (cached && now - cached.timestamp < 60 * 60 * 1000) {
    return cached.data;
  }

  const raw = await postBusApi('/api/static/routeprice', { routeCode: String(routeCode).trim() });

  const prices = (raw || []).map((item) => ({
    routeCode: item.routeCode || routeCode,
    description: (item.description || '').trim(),
    cardType: (item.cardType || '').trim(),
    price: Number(item.price) || 0
  }));

  cache.routePrices.set(routeCode, { data: prices, timestamp: now });
  return prices;
}

/**
 * 7. Hat Güzergah Koordinatları (Polyline - "logitude" yazım hatası onarımı ile)
 */
export async function getRouteCoordinates(routeCode) {
  if (!routeCode) return { forward: [], backward: [], all: [] };

  const now = Date.now();
  const cached = cache.routeCoordinates.get(routeCode);
  if (cached && now - cached.timestamp < 60 * 60 * 1000) {
    return cached.data;
  }

  const raw = await postBusApi('/api/static/routecoordinate', { routeCode: String(routeCode).trim() });

  const forwardPoints = [];
  const backwardPoints = [];
  const allPoints = [];

  for (const item of raw || []) {
    // ⚠️ "logitude" yazım hatası yönetimi
    const rawLng = item.logitude !== undefined ? item.logitude : item.longitude;
    const coords = normalizeCoordinates(item.latitude, rawLng);
    if (!coords) continue;

    const point = {
      latitude: coords.lat,
      longitude: coords.lng,
      sequence: Number(item.sequence) || 0,
      route: item.route || routeCode,
      routeDirection: item.routeDirection || 'F' // F: Forward (Gidiş), B: Backward (Dönüş)
    };

    allPoints.push(point);
    if (point.routeDirection === 'B') {
      backwardPoints.push([point.latitude, point.longitude]);
    } else {
      forwardPoints.push([point.latitude, point.longitude]);
    }
  }

  const result = {
    forward: forwardPoints,
    backward: backwardPoints,
    hasForward: forwardPoints.length > 0,
    hasBackward: backwardPoints.length > 0,
    totalPoints: allPoints.length
  };

  cache.routeCoordinates.set(routeCode, { data: result, timestamp: now });
  return result;
}
