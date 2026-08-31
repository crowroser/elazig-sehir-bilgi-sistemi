import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Building2,
  Home,
  Phone,
  Search,
  MapPin,
  Compass,
  Layers,
  FileText,
  User,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink
,
  Calendar,
  Camera
} from 'lucide-react';
import {
  fetchNeighborhoods,
  searchAddresses,
  searchBuildings
} from '../../services/api';

export default function CbsExplorer({
  onSelectNeighborhoodOnMap,
  onNeighborhoodsLoaded,
  onSelectPointOnMap
}) {
  const [activeSubTab, setActiveSubTab] = useState('neighborhoods'); // 'neighborhoods', 'address', 'building'

  // State: Mahalleler
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [mahalleSearch, setMahalleSearch] = useState('');
  const [loadingMahalle, setLoadingMahalle] = useState(true);

  // State: Numarataj / Adres
  const [addressSearch, setAddressSearch] = useState({ mahalle: '', csbm: '', query: '' });
  const [addressResults, setAddressResults] = useState([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchedAddress, setSearchedAddress] = useState(false);

  // State: Ada/Parsel & Yapı
  const [buildingQuery, setBuildingQuery] = useState({ mahalle: '', ada: '', parsel: '', objectid: '' });
  const [buildingResults, setBuildingResults] = useState([]);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const [searchedBuilding, setSearchedBuilding] = useState(false);

  // 1. Mahalleleri İlk Yüklemede Getir
  useEffect(() => {
    async function load() {
      setLoadingMahalle(true);
      try {
        const data = await fetchNeighborhoods(true);
        setNeighborhoods(data);
        if (onNeighborhoodsLoaded) onNeighborhoodsLoaded(data);
      } catch (err) {
        console.error('Mahalleler yüklenemedi:', err);
      } finally {
        setLoadingMahalle(false);
      }
    }
    load();
  }, []);

  // Mahalle Arama Filtresi
  const filteredMahalle = neighborhoods.filter((n) => {
    if (!mahalleSearch.trim()) return true;
    const q = mahalleSearch.toLocaleLowerCase('tr-TR').trim();
    return (
      n.ad.toLocaleLowerCase('tr-TR').includes(q) ||
      n.muhtarAdi.toLocaleLowerCase('tr-TR').includes(q)
    );
  });

  // 2. Adres Arama
  const handleSearchAddress = async (e) => {
    e?.preventDefault();
    if (!addressSearch.mahalle && !addressSearch.csbm && !addressSearch.query) {
      alert('Lütfen en az bir arama kriteri girin (Mahalle, Cadde/Sokak veya No)');
      return;
    }

    setLoadingAddress(true);
    setSearchedAddress(true);
    try {
      const results = await searchAddresses(addressSearch);
      setAddressResults(results);
    } catch (err) {
      console.error('Adres aranamadı:', err);
      setAddressResults([]);
    } finally {
      setLoadingAddress(false);
    }
  };

  // 3. Yapı / Bina Arama
  const handleSearchBuilding = async (e) => {
    e?.preventDefault();
    if (!buildingQuery.objectid && !buildingQuery.ada && !buildingQuery.parsel && !buildingQuery.mahalle) {
      alert('Lütfen sorgulamak için Ada/Parsel veya Mahalle girin.');
      return;
    }

    setLoadingBuilding(true);
    setSearchedBuilding(true);
    try {
      const results = await searchBuildings(buildingQuery);
      setBuildingResults(results);
    } catch (err) {
      console.error('Bina aranamadı:', err);
      setBuildingResults([]);
    } finally {
      setLoadingBuilding(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* 1. Üst Başlık & Alt Sekmeler */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">
                Elazığ Kent Bilgi & İmar Rehberi
              </h2>
              <p className="text-xs text-zinc-400">
                Mahalle sınırları, muhtarlıklar, numarataj ve bina detay sorgulama
              </p>
            </div>
          </div>
        </div>

        {/* Alt Sekme Düğmeleri */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('neighborhoods')}
            className={`flex-1 py-2 rounded-lg transition ${
              activeSubTab === 'neighborhoods'
                ? 'bg-amber-600 text-white font-bold shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5"><Landmark className="w-4 h-4" /> 45 Mahalle & Muhtarlık</span>
          </button>

          <button
            onClick={() => setActiveSubTab('address')}
            className={`flex-1 py-2 rounded-lg transition ${
              activeSubTab === 'address'
                ? 'bg-amber-600 text-white font-bold shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5"><MapPin className="w-4 h-4" /> Numarataj & Adres</span>
          </button>

          <button
            onClick={() => setActiveSubTab('building')}
            className={`flex-1 py-2 rounded-lg transition ${
              activeSubTab === 'building'
                ? 'bg-amber-600 text-white font-bold shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5"><Building2 className="w-4 h-4" /> Ada / Parsel & Yapı</span>
          </button>
        </div>
      </div>

      {/* SEKME 1: MAHALLELER & MUHTARLIKLAR */}
      {activeSubTab === 'neighborhoods' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-0 space-y-3">
          
          {/* Mahalle Arama */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={mahalleSearch}
              onChange={(e) => setMahalleSearch(e.target.value)}
              placeholder="Mahalle veya muhtar adı ile ara..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {loadingMahalle ? (
            <div className="py-12 text-center text-xs text-zinc-400">Mahalleler yükleniyor...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1">
              {filteredMahalle.map((nh) => (
                <div
                  key={nh.objectid}
                  className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-amber-500/60 shadow-sm space-y-3 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-white">
                        {nh.ad} Mahallesi
                      </h3>
                      {nh.alanM2 && (
                        <span className="text-[11px] text-zinc-400">
                          {(nh.alanM2 / 10000).toFixed(1)} ha
                        </span>
                      )}
                    </div>

                    {/* Muhtar Bilgisi */}
                    <div className="mt-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-200">
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-semibold">{nh.muhtarAdi}</span>
                      </div>
                      {nh.muhtarTelefon && nh.muhtarTelefon !== '-' ? (
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <a
                            href={`tel:${nh.muhtarTelefon.replace(/\s+/g, '')}`}
                            className="hover:text-emerald-400 font-mono transition"
                          >
                            {nh.muhtarTelefon}
                          </a>
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">Telefon kaydı yok</span>
                      )}
                    </div>

                    {/* İstatistikler */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-center text-[11px]">
                      <div className="bg-zinc-900/40 p-1.5 rounded-lg">
                        <span className="text-zinc-400 block text-[10px]">Bina</span>
                        <span className="font-bold text-white">{nh.yapiSayisi.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="bg-zinc-900/40 p-1.5 rounded-lg">
                        <span className="text-zinc-400 block text-[10px]">Kapı No</span>
                        <span className="font-bold text-white">{nh.kapiSayisi.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="bg-zinc-900/40 p-1.5 rounded-lg">
                        <span className="text-zinc-400 block text-[10px]">Yol</span>
                        <span className="font-bold text-white">{nh.yolSayisi.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sınırları Haritada Göster */}
                  <button
                    onClick={() => onSelectNeighborhoodOnMap && onSelectNeighborhoodOnMap(nh)}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Sınırları Haritada Göster</span>
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* SEKME 2: NUMARATAJ & ADRES SORGULAMA */}
      {activeSubTab === 'address' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* Adres Formu */}
          <form onSubmit={handleSearchAddress} className="space-y-3 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Mahalle</label>
                <input
                  type="text"
                  placeholder="Örn: AKSARAY"
                  value={addressSearch.mahalle}
                  onChange={(e) => setAddressSearch({ ...addressSearch, mahalle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Cadde / Sokak (CSBM)</label>
                <input
                  type="text"
                  placeholder="Örn: BAHÇELİEVLER"
                  value={addressSearch.csbm}
                  onChange={(e) => setAddressSearch({ ...addressSearch, csbm: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Kapı No / Anahtar</label>
                <input
                  type="text"
                  placeholder="Örn: 12 veya Çarşı"
                  value={addressSearch.query}
                  onChange={(e) => setAddressSearch({ ...addressSearch, query: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={loadingAddress}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <Search className={`w-4 h-4 ${loadingAddress ? 'animate-spin' : ''}`} />
              <span>{loadingAddress ? 'Numarataj Veritabanında Aranıyor...' : 'Adres Ara (141.950 Kayıt)'}</span>
            </button>
          </form>

          {/* Arama Sonuçları */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingAddress ? (
              <div className="py-8 text-center text-xs text-zinc-400">Sonuçlar getiriliyor...</div>
            ) : searchedAddress && addressResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-800/30 rounded-xl">
                Aradığınız kriterlere uygun numarataj kaydı bulunamadı.
              </div>
            ) : (
              addressResults.map((addr) => (
                <div
                  key={addr.objectid}
                  className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:border-zinc-500 transition flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {addr.csbm} {addr.kapiNo ? `No: ${addr.kapiNo}` : ''}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-300 font-semibold text-[10px] border border-zinc-700">
                        {addr.mahalle} Mah.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                      <span><span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> Mesken:</span> {addr.meskenSayisi}</span>
                      <span><span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> İşyeri:</span> {addr.isyeriSayisi}</span>
                      <span><span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Güncelleme:</span> {addr.guncellemeTarihi}</span>
                    </div>
                  </div>

                  {addr.latitude && addr.longitude && (
                    <button
                      onClick={() => {
                        if (onSelectPointOnMap) {
                          onSelectPointOnMap({
                            lat: addr.latitude,
                            lng: addr.longitude,
                            title: `${addr.mahalle} Mah. ${addr.csbm}`,
                            subtitle: `Kapı No: ${addr.kapiNo || '-'} • Mesken: ${addr.meskenSayisi} • İşyeri: ${addr.isyeriSayisi}`
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition shrink-0 flex items-center gap-1"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Konum</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* SEKME 3: ADA / PARSEL & YAPI SORGULAMA */}
      {activeSubTab === 'building' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* Bina Arama Formu */}
          <form onSubmit={handleSearchBuilding} className="space-y-3 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Mahalle Adı</label>
                <input
                  type="text"
                  placeholder="Örn: AKSARAY"
                  value={buildingQuery.mahalle}
                  onChange={(e) => setBuildingQuery({ ...buildingQuery, mahalle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Ada No</label>
                <input
                  type="text"
                  placeholder="Örn: 101"
                  value={buildingQuery.ada}
                  onChange={(e) => setBuildingQuery({ ...buildingQuery, ada: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Parsel No</label>
                <input
                  type="text"
                  placeholder="Örn: 5"
                  value={buildingQuery.parsel}
                  onChange={(e) => setBuildingQuery({ ...buildingQuery, parsel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={loadingBuilding}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <Building2 className={`w-4 h-4 ${loadingBuilding ? 'animate-spin' : ''}`} />
              <span>{loadingBuilding ? 'Bina Kayıtları Sorgulanıyor...' : 'Bina Detaylarını Getir'}</span>
            </button>
          </form>

          {/* KVKK Uyarısı */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca yalnızca resmi yapısal öznitelikler listelenir.</span>
          </div>

          {/* Bina Sonuçları */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loadingBuilding ? (
              <div className="py-8 text-center text-xs text-zinc-400">Bina detayları getiriliyor...</div>
            ) : searchedBuilding && buildingResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-800/30 rounded-xl">
                Girilen kriterlere ait yapı kaydı bulunamadı.
              </div>
            ) : (
              buildingResults.map((bina) => (
                <div
                  key={bina.objectid}
                  className="p-4 rounded-xl bg-zinc-800/70 border border-zinc-700/70 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-white">{bina.ad}</h4>
                      <p className="text-xs text-amber-400">
                        {bina.mahalle} Mah. • Ada: {bina.adaNo} / Parsel: {bina.parselNo}
                      </p>
                    </div>
                    {bina.tabanAlaniM2 && (
                      <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300 font-mono text-xs border border-zinc-700">
                        {bina.tabanAlaniM2} m²
                      </span>
                    )}
                  </div>

                  {/* Detay Tablosu (Boş alan toleranslı) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                      <span className="text-zinc-400 text-[10px] block">Kat Sayısı</span>
                      <span className="font-bold text-white">
                        {bina.zeminUstuKat} Üst + {bina.zeminAltiKat} Alt
                      </span>
                    </div>

                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                      <span className="text-zinc-400 text-[10px] block">Mesken / İşyeri</span>
                      <span className="font-bold text-white">
                        {bina.meskenSayisi} Mesken / {bina.isyeriSayisi} İşyeri
                      </span>
                    </div>

                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                      <span className="text-zinc-400 text-[10px] block">Asansör / Otopark</span>
                      <span className="font-bold text-white">
                        {bina.asansor} / {bina.otopark}
                      </span>
                    </div>

                    <div className="bg-zinc-900/50 p-2 rounded-lg">
                      <span className="text-zinc-400 text-[10px] block">Yapı Sınıfı</span>
                      <span className="font-bold text-white">{bina.yapiSinifi}</span>
                    </div>
                  </div>

                  {/* Fotoğraflar (Varsa) */}
                  {bina.photos && bina.photos.length > 0 && (
                    <div className="pt-2 border-t border-zinc-700/60 space-y-1.5">
                      <span className="text-[11px] font-bold text-amber-400">
                        <span className="flex items-center gap-1"><Camera className="w-4 h-4" /> Saha Fotoğrafları</span> ({bina.photos.length})
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {bina.photos.map((ph) => (
                          <a
                            key={ph.id}
                            href={ph.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video rounded-lg overflow-hidden border border-zinc-700 bg-black block group"
                          >
                            <img
                              src={ph.url}
                              alt={ph.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                    <span>Dış Cephe: {bina.disCephe}</span>
                    <span>Son Güncelleme: {bina.guncellemeTarihi}</span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  );
}
