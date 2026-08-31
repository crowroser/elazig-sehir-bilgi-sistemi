# Elazığ Belediyesi — Birleşik API Dokümantasyonu

> Bu doküman, Elazığ Belediyesi'ne ait iki ayrı ve birbirinden bağımsız API'yi tek çatı altında toplar:
> **(1)** Elazığ Kart — Canlı Otobüs Takip API'si (`elazigkart.elazig.bel.tr`)
> **(2)** Elazığ CBS — Kent Bilgi Sistemi API'si (`cbs.elazig.bel.tr`)
>
> İki sistem de anonim/genel erişime açık, birbirinden bağımsız çalışıyor (farklı base URL, farklı kimlik doğrulama yok kuralı, farklı veri modeli). Otobüs API'si PowerShell ile uçtan uca test edilerek kesinleştirilmiştir; CBS API'si HAR dosyası analizinden çıkarılmış, henüz canlı test edilmemiştir.

## İçindekiler

- [Bölüm A — Elazığ Kart: Canlı Otobüs Takip API'si](#bölüm-a--elazığ-kart-canlı-otobüs-takip-apisi)
  - Aktif durak listesi, duraktan geçen hatlar, canlı otobüs konumları, sefer saatleri, hat durakları, ücret bilgisi, güzergah koordinatları
- [Bölüm B — Elazığ CBS: Kent Bilgi Sistemi API'si](#bölüm-b--elazığ-cbs-kent-bilgi-sistemi-apisi)
  - Parsel, bina, mahalle, numarataj, acil toplanma alanları, harita/query servisleri, ek dosyaları (fotoğraf)

---

# Bölüm A — Elazığ Kart: Canlı Otobüs Takip API'si


> Bu doküman, senin **"Elazığ Şehir Asistanı" n8n workflow'unun otobüs takibi dalından** çıkarılmış ve ardından **PowerShell ile gerçek uçtan uca istekler atılarak** (durak → hat → sefer saatleri → durak istatistiği → ücret → güzergah koordinatları) doğrulanmıştır. Aşağıdaki tüm uç noktalar **gerçek yakalanan yanıtlarla kesinleştirilmiştir** (yalnızca `realtimedata` istisna — bkz. Bölüm 3).

**Base URL:** `https://elazigkart.elazig.bel.tr`
**Auth:** `Authorization`/token yok — sadece `accept`/`content-type: application/json` header'ı. Anonim erişim.
**Metod:** Tüm uçlar **POST**, gövde JSON (`application/json`).
**Ortak yanıt zarfı:** Çoğu uç `{ "version": 1, "statusCode": 200, "message": "Success", "result": [...] }` şeklinde sarmalanıyor.
**Bilinen quirk:** `activestation` gibi bazı yanıtlar bozuk (Windows-1254/ISO-8859-9 mojibake) UTF-8 metin olarak dönebiliyor — istemci tarafında önce düz `JSON.parse`, başarısız olursa `Buffer.from(text,'binary').toString('utf8')` ile düzeltip tekrar parse etmek gerekiyor.

**✅ Yeni teyit edilen quirk — Rate limiting:** Ardışık isteklerde (~300ms aralıkla) **429 Too Many Requests** alınabiliyor (özellikle `realtimedata` uç noktasında gözlemlendi). İstekler arasında en az **1 saniye**, toplu/döngüsel sorgularda ise 1-2 saniye bekleme önerilir. 429 alınan istek birkaç saniye sonra tekrar denendiğinde normal `200` dönüyor — kalıcı bir engelleme değil, geçici hız sınırlaması.

---

### 1. `POST /api/static/activestation` — Aktif durak listesi ✅ KESİNLEŞTİ

**Body:** `{}`
**Yanıt zarfı:** `{ "version": 1, "statusCode": 200, "message": "Success", "result": [ {...} ] }`

**Durak nesnesi alanları:**
| Alan | Tip | Açıklama |
|---|---|---|
| `stationId` | number | Durağın ID'si (sonraki isteklerde `stopId` olarak kullanılıyor) |
| `description` | string | Durak adı (büyük harf, Türkçe karakterli) |
| `isActive` | number (`1`) | `bool` değil — `1` olarak geliyor |
| `latitude` | **string** | Enlem — `"38.6745..."` gibi tırnaklı, sayı değil |
| `longitude` | **string** | Boylam |

**Kayıt sayısı:** ~1331 durak, `stationId` 700'den ~2071'e kadar seyrek aralıklarla.

**Bilinen veri kalitesi sorunları:**
- Bazı kayıtlarda `latitude`/`longitude` eksik veya boş (ör. test kaydı `stationId 2056`, `"description":"test"`).
- Birkaç kayıtta (`stationId 1427`–`1468`, `"D1"`.."D42"` gibi kısa isimli) koordinatlar Elazığ dışında görünüyor (39.1x/39.4x enlem — normal Elazığ duraklarının enlemi 38.6x civarı) — muhtemelen test/hatalı veri.
- Haversine hesabından önce `latitude`/`longitude` boş/eksik kontrolü şart.

> Boyut nedeniyle sonraki node'lara sadece 5 alanı (stationId, description, latitude, longitude, isActive) taşımak, n8n Code node task-runner timeout'unu önlüyor — bu optimizasyonu koru.

---

### 2. `POST /api/static/stationremainingtime` — Duraktan geçen hatlar / kalan süre ✅ KESİNLEŞTİ

**Body:** `{ "stopId": <stationId> }`  *(number olarak da kabul ediyor, string de dener)*
**Yanıt zarfı:** `{ "version": 1, "statusCode": 200, "message": "Success", "result": [ {...} ] }`

**Eleman alanları:**
| Alan | Tip | Açıklama |
|---|---|---|
| `busLineCode` | string | Hat kodu — **diğer tüm uçlarda `routeCode` olarak bu değer kullanılıyor** (ör. `"HASTANELER"`) |
| `busLineNo` | number | Hat numarası (ör. `12`) |
| `busLineShortName` | string | Hat numarasının string hali (ör. `"12"`) |
| `panelId` | number | Sorgulanan durağın ID'si (`stopId` ile aynı) |
| `remainingTimeCurr` | number | Şu anki otobüsün durağa kalan süresi (dk) |
| `remainingTimeNext` | number | Bir sonraki otobüsün kalan süresi (dk) |
| `isAccordingToTimeSchedule` | string (`"A"`) | Anlamı teyit edilmedi — muhtemelen "tarifeye göre mi, canlı veriye göre mi" bayrağı |
| `busStatusCurr` / `busStatusNext` | number (`0`) | Anlamı teyit edilmedi |

`result` boşsa → o duraktan geçen aktif hat yok demek. Aynı durakta genelde 5-10 farklı hat listeleniyor.

**✅ Teyit edildi (4 durak / ~35 kayıt taranarak):** `busStatusCurr` ve `busStatusNext` bu örneklerde **hep `0`** geldi; `isAccordingToTimeSchedule` da **hep `"A"`** geldi. Değişkenlik gözlemlenmedi — ya sabit/pasif alanlar, ya da farklı koşullarda (arıza, hat dışı vb.) tetikleniyor olabilirler. Fonksiyonel olarak gerekmedikçe önemsiz kabul edilebilir.

---

### 3. `POST /api/static/realtimedata` — Bir hattaki canlı otobüs konumları ✅ KESİNLEŞTİ

**Body:** `{ "routeCode": "<busLineCode>" }`
**Yanıt zarfı:** `{ "version": 1, "statusCode": 200, "message": "Success", "result": [ {...} ] }`

**Eleman alanları (gerçek, `ABDULLAHPAŞA` hattı, 3 canlı otobüs örneği):**
| Alan | Tip | Açıklama |
|---|---|---|
| `state` | number (`1`) | Araç durumu — anlamı teyit edilmedi (muhtemelen "seferde/aktif") |
| `plaka` | string | Araç plakası (`"23 EB 996"`) |
| `enlem` | **number** | Anlık enlem — ⚠️ `activestation`'ın aksine burada **sayı**, string değil |
| `boylam` | **number** | Anlık boylam — burada da sayı |
| `renk` | string | Harita ikonunun rengi, hex kod harfleri (`"00FF00"` = yeşil) |
| `hiz` | number | Anlık hız (km/s) |
| `maxHiz` | number | Sefer boyunca ulaşılan maksimum hız |
| `mesafe` | number | Muhtemelen sefer/gün içinde kat edilen toplam mesafe (metre) — teyit edilmedi |
| `surucu` | string | Sürücü adı-soyadı |
| `gunlukYolcu` | number | **O gün taşınan toplam yolcu sayısı** — workflow'da hiç kullanılmıyor, faydalı olabilir |
| `seferYolcu` | number | Mevcut seferde taşınan yolcu sayısı |
| `durakYolcu` | number | Şu anki/son duraktan binen yolcu sayısı |
| `yon` | number (0-360) | Aracın pusula yönü (derece) — harita ikonunu döndürmek için kullanılabilir |
| `istikamet` | string (`"G"`/`"D"`) | Gidiş/Dönüş — `busLineCode`/durak eşleştirmesinde bu, workflow'un normalize ettiği `hatkodu`'ndan daha güvenilir bir yön kaynağı |
| `editDate` | string (ISO 8601, TZ'siz) | Son konum güncelleme zamanı (`"2026-08-31T11:08:12.203"`) — yerel (TR) saat gibi görünüyor, UTC değil |
| `imageUrl` | string | Harita ikonu görsel yolu (`"images/icon/green_bus.gif"`) |
| `klimaVarMi` | number (0/1) | Klima var mı |
| `engelliUygunMu` | number (0/1) | Engelli erişimine uygun mu |
| `hatkodu` | string | Hat kodu (`busLineCode` ile aynı) |
| `validatorNo` | number | Validatör (kart okuyucu) cihaz numarası |

**Not:** Workflow şu an bu zengin veriden sadece `enlem, boylam, hatkodu, plaka, validatorNo, surucu, hiz, maxHiz, editDate` alanlarını kullanıyor — `gunlukYolcu/seferYolcu/durakYolcu` (doluluk bilgisi) ve `yon`/`istikamet` (yön/harita ikonu döndürme) kullanılmayan ama mesaja eklenebilecek değerli veriler.

**Ayrıca:** `enlem`/`boylam` burada sayı olduğu için, workflow'daki `if (lat > 39 && lon < 39) { swap }` güvenlik svapı muhtemelen gereksiz (`activestation`'daki string alanlarla karıştırılmış olabilir) — gerçek veride swap gerektiren bir örnek görülmedi, ama zararı da yok, kalabilir.

#### 3.1 `renk` / `imageUrl` — ✅ KISMEN ÇÖZÜLDÜ (PowerShell testleri + resmi site ile doğrulandı)

`renk` ve `imageUrl`, aracın **haritadaki anlık durum ikonunu** belirliyor — resmi "Otobüsüm Nerede" sayfasında (`elazigkart.elazig.bel.tr/wheremybus`) doğrudan bu şekilde render ediliyor, teyit edildi:

| `renk` | `imageUrl` | Gözlemlenen durum |
|---|---|---|
| `"00FF00"` (yeşil) | `green_bus.gif` | Araç hareket halinde (`hiz > 0` genelde, ama `hiz=0` iken de görüldü) |
| `"FFFF00"` (sarı) | `yellow_bus.gif` | Araç duraklamış/bekliyor gibi görünüyor (sitede tıklanınca bir durak balonu açılıyor, ör. *"ABDULLAHPAŞA FATİH LİSESİ İLERİ HİLALKENT YOLU 7. DURAK"*) |
| `"FF0000"` (kırmızı) | `red_bus.gif` | Ender görülüyor; net bir kural çıkarılamadı (sinyal kaybı / rota dışı / uzun süre hareketsiz olabilir) |

**Test edilip elenen hipotezler:**
- ~~`hiz=0` → kırmızı/sarı~~: Çürütüldü — birden fazla örnekte `hiz=0` iken renk yeşil de çıktı (ör. `stationda bekleyen ama henüz "sarı"ya geçmemiş araç`).
- ~~`editDate` bayatlığı (GPS gecikmesi) → renk~~: Çürütüldü — kırmızı/sarı örnekler de çoğu zaman 0-20 saniye içinde güncellenmiş, taze veri.
- ~~`stationremainingtime`'daki `busStatusCurr`/`busStatusNext` → renk~~: Bağlantı bulunamadı — bu iki alan 4 durak/~35 hat boyunca **hep `0`** geldi, `renk`'teki değişkenlikle örtüşmüyor.

**Sonuç:** `renk`'in yeşil=hareket, sarı=duraklama ayrımı görsel olarak doğrulandı; tam arkasındaki iş kuralı (özellikle kırmızının ne zaman tetiklendiği) backend-only bir mantık olabilir, dışarıdan teyit edilemedi. Pratik kullanım için mevcut ayrım (yeşil/sarı/kırmızı → haritada bu sırayla göster) yeterli.

---

### 4. `POST /api/linehours/routeschedule` — Hat sefer saatleri ✅ KESİNLEŞTİ

**Body:**
```json
{ "routeCode": "<busLineCode>", "dayType": 0, "isFirstStations": true, "direction": "G", "hour": "" }
```
**Yanıt zarfı:** `result` dizisi (envelope ile).

**Eleman alanları:**
| Alan | Tip | Açıklama |
|---|---|---|
| `sequenceNumber` | number | Durağın hat üzerindeki sırası (`isFirstStations:true` iken hep `1` — ilk durak) |
| `stationName` | string | Durak adı |
| `routeCode` | string | Hat kodu |
| `time` | string | Sefer saati (`"06:30"`) |
| `plannedStationIn` | string | Planlanan varış saati (genelde `time` ile aynı) |
| `hour` / `minute` | number | `time`'ın ayrıştırılmış hali |
| `direction` | string (`"G"`/`"D"`) | Gidiş/Dönüş |
| `ring` | bool | Anlamı teyit edilmedi (muhtemelen "dairesel hat mı" bayrağı) |

Yanıt, **o hattın günlük tüm kalkış saatlerinin düz listesi** (12 sefer için 12 eleman, hepsi aynı ilk durak, farklı `time`) — "sonraki 3 sefer" gibi bir filtre yok, tüm günü döndürüyor; filtrelemeyi client-side yapman gerekiyor (mevcut workflow bunu doğru yapıyor).

**✅ Teyit edildi:** `dayType` parametresinin şu an **hiçbir işlevsel etkisi yok**. İki farklı hatta (`HASTANELER`: 12 sefer, `ÜNİVERSİTE`: 59 sefer) `dayType=0/1/2` gönderilerek test edildi, üçü de **birebir aynı sonucu** döndürdü (aynı sefer sayısı, aynı ilk/son saat). Parametre backend'de ya kullanılmıyor ya da bu iki hat için hafta içi/sonu farkı tanımlı değil — pratikte `0` göndermek yeterli, farklı değer denemenin bir faydası gözlemlenmedi.

**✅ Teyit edildi:** `ring` alanı gerçek bir `boolean` — test edilen hatlarda hep `false` döndü.

---

### 5. `POST /api/static/routestat` — Hattın durak listesi ✅ KESİNLEŞTİ

**Body:** `{ "routeCode": "<busLineCode>" }`
**Yanıt zarfı:** `result` dizisi.

**Eleman alanları:**
| Alan | Tip | Açıklama |
|---|---|---|
| `stopId` | number | Durağın ID'si (`activestation`'daki `stationId` ile aynı) |
| `stopName` | string | Durak adı |
| `sequence` | number | Hat üzerindeki sıra |
| `latitude` / `longitude` | string | Durağın koordinatı |
| `direction` | string (`"G"`) | Gidiş/Dönüş |

Bu, aslında **hattın tüm durak listesi** (ör. `HASTANELER` hattı için 36 durak) — workflow şu an sadece `result.length`'i "Toplam Durak" olarak gösteriyor ama içinde durak adı + koordinat da var, istersen "bu hattaki tüm duraklar" gibi bir liste özelliği eklenebilir.

---

### 6. `POST /api/static/routeprice` — Hat ücret bilgisi ✅ KESİNLEŞTİ

**Body:** `{ "routeCode": "<busLineCode>" }`
**Yanıt zarfı:** `{ "version": 1, "statusCode": 200, "message": "Success", "result": [ {...} ] }`

**Eleman alanları:**
| Alan | Açıklama |
|---|---|
| `routeCode` | Hat kodu |
| `description` | Hattın tam adı (ör. `"12 HASTANELER  HARPUT DEVLET ARŞ EĞT"`) |
| `cardType` | Tarife tipi — gözlenen değerler: `"ÖĞRENCİ-ÖĞRETMEN"`, `"TAM KART"`, `"İNDİRİMLİ"` |
| `price` | Ücret (TL, sayı) |

Her hat için sabit 3 tarife satırı dönüyor.

---

### 7. `POST /api/static/routecoordinate` — Hat güzergah koordinatları ✅ KESİNLEŞTİ

**Body:** `{ "routeCode": "<busLineCode>" }`
**Yanıt zarfı:** `result` dizisi — **hattın polyline'ı** (harita üzerinde çizilecek güzergah).

**Eleman alanları:**
| Alan | Tip | Açıklama |
|---|---|---|
| `latitude` | string | Nokta enlemi |
| `logitude` | string | ⚠️ **Yazım hatası API'de var** — `longitude` değil `logitude`! |
| `sequence` | number | Noktanın sıradaki yeri (0'dan başlıyor) |
| `route` | string | Hat kodu |
| `routeDirection` | string (`"F"` / `"B"`) | ✅ Teyit edildi — **iki değer de gözlemlendi**: `"F"` (Forward/Gidiş) ve `"B"` (Backward/Dönüş). Önceki tahmin olan `"D"` değil, `"B"` kullanılıyor. |

`HASTANELER` hattı için 227 nokta — yani harita üzerinde çizim için oldukça yoğun bir polyline. Bu uç, mevcut workflow'da çekiliyor ama **hiç kullanılmıyor** — bir harita özelliği eklemek istersen (örn. "bu hattın güzergahını göster") burası tam ihtiyacın olan veri.

---

### 8. Uçtan uca akış özeti

```
Kullanıcı konumu paylaşır
   → activestation (tüm aktif duraklar)
   → [Haversine ile en yakın aktif durak bulunur]
   → stationremainingtime (o duraktan geçen hatlar + kalan süreler)
   → realtimedata (seçilen/ilk hattın canlı otobüsleri — bazen boş)
   → [Haversine ile durağa en yakın canlı otobüs bulunur]
   → routeschedule (o hattın günlük tüm sefer saatleri, client-side filtrelenir)
   → routestat (hattın tüm durak listesi — şu an sadece sayısı kullanılıyor)
   → routeprice (3 tarife: öğrenci, tam, indirimli)
   → routecoordinate (hattın polyline'ı — şu an hiç kullanılmıyor)
   → [Tüm veriler tek bir Türkçe mesajda birleştirilip kullanıcıya gönderilir]
```

---

### 9. Hızlı `curl` şablonları

```bash
## Aktif duraklar
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/activestation" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" -d '{}'

## Bir duraktan geçen hatlar
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/stationremainingtime" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"stopId":701}'

## Bir hattın canlı otobüsleri (mesai saatinde dene)
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/realtimedata" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"routeCode":"HASTANELER"}'

## Hat sefer saatleri (gidiş, tüm gün)
curl -X POST "https://elazigkart.elazig.bel.tr/api/linehours/routeschedule" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"routeCode":"HASTANELER","dayType":0,"isFirstStations":true,"direction":"G","hour":""}'

## Hattın tüm durakları
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/routestat" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"routeCode":"HASTANELER"}'

## Hat ücret bilgisi
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/routeprice" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"routeCode":"HASTANELER"}'

## Hat güzergah koordinatları (polyline)
curl -X POST "https://elazigkart.elazig.bel.tr/api/static/routecoordinate" \
  -H "accept: application/json, text/plain, */*" -H "content-type: application/json" \
  -d '{"routeCode":"HASTANELER"}'
```

---

### 10. Test geçmişi ve doğrulama durumu (PowerShell ile uçtan uca test edildi)

Aşağıdaki noktalar, birden fazla durak/hat üzerinde PowerShell ile gerçek isteklerle test edilerek **kesinleştirildi**:

| Konu | Durum | Sonuç |
|---|---|---|
| `state` alanı | ✅ Gözlemlendi | ~40+ örnekte hep `1` geldi; farklı değer görülmedi, anlamı hâlâ tam teyitli değil ama pratikte sabit |
| `dayType` enum'u | ✅ Teyit edildi | `0/1/2` hiçbir fark yaratmıyor (2 farklı hatta test edildi) — işlevsiz kabul edilebilir |
| `ring` alanı | ✅ Teyit edildi | Boolean, gözlemlenen tüm kayıtlarda `false` |
| `routeDirection` | ✅ Teyit edildi | `"F"` (Gidiş) ve `"B"` (Dönüş) — ilk tahmin olan `"D"` yanlıştı |
| `busStatusCurr`/`busStatusNext` | ✅ Gözlemlendi | Hep `0`, `renk` ile bağlantısı bulunamadı |
| `isAccordingToTimeSchedule` | ✅ Gözlemlendi | Hep `"A"` |
| `istikamet` ↔ hat yönü eşleşmesi | ✅ Doğrulandı | Çift yönlü aktif hatlarda (ör. `ABDULLAHPAŞA`) hem `G` hem `D` aynı anda görülüyor, tutarlı |
| `renk`/`imageUrl` | ✅ Kısmen çözüldü | Bkz. Bölüm 3.1 — yeşil=hareket, sarı=duraklama görsel olarak resmi siteyle doğrulandı; kırmızının tam tetikleyicisi teyit edilemedi |
| Rate limiting | ✅ Yeni bulgu | Ardışık hızlı isteklerde 429 riski var, bkz. yukarıdaki "Bilinen quirk" |
| Durak/hat boş sonuç dönmesi (`700`, `900`, `1400` gibi `stationId`'ler) | ✅ Doğrulandı | Bazı duraklardan hiçbir aktif hat geçmiyor — veri kalitesi sorunu değil, gerçek durum (durak var ama o an/hiç hat servisi yok) |

### 11. Hâlâ netleşmeyen nokta

- **`renk`'in kırmızı (`FF0000`) durumu** — ne zaman tetiklendiği net değil; hız, GPS bayatlığı ve `busStatusCurr/Next` ile bağlantı kurulamadı. İhtimal: sinyal kaybı, rota dışı seyir, veya arıza/uzun bekleme gibi backend-only bir durum. İşlevsel olarak önemli değilse (harita ikonu rengini birebir API'den aldığın için) atlanabilir.

---

# Bölüm B — Elazığ CBS: Kent Bilgi Sistemi API'si


> HAR dosyasından (`cbs.elazig.bel.tr` üzerinde `/kentbilgisistemi` gezinimi) çıkarılmıştır.
> Sistem, standart bir **ArcGIS Enterprise Server + Portal for ArcGIS** kurulumu üzerine inşa edilmiş özel bir AngularJS SPA'dır ("cbsportal" / "kentbilgisistemi"). Uygulama katmanı (controller'lar) doğrudan ArcGIS REST API'sini çağırıyor; ayrı bir "iş" API'si yok.

**Base URL:** `https://cbs.elazig.bel.tr`
**Kimlik doğrulama:** Yakalanan trafikte hiçbir istekte `Authorization`, `token` ya da `X-Esri-Authorization` header/parametresi yok → bu servisler **anonim/genel erişime açık** (Portal `esriSharingPublic`). Sadece `Referer: https://cbs.elazig.bel.tr/kentbilgisistemi` gönderiliyor. **✅ PowerShell ile canlı test edilerek doğrulandı** — hiç auth hatası alınmadan 10 katmanın metadata'sı, öznitelik sorguları, istatistik sorgusu ve Portal `self` uç noktası başarıyla çekildi.
**Yanıt formatları:** `f=json` (JSON), `f=pbf` (Protocol Buffers — harita çizimi/vector tile sorguları için), bazı istekler GET, bazı ağır `outFields`/`outStatistics` içerenler POST (`application/x-www-form-urlencoded`) olarak atılıyor.
**Koordinat sistemi:** Kaynak veri `wkid 5257` (ITRF / TM 39, "TM_MAKS_ITRF_39"), harita üzerinde `outSR=102100` (Web Mercator) kullanılıyor.
**✅ Yeni doğrulanan quirk — Tarih alanları:** Tarih içeren alanlar (`guncelleme_tarihi`, `olusturma_tarihi`, `degistirmetarihi` vb.) **ISO string değil, Unix epoch milisaniye** olarak dönüyor (ör. `1716538382000` → 24.05.2024). Client tarafında `new Date(epochMs)` ile çevrilmesi gerekiyor.
**✅ Rate limiting gözlemlenmedi:** Otobüs API'sinin aksine, art arda (~800ms aralıkla) atılan 10+ istekte hiç 429 alınmadı — ArcGIS Server tarafı bu konuda daha toleranslı görünüyor (yine de production kullanımda makul bir bekleme önerilir).

---

### 1. Servis Envanteri

| Servis | Tip | Açıklama |
|---|---|---|
| `/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer` | FeatureServer (çok katmanlı) | Ana kent bilgi sistemi — parsel, bina, yol, mahalle, numarataj vb. |
| `/server/rest/services/acil_toplanma/FeatureServer` | FeatureServer (tek katman: `0`) | Acil durum toplanma alanları (parklar) |
| `/server/rest/services/saha_tespit/saha_kapi/FeatureServer` | FeatureServer (tek katman: `1`) | Saha tespit / bağımsız bölüm verisi (KBS_HALK layer 12 ile aynı şema) |
| `/server/rest/services/Utilities/PrintingTools/GPServer` | Geoprocessing Server | Harita/PDF çıktı alma (Export Web Map Task) |
| `/portal/sharing/rest/...` | Portal for ArcGIS | Taban harita galerisi (basemap gallery), grup/öğe (item) sorgulama |

---

### 2. KBS_HALK — Katman Listesi

`GET /server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/{layerId}?f=json` → katmanın tüm metadata'sını (fields, geometryType, extent, drawingInfo/renderer, capabilities) döner.

| ID | Katman Adı | Geometri | Not |
|---|---|---|---|
| 0 | Önemli Noktalar | Point | POI'ler (ad, yol, kapı no) |
| 2 | YEŞİL ALAN | Polygon | Parklar/yeşil alanlar |
| 3 | KADASTRO | Polygon | Ada/parsel sınırları |
| 4 | İLÇE | Polygon | İlçe sınırları |
| 5 | MAHALLE | Polygon | Mahalle sınırları + muhtar bilgisi, yapı/kapı sayıları |
| 6 | YOL ORTA HAT | Polyline | Yol orta hattı, şerit/kaplama bilgisi |
| 7 | NUMARATAJ | Point | Kapı numaraları, mesken/işyeri sayısı |
| 8 | YAPI | Polygon | Bina/yapı poligonları (kat sayısı, yapı sınıfı, asansör vb.) |
| 9 | DİĞER YAPI | Polygon | Diğer yapılar |
| 12 | BAĞIMSIZ BÖLÜM | (tablo, geometrisiz) | Daire/işyeri gibi bağımsız bölümler — **✅ teyit edildi:** canlı testte `geometryType` alanı gerçekten boş döndü |

> Not: 1, 10, 11 numaralı katmanlar bu oturumda hiç çağrılmamış (muhtemelen halka kapalı ya da farklı yetkilerle görünüyor).

#### 2.1 ✅ Tam alan (field) listeleri — PowerShell ile 10 katmandan canlı çekildi

Aşağıdaki listeler, önceki "öne çıkan alanlar" tahmininden çok daha kapsamlı — her katmanın `?f=json` metadata yanıtından **tam** olarak çıkarıldı:

**Layer 0 — Önemli Noktalar** (13 alan): `objectid, saha_aciklama, globalid, created_user, created_date, last_edited_user, last_edited_date, onemli_noktalar, mahalle, ad, yol, kapino, yeni_kapino`

**Layer 2 — YEŞİL ALAN** (10 alan): `objectid, saha_aciklama, globalid, created_user, created_date, last_edited_user, last_edited_date, Shape__Area, Shape__Length, ad`

**Layer 3 — KADASTRO** (12 alan): `objectid, ada, parsel, ada_parsel, ilce, mahalle, mahalleadi, Shape__Area, Shape__Length, kad_mah, object_yedek, objectid_yedek`

**Layer 4 — İLÇE** (24 alan): `objectid, id, ad, kimlikno, ilid, globalid, olusturmatarihi, degistirmetarihi, gecerliliktarihi, ihtilafdurumu, ihtilafnedeni, kuruluskararsayisi, kuruluskarartarihi, merkezilcemi, olusturan, degistiren, operationnumber, operationdescription, uavtmerkezkoykodu, uavtmerkezbucakkodu, verikaynagi, se_anno_cad_data, Shape__Area, Shape__Length`

**Layer 5 — MAHALLE** (32 alan): `objectid, id, ad, kimlikno, beldeid, ilceid, belediyeid, globalid, olusturmatarihi, degistirmetarihi, gecerliliktarihi, ihtilafdurumu, ihtilafnedeni, kuruluskararsayisi, kuruluskarartarihi, bucakid, olusturan, degistiren, operationnumber, operationdescription, tanitimkodu, verikaynagi, se_anno_cad_data, ilce, durum, muhtar_adi_soyadi, muhtar_cep_telefonu, yol_orta_hat_sayisi, yapi_sayisi, kapi_sayisi, Shape__Area, Shape__Length`

**Layer 6 — YOL ORTA HAT** (38 alan): `objectid, id, kimlikno, tip, yolid, globalid, olusturmatarihi, degistirmetarihi, ad, olusumyontemi, olcek, olusturan, degistiren, operationdescription, islemgerekcesi, ofis_kontrol, belediye_kontrol, yol_tasarim, yol_tasarim_aciklama, yol_tasarim_ad, yol_tasarim_tip, yol_tasarim_oneri, saha_aciklama, guncelleme, guncelleme_tarihi, olusturma, olusturma_tarihi, ekip, kontrol_id, tespit_tarihi, serit_sayisi, kullanilan_serit_sayisi, kaplama_cinsi, kontrol, bolunmus_yol, mahalle_adi, guncellik_durum, Shape__Length`

**Layer 7 — NUMARATAJ** (55 alan): `objectid, id, kimlikno, tip, baglioldugunumaratajid, yolortahatyonid, yapiid, parselid, digeryapiid, globalid, olusturmatarihi, degistirmetarihi, olusturan, degistiren, binakodu, operationdescription, ad, aciklama, tasarimkapino, mahalle, yeni_csbm, numarataj_tasarim, ofis_kontrol, belediye_kontrol, siparis_tarihi, siparis_aciklama, montaj, montaj_aciklama, csbm, yeni_csbm_tip, toplam_mesken_sayisi, toplam_is_yeri_sayisi, guncelleme, guncelleme_tarihi, olusturma, olusturma_tarihi, ekip, saha_aciklama, kontrol_id, kapi_tur, kapi_kullanim, ilan_reklam, tespit_tarihi, kontrol, mukerrer_kontrol, maksguncelleme, maksguncelleme_tarihi, numaratajguncelleme, numaratajguncelleme_tarihi, yolortahat_id, montaj_tarihi, kimlik_yeni, guncellik_durum, deneme, kimlik_no_str` — **✅ toplam kayıt sayısı teyit edildi: 141.950**

**Layer 8 — YAPI** (60 alan): `objectid, id, kimlikno, parselkimlikno, tip, durum, parselid, globalid, olusturmatarihi, degistirmetarihi, olusumyontemi, siteveyakooperatifadi, zeminustukatsayisi, zeminaltikatsayisi, ad, parsel_id, olusturan, degistiren, operationdescription, aciklama, paftaadi, parselno, adano, yapikayitbelgeno, yapikayitbelgetarih, yapim_yili, ikamet_durumu, fiziksel_durum, belediye_kontrol, ofis_kontrol, saha_aciklama, oturan_bilgisi, bb_tespiti, toplam_mesken, toplam_isyeri, toplam_bb_sayisi, guncelleme, guncelleme_tarihi, olusturma, olusturma_tarihi, ekip, otopark, dis_cephe_kaplama, yangin_merdiveni, yapi_sinifi, asansor, asansor_sayisi, asansor_kapasite, tescilli_yapi, tespit_tarihi, kontrol, maksguncelleme, maksguncelleme_tarihi, numaratajguncelleme, numaratajguncelleme_tarihi, mahalle_adi, kimlik_yeni, guncellik_durum, Shape__Area, Shape__Length` — **⚠️ veri kalitesi notu:** `objectid=1` gibi eski/ilk-aktarım kayıtlarında (`operationdescription="İLK VERİ AKTARIMI"`) çoğu alan boş geliyor; sadece `tip, durum, zeminustukatsayisi, ikamet_durumu, oturan_bilgisi, otopark, dis_cephe_kaplama, yapi_sinifi, asansor, mahalle_adi, guncellik_durum` gibi bir kısmı dolu olabiliyor. `objectid` sıralı değil (1, 2, 5 geldi — 3 ve 4 atlanmış), muhtemelen silinmiş/erişilemeyen kayıtlar var.

**Layer 9 — DİĞER YAPI** (27 alan): `objectid, id, ad, kimlikno, tip, globalid, olusturmatarihi, degistirmetarihi, olusturan, degistiren, operationdescription, adano, parselno, paftaadi, zeminustukatsayisi, zeminaltikatsayisi, guncelleme, guncelleme_tarihi, olusturma, olusturma_tarihi, saha_aciklama, mahalle, maksguncelleme, maksguncelleme_tarihi, guncellik_durum, Shape__Area, Shape__Length`

**Layer 12 — BAĞIMSIZ BÖLÜM** (49 alan): `objectid, id, kimlikno, durum, baglioldugubbid, yapiid, numaratajid, globalid, olusturmatarihi, degistirmetarihi, ad, bagimsizbolumno, kullanimturu, kullanimalttur, digeryapiid, tapubagimsizbolumno, tip, kaynak, olusturan, degistiren, operationnumber, operationdescription, aciklama, islemgerekcesi, katno, tasarimkapino, yapikayitbelgeno, yapikayitbelgetarih, baba_adi, oturan_sayisi, is_yeri_unvani, is_yeri_turu, numarataj_id, bb_aciklama, guncelleme, guncelleme_tarihi, olusturma, olusturma_tarihi, kontrol_id, ana_ad, tc_kimlik, bbturu, bb_turu, tespit_tarihi, maksguncelleme, maksguncelleme_tarihi, numaratajguncelleme, numaratajguncelleme_tarihi, mahalle` — **⚠️ KVKK uyarısı teyit edildi:** `tc_kimlik`, `ana_ad`, `baba_adi` gerçekten `outFields=*` ile dönüyor, dışa aktarırken/loglarken dikkat edilmeli.

**acil_toplanma / Layer 0** (test edildi, ✅): `sira_no, mahalle_ad, park_adi, m2, engelli_ (engelli erişimi), elektrik, su, wc, enlem_koor, boylam_koo` — **toplam 130 acil toplanma alanı** kayıtlı, teyit edildi.

**⚠️ Yeni keşfedilen veri kalitesi sorunu — mahalle adı tutarsızlığı:** Mahalle bazlı istatistik sorgusunda aynı mahallenin farklı yazımları ayrı kayıt olarak sayılıyor, ör. `"DOĞUKENT"` (7.052 numarataj) ile `"DOĞU KENT"` (17 numarataj, boşluklu yazım) ayrı gruplarmış gibi geliyor. Mahalle bazlı raporlama yapılacaksa isim normalizasyonu (boşluk/büyük-küçük harf temizliği) gerekiyor.

---

### 3. Query Endpoint'i — `/FeatureServer/{layerId}/query`

Standart Esri `query` operasyonu. Tüm harita etkileşimleri (pan/zoom, arama, popup açma, istatistik) bu endpoint üzerinden yapılıyor. GET veya POST (form-urlencoded) desteklenir; uzun `outFields`/`outStatistics` gövdeleri POST ile gönderiliyor.

#### 3.1 Harita çizimi (tile/vector) sorgusu — en sık kullanılan
```
GET /server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8/query
    ?f=pbf
    &geometry={"xmin":...,"ymin":...,"xmax":...,"ymax":...}
    &geometryType=esriGeometryEnvelope
    &inSR=102100
    &outSR=102100
    &spatialRel=esriSpatialRelIntersects
    &where=(bb_tespiti<>1) OR (tip<>5)
    &outFields=objectid,tip
    &orderByFields=objectid
    &resultType=tile
    &returnExceededLimitFeatures=false
    &quantizationParameters={"extent":{...},"mode":"view","originPosition":"upperLeft","tolerance":<zoom'a göre değişen piksel toleransı>}
```
- Harita, görünen ekran dikdörtgenini (bbox) kutulara (tile) bölüp her biri için ayrı bir istek atıyor (aynı `where` ile, farklı `geometry`).
- `f=pbf` yanıtı binary Protocol Buffers (Esri'nin `esriPBuffer` şeması) — sadece harita çizim motorunda (ArcGIS JS API) çözülüyor, düz JSON değil.
- Öznitelik/veri çekmek istiyorsanız `f=json` kullanın (aşağıya bakın); `f=pbf` sadece geometriyi hızlı çizmek içindir.

#### 3.2 Öznitelik (attribute) sorgusu — asıl veri çekimi
```
GET /server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/6/query
    ?f=json
    &where=yol_tasarim_ad='4108'
    &outFields=objectid,id,kimlikno,tip,ad,... (tüm alan listesi ya da *)
    &returnGeometry=false
```
Yanıt:
```json
{
  "objectIdFieldName": "objectid",
  "globalIdFieldName": "globalid",
  "geometryType": "esriGeometryPolyline",
  "spatialReference": {"wkt": "PROJCS[...TM_MAKS_ITRF_39...]"},
  "fields": [ {"name":"objectid","alias":"OBJECTID","type":"esriFieldTypeOID"}, ... ],
  "features": [
    { "attributes": { "objectid": 123, "ad": "...", ... } }
  ]
}
```
`returnGeometry=false` → sadece öznitelikler döner (popup/detay panelleri bu şekilde çalışıyor). Geometriye de ihtiyaç varsa parametreyi kaldırın veya `true` yapın; bu durumda her feature'a bir `geometry` alanı eklenir (rings/paths/x-y, `outSR`'a göre).

#### 3.3 Sayım / ID sorgusu (yalnızca kaç kayıt var, hangi ID'ler)
```
GET .../FeatureServer/7/query?f=json&returnIdsOnly=true&returnCountOnly=true
    &where=numarataj_tasarim<>'0'&spatialRel=esriSpatialRelIntersects
```

#### 3.4 İstatistik (group by) sorgusu
```
GET .../FeatureServer/7/query?f=json
    &groupByFieldsForStatistics=mahalle
    &outFields=*
    &outStatistics=[{"onStatisticField":"mahalle","outStatisticFieldName":"countOFmahalle","statisticType":"count"}]
    &where=numarataj_tasarim<>'0'
```
Mahalle bazında sayım gibi dashboard/istatistik panelleri bunu kullanıyor. `statisticType` değerleri Esri standardı: `count, sum, min, max, avg, stddev, var`.

#### 3.5 Sık kullanılan diğer parametreler
| Parametre | Açıklama |
|---|---|
| `where` | SQL benzeri filtre (`1=1` = tümü). Türkçe karakterli metin alanları `LIKE '%...%'` ile de sorgulanabiliyor (arama kutusu böyle çalışıyor). |
| `outFields` | Dönecek alanlar, `*` ya da virgülle ayrılmış liste |
| `returnGeometry` | `true`/`false` |
| `geometry` + `geometryType` + `inSR` | Mekansal filtre (envelope/point/polygon) |
| `spatialRel` | `esriSpatialRelIntersects` (neredeyse tüm isteklerde bu) |
| `orderByFields` | Sıralama (genelde `objectid`) |
| `resultType` | `tile` (harita çizimi) ya da yok (öznitelik sorgusu) |
| `quantizationParameters` | Vector-tile hassasiyeti (zoom seviyesine göre) |
| `outSR` / `inSR` | `102100` = Web Mercator |

---

### 4. Ek Dosyaları (Fotoğraflar) — Attachments

Bazı katmanlarda (0, 7, 8, 9) her kayda fotoğraf eklenebiliyor (saha tespiti fotoğrafları).

**Ek listesini almak:**
```
GET /server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/{layerId}/queryAttachments
    ?f=json&objectIds={objectId}&returnMetadata=true
```
Yanıt:
```json
{
  "attachmentGroups": [{
    "parentObjectId": 12662,
    "parentGlobalId": "{B1E1F6C8-...}",
    "attachmentInfos": [
      {"id":160554165,"name":"Fotoğraf 1.jpg","contentType":"image/jpeg","size":376176}
    ]
  }]
}
```

**Dosyayı indirmek:**
```
GET /server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/{layerId}/{objectId}/attachments/{attachmentId}
GET .../attachments/{attachmentId}?w=400   # küçük önizleme (genişlik parametreli)
```
Yanıt doğrudan binary `image/jpeg`.

**✅ Test edildi:** `objectid` 1-20 aralığında YAPI katmanında (Layer 8) hiç ek dosyalı kayıt bulunamadı — fotoğraflı kayıtlar nadir, muhtemelen sadece sonradan saha tespiti yapılmış belirli kayıtlarda mevcut (dokümandaki örnek `objectid=12662` gibi daha yüksek/spesifik ID'lerde olabilir). Rastgele düşük `objectid` denemek yerine, önce bir `where=bb_tespiti=1` gibi saha-tespiti-yapılmış kayıtları filtreleyen bir sorguyla ilgili `objectid`'leri bulup ardından `queryAttachments` denemek daha verimli olur.

---

### 5. Yazdırma / PDF Servisi

```
GET /server/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task?f=json
```
Task'in kendisi bir **Geoprocessing servisi**; gerçek yazdırma işlemi bir POST ile `.../Export Web Map Task/execute` (veya `submitJob`) endpoint'ine, web haritasının JSON tanımı (`Web_Map_as_JSON`) gövdede gönderilerek yapılır (standart Esri "Export Web Map" GP task şeması). Bu oturumda sadece task tanımı çekilmiş, gerçek bir yazdırma isteği yakalanmamış — parametre listesi için yukarıdaki URL'nin JSON yanıtındaki `parameters` dizisine bakın.

`Get Layout Templates Info/execute` uç noktası bu oturumda `400 Invalid URL` hatası döndü (muhtemelen doğrudan GET yerine POST/execute gerektiriyor).

---

### 6. Portal (Basemap Galerisi)

Harita altlığı (uydu, sokak, gece modu vb.) seçici, Esri **Portal for ArcGIS** üzerinden geliyor:

**✅ Test edildi:** `portals/self` uç noktası anonim erişimle çalışıyor, gerçek yanıt: `name: "Elazığ Belediyesi ArcGIS Enterprise"` — bu, sistemin gerçekten kurumsal bir ArcGIS Enterprise kurulumu olduğunu doğruluyor.

```
GET /portal/sharing/rest/portals/self?f=json
GET /portal/sharing/rest/community/groups?f=json&...
GET /portal/sharing/rest/content/groups/{groupId}/search?f=json&...   # basemap galerisi öğeleri
GET /portal/sharing/rest/content/items/{itemId}/data?f=json           # bir web map/basemap item'ının tanımı
GET /portal/sharing/rest/content/items/{itemId}/info/thumbnail/{dosya}
```
Bunlar Esri'nin **hazır basemap galerisi** (Navigation, Terrain, Human Geography, Nova Map, Colored Pencil, vb. — standart Esri stilleri), Elazığ'a özgü içerik değil; sadece `ac79b007546f4e6c88dd2e048fb1a77d` ve `ff0f815a47624c1cb6528318d2788b83` ID'li item'lar tekrar tekrar çağrılıyor — muhtemelen uygulamanın varsayılan/özel taban haritası.

---

### 7. Uygulama Yapısı (AngularJS SPA) — Bilgi Amaçlı

`/kentbilgisistemi/app.js` + modüler controller'lar (`app/{modül}/{modül}.controller.js`) klasik bir AngularJS uygulaması. `authService/authentication.service.js` ve `authService/data.service.js` genel auth/HTTP yardımcı servisleri; ancak halka açık (`KBS_HALK`) tarafında gerçek bir token akışı gözlemlenmedi — büyük ihtimalle personel paneli (`/cbsportal`, `aykomeyonetim`, `yonetim` gibi modüller) girişli, halk tarafı (`/kentbilgisistemi`) anonim.

---

### 8. Hızlı Başlangıç — Örnek `curl` Komutları

```bash
## Bir mahallenin sınır bilgisini adına göre bul (✅ test edildi - AKSARAY ile calisiyor; "MERKEZ" adinda mahalle YOK, deneme yapmayin)
curl "https://cbs.elazig.bel.tr/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/5/query?f=json&where=ad='AKSARAY'&outFields=*&returnGeometry=false"

## Bir yapının (bina) tüm bilgilerini objectid ile çek
curl "https://cbs.elazig.bel.tr/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8/query?f=json&where=objectid=12662&outFields=*&returnGeometry=false"

## Bir binaya ait fotoğrafların listesi
curl "https://cbs.elazig.bel.tr/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/8/queryAttachments?f=json&objectIds=12662&returnMetadata=true"

## Acil toplanma alanlarının tamamı (öznitelik, geometrisiz)
curl "https://cbs.elazig.bel.tr/server/rest/services/acil_toplanma/FeatureServer/0/query?f=json&where=1=1&outFields=*&returnGeometry=false"

## Mahalle bazında numarataj (kapı) sayımı
curl "https://cbs.elazig.bel.tr/server/rest/services/kentbilgisistemi/KBS_HALK/FeatureServer/7/query?f=json&where=1=1&groupByFieldsForStatistics=mahalle&outStatistics=%5B%7B%22onStatisticField%22%3A%22mahalle%22%2C%22outStatisticFieldName%22%3A%22adet%22%2C%22statisticType%22%3A%22count%22%7D%5D"
```

---

### 9. Notlar / Uyarılar

- **✅ PowerShell ile canlı test edildi (Ağustos 2026):** Anonim erişim gerçekten çalışıyor — 10 katmanın tam metadata'sı, öznitelik/istatistik/sayım sorguları ve Portal `self` uç noktası hiç auth hatası almadan başarıyla çekildi. Rate limiting gözlemlenmedi.
- Bu, resmî yayınlanmış bir API değil; belediyenin genel ArcGIS Server'ının **anonim erişime açık** uçları taranarak çıkarılmıştır. Yoğun/otomatikleştirilmiş kullanım öncesi belediye ile iletişime geçmeniz önerilir.
- Layer 12 (BAĞIMSIZ BÖLÜM) ve türevleri **TC kimlik no, ad-soyad** gibi kişisel veri alanları içeriyor — canlı testte bu alanların gerçekten `outFields=*` ile döndüğü doğrulandı; dışa aktarırken/loglarken KVKK'ya dikkat edin.
- `f=pbf` yanıtları düz JSON değildir; sadece harita render'ı için kullanılır. Programatik veri çekimi için her zaman `f=json` + `returnGeometry=false` (gerekmiyorsa) tercih edin.
- **✅ Yeni:** Tarih alanları (`*_tarihi` ile bitenler) Unix epoch milisaniye formatında geliyor, ISO string değil — parse ederken dikkat edin.
- **✅ Yeni:** Mahalle isimlerinde tutarsız yazımlar var (ör. `"DOĞUKENT"` / `"DOĞU KENT"`), mahalle bazlı toplu analizlerde normalizasyon gerekebilir.
- **✅ Yeni:** YAPI (Layer 8) gibi katmanlarda eski/ilk-aktarım kayıtlarının çoğu alanı boş olabiliyor — `outFields=*` çekip `null`/boş değerlere karşı toleranslı kod yazılmalı.
- `where` parametresinde tek tırnak/özel karakterler URL-encode edilmeli (`'` → `%27`, boşluk → `%20` veya `+`).
