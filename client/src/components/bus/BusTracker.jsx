import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Bus,
  Clock,
  Coins,
  RefreshCw,
  Navigation,
  ChevronRight,
  Info,
  Users,
  Gauge,
  Wind,
  Accessibility,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  X,
  User
} from 'lucide-react';
import {
  fetchAllStations,
  fetchNearestStations,
  fetchStationRemaining,
  fetchRealtimeBuses,
  fetchRouteOverview,
  fetchRouteSchedule,
  fetchRoutePrice,
  fetchRouteCoordinates
} from '../../services/api';

export default function BusTracker({
  onStationsLoaded,
  onBusesUpdated,
  onRouteCoordinatesUpdated,
  onSelectStationOnMap,
  selectedStationFromMap,
  onUserLocationFound
}) {
  // State: Durak Arama ve Seçimi
  const [stations, setStations] = useState([]);
  const [stationSearch, setStationSearch] = useState('');
  const [filteredStations, setFilteredStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  
  // State: Konum
  const [isLocating, setIsLocating] = useState(false);
  const [nearestStations, setNearestStations] = useState([]);

  // State: Duraktan Geçen Hatlar ve Kalan Süreler
  const [stationLines, setStationLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [selectedRouteCode, setSelectedRouteCode] = useState(null);
  const [routeOverview, setRouteOverview] = useState(null);
  const [direction, setDirection] = useState('G'); // 'G' = Gidiş, 'D' = Dönüş
  const [loadingRoute, setLoadingRoute] = useState(false);

  // State: Canlı Otomatik Yenileme
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State: Modallar
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // 1. Tüm Durakları İlk Yüklemede Çek
  useEffect(() => {
    async function loadStations() {
      try {
        const data = await fetchAllStations();
        setStations(data);
        if (onStationsLoaded) onStationsLoaded(data);
      } catch (err) {
        console.error('Durak listesi yüklenemedi:', err);
      }
    }
    loadStations();
  }, []);

  // Haritadan durak tıklandığında seçimi senkronize et
  useEffect(() => {
    if (selectedStationFromMap) {
      handleSelectStation(selectedStationFromMap);
    }
  }, [selectedStationFromMap]);

  // Durak Arama Filtresi
  useEffect(() => {
    if (!stationSearch.trim()) {
      setFilteredStations([]);
      return;
    }
    const q = stationSearch.toLocaleLowerCase('tr-TR').trim();
    const matches = stations.filter(
      (st) =>
        st.description.toLocaleLowerCase('tr-TR').includes(q) ||
        String(st.stationId).includes(q)
    );
    setFilteredStations(matches.slice(0, 15));
  }, [stationSearch, stations]);

  // 2. Kullanıcı Konumu (GPS) Al
  const handleFindNearest = () => {
    if (!navigator.geolocation) {
      alert('Tarayıcınız konum servisini desteklemiyor.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (onUserLocationFound) onUserLocationFound({ lat: latitude, lng: longitude });

        try {
          const nearest = await fetchNearestStations(latitude, longitude, 5);
          setNearestStations(nearest);
          if (nearest.length > 0) {
            handleSelectStation(nearest[0]);
          }
        } catch (err) {
          console.error('En yakın durak hesaplanamadı:', err);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.warn('Konum alınamadı:', err);
        setIsLocating(false);
        alert('Konumunuza ulaşılamadı. Lütfen konum izni verin.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 3. Durak Seçildiğinde
  const handleSelectStation = async (station) => {
    setSelectedStation(station);
    setStationSearch('');
    setFilteredStations([]);
    if (onSelectStationOnMap) onSelectStationOnMap(station);

    setLoadingLines(true);
    try {
      const lines = await fetchStationRemaining(station.stationId);
      setStationLines(lines || []);

      // İlk hattı otomatik seç
      if (lines && lines.length > 0) {
        handleSelectRoute(lines[0].busLineCode);
      } else {
        setSelectedRouteCode(null);
        setRouteOverview(null);
        if (onBusesUpdated) onBusesUpdated([]);
        if (onRouteCoordinatesUpdated) onRouteCoordinatesUpdated(null);
      }
    } catch (err) {
      console.error('Durak hat bilgisi alınamadı:', err);
    } finally {
      setLoadingLines(false);
    }
  };

  // 4. Hat Seçildiğinde
  const handleSelectRoute = async (routeCode, dir = direction) => {
    setSelectedRouteCode(routeCode);
    setLoadingRoute(true);

    try {
      const overview = await fetchRouteOverview(routeCode, dir);
      setRouteOverview(overview || {});

      if (onBusesUpdated) {
        onBusesUpdated(overview?.buses || []);
      }
      if (onRouteCoordinatesUpdated) {
        onRouteCoordinatesUpdated(overview?.coordinates || null);
      }
    } catch (err) {
      console.error('Hat detayları alınamadı:', err);
    } finally {
      setLoadingRoute(false);
      setRefreshCountdown(10);
    }
  };

  // 5. Canlı Veri Polling (Otomatik Yenileme)
  useEffect(() => {
    if (!autoRefresh || !selectedRouteCode) return;

    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          refreshLiveBuses();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, selectedRouteCode, direction]);

  const refreshLiveBuses = async () => {
    if (!selectedRouteCode) return;
    setIsRefreshing(true);
    try {
      const overview = await fetchRouteOverview(selectedRouteCode, direction);
      setRouteOverview(overview || {});
      if (onBusesUpdated) {
        onBusesUpdated(overview?.buses || []);
      }
    } catch (err) {
      console.error('Canlı veri yenileme hatası:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleDirection = () => {
    const newDir = direction === 'G' ? 'D' : 'G';
    setDirection(newDir);
    if (selectedRouteCode) {
      handleSelectRoute(selectedRouteCode, newDir);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* 1. Üst Başlık ve Durak Arama */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold border border-brand-500/30">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white tracking-tight">
                Canlı Otobüs Takip
              </h2>
              <p className="text-xs text-zinc-400">
                1.286 durak & 82 aktif hat (Elazığ Kart)
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder="Durak adı veya no ara..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
            />
            
            {/* Arama Sonuçları Dropdown */}
            {filteredStations.length > 0 && (
              <div className="absolute w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {filteredStations.map((st) => (
                  <button
                    key={st.stationId}
                    onClick={() => handleSelectStation(st)}
                    className="w-full px-4 py-2.5 text-left hover:bg-zinc-700 transition flex items-center justify-between border-b border-zinc-700/50 last:border-0"
                  >
                    <span className="text-xs font-bold text-white">{st.description}</span>
                    <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">No: {st.stationId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={handleFindNearest}
            disabled={isLocating}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition shadow-lg shadow-brand-500/20 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            title="GPS ile en yakın durağı bul"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLocating ? 'Konum Alınıyor...' : 'En Yakın Durak'}</span>
          </button>
        </div>

        {/* Seçili Durak Bilgisi */}
        {selectedStation ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-brand-950/40 border border-brand-800/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{selectedStation.description}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    No: {selectedStation.stationId}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {Number(selectedStation.latitude).toFixed(4)}, {Number(selectedStation.longitude).toFixed(4)}
                </p>
              </div>
            </div>
            {selectedStation.distanceText && (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" /> {selectedStation.distanceText}
              </span>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-center text-xs text-zinc-400">
            Haritadan bir durağa tıklayın veya yukarıdan arama yapın.
          </div>
        )}
      </div>

      {/* 2. Duraktan Geçen Hatlar Listesi (Kalan Süreler) */}
      {selectedStation && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-brand-400" />
              <h3 className="font-bold text-sm text-white">Bu Duraktan Geçen Hatlar</h3>
            </div>
            <span className="text-xs text-zinc-400">{(stationLines || []).length} hat aktif</span>
          </div>

          {loadingLines ? (
            <div className="py-6 text-center text-xs text-zinc-400">Hatlar yükleniyor...</div>
          ) : (stationLines || []).length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-center space-y-1">
              <p className="text-xs font-semibold text-zinc-300">Bu duraktan şu an aktif hat geçmiyor</p>
              <p className="text-[11px] text-zinc-500">Sefer saatleri dışında veya pasif durak olabilir.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {(stationLines || []).map((line) => {
                const isSelected = selectedRouteCode === line.busLineCode;
                const hasArrival = line.remainingTimeCurr !== null && line.remainingTimeCurr !== undefined;

                return (
                  <div
                    key={line.busLineCode}
                    onClick={() => handleSelectRoute(line.busLineCode)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-brand-600/20 border-brand-500 shadow-md ring-1 ring-brand-500'
                        : 'bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-900 text-brand-300 font-mono font-bold text-xs border border-zinc-700">
                          {line.busLineShortName || line.busLineNo || '•'}
                        </span>
                        <span className="font-bold text-xs text-white truncate">
                          {line.busLineCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                        {line.remainingTimeNext !== null && (
                          <span className="truncate">Sonraki: {line.remainingTimeNext} dk</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {hasArrival ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30 flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3 shrink-0" />
                            {line.remainingTimeCurr === 0 ? 'DURAKTA' : `${line.remainingTimeCurr} dk`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">Canlı süre yok</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Seçili Hat Canlı Takip & Detay Paneli */}
      {selectedRouteCode && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4 flex-1 flex flex-col min-h-0">
          
          {/* Hat Başlığı & Kontroller */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600/30 text-brand-400 flex items-center justify-center font-bold border border-brand-500/30">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  {selectedRouteCode}
                </h2>
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-300">
                    {(routeOverview?.buses || []).length} Otobüs Aktif
                  </span>
                  <span>•</span>
                  <span>{(routeOverview?.routeStops || []).length} Durak</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowPriceModal(true)}
                className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 transition"
                title="Ücret Tarifesi"
              >
                <Coins className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="p-2 rounded-xl bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 border border-brand-500/20 transition"
                title="Sefer Saatleri"
              >
                <Clock className="w-4 h-4" />
              </button>
              
              <div className="h-6 w-px bg-zinc-700 mx-1"></div>

              {/* Yön Değiştirici */}
              <button
                onClick={toggleDirection}
                disabled={loadingRoute}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition disabled:opacity-50 text-[11px] sm:text-xs font-bold"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-brand-400" />
                <span className="hidden sm:inline">{direction === 'G' ? 'Gidiş Yönü' : 'Dönüş Yönü'}</span>
              </button>

              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-xl border transition ${
                  autoRefresh
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}
                title="Otomatik Yenileme (10sn)"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loadingRoute ? (
            <div className="py-12 text-center text-zinc-400 space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-xs">Hat verileri yükleniyor...</p>
            </div>
          ) : !routeOverview ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              Hat verisi bulunamadı.
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              
              {/* Güzergah / Son Durak Bilgisi */}
              <div className="px-3 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/40 flex items-center justify-between text-xs shrink-0">
                <span className="text-zinc-400">Güzergah:</span>
                <span className="font-bold text-white text-right max-w-[70%] truncate">
                  {(routeOverview?.routeStops || []).length > 0 
                    ? `${routeOverview.routeStops[0].durakAdi} ➔ ${routeOverview.routeStops[routeOverview.routeStops.length - 1].durakAdi}`
                    : 'Bilinmiyor'}
                </span>
              </div>

              {/* Canlı Otobüs Kartları */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2 sticky top-0 bg-zinc-900 py-1 z-10">
                  <span className="relative flex h-2 w-2">
                    {(routeOverview?.buses || []).length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${(routeOverview?.buses || []).length > 0 ? 'bg-emerald-500' : 'bg-zinc-500'}`}></span>
                  </span>
                  Sahadaki Araçlar ({(routeOverview?.buses || []).length})
                </h3>

                {(routeOverview?.buses || []).length === 0 ? (
                  <div className="p-6 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-center">
                    <AlertCircle className="w-6 h-6 text-zinc-500 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-zinc-300">Şu an hatta aktif araç yok</p>
                    <p className="text-xs text-zinc-500 mt-1">Sefer saatleri dışında veya araçlar henüz harekete geçmemiş olabilir.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                    {(routeOverview?.buses || []).map((bus) => (
                      <div
                        key={bus.plaka}
                        className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 hover:bg-zinc-800 hover:border-brand-500/40 transition-colors shadow-sm space-y-2"
                      >
                        {/* Üst Satır: Plaka ve Durum */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-white/50"
                              style={{ backgroundColor: bus.renk }}
                            />
                            <span className="font-mono font-extrabold text-sm text-white">
                              {bus.plaka}
                            </span>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: `${bus.renk}25`,
                              color: bus.renk,
                              border: `1px solid ${bus.renk}60`
                            }}
                          >
                            {bus.statusText}
                          </span>
                        </div>

                        {/* Orta Satır: Metrikler */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-700/60 text-center text-xs">
                          <div className="bg-zinc-900/60 p-1.5 rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                              <Gauge className="w-3 h-3" />
                              <span>Hız</span>
                            </div>
                            <span className="font-bold text-white text-[11px] sm:text-xs">{bus.hiz} km/s</span>
                          </div>

                          <div className="bg-zinc-900/60 p-1.5 rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                              <Users className="w-3 h-3" />
                              <span>Yolcu</span>
                            </div>
                            <span className="font-bold text-white text-[11px] sm:text-xs">{bus.seferYolcu} kişi</span>
                          </div>

                          <div className="bg-zinc-900/60 p-1.5 rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                              <Navigation className="w-3 h-3" />
                              <span>Pusula</span>
                            </div>
                            <span className="font-bold text-white text-[11px] sm:text-xs">{bus.yon}°</span>
                          </div>
                        </div>

                        {/* Doluluk Göstergesi */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                            <span>Doluluk</span>
                            <span className={`font-semibold ${
                              (Number(bus.seferYolcu) || 0) < 15 ? 'text-emerald-400' : (Number(bus.seferYolcu) || 0) < 35 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {(Number(bus.seferYolcu) || 0) < 15 ? 'Boş' : (Number(bus.seferYolcu) || 0) < 35 ? 'Orta' : 'Kalabalık'}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                (Number(bus.seferYolcu) || 0) < 15 ? 'bg-emerald-500' : (Number(bus.seferYolcu) || 0) < 35 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(((Number(bus.seferYolcu) || 0) / 50) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Alt Satır: Sürücü & Donanım */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                          <span className="truncate max-w-[140px]">
                            <User className="w-3 h-3 inline mr-1" /> {bus.surucu}
                          </span>
                          <div className="flex items-center gap-2">
                            {bus.klimaVarMi && (
                              <span title="Klimalı Araç" className="text-sky-400"><span className="flex items-center gap-1"><Wind className="w-3 h-3" /> Klima</span></span>
                            )}
                            {bus.engelliUygunMu && (
                              <span title="Engelli Erişimine Uygun" className="text-emerald-400"><span className="flex items-center gap-1"><Accessibility className="w-3 h-3" /> Engelli</span></span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Sefer Saatleri */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {selectedRouteCode} Sefer Saatleri
                </h3>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex gap-2 p-1 bg-zinc-800/60 border border-zinc-700/50 rounded-xl">
                <button
                  onClick={() => handleSelectRoute(selectedRouteCode, 'G')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${direction === 'G' ? 'bg-brand-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                  Gidiş Yönü
                </button>
                <button
                  onClick={() => handleSelectRoute(selectedRouteCode, 'D')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${direction === 'D' ? 'bg-brand-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                  Dönüş Yönü
                </button>
              </div>

              {loadingRoute ? (
                <div className="py-8 text-center text-xs text-zinc-400">Yükleniyor...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 mb-2 border-b border-zinc-800 pb-1 flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-emerald-400" /> Yaklaşan Seferler
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(routeOverview?.schedule?.nextTrips || []).length > 0 ? (
                        (routeOverview?.schedule?.nextTrips || []).map((t, i) => (
                          <span key={i} className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                            {t.time}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-500">Yaklaşan sefer bulunamadı.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 mb-2 border-b border-zinc-800 pb-1 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-brand-400" /> Tüm Seferler (Bugün)
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {(routeOverview?.schedule?.allTrips || []).map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-zinc-800/80 border border-zinc-700 text-zinc-300 rounded text-center text-xs font-mono">
                          {t.time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Ücret Tarifesi */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-white text-base">Ücret Tarifesi</h3>
              </div>
              <button onClick={() => setShowPriceModal(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {(routeOverview?.prices || []).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                  <span className="font-bold text-sm text-zinc-200">{p.tip}</span>
                  <span className="font-mono font-extrabold text-lg text-amber-400">
                    {p.fiyat.toFixed(2)} ₺
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
