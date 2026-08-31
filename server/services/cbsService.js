import { formatEpochDate, normalizeNeighborhoodName, normalizeTurkishText, calculateDistanceMeters, formatDistance } from '../utils/geoUtils.js';

const CBS_API_BASE = 'https://cbs.elazig.bel.tr';
const REFERER_HEADER = { 'Referer': 'https://cbs.elazig.bel.tr/kentbilgisistemi' };

// In-Memory Cache
const cache = {
  emergency: { data: null, timestamp: 0, ttl: 30 * 60 * 1000 }, // 30 dakika
  neighborhoods: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 }, // 1 saat
  greenAreas: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 },
  poiList: { data: null, timestamp: 0, ttl: 60 * 60 * 1000 }
};

/**
 * Türkçe Karakter ve Boşluk Varyasyonlarını Genişletir
 */
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
    .replace(/I/g, 'I')
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

/**
 * Genel ArcGIS FeatureServer Query Yardımcısı
 */
async function queryArcGis(servicePath, params = {}) {
  const defaultParams = {
    f: 'json',
    outSR: '4326',
    returnGeometry: 'false',
    where: '1=1',
    ...params
  };

  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(defaultParams)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }

  const url = `${CBS_API_BASE}${servicePath}/query?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...REFERER_HEADER
      }
    });

    if (!response.ok) {
      throw new Error(`CBS API HTTP Hata: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`ArcGIS Servis Hatası: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data;
  } catch (err) {
    console.error(`[CBS API] Sorgu hatası (${servicePath}):`, err.message);
    throw err;
  }
}

/**
 * 1. Acil Toplanma Alanları (130 Alan - Tam Liste & WGS84 Geometri)
 */
export async function getEmergencyAssemblyAreas() {
  const now = Date.now();
  if (cache.emergency.data && now - cache.emergency.timestamp < cache.emergency.ttl) {
    return cache.emergency.data;
  }

  const data = await queryArcGis('/server/rest/services/acil_toplanma/FeatureServer/0', {
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326'
  });

  const features = data.features || [];
  const list = features.map((f) => {
    const attr = f.attributes || {};
    const geom = f.geometry || {};

    const lat = geom.y !== undefined ? geom.y : attr.enlem_koor;
    const lng = geom.x !== undefined ? geom.x : attr.boylam_koo;

    const hasValue = (val) => {
      if (!val) return false;
      const str = String(val).trim().toUpperCase();
      return str === 'VAR' || str === 'EVET' || str === '1' || str === '+' || str === 'UYGUN';
    };

    return {
      objectid: attr.objectid,
      siraNo: attr.sira_no || 0,
      mahalle: (attr.mahalle_ad || '').trim(),
      mevkii: (attr.mevki̇i̇ || attr.mevkii || '').trim(),
      parkAdi: (attr.park_adi || attr.mevki̇i̇ || attr.mahalle_ad || 'Acil Toplanma Alanı').trim(),
      alanM2: attr.m2 ? Number(String(attr.m2).replace(/\D/g, '')) || String(attr.m2).trim() : null,
      engelliUygun: hasValue(attr.engelli̇_ || attr.engelli_),
      elektrik: hasValue(attr.elektri̇k || attr.elektrik),
      su: hasValue(attr.su),
      wc: hasValue(attr.wc),
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null
    };
  });

  list.sort((a, b) => a.siraNo - b.siraNo);

  cache.emergency.data = list;
  cache.emergency.timestamp = now;
  return list;
}

/**
 * 2. Mahalle Listesi ve Sınırları (Layer 5 MAHALLE - 45 Mahalle)
 */
export async function getNeighborhoods(includeGeometry = true) {
  const now = Date.now();
  if (cache.neighborhoods.data && now - cache.neighborhoods.timestamp < cache.neighborhoods.ttl) {
    return cache.neighborhoods.data;
  }

  const data = await queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/5', {
    where: '1=1',
    outFields: 'objectid,id,ad,muhtar_adi_soyadi,muhtar_cep_telefonu,yapi_sayisi,kapi_sayisi,yol_orta_hat_sayisi,Shape__Area,Shape__Length',
    returnGeometry: includeGeometry ? 'true' : 'false',
    outSR: '4326',
    orderByFields: 'ad'
  });

  const list = (data.features || []).map((f) => {
    const attr = f.attributes || {};
    const geom = f.geometry || {};

    let rings = [];
    if (geom.rings && Array.isArray(geom.rings)) {
      rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
    }

    return {
      objectid: attr.objectid,
      id: attr.id,
      ad: (attr.ad || '').trim(),
      normalizedName: normalizeNeighborhoodName(attr.ad),
      muhtarAdi: (attr.muhtar_adi_soyadi || 'Bilgi Yok').trim(),
      muhtarTelefon: (attr.muhtar_cep_telefonu || '').trim(),
      yapiSayisi: attr.yapi_sayisi || 0,
      kapiSayisi: attr.kapi_sayisi || 0,
      yolSayisi: attr.yol_orta_hat_sayisi || 0,
      alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
      geometryRings: rings
    };
  });

  cache.neighborhoods.data = list;
  cache.neighborhoods.timestamp = now;
  return list;
}

/**
 * 3. Numarataj / Kapı No ve Adres Arama (Layer 7 NUMARATAJ)
 */
export async function searchAddress({ query = '', mahalle = '', csbm = '', limit = 25 }) {
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
    });
    if (qClauses.length > 0) {
      whereClauses.push(`(${qClauses.join(' OR ')})`);
    }
  }

  const whereSql = whereClauses.join(' AND ');

  const data = await queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/7', {
    where: whereSql,
    outFields: 'objectid,ad,mahalle,csbm,tasarimkapino,toplam_mesken_sayisi,toplam_is_yeri_sayisi,kapi_tur,kapi_kullanim,guncelleme_tarihi',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: Math.min(limit, 50)
  });

  return (data.features || []).map((f) => {
    const attr = f.attributes || {};
    const geom = f.geometry || {};

    return {
      objectid: attr.objectid,
      ad: attr.ad || `${attr.csbm || ''} No: ${attr.tasarimkapino || ''}`.trim(),
      mahalle: (attr.mahalle || '').trim(),
      csbm: (attr.csbm || '').trim(),
      kapiNo: (attr.tasarimkapino || '').trim(),
      meskenSayisi: attr.toplam_mesken_sayisi || 0,
      isyeriSayisi: attr.toplam_is_yeri_sayisi || 0,
      kapiTur: attr.kapi_tur || '-',
      kapiKullanim: attr.kapi_kullanim || '-',
      guncellemeTarihi: formatEpochDate(attr.guncelleme_tarihi),
      latitude: geom.y !== undefined ? geom.y : null,
      longitude: geom.x !== undefined ? geom.x : null
    };
  });
}

/**
 * 4. Yapı / Bina Detay Sorgulama (Layer 8 YAPI)
 */
export async function searchBuilding({ objectid, mahalle, ada, parsel, limit = 10 }) {
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

  if (whereClauses.length === 0) {
    whereClauses.push('1=1');
  }

  const whereSql = whereClauses.join(' AND ');

  const outFields = [
    'objectid', 'ad', 'mahalle_adi', 'adano', 'parselno', 'paftaadi',
    'zeminustukatsayisi', 'zeminaltikatsayisi', 'toplam_mesken', 'toplam_isyeri',
    'toplam_bb_sayisi', 'yapi_sinifi', 'asansor', 'asansor_sayisi', 'asansor_kapasite',
    'otopark', 'yangin_merdiveni', 'dis_cephe_kaplama', 'ikamet_durumu', 'fiziksel_durum',
    'yapim_yili', 'tescilli_yapi', 'guncelleme_tarihi', 'olusturma_tarihi', 'Shape__Area'
  ].join(',');

  const data = await queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8', {
    where: whereSql,
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: limit
  });

  const buildings = await Promise.all(
    (data.features || []).map(async (f) => {
      const attr = f.attributes || {};
      const geom = f.geometry || {};

      let rings = [];
      if (geom.rings && Array.isArray(geom.rings)) {
        rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
      }

      const photos = await getLayerAttachments(8, attr.objectid).catch(() => []);

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
        toplamBölüm: attr.toplam_bb_sayisi || 0,
        yapiSinifi: attr.yapi_sinifi || '-',
        asansor: attr.asansor || (attr.asansor_sayisi ? 'Var' : '-'),
        asansorSayisi: attr.asansor_sayisi || 0,
        otopark: attr.otopark || '-',
        yanginMerdiveni: attr.yangin_merdiveni || '-',
        disCephe: attr.dis_cephe_kaplama || '-',
        ikametDurumu: attr.ikamet_durumu || '-',
        fizikselDurum: attr.fiziksel_durum || '-',
        yapimYili: attr.yapim_yili || '-',
        tescilliYapi: attr.tescilli_yapi || 'Hayır',
        guncellemeTarihi: formatEpochDate(attr.guncelleme_tarihi),
        tabanAlaniM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
        geometryRings: rings,
        photos
      };
    })
  );

  return buildings;
}

/**
 * 5. Parklar ve Yeşil Alanlar (Layer 2 YEŞİL ALAN)
 */
export async function getGreenAreas() {
  const now = Date.now();
  if (cache.greenAreas.data && now - cache.greenAreas.timestamp < cache.greenAreas.ttl) {
    return cache.greenAreas.data;
  }

  const data = await queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/2', {
    where: '1=1',
    outFields: 'objectid,ad,Shape__Area,saha_aciklama',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: 150
  });

  const list = (data.features || []).map((f) => {
    const attr = f.attributes || {};
    const geom = f.geometry || {};

    let rings = [];
    if (geom.rings && Array.isArray(geom.rings)) {
      rings = geom.rings.map((ring) => ring.map((pt) => [pt[1], pt[0]]));
    }

    return {
      objectid: attr.objectid,
      ad: (attr.ad || 'Yeşil Alan / Park').trim(),
      aciklama: attr.saha_aciklama || '',
      alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
      geometryRings: rings
    };
  });

  cache.greenAreas.data = list;
  cache.greenAreas.timestamp = now;
  return list;
}

/**
 * 6. Önemli Noktalar / POI (Layer 0)
 */
export async function getPoiList() {
  const now = Date.now();
  if (cache.poiList.data && now - cache.poiList.timestamp < cache.poiList.ttl) {
    return cache.poiList.data;
  }

  const data = await queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/0', {
    where: '1=1',
    outFields: 'objectid,ad,onemli_noktalar,mahalle,yol,kapino',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: 150
  });

  const list = (data.features || []).map((f) => {
    const attr = f.attributes || {};
    const geom = f.geometry || {};

    return {
      objectid: attr.objectid,
      ad: (attr.ad || attr.onemli_noktalar || 'Önemli Nokta').trim(),
      kategori: (attr.onemli_noktalar || '').trim(),
      mahalle: (attr.mahalle || '').trim(),
      yol: (attr.yol || '').trim(),
      kapino: (attr.kapino || '').trim(),
      latitude: geom.y !== undefined ? geom.y : null,
      longitude: geom.x !== undefined ? geom.x : null
    };
  });

  cache.poiList.data = list;
  cache.poiList.timestamp = now;
  return list;
}

/**
 * 7. Katman Fotoğrafları / Ekleri (Attachments)
 */
export async function getLayerAttachments(layerId, objectId) {
  if (!objectId) return [];

  const url = `${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/${layerId}/queryAttachments?f=json&objectIds=${Number(objectId)}&returnMetadata=true`;

  try {
    const res = await fetch(url, { headers: REFERER_HEADER });
    const data = await res.json();

    const group = (data.attachmentGroups || [])[0];
    if (!group || !group.attachmentInfos) return [];

    return group.attachmentInfos.map((item) => ({
      id: item.id,
      name: item.name,
      contentType: item.contentType || 'image/jpeg',
      size: item.size,
      url: `/api/cbs/attachment/${layerId}/${objectId}/${item.id}`,
      thumbnailUrl: `/api/cbs/attachment/${layerId}/${objectId}/${item.id}`
    }));
  } catch (err) {
    console.warn(`[CBS Attachments] Fotoğraf çekme hatası (layer: ${layerId}, objectid: ${objectId}):`, err.message);
    return [];
  }
}

export async function getBuildingAttachments(objectId) {
  return await getLayerAttachments(8, objectId);
}

/**
 * CBS Fotoğraf Binary İndirme (Proxy için)
 */
export async function getAttachmentBuffer(layerId, objectId, attachmentId) {
  const url = `${CBS_API_BASE}/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/${layerId}/${objectId}/attachments/${attachmentId}`;
  const res = await fetch(url, { headers: REFERER_HEADER });
  if (!res.ok) {
    throw new Error(`Fotoğraf indirilemedi: ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType
  };
}

