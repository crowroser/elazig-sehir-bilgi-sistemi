import React, { useState, useEffect } from 'react';
import Header from './components/common/Header';
import StatusModal from './components/common/StatusModal';
import AboutModal from './components/common/AboutModal';
import CityStats from './components/common/CityStats';
import CityMap from './components/map/CityMap';
import BusTracker from './components/bus/BusTracker';
import CbsExplorer from './components/cbs/CbsExplorer';
import EmergencyAssembly from './components/emergency/EmergencyAssembly';
import IdentifyDrawer from './components/cbs/IdentifyDrawer';
import { fetchHealthStatus, identifyLocation } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('bus'); // 'bus', 'cbs', 'emergency'
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Harita Verileri
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [emergencyAreas, setEmergencyAreas] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Tıklanan Nokta CBS Verisi (Identify)
  const [identifiedData, setIdentifiedData] = useState(null);
  const [loadingIdentify, setLoadingIdentify] = useState(false);

  // 1. Sistem Sağlık Durumunu Periyodik Kontrol Et
  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await fetchHealthStatus();
      setHealthData(data);
    } catch (err) {
      console.warn('Sağlık kontrolü yapılamadı:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 60000); // 1 dakikada bir kontrol
    return () => clearInterval(interval);
  }, []);

  // Sekme Değiştiğinde Önceki Seçimleri Temizle
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSelectedStation(null);
    setSelectedBus(null);
    setSelectedEmergency(null);
    setSelectedNeighborhood(null);
    setUserLocation(null);
    setIdentifiedData(null);
  };

  // Haritadaki Tüm İşaretlemeleri Temizle
  const handleClearMap = () => {
    setSelectedStation(null);
    setSelectedBus(null);
    setSelectedEmergency(null);
    setSelectedNeighborhood(null);
    setUserLocation(null);
    setIdentifiedData(null);
  };

  // Haritaya tıklandığında CBS verisini anında çek
  const handleMapClick = async ({ lat, lng }) => {
    setLoadingIdentify(true);
    setIdentifiedData({ coordinates: { lat, lng } }); // anında koordinat ve loading göster

    try {
      const data = await identifyLocation(lat, lng);
      setIdentifiedData(data);
    } catch (err) {
      console.error('Nokta CBS verisi çekilemedi:', err);
    } finally {
      setLoadingIdentify(false);
    }
  };

  // Harita seçim olayları
  const handleSelectStation = (station) => {
    setSelectedStation(station);
    setIdentifiedData(null);
    if (activeTab !== 'bus') setActiveTab('bus');
  };

  const handleSelectEmergencyArea = (area) => {
    setSelectedEmergency(area);
    setIdentifiedData(null);
  };

  const handleSelectNeighborhood = (nh) => {
    setSelectedNeighborhood(nh);
    setIdentifiedData(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      
      {/* 1. Üst Menü Çubuğu */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenStatus={() => setShowStatusModal(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        healthData={healthData}
      />

      {/* 2. Kent İstatistikleri Çubuğu */}
      <CityStats
        stationCount={stations.length || 1286}
        neighborhoodCount={neighborhoods.length || 45}
        emergencyCount={emergencyAreas.length || 130}
      />

      {/* 3. Ana Çalışma Alanı (Split Screen: Sol Panel + Sağ Harita) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
        
        {/* Sol Panel: Aktif Mod Kontrolü ve Listeler */}
        <section className="w-full lg:w-[480px] xl:w-[540px] h-[48%] lg:h-full flex flex-col overflow-y-auto shrink-0 transition-all duration-300">
          {activeTab === 'bus' && (
            <BusTracker
              onStationsLoaded={setStations}
              onBusesUpdated={setBuses}
              onRouteCoordinatesUpdated={setRouteCoordinates}
              onSelectStationOnMap={setSelectedStation}
              selectedStationFromMap={selectedStation}
              onUserLocationFound={setUserLocation}
            />
          )}

          {activeTab === 'cbs' && (
            <CbsExplorer
              onSelectNeighborhoodOnMap={handleSelectNeighborhood}
              onNeighborhoodsLoaded={setNeighborhoods}
              onSelectPointOnMap={(pt) => {
                setUserLocation(pt);
                setIdentifiedData(null);
              }}
            />
          )}

          {activeTab === 'emergency' && (
            <EmergencyAssembly
              onSelectAreaOnMap={handleSelectEmergencyArea}
              onAreasLoaded={setEmergencyAreas}
            />
          )}
        </section>

        {/* Sağ Panel: İnteraktif Leaflet Haritası & CBS Tıklama Kartı */}
        <section className="flex-1 h-[52%] lg:h-full rounded-2xl overflow-hidden shadow-elevated relative">
          <CityMap
            stations={stations}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
            routeCoordinates={routeCoordinates}
            emergencyAreas={emergencyAreas}
            selectedEmergency={selectedEmergency}
            onSelectEmergency={handleSelectEmergencyArea}
            neighborhoods={neighborhoods}
            selectedNeighborhood={selectedNeighborhood}
            userLocation={userLocation}
            activeLayer={activeTab}
            onMapClick={handleMapClick}
            identifiedData={identifiedData}
            onClearMap={handleClearMap}
          />

          {/* Tıklanan Noktanın CBS Detay Paneli */}
          <IdentifyDrawer
            data={identifiedData}
            loading={loadingIdentify}
            onClose={() => {
              setIdentifiedData(null);
            }}
          />
        </section>

      </main>

      {/* 4. Sistem Durum Modalı */}
      <StatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        healthData={healthData}
        onRefresh={loadHealth}
        loading={loadingHealth}
      />

      {/* 5. Hakkında Modalı */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

    </div>
  );
}
