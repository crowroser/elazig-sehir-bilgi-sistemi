import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Map, 
  Satellite, 
  Trash2, 
  Focus,
  Info,
  MapPin,
  Bus,
  ShieldAlert,
  Navigation,
  Clock,
  Gauge
} from 'lucide-react';
import { createRoot } from 'react-dom/client';

// Elazığ Varsayılan Merkez ve Zoom
const DEFAULT_CENTER = [38.6748, 39.2225];
const DEFAULT_ZOOM = 13;

export default function CityMap({
  stations = [],
  selectedStation = null,
  onSelectStation,
  buses = [],
  selectedBus = null,
  onSelectBus,
  routeCoordinates = null,
  routeDirection = 'forward',
  emergencyAreas = [],
  selectedEmergency = null,
  onSelectEmergency,
  neighborhoods = [],
  selectedNeighborhood = null,
  userLocation = null,
  activeLayer = 'bus', // 'bus', 'emergency', 'cbs'
  onMapClick = null,
  identifiedData = null,
  onClearMap = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapType, setMapType] = useState('osm'); // 'osm' veya 'satellite'

  const layersRef = useRef({
    stations: L.layerGroup(),
    buses: L.layerGroup(),
    routeLine: L.layerGroup(),
    emergency: L.layerGroup(),
    neighborhoods: L.layerGroup(),
    user: L.layerGroup(),
    highlight: L.layerGroup()
  });

  // 1. Haritayı Başlat (OpenStreetMap - 100% Ücretsiz ve API Keysiz)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true
    });

    const baseTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    tileLayerRef.current = baseTile;

    // Katman gruplarını ekle
    Object.values(layersRef.current).forEach((layer) => layer.addTo(map));

    // Haritaya tıklama olayını dinle (CBS Identify)
    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Harita Tipi Değiştirme (Standart OSM vs Esri Uydu)
  const toggleMapType = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'osm') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        }
      ).addTo(map);
      setMapType('satellite');
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);
      setMapType('osm');
    }
  };

  // 2. Seçilen Konum / Adres / GPS Güncellemesi
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = layersRef.current.user;
    if (!map) return;

    userLayer.clearLayers();

    if (userLocation && userLocation.lat && userLocation.lng) {
      const { lat, lng, title, subtitle } = userLocation;

      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div class="relative flex items-center justify-center w-9 h-9">
            <span class="absolute inline-flex w-full h-full rounded-full bg-amber-500 opacity-60 animate-ping"></span>
            <div class="relative w-6 h-6 bg-amber-600 rounded-full border-2 border-white shadow-2xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: userIcon }).addTo(userLayer);
      
      marker.bindPopup(`
        <div class="p-3 text-zinc-100 bg-zinc-900 rounded-xl space-y-1.5 min-w-[200px]">
          <div class="flex items-center gap-1 text-xs text-amber-500 font-bold">
            <span>Seçilen Konum</span>
          </div>
          ${subtitle ? `<div class="text-xs text-zinc-300">${subtitle}</div>` : ''}
          <div class="text-[10px] text-zinc-400 font-mono">
            Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}
          </div>
        </div>
      `);

      map.flyTo([lat, lng], 17, { animate: true, duration: 1 });
      setTimeout(() => {
        marker.openPopup();
      }, 400);
    }
  }, [userLocation]);

  // 3. Tıklanan Noktanın Poligonunu Vurgulama (Highlight Layer)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const hlLayer = layersRef.current.highlight;
    if (!map) return;

    hlLayer.clearLayers();

    if (identifiedData) {
      const rings = identifiedData.yapi?.geometryRings || identifiedData.kadastro?.geometryRings;
      if (rings && rings.length > 0) {
        L.polygon(rings, {
          color: '#d97706',
          weight: 3,
          opacity: 0.9,
          fillColor: '#d97706',
          fillOpacity: 0.35,
          dashArray: '4, 4'
        }).addTo(hlLayer);
      }
    }
  }, [identifiedData]);

  // 4. Durakları Güncelle & İzolasyon (Yalnızca "Otobüs Takip" sekmesinde görünür)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stationLayer = layersRef.current.stations;
    if (!map) return;

    stationLayer.clearLayers();

    if (activeLayer !== 'bus') {
      return;
    }

    stations.forEach((st) => {
      if (!st.latitude || !st.longitude) return;

      const isSelected = selectedStation?.stationId === st.stationId;

      const stationIcon = L.divIcon({
        className: 'custom-station-marker',
        html: `
          <div class="relative group cursor-pointer transition-transform duration-200 ${isSelected ? 'scale-125 z-30' : 'hover:scale-110'}">
            <div class="w-5 h-5 rounded-full ${isSelected ? 'bg-amber-600 ring-4 ring-amber-500/40' : 'bg-zinc-800/90 hover:bg-brand-600'} border-2 border-white shadow-md flex items-center justify-center text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([st.latitude, st.longitude], { icon: stationIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectStation) onSelectStation(st);
      });

      marker.bindPopup(`
        <div class="p-3 max-w-xs text-zinc-100 bg-zinc-900 rounded-xl">
          <div class="flex items-center gap-1.5 text-xs text-amber-500 font-bold mb-1">
            <span>Durak No: ${st.stationId}</span>
          </div>
          <div class="text-sm font-semibold text-white mb-2 leading-snug">
            ${st.description}
          </div>
          <button id="btn-select-st-${st.stationId}" class="w-full py-1.5 px-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold transition">
            Bu Duraktan Geçen Hatları Gör
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-st-${st.stationId}`);
        if (btn) {
          btn.onclick = () => {
            if (onSelectStation) onSelectStation(st);
            map.closePopup();
          };
        }
      });

      marker.addTo(stationLayer);
    });

    if (selectedStation?.latitude && selectedStation?.longitude) {
      map.flyTo([selectedStation.latitude, selectedStation.longitude], 16, { animate: true, duration: 1 });
    }
  }, [stations, selectedStation, activeLayer, onSelectStation]);

  // 5. Canlı Otobüsleri Güncelle & İzolasyon (Yalnızca "Otobüs Takip" sekmesinde görünür)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const busLayer = layersRef.current.buses;
    if (!map) return;

    busLayer.clearLayers();

    if (activeLayer !== 'bus') {
      return;
    }

    buses.forEach((bus) => {
      if (!bus.latitude || !bus.longitude) return;

      const isSelected = selectedBus?.plaka === bus.plaka;
      const rotation = bus.yon || 0;
      const bgColor = bus.renk || '#10b981';

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div class="relative cursor-pointer transition-transform duration-300 ${isSelected ? 'scale-125 z-40' : 'hover:scale-110'}">
            <div class="pulsing-ring" style="color: ${bgColor};"></div>

            <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-2xl border-2 border-white text-white font-bold" style="background-color: ${bgColor};">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>

              <div class="absolute -top-1.5 left-1/2 -translate-x-1/2" style="transform: rotate(${rotation}deg); transform-origin: 50% 16px;">
                <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-white drop-shadow-sm"></div>
              </div>
            </div>

            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-zinc-950/90 text-white font-mono text-[9px] font-bold border border-zinc-700 shadow-md">
              ${bus.hiz} km/s
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectBus) onSelectBus(bus);
      });

      marker.bindPopup(`
        <div class="p-3 text-zinc-100 bg-zinc-900 rounded-xl space-y-2 min-w-[220px]">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-1.5">
            <span class="text-xs font-bold text-brand-400">${bus.hatkodu}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background-color: ${bgColor}30; color: ${bgColor}; border: 1px solid ${bgColor}60;">
              ${bus.statusText}
            </span>
          </div>

          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-zinc-400">Plaka:</span>
              <span class="font-bold text-white font-mono">${bus.plaka}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Hız / Maks:</span>
              <span class="font-semibold text-zinc-200">${bus.hiz} / ${bus.maxHiz} km/s</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Sürücü:</span>
              <span class="font-semibold text-zinc-200">${bus.surucu}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Sefer Yolcu:</span>
              <span class="font-semibold text-zinc-200">${bus.seferYolcu} kişi (Günlük: ${bus.gunlukYolcu})</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">İstikamet:</span>
              <span class="font-semibold text-zinc-200">${bus.istikamet === 'G' ? 'Gidiş' : 'Dönüş'}</span>
            </div>
            <div class="flex justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800">
              <span>Güncellenme:</span>
              <span>${bus.editDate ? bus.editDate.split('T')[1]?.slice(0, 8) : '-'}</span>
            </div>
          </div>
        </div>
      `);

      marker.addTo(busLayer);
    });
  }, [buses, selectedBus, activeLayer, onSelectBus]);

  // 6. Hat Güzergah Polyline Çizimi & İzolasyon (Yalnızca "Otobüs Takip" sekmesinde)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const lineLayer = layersRef.current.routeLine;
    if (!map) return;

    lineLayer.clearLayers();

    if (activeLayer !== 'bus' || !routeCoordinates) return;

    const points = routeDirection === 'backward' ? routeCoordinates.backward : routeCoordinates.forward;

    if (points && points.length > 0) {
      L.polyline(points, {
        color: '#0284c7',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(lineLayer);

      const mainPolyline = L.polyline(points, {
        color: '#38bdf8',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 4'
      }).addTo(lineLayer);

      map.fitBounds(mainPolyline.getBounds(), { padding: [40, 40], maxZoom: 15 });
    }
  }, [routeCoordinates, routeDirection, activeLayer]);

  // 7. Acil Toplanma Alanları Katmanı & İzolasyon (Yalnızca "Acil Toplanma" sekmesinde)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const emergencyLayer = layersRef.current.emergency;
    if (!map) return;

    emergencyLayer.clearLayers();

    if (activeLayer !== 'emergency') {
      return;
    }

    emergencyAreas.forEach((area) => {
      if (!area.latitude || !area.longitude) return;

      const isSelected = selectedEmergency?.objectid === area.objectid;

      const emergencyIcon = L.divIcon({
        className: 'custom-emergency-marker',
        html: `
          <div class="relative cursor-pointer transition-transform duration-200 ${isSelected ? 'scale-125 z-40' : 'hover:scale-110'}">
            <div class="w-7 h-7 rounded-xl ${isSelected ? 'bg-rose-500 ring-4 ring-rose-400/40' : 'bg-rose-700 hover:bg-rose-600'} border-2 border-white shadow-xl flex items-center justify-center text-sm shadow-rose-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([area.latitude, area.longitude], { icon: emergencyIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectEmergency) onSelectEmergency(area);
      });

      marker.bindPopup(`
        <div class="p-3 text-zinc-100 bg-zinc-900 rounded-xl space-y-2 max-w-xs">
          <div class="flex items-center gap-1.5 text-xs text-rose-500 font-bold">
            <span>Acil Toplanma Alanı (#${area.siraNo})</span>
          </div>
          <div class="text-sm font-bold text-white">
            ${area.parkAdi || area.mevkii}
          </div>
          <div class="text-xs text-zinc-300">
            ${area.mahalle} Mah. ${area.mevkii ? `— ${area.mevkii}` : ''}
          </div>

          <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-zinc-800 text-[11px]">
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">Alan:</span>
              <span class="font-semibold text-white">${area.alanM2 ? `${Number(area.alanM2).toLocaleString('tr-TR')} m²` : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">Engelli:</span>
              <span class="font-semibold ${area.engelliUygun ? 'text-emerald-400' : 'text-zinc-400'}">${area.engelliUygun ? 'Uygun' : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">Su:</span>
              <span class="font-semibold ${area.su ? 'text-emerald-400' : 'text-zinc-400'}">${area.su ? 'Var' : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-zinc-500">WC:</span>
              <span class="font-semibold ${area.wc ? 'text-emerald-400' : 'text-zinc-400'}">${area.wc ? 'Var' : '-'}</span>
            </div>
          </div>
        </div>
      `);

      marker.addTo(emergencyLayer);
    });

    if (selectedEmergency?.latitude && selectedEmergency?.longitude) {
      map.flyTo([selectedEmergency.latitude, selectedEmergency.longitude], 16, { animate: true, duration: 1 });
    }
  }, [emergencyAreas, selectedEmergency, activeLayer, onSelectEmergency]);

  // 8. Mahalle Sınırları Katmanı & İzolasyon (Yalnızca "Kent Bilgisi (CBS)" sekmesinde)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const nLayer = layersRef.current.neighborhoods;
    if (!map) return;

    nLayer.clearLayers();

    if (activeLayer !== 'cbs') {
      return;
    }

    neighborhoods.forEach((nh) => {
      if (!nh.geometryRings || nh.geometryRings.length === 0) return;

      const isSelected = selectedNeighborhood?.objectid === nh.objectid;

      const polygon = L.polygon(nh.geometryRings, {
        color: isSelected ? '#38bdf8' : '#71717a',
        weight: isSelected ? 3 : 1.5,
        opacity: isSelected ? 1 : 0.6,
        fillColor: isSelected ? '#0284c7' : '#3f3f46',
        fillOpacity: isSelected ? 0.25 : 0.08,
      });

      polygon.bindTooltip(`
        <div class="text-xs font-bold p-1 text-zinc-900">
          ${nh.ad} Mahallesi
        </div>
      `, { sticky: true });

      polygon.addTo(nLayer);

      if (isSelected) {
        map.fitBounds(polygon.getBounds(), { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [neighborhoods, selectedNeighborhood, activeLayer]);

  // Tüm haritayı sıfırlama / temizleme fonksiyonu
  const handleClearAll = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.closePopup();
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
    layersRef.current.user.clearLayers();
    layersRef.current.highlight.clearLayers();
    if (onClearMap) onClearMap();
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl bg-zinc-950">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Harita Hızlı Butonları (Sağ Üst) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={toggleMapType}
          title={mapType === 'osm' ? 'Uydu Haritasına Geç' : 'Standart Haritaya Geç'}
          className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-lg backdrop-blur transition flex items-center gap-1.5 text-xs font-bold"
        >
          {mapType === 'osm' ? <Satellite className="w-4 h-4" /> : <Map className="w-4 h-4" />}
          <span>{mapType === 'osm' ? 'Uydu' : 'Harita'}</span>
        </button>

        <button
          onClick={handleClearAll}
          title="Tüm İşaretlemeleri Temizle ve Haritayı Sıfırla"
          className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-amber-500 border border-zinc-700 shadow-lg backdrop-blur transition flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <Trash2 className="w-4 h-4" /> Temizle
        </button>

        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            }
          }}
          title="Merkeze Sıfırla"
          className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-lg backdrop-blur transition flex justify-center items-center"
        >
          <Focus className="w-4 h-4" />
        </button>
      </div>

      {/* Bilgilendirme Rozeti (Sol Alt) */}
      <div className="absolute bottom-4 left-4 z-20 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700/60 text-[11px] text-zinc-300 flex items-center gap-1.5 shadow-lg hidden sm:flex pointer-events-none">
        <Info className="w-3.5 h-3.5 text-amber-500" />
        <span>Haritada herhangi bir noktaya tıklayarak bina, kadastro ve mahalle verilerini görebilirsiniz.</span>
      </div>
    </div>
  );
}
