/**
 * Coğrafi ve Metin Yardımcı Fonksiyonları
 * Elazığ Şehir Bilgi Sistemi
 */

// Elazığ Merkez ve Yakın Çevre Bounding Box (Enlem: ~38.45 - 38.85, Boylam: ~39.05 - 39.35)
export const ELAZIG_BBOX = {
  minLat: 38.45,
  maxLat: 38.90,
  minLng: 38.95,
  maxLng: 39.45
};

// Elazığ Şehir Merkezi Varsayılan Koordinatları (Cumhuriyet Meydanı / Valilik)
export const ELAZIG_CENTER = {
  lat: 38.6748,
  lng: 39.2225,
  zoom: 13
};

/**
 * String veya Number olarak gelen koordinatları doğrular ve temiz bir float döndürür.
 */
export function normalizeCoordinates(latInput, lngInput) {
  if (latInput === null || latInput === undefined || lngInput === null || lngInput === undefined) {
    return null;
  }

  let lat = typeof latInput === 'number' ? latInput : parseFloat(String(latInput).replace(',', '.'));
  let lng = typeof lngInput === 'number' ? lngInput : parseFloat(String(lngInput).replace(',', '.'));

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // Bazen enlem ve boylam ters girilmiş olabilir kontrolü
  if (lat > 39 && lng < 39 && lng > 38) {
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  return { lat, lng };
}

/**
 * Verilen koordinatın Elazığ sınırları içinde geçerli bir nokta olup olmadığını kontrol eder.
 * Test verilerini (D1..D42 gibi 39.1+ enlemdeki sahte durakları) filtreler.
 */
export function isInsideElazig(lat, lng) {
  const coords = normalizeCoordinates(lat, lng);
  if (!coords) return false;

  return (
    coords.lat >= ELAZIG_BBOX.minLat &&
    coords.lat <= ELAZIG_BBOX.maxLat &&
    coords.lng >= ELAZIG_BBOX.minLng &&
    coords.lng <= ELAZIG_BBOX.maxLng
  );
}

/**
 * İki nokta arasındaki mesafeyi Haversine formülü ile hesaplar (metre cinsinden).
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Dünya yarıçapı (metre)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Mesafeyi insan dostu metne dönüştürür (ör: "350 m" veya "2.4 km").
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined || isNaN(meters)) return '-';
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Türkçe karakter duyarlı arama normalizasyonu.
 */
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

/**
 * Mahalle adlarındaki boşluk ve yazım tutarsızlıklarını normalize eder.
 * (Ör: "DOĞU KENT" -> "DOĞUKENT", "ABDULLAH PAŞA" -> "ABDULLAHPAŞA")
 */
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

/**
 * ArcGIS Unix epoch milisaniye tarihini TR formatında stringe çevirir.
 */
export function formatEpochDate(epochMs) {
  if (!epochMs || isNaN(epochMs)) return '-';
  try {
    const d = new Date(Number(epochMs));
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', {
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