/**
 * 8. HARİTAYA TIKLANAN NOKTADAN CBS VERİSİ SORGULAMA (Spatial Identify)
 * Kullanıcı haritada herhangi bir yere tıkladığında:
 * - Yapı (Bina Kat/Mesken/Asansör/Yapı Sınıfı)
 * - Kadastro (Ada/Parsel/Alan)
 * - Mahalle & Muhtarlık Bilgisi
 * - Numarataj (Cadde/Sokak/Kapı No)
 * - En Yakın Acil Toplanma Alanı (Mesafe ile)
 * paralel olarak tek seferde çekilir.
 */
export async function identifyLocation(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    throw new Error('Geçersiz koordinat');
  }

  const pointGeom = JSON.stringify({ x: numLng, y: numLat, spatialReference: { wkid: 4326 } });
  const buffer = 0.0004; // ~40 metre arama yarıçapı (numarataj için)
  const envGeom = JSON.stringify({
    xmin: numLng - buffer,
    ymin: numLat - buffer,
    xmax: numLng + buffer,
    ymax: numLat + buffer,
    spatialReference: { wkid: 4326 }
  });

  const [yapiRes, kadastroRes, mahalleRes, numaratajRes, parkRes, emergencyList] = await Promise.all([
    // Layer 8: YAPI
    queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8', {
      geometry: pointGeom,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,ad,mahalle_adi,adano,parselno,paftaadi,zeminustukatsayisi,zeminaltikatsayisi,toplam_mesken,toplam_isyeri,toplam_bb_sayisi,yapi_sinifi,asansor,asansor_sayisi,otopark,yangin_merdiveni,dis_cephe_kaplama,ikamet_durumu,fiziksel_durum,yapim_yili,guncelleme_tarihi,Shape__Area',
      returnGeometry: 'true'
    }).catch(() => ({ features: [] })),

    // Layer 3: KADASTRO (Ada/Parsel)
    queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/3', {
      geometry: pointGeom,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,ada,parsel,ada_parsel,mahalle,mahalleadi,Shape__Area',
      returnGeometry: 'true'
    }).catch(() => ({ features: [] })),

    // Layer 5: MAHALLE
    queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/5', {
      geometry: pointGeom,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,ad,muhtar_adi_soyadi,muhtar_cep_telefonu,yapi_sayisi,kapi_sayisi,yol_orta_hat_sayisi,Shape__Area',
      returnGeometry: 'false'
    }).catch(() => ({ features: [] })),

    // Layer 7: NUMARATAJ (En Yakın Kapı No / Sokak)
    queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/7', {
      geometry: envGeom,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,ad,mahalle,csbm,tasarimkapino,toplam_mesken_sayisi,toplam_is_yeri_sayisi,kapi_tur,kapi_kullanim,guncelleme_tarihi',
      returnGeometry: 'true',
      resultRecordCount: 5
    }).catch(() => ({ features: [] })),

    // Layer 2: YEŞİL ALAN
    queryArcGis('/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/2', {
      geometry: pointGeom,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,ad,Shape__Area,saha_aciklama',
      returnGeometry: 'false'
    }).catch(() => ({ features: [] })),

    // Acil Toplanma Alanları
    getEmergencyAssemblyAreas().catch(() => [])
  ]);

  // 1. Yapı (Bina) Sonucu
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
      toplamBölüm: attr.toplam_bb_sayisi || 0,
      yapiSinifi: attr.yapi_sinifi || '-',
      asansor: attr.asansor || (attr.asansor_sayisi ? 'Var' : '-'),
      asansorSayisi: attr.asansor_sayisi || 0,
      otopark: attr.otopark || '-',
      yanginMerdiveni: attr.yangin_merdiveni || '-',
      disCephe: attr.dis_cephe_kaplama || '-',
      ikametDurumu: attr.ikamet_durumu || '-',
      yapimYili: attr.yapim_yili || '-',
      guncellemeTarihi: formatEpochDate(attr.guncelleme_tarihi),
      tabanAlaniM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null,
      geometryRings: rings
    };
  }

  // 2. Kadastro (Ada / Parsel) Sonucu
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

  // 3. Mahalle Sonucu
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
      yolSayisi: attr.yol_orta_hat_sayisi || 0,
      alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null
    };
  }

  // 4. Numarataj (En Yakın Kapı / Sokak) Sonucu
  let numarataj = null;
  if (numaratajRes.features && numaratajRes.features.length > 0) {
    // Tıklanan noktaya en yakın kapı numarasını seç
    const sorted = numaratajRes.features.map((f) => {
      const attr = f.attributes || {};
      const geom = f.geometry || {};
      const dist = geom.y && geom.x ? calculateDistanceMeters(numLat, numLng, geom.y, geom.x) : 99999;
      return {
        objectid: attr.objectid,
        ad: attr.ad || `${attr.csbm || ''} No: ${attr.tasarimkapino || ''}`.trim(),
        mahalle: (attr.mahalle || '').trim(),
        csbm: (attr.csbm || '').trim(),
        kapiNo: (attr.tasarimkapino || '').trim(),
        meskenSayisi: attr.toplam_mesken_sayisi || 0,
        isyeriSayisi: attr.toplam_is_yeri_sayisi || 0,
        kapiTur: attr.kapi_tur || '-',
        distanceMeters: dist,
        distanceText: formatDistance(dist),
        latitude: geom.y,
        longitude: geom.x
      };
    });

    sorted.sort((a, b) => a.distanceMeters - b.distanceMeters);
    numarataj = sorted[0];
  }

  // 5. Park / Yeşil Alan Sonucu
  let park = null;
  if (parkRes.features && parkRes.features.length > 0) {
    const attr = parkRes.features[0].attributes || {};
    park = {
      objectid: attr.objectid,
      ad: (attr.ad || 'Park / Yeşil Alan').trim(),
      aciklama: attr.saha_aciklama || '',
      alanM2: attr.Shape__Area ? Math.round(Number(attr.Shape__Area)) : null
    };
  }

  // Fotoğrafları çek (Bina veya Numarataj saha tespiti)
  if (yapi && yapi.objectid) {
    yapi.photos = await getLayerAttachments(8, yapi.objectid).catch(() => []);
  }
  if (numarataj && numarataj.objectid) {
    numarataj.photos = await getLayerAttachments(7, numarataj.objectid).catch(() => []);
  }

  // 6. En Yakın Acil Toplanma Alanı
  let nearestEmergency = null;
  if (emergencyList && emergencyList.length > 0) {
    const withDists = emergencyList
      .filter((e) => e.latitude && e.longitude)
      .map((e) => {
        const d = calculateDistanceMeters(numLat, numLng, e.latitude, e.longitude);
        return { ...e, distanceMeters: d, distanceText: formatDistance(d) };
      });
    withDists.sort((a, b) => a.distanceMeters - b.distanceMeters);
    nearestEmergency = withDists[0] || null;
  }

  return {
    coordinates: { lat: numLat, lng: numLng },
    mahalle,
    kadastro,
    yapi,
    numarataj,
    park,
    nearestEmergency
  };
}
