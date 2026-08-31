/**
 * Elazığ Şehir Bilgi Sistemi — OpenAPI 3.0.0 Spesifikasyonu
 */

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Elazığ Şehir Bilgi Sistemi API',
    version: '1.0.0',
    description: `
**Elazığ Belediyesi'nin iki bağımsız kamu API'sini birleştiren modern REST API:**
1. **Elazığ Kart Ulaşım API** (\`https://elazigkart.elazig.bel.tr\`) — Canlı otobüs takibi, hat güzergahları, sefer saatleri, duraklar ve ücret tarifeleri.
2. **Elazığ CBS ArcGIS Enterprise API** (\`https://cbs.elazig.bel.tr\`) — Mahalleler, muhtarlıklar, numarataj (kapı no), ada/parsel, yapı detayları ve 130 acil toplanma alanı.

*Tüm uç noktalar CORS korumalı, rate-limit kuyruklu, mojibake onarımlı ve KVKK güvenlik filtreli olarak sunulmaktadır.*
    `,
    contact: {
      name: 'Elazığ Şehir Bilgi Sistemi Geliştirici Ekibi',
      url: 'http://localhost:3001'
    }
  },
  servers: [
    {
      url: 'http://localhost:3001/api',
      description: 'Yerel Geliştirme Sunucusu (BFF Proxy)'
    }
  ],
  tags: [
    {
      name: '🚌 Canlı Otobüs Takip (Elazığ Kart)',
      description: 'Otobüs durakları, canlı GPS araç takibi, polyline güzergahlar, sefer saatleri ve ücret tarifesi'
    },
    {
      name: '🏛️ Kent Bilgi Sistemi (Elazığ CBS)',
      description: 'Harita tıklama (Identify), mahalle sınırları, numarataj, ada/parsel, bina detayları ve fotoğraflar'
    },
    {
      name: '🚨 Acil Durum & Toplanma',
      description: '130 resmi acil durum toplanma alanı ve donanım bilgileri'
    },
    {
      name: '⚙️ Sistem Durumu & Sağlık',
      description: 'Belediye API sunucularının bağlantı ve gecikme metrikleri'
    }
  ],
  paths: {
    // -------------------------------------------------------------
    // OTOBÜS API'LERİ
    // -------------------------------------------------------------
    '/bus/stations': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Tüm aktif otobüs duraklarını getirir (~1.286 durak)',
        description: 'Elazığ sınırları içindeki tüm doğrulanmış ve aktif durakları listeler. Hatalı test durakları (D1..D42) otomatik filtrelenmiştir.',
        responses: {
          200: {
            description: 'Başarılı durak listesi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 1286 },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          stationId: { type: 'integer', example: 701 },
                          description: { type: 'string', example: 'KIZ MESLEK LİSESİ' },
                          isActive: { type: 'boolean', example: true },
                          latitude: { type: 'number', example: 38.674566 },
                          longitude: { type: 'number', example: 39.216306 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/bus/stations/nearest': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Verilen koordinata en yakın durakları bulur (Haversine)',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', example: 38.6748 }, description: 'Enlem' },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number', example: 39.2225 }, description: 'Boylam' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 5 }, description: 'Sonuç adedi' }
        ],
        responses: {
          200: {
            description: 'En yakın duraklar ve metre/km cinsinden mesafeleri'
          }
        }
      }
    },
    '/bus/station/{stopId}/remaining': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Bir duraktan geçen hatlar ve kalan varış süreleri',
        parameters: [
          { name: 'stopId', in: 'path', required: true, schema: { type: 'integer', example: 701 }, description: 'Durak ID' }
        ],
        responses: {
          200: {
            description: 'Duraktan geçen hatlar ve kalan dakikalar'
          }
        }
      }
    },
    '/bus/route/{routeCode}/realtime': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Bir hattaki canlı hareket halindeki otobüs konumları ve doluluk',
        parameters: [
          { name: 'routeCode', in: 'path', required: true, schema: { type: 'string', example: 'ABDULLAHPAŞA' }, description: 'Hat Kodu' }
        ],
        responses: {
          200: {
            description: 'Canlı otobüsler (plaka, hız, yön pusula açısı, renk kodu, sürücü, doluluk)'
          }
        }
      }
    },
    '/bus/route/{routeCode}/schedule': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Hattın günlük sefer saatleri ve sıradaki 3 kalkış',
        parameters: [
          { name: 'routeCode', in: 'path', required: true, schema: { type: 'string', example: 'ABDULLAHPAŞA' } },
          { name: 'direction', in: 'query', schema: { type: 'string', enum: ['G', 'D'], default: 'G' }, description: 'G: Gidiş, D: Dönüş' }
        ],
        responses: {
          200: {
            description: 'Sefer saatleri çizelgesi'
          }
        }
      }
    },
    '/bus/route/{routeCode}/price': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Hattın ücret tarifesi (Tam / İndirimli / Öğrenci)',
        parameters: [
          { name: 'routeCode', in: 'path', required: true, schema: { type: 'string', example: 'ABDULLAHPAŞA' } }
        ],
        responses: {
          200: {
            description: 'Bilet fiyatları'
          }
        }
      }
    },
    '/bus/route/{routeCode}/coordinates': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Hattın polyline güzergah koordinatları (Gidiş & Dönüş)',
        parameters: [
          { name: 'routeCode', in: 'path', required: true, schema: { type: 'string', example: 'ABDULLAHPAŞA' } }
        ],
        responses: {
          200: {
            description: 'Gidiş ve dönüş güzergah polyline noktaları'
          }
        }
      }
    },
    '/bus/route/{routeCode}/overview': {
      get: {
        tags: ['🚌 Canlı Otobüs Takip (Elazığ Kart)'],
        summary: 'Birleşik Hat Özeti (Canlı Araçlar + Saatler + Fiyat + Güzergah)',
        parameters: [
          { name: 'routeCode', in: 'path', required: true, schema: { type: 'string', example: 'ABDULLAHPAŞA' } }
        ],
        responses: {
          200: {
            description: 'Tüm hat verilerini tek istekte döndürür'
          }
        }
      }
    },

    // -------------------------------------------------------------
    // CBS API'LERİ
    // -------------------------------------------------------------
    '/cbs/identify': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Haritaya tıklanan noktanın canlı CBS verisini getirir (Spatial Identify)',
        description: 'Tıklanan enlem/boylam noktası üzerindeki bina, kadastro ada/parsel, mahalle, en yakın numarataj, yeşil alan ve en yakın acil toplanma alanını paralel sorgular.',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', example: 38.695706 }, description: 'Enlem' },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number', example: 39.176238 }, description: 'Boylam' }
        ],
        responses: {
          200: {
            description: 'Noktaya ait bina, ada/parsel, mahalle ve adres detayları'
          }
        }
      }
    },
    '/cbs/emergency-assembly': {
      get: {
        tags: ['🚨 Acil Durum & Toplanma'],
        summary: '130 Acil Durum Toplanma Alanının tamamı (WGS84 Geometri ile)',
        description: 'Park adı, m² alan, mahalle, engelli uygunluğu (♿), su (💧), WC (🚻) ve elektrik (⚡) durumu.',
        responses: {
          200: {
            description: '130 toplanma alanı listesi'
          }
        }
      }
    },
    '/cbs/neighborhoods': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: '45 Mahalle ve Muhtarlık Rehberi (Poligon Sınırları ile)',
        parameters: [
          { name: 'geometry', in: 'query', schema: { type: 'boolean', default: true }, description: 'Poligon sınırlarını dahil et' }
        ],
        responses: {
          200: {
            description: '45 mahallenin muhtar telefonları, bina/kapı istatistikleri ve sınırları'
          }
        }
      }
    },
    '/cbs/search/address': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Numarataj & Kapı No Arama (141.950 Kayıt)',
        parameters: [
          { name: 'mahalle', in: 'query', schema: { type: 'string', example: 'ÇAYDAÇIRA' }, description: 'Mahalle Adı (Türkçe toleranslı)' },
          { name: 'csbm', in: 'query', schema: { type: 'string', example: '2007' }, description: 'Cadde / Sokak / CSBM' },
          { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Genel Anahtar Kelime veya Kapı No' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 }, description: 'Sonuç limiti' }
        ],
        responses: {
          200: {
            description: 'Eşleşen numarataj ve kapı kayıtları'
          }
        }
      }
    },
    '/cbs/search/building': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Ada / Parsel ve Yapı (Bina) Detay Sorgulama',
        parameters: [
          { name: 'mahalle', in: 'query', schema: { type: 'string', example: 'AKSARAY' } },
          { name: 'ada', in: 'query', schema: { type: 'string', example: '856' } },
          { name: 'parsel', in: 'query', schema: { type: 'string', example: '1' } },
          { name: 'objectid', in: 'query', schema: { type: 'integer', example: 12662 } }
        ],
        responses: {
          200: {
            description: 'Bina kat sayısı, mesken/işyeri, asansör, otopark, yapı sınıfı ve saha fotoğrafları'
          }
        }
      }
    },
    '/cbs/building/{objectId}/attachments': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Bir binaya ait saha tespiti fotoğraflarının listesi',
        parameters: [
          { name: 'objectId', in: 'path', required: true, schema: { type: 'integer', example: 12662 } }
        ],
        responses: {
          200: {
            description: 'Fotoğraf dosya listesi'
          }
        }
      }
    },
    '/cbs/attachment/{layerId}/{objectId}/{attachmentId}': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Saha fotoğrafını indirir / görüntüler (Referer Korumalı Proxy)',
        parameters: [
          { name: 'layerId', in: 'path', required: true, schema: { type: 'integer', example: 8 } },
          { name: 'objectId', in: 'path', required: true, schema: { type: 'integer', example: 12662 } },
          { name: 'attachmentId', in: 'path', required: true, schema: { type: 'integer', example: 160554165 } }
        ],
        responses: {
          200: {
            description: 'JPEG formatında binary fotoğraf verisi',
            content: {
              'image/jpeg': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      }
    },
    '/cbs/green-areas': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Parklar ve Yeşil Alan Poligonları',
        responses: {
          200: { description: 'Yeşil alanlar listesi' }
        }
      }
    },
    '/cbs/poi': {
      get: {
        tags: ['🏛️ Kent Bilgi Sistemi (Elazığ CBS)'],
        summary: 'Önemli Noktalar (POI)',
        responses: {
          200: { description: 'Önemli noktalar listesi' }
        }
      }
    },

    // -------------------------------------------------------------
    // SİSTEM SAĞLIK & DURUM
    // -------------------------------------------------------------
    '/health': {
      get: {
        tags: ['⚙️ Sistem Durumu & Sağlık'],
        summary: 'Belediye API sunucularının bağlantı ve gecikme metrikleri',
        responses: {
          200: {
            description: 'Sağlık durumu ve yanıt süreleri'
          }
        }
      }
    }
  }
};
