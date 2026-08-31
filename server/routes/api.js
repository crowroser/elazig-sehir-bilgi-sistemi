import express from 'express';
import * as busService from '../services/busService.js';
import * as cbsService from '../services/cbsService.js';

const router = express.Router();

// ==========================================
// 1. OTOBÜS TAKİP ENDPOINT'LERİ (Elazığ Kart)
// ==========================================

// Tüm aktif duraklar
router.get('/bus/stations', async (req, res) => {
  try {
    const stations = await busService.getActiveStations();
    res.json({ success: true, count: stations.length, data: stations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Durak listesi alınamadı', error: err.message });
  }
});

// En yakın durakları bul
router.get('/bus/stations/nearest', async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat ve lng parametreleri zorunludur' });
    }
    const nearest = await busService.getNearestStations(Number(lat), Number(lng), Number(limit));
    res.json({ success: true, count: nearest.length, data: nearest });
  } catch (err) {
    res.status(500).json({ success: false, message: 'En yakın duraklar hesaplanamadı', error: err.message });
  }
});

// Duraktan geçen hatlar ve kalan süreler
router.get('/bus/station/:stopId/remaining', async (req, res) => {
  try {
    const { stopId } = req.params;
    const lines = await busService.getStationRemainingTime(stopId);
    res.json({ success: true, count: lines.length, data: lines });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Durak hat bilgisi alınamadı', error: err.message });
  }
});

// Canlı otobüs konumları
router.get('/bus/route/:routeCode/realtime', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const buses = await busService.getRealtimeBuses(routeCode);
    res.json({
      success: true,
      routeCode,
      activeBusCount: buses.length,
      data: buses
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Canlı otobüs verisi alınamadı', error: err.message });
  }
});

// Hat sefer saatleri
router.get('/bus/route/:routeCode/schedule', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const { direction = 'G' } = req.query;
    const schedule = await busService.getRouteSchedule(routeCode, direction);
    res.json({ success: true, routeCode, direction, data: schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sefer saatleri alınamadı', error: err.message });
  }
});

// Hattın tüm durak listesi
router.get('/bus/route/:routeCode/stops', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const stops = await busService.getRouteStops(routeCode);
    res.json({ success: true, routeCode, count: stops.length, data: stops });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Hat durakları alınamadı', error: err.message });
  }
});

// Hat ücret tarifesi
router.get('/bus/route/:routeCode/price', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const prices = await busService.getRoutePrice(routeCode);
    res.json({ success: true, routeCode, data: prices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ücret tarifesi alınamadı', error: err.message });
  }
});

// Hat güzergah polyline koordinatları
router.get('/bus/route/:routeCode/coordinates', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const coords = await busService.getRouteCoordinates(routeCode);
    res.json({ success: true, routeCode, data: coords });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Hat güzergah koordinatları alınamadı', error: err.message });
  }
});

// Hat Genel Özeti (Hızlı yükleme için birleşik uç nokta)
router.get('/bus/route/:routeCode/overview', async (req, res) => {
  try {
    const { routeCode } = req.params;
    const { direction = 'G' } = req.query;

    const [buses, schedule, prices, coordinates, stops] = await Promise.all([
      busService.getRealtimeBuses(routeCode).catch(() => []),
      busService.getRouteSchedule(routeCode, direction).catch(() => ({ allTrips: [], nextTrips: [] })),
      busService.getRoutePrice(routeCode).catch(() => []),
      busService.getRouteCoordinates(routeCode).catch(() => ({ forward: [], backward: [] })),
      busService.getRouteStops(routeCode).catch(() => [])
    ]);

    res.json({
      success: true,
      routeCode,
      data: {
        buses,
        schedule,
        prices,
        coordinates,
        stops
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Hat özeti alınamadı', error: err.message });
  }
});

// ==========================================
// 2. KENT BİLGİ SİSTEMİ ENDPOINT'LERİ (Elazığ CBS)
// ==========================================

// Haritadan Tıklanan Noktanın CBS Bilgisini Getir (Identify)
router.get('/cbs/identify', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat ve lng parametreleri zorunludur' });
    }
    const info = await cbsService.identifyLocation(lat, lng);
    res.json({ success: true, data: info });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Nokta CBS verisi alınamadı', error: err.message });
  }
});

