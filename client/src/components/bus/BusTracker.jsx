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
  AlertCircle
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
  // State: Duraklar
  const [stations, setStations] = useState([]);
  const [stationSearch, setStationSearch] = useState('');
  const [filteredStations, setFilteredStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [nearestStations, setNearestStations] = useState([]);
  const [isLocating, setIsLocating] = useState(false);

  // State: Hat ve Canlı Veri
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

  // 2. "Bana En Yakın Durak" Butonu
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
      setStationLines(lines);

      // İlk hattı otomatik seç
      if (lines.length > 0) {
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
      setRouteOverview(overview);

      if (onBusesUpdated) {
        onBusesUpdated(overview.buses || []);
      }
      if (onRouteCoordinatesUpdated) {
        onRouteCoordinatesUpdated(overview.coordinates || null);
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
  }, [autoRefresh, selectedRouteCode]);

  // Canlı Otobüsleri Yenileme
  const refreshLiveBuses = async () => {
    if (!selectedRouteCode) return;
    setIsRefreshing(true);
    try {
      const buses = await fetchRealtimeBuses(selectedRouteCode);
      setRouteOverview((prev) => (prev ? { ...prev, buses } : { buses }));
      if (onBusesUpdated) onBusesUpdated(buses);
    } catch (err) {
      console.warn('Canlı otobüs yenilenemedi:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Yön Değiştirme (Gidiş / Dönüş)
  const toggleDirection = () => {
    const nextDir = direction === 'G' ? 'D' : 'G';
    setDirection(nextDir);
    if (selectedRouteCode) {
      handleSelectRoute(selectedRouteCode, nextDir);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* 1. Üst Kontrol Paneli: Durak Arama & En Yakın Butonu */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          
          {/* Arama Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder="Durak adı veya No ile ara (ör: 701 veya Valilik)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
            {stationSearch && (
              <button
                onClick={() => setStationSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}

            {/* Arama Sonuç Dropdown */}
            {filteredStations.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                {filteredStations.map((st) => (
                  <div
                    key={st.stationId}
                    onClick={() => handleSelectStation(st)}
                    className="p-3 hover:bg-slate-800 border-b border-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-bold text-white block">{st.description}</span>
                      <span className="text-slate-400">Durak No: {st.stationId}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* En Yakın Durak Butonu */}
          <button
            onClick={handleFindNearest}
            disabled={isLocating}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs sm:text-sm font-bold shadow-lg shadow-brand-600/25 transition shrink-0 disabled:opacity-50"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Konum Alınıyor...' : 'En Yakın Durak'}</span>
          </button>
        </div>

        {/* Seçili Durak Bilgisi */}
        {selectedStation ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-brand-950/40 border border-brand-800/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                🚏
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{selectedStation.description}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    No: {selectedStation.stationId}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStation.latitude.toFixed(4)}, {selectedStation.longitude.toFixed(4)}
                </p>
              </div>
            </div>
            {selectedStation.distanceText && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                📍 {selectedStation.distanceText}
              </span>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-center text-xs text-slate-400">
            💡 Haritadan bir durağa tıklayın veya yukarıdan arama yapın.
          </div>
        )}
      </div>

      {/* 2. Duraktan Geçen Hatlar Listesi (Kalan Süreler) */}
      {selectedStation && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-brand-400" />
              <h3 className="font-bold text-sm text-white">Bu Duraktan Geçen Hatlar</h3>
            </div>
            <span className="text-xs text-slate-400">{stationLines.length} hat aktif</span>
          </div>

          {loadingLines ? (
            <div className="py-6 text-center text-xs text-slate-400">Hatlar yükleniyor...</div>
          ) : stationLines.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-300">Bu duraktan şu an aktif hat geçmiyor</p>
              <p className="text-[11px] text-slate-500">Sefer saatleri dışında veya pasif durak olabilir.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {stationLines.map((line) => {
                const isSelected = selectedRouteCode === line.busLineCode;
                const hasArrival = line.remainingTimeCurr !== null && line.remainingTimeCurr !== undefined;

                return (
                  <div
                    key={line.busLineCode}
                    onClick={() => handleSelectRoute(line.busLineCode)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'bg-brand-600/20 border-brand-500 shadow-md ring-1 ring-brand-500'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-brand-300 font-mono font-bold text-xs border border-slate-700">
                          {line.busLineShortName || line.busLineNo || '•'}
                        </span>
                        <span className="font-bold text-xs text-white truncate max-w-[120px]">
                          {line.busLineCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        {line.remainingTimeNext !== null && (
                          <span>Sonraki: {line.remainingTimeNext} dk</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {hasArrival ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
                            {line.remainingTimeCurr === 0 ? 'DURAKTA' : `${line.remainingTimeCurr} dk`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">Canlı süre yok</span>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
          
          {/* Hat Başlığı & Kontroller */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600/30 text-brand-400 flex items-center justify-center font-bold border border-brand-500/30">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  {selectedRouteCode}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{routeOverview?.stops?.length || 0} Durak</span>
                  <span>•</span>
                  <span>{routeOverview?.buses?.length || 0} Canlı Araç</span>
                </div>
              </div>
            </div>

            {/* Sağ Butonlar (Yön, Sefer, Ücret, Yenile) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleDirection}
                title="Gidiş/Dönüş Değiştir"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-brand-400" />
                <span>{direction === 'G' ? 'Gidiş' : 'Dönüş'}</span>
              </button>

              <button
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Saatler</span>
              </button>

              <button
                onClick={() => setShowPriceModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Ücret</span>
              </button>

              <button
                onClick={refreshLiveBuses}
                disabled={isRefreshing}
                title="Canlı Konumları Yenile"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Otomatik Yenileme Çubuğu */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Canlı Takip Aktif (Otomatik yenileme: {refreshCountdown}s)</span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-[10px] font-semibold text-brand-400 hover:underline"
            >
              {autoRefresh ? 'Durdur' : 'Başlat'}
            </button>
          </div>

          {/* Canlı Otobüs Kartları */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Seferdeki Canlı Araçlar</span>
              <span className="text-[11px] font-normal text-slate-500">
                {routeOverview?.buses?.length || 0} araç hatta
              </span>
            </h4>

            {loadingRoute ? (
              <div className="py-6 text-center text-xs text-slate-400">Otobüs verisi alınıyor...</div>
            ) : !routeOverview?.buses || routeOverview.buses.length === 0 ? (
              /* ⚠️ Empty State: Kullanıcı Dostu Açıklama */
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center space-y-1.5">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">
                  Şu Anda Bu Hatta Canlı Otobüs Bulunmuyor
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Araçlar sefer saatini bekliyor olabilir veya GPS sinyali pasif durumda. Günlük sefer saatlerini inceleyebilirsiniz.
                </p>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 text-xs font-semibold border border-brand-500/30 transition"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Sefer Saatlerini Gör</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {routeOverview.buses.map((bus) => (
                  <div
                    key={bus.plaka}
                    className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 shadow-sm space-y-2 hover:border-slate-600 transition"
                  >
                    {/* Üst Satır: Plaka & Durum */}
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
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60 text-center text-xs">
                      <div className="bg-slate-900/60 p-1.5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                          <Gauge className="w-3 h-3" />
                          <span>Hız</span>
                        </div>
                        <span className="font-bold text-white text-xs">{bus.hiz} km/s</span>
                      </div>

                      <div className="bg-slate-900/60 p-1.5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                          <Users className="w-3 h-3" />
                          <span>Yolcu</span>
                        </div>
                        <span className="font-bold text-white text-xs">{bus.seferYolcu} kişi</span>
                      </div>

                      <div className="bg-slate-900/60 p-1.5 rounded-lg">
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                          <Navigation className="w-3 h-3" />
                          <span>Pusula</span>
                        </div>
                        <span className="font-bold text-white text-xs">{bus.yon}°</span>
                      </div>
                    </div>

                    {/* Alt Satır: Sürücü & Donanım */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="truncate max-w-[140px]">👤 {bus.surucu}</span>
                      <div className="flex items-center gap-2">
                        {bus.klimaVarMi && (
                          <span title="Klimalı Araç" className="text-sky-400">❄️ Klima</span>
                        )}
                        {bus.engelliUygunMu && (
                          <span title="Engelli Erişimine Uygun" className="text-emerald-400">♿ Engelli</span>
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

      {/* MODAL 1: Sefer Saatleri */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {selectedRouteCode} Sefer Saatleri
                </h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Sıradaki 3 Sefer */}
              {routeOverview?.schedule?.nextTrips?.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    ⚡ Sıradaki Kalkışlar
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {routeOverview.schedule.nextTrips.map((trip, idx) => (
                      <div key={idx} className="bg-slate-900/80 p-2.5 rounded-lg text-center border border-amber-700/30">
                        <span className="font-mono font-extrabold text-base text-amber-300 block">
                          {trip.time}
                        </span>
                        <span className="text-[10px] text-amber-400 font-medium">
                          {trip.diffText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Günlük Tüm Seferler Listesi */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300">
                  Tüm Günlük Sefer Çizelgesi ({routeOverview?.schedule?.allTrips?.length || 0} Sefer)
                </span>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(routeOverview?.schedule?.allTrips || []).map((trip, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-center font-mono font-bold text-sm text-slate-200"
                    >
                      {trip.time}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-800/30 text-right">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Ücret Tarifesi */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  {selectedRouteCode} Ücret Tarifesi
                </h3>
              </div>
              <button
                onClick={() => setShowPriceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3">
              {(routeOverview?.prices || []).map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 shadow-sm"
                >
                  <div>
                    <span className="font-bold text-sm text-white block">{p.cardType}</span>
                    <span className="text-xs text-slate-400">Belediye Toplu Taşıma Tarifesi</span>
                  </div>
                  <span className="font-extrabold text-lg text-emerald-400 font-mono">
                    {p.price.toFixed(2)} ₺
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-800/30 text-right">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
