import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

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
            <span class="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-60 animate-ping"></span>
            <div class="relative w-6 h-6 bg-amber-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center text-xs">
              📍
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: userIcon }).addTo(userLayer);
      
      marker.bindPopup(`
        <div class="p-3 text-slate-100 bg-slate-900 rounded-xl space-y-1.5 min-w-[200px]">
          <div class="flex items-center gap-1 text-xs text-amber-400 font-bold">
            <span>📍 ${title || 'Seçilen Konum'}</span>
          </div>
          ${subtitle ? `<div class="text-xs text-slate-300">${subtitle}</div>` : ''}
          <div class="text-[10px] text-slate-400 font-mono">
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
          color: '#f59e0b',
          weight: 3,
          opacity: 0.9,
          fillColor: '#f59e0b',
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
            <div class="w-5 h-5 rounded-full ${isSelected ? 'bg-amber-500 ring-4 ring-amber-400/40' : 'bg-slate-700/90 hover:bg-brand-500'} border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold text-white transition-colors">
              🚏
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
        <div class="p-3 max-w-xs text-slate-100 bg-slate-900 rounded-xl">
          <div class="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-1">
            <span>🚏 Durak No: ${st.stationId}</span>
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

            <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-2xl border-2 border-white text-white font-bold text-xs" style="background-color: ${bgColor};">
              <span class="text-sm">🚌</span>

              <div class="absolute -top-1.5 left-1/2 -translate-x-1/2" style="transform: rotate(${rotation}deg); transform-origin: 50% 16px;">
                <div class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-white drop-shadow-sm"></div>
              </div>
            </div>

            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-950/90 text-white font-mono text-[9px] font-bold border border-slate-700 shadow-md">
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
        <div class="p-3 text-slate-100 bg-slate-900 rounded-xl space-y-2 min-w-[220px]">
          <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span class="text-xs font-bold text-brand-400">${bus.hatkodu}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" style="background-color: ${bgColor}30; color: ${bgColor}; border: 1px solid ${bgColor}60;">
              ${bus.statusText}
            </span>
          </div>

          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-400">Plaka:</span>
              <span class="font-bold text-white font-mono">${bus.plaka}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Hız / Maks:</span>
              <span class="font-semibold text-slate-200">${bus.hiz} / ${bus.maxHiz} km/s</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Sürücü:</span>
              <span class="font-semibold text-slate-200">${bus.surucu}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Sefer Yolcu:</span>
              <span class="font-semibold text-slate-200">${bus.seferYolcu} kişi (Günlük: ${bus.gunlukYolcu})</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">İstikamet:</span>
              <span class="font-semibold text-slate-200">${bus.istikamet === 'G' ? 'Gidiş' : 'Dönüş'}</span>
            </div>
            <div class="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
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
            <div class="w-7 h-7 rounded-xl ${isSelected ? 'bg-rose-500 ring-4 ring-rose-400/40' : 'bg-rose-600 hover:bg-rose-500'} border-2 border-white shadow-xl flex items-center justify-center text-sm shadow-rose-900/50">
              🚨
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
        <div class="p-3 text-slate-100 bg-slate-900 rounded-xl space-y-2 max-w-xs">
          <div class="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
            <span>🚨 Acil Toplanma Alanı (#${area.siraNo})</span>
          </div>
          <div class="text-sm font-bold text-white">
            ${area.parkAdi || area.mevkii}
          </div>
          <div class="text-xs text-slate-300">
            📍 ${area.mahalle} Mah. ${area.mevkii ? `— ${area.mevkii}` : ''}
          </div>

          <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-800 text-[11px]">
            <div class="flex items-center gap-1">
              <span>📏 Alan:</span>
              <span class="font-semibold text-white">${area.alanM2 ? `${Number(area.alanM2).toLocaleString('tr-TR')} m²` : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>♿ Engelli:</span>
              <span class="font-semibold ${area.engelliUygun ? 'text-emerald-400' : 'text-slate-400'}">${area.engelliUygun ? 'Uygun' : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>💧 Su:</span>
              <span class="font-semibold ${area.su ? 'text-emerald-400' : 'text-slate-400'}">${area.su ? 'Var' : '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>🚻 WC:</span>
              <span class="font-semibold ${area.wc ? 'text-emerald-400' : 'text-slate-400'}">${area.wc ? 'Var' : '-'}</span>
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
        color: isSelected ? '#38bdf8' : '#64748b',
        weight: isSelected ? 3 : 1.5,
        opacity: isSelected ? 1 : 0.6,
        fillColor: isSelected ? '#0284c7' : '#334155',
        fillOpacity: isSelected ? 0.25 : 0.08,
      });

      polygon.bindTooltip(`
        <div class="text-xs font-bold p-1 text-slate-900">
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
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-slate-800 shadow-2xl bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Harita Hızlı Butonları (Sağ Üst) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={toggleMapType}
          title={mapType === 'osm' ? 'Uydu Haritasına Geç' : 'Standart Haritaya Geç'}
          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg backdrop-blur transition flex items-center gap-1.5 text-xs font-bold"
        >
          <span>{mapType === 'osm' ? '🛰️ Uydu' : '🗺️ Harita'}</span>
        </button>

        <button
          onClick={handleClearAll}
          title="Tüm İşaretlemeleri Temizle ve Haritayı Sıfırla"
          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-700 shadow-lg backdrop-blur transition flex items-center justify-center text-xs font-bold"
        >
          🧹 Temizle
        </button>

        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            }
          }}
          title="Merkeze Sıfırla"
          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-lg backdrop-blur transition text-center"
        >
          🎯
        </button>
      </div>

      {/* Bilgilendirme Rozeti (Sol Alt) */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-lg hidden sm:flex pointer-events-none">
        <span>💡 Haritada herhangi bir noktaya tıklayarak bina, kadastro ve mahalle verilerini görebilirsiniz.</span>
      </div>
    </div>
  );
}