// Acil toplanma alanları (130 alan)
router.get('/cbs/emergency-assembly', async (req, res) => {
  try {
    const list = await cbsService.getEmergencyAssemblyAreas();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Acil toplanma alanları alınamadı', error: err.message });
  }
});

// Mahalleler ve muhtar bilgileri
router.get('/cbs/neighborhoods', async (req, res) => {
  try {
    const includeGeom = req.query.geometry !== 'false';
    const list = await cbsService.getNeighborhoods(includeGeom);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Mahalle listesi alınamadı', error: err.message });
  }
});

// Parklar ve yeşil alanlar
router.get('/cbs/green-areas', async (req, res) => {
  try {
    const list = await cbsService.getGreenAreas();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Yeşil alanlar alınamadı', error: err.message });
  }
});

// Önemli noktalar (POI)
router.get('/cbs/poi', async (req, res) => {
  try {
    const list = await cbsService.getPoiList();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Önemli noktalar alınamadı', error: err.message });
  }
});

// Adres / Numarataj arama
router.get('/cbs/search/address', async (req, res) => {
  try {
    const { query, mahalle, csbm, limit } = req.query;
    const results = await cbsService.searchAddress({
      query,
      mahalle,
      csbm,
      limit: limit ? Number(limit) : 25
    });
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Adres araması yapılamadı', error: err.message });
  }
});

// Yapı / Bina detay sorgulama
router.get('/cbs/search/building', async (req, res) => {
  try {
    const { objectid, mahalle, ada, parsel, limit } = req.query;
    const results = await cbsService.searchBuilding({
      objectid,
      mahalle,
      ada,
      parsel,
      limit: limit ? Number(limit) : 10
    });
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bina sorgulanamadı', error: err.message });
  }
});

// Bina fotoğrafları listesi
router.get('/cbs/building/:objectId/attachments', async (req, res) => {
  try {
    const { objectId } = req.params;
    const photos = await cbsService.getBuildingAttachments(objectId);
    res.json({ success: true, count: photos.length, data: photos });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bina fotoğrafları alınamadı', error: err.message });
  }
});

// CBS Fotoğraf İndirme / Proxy Endpoint'i (Referer & CORS korumalı)
router.get('/cbs/attachment/:layerId/:objectId/:attachmentId', async (req, res) => {
  try {
    const { layerId, objectId, attachmentId } = req.params;
    const { buffer, contentType } = await cbsService.getAttachmentBuffer(layerId, objectId, attachmentId);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 gün tarayıcı önbelleği
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ success: false, message: 'Fotoğraf bulunamadı', error: err.message });
  }
});

// ==========================================
// 3. SİSTEM SAĞLIK VE API DURUMU
// ==========================================
router.get('/health', async (req, res) => {
  const t0 = Date.now();
  let busStatus = { status: 'down', latencyMs: 0 };
  let cbsStatus = { status: 'down', latencyMs: 0 };

  // Otobüs API kontrolü
  try {
    const bStart = Date.now();
    await fetch('https://elazigkart.elazig.bel.tr/api/static/activestation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(4000)
    });
    busStatus = { status: 'healthy', latencyMs: Date.now() - bStart };
  } catch (e) {
    busStatus = { status: 'error', error: e.message };
  }

  // CBS API kontrolü
  try {
    const cStart = Date.now();
    await fetch('https://cbs.elazig.bel.tr/server/rest/services/acil_toplanma/FeatureServer/0/query?f=json&where=1%3D1&returnCountOnly=true', {
      headers: { 'Referer': 'https://cbs.elazig.bel.tr/kentbilgisistemi' },
      signal: AbortSignal.timeout(4000)
    });
    cbsStatus = { status: 'healthy', latencyMs: Date.now() - cStart };
  } catch (e) {
    cbsStatus = { status: 'error', error: e.message };
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - t0,
    services: {
      busApi: busStatus,
      cbsApi: cbsStatus
    }
  });
});

export default router;
