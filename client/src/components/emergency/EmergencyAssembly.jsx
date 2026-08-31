import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  MapPin,
  CheckCircle2,
  Navigation2,
  Filter,
  Layers,
  Droplets,
  Zap,
  Accessibility,
  ArrowUpDown
} from 'lucide-react';
import { fetchEmergencyAreas } from '../../services/api';

export default function EmergencyAssembly({ onSelectAreaOnMap, onAreasLoaded }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMahalle, setSelectedMahalle] = useState('');
  const [filters, setFilters] = useState({
    engelli: false,
    su: false,
    wc: false,
    elektrik: false
  });
  const [sortBy, setSortBy] = useState('sira'); // 'sira', 'm2', 'ad'

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchEmergencyAreas();
        setAreas(data);
        if (onAreasLoaded) onAreasLoaded(data);
      } catch (err) {
        console.error('Acil toplanma alanları yüklenemedi:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Benzersiz mahalle listesi
  const mahalleList = Array.from(new Set(areas.map((a) => a.mahalle).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, 'tr')
  );

  // Filtreleme mantığı
  const filteredAreas = areas.filter((area) => {
    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR').trim();
      const matchPark = (area.parkAdi || '').toLocaleLowerCase('tr-TR').includes(q);
      const matchMahalle = (area.mahalle || '').toLocaleLowerCase('tr-TR').includes(q);
      const matchMevkii = (area.mevkii || '').toLocaleLowerCase('tr-TR').includes(q);
      if (!matchPark && !matchMahalle && !matchMevkii) return false;
    }

    if (selectedMahalle && area.mahalle !== selectedMahalle) {
      return false;
    }

    if (filters.engelli && !area.engelliUygun) return false;
    if (filters.su && !area.su) return false;
    if (filters.wc && !area.wc) return false;
    if (filters.elektrik && !area.elektrik) return false;

    return true;
  });

  // Sıralama
  const sortedAreas = [...filteredAreas].sort((a, b) => {
    if (sortBy === 'm2') {
      const m2A = typeof a.alanM2 === 'number' ? a.alanM2 : 0;
      const m2B = typeof b.alanM2 === 'number' ? b.alanM2 : 0;
      return m2B - m2A;
    }
    if (sortBy === 'ad') {
      return (a.parkAdi || '').localeCompare(b.parkAdi || '', 'tr');
    }
    return a.siraNo - b.siraNo;
  });

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* 1. Üst Bilgi Kartı */}
      <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900 border border-rose-900/40 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-white">
              Elazığ Acil Durum Toplanma Alanları
            </h2>
            <p className="text-xs text-rose-200/80">
              Afet ve acil durumlarda güvenle toplanabileceğiniz 130 resmi toplanma alanı ve donanım bilgileri.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Arama ve Filtreleme Araç Çubuğu */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        
        {/* Arama Input + Mahalle Seçici */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          
          <div className="relative sm:col-span-7">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Park adı, mahalle veya mevki ara..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="sm:col-span-5">
            <select
              value={selectedMahalle}
              onChange={(e) => setSelectedMahalle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Tüm Mahalleler ({mahalleList.length})</option>
              {mahalleList.map((m) => (
                <option key={m} value={m}>
                  {m} Mahallesi
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Filtre Rozetleri & Sıralama */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
          
          {/* Donanım Filtreleri */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => toggleFilter('engelli')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                filters.engelli
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Accessibility className="w-3.5 h-3.5" />
              <span>Engelli Uygun</span>
            </button>

            <button
              onClick={() => toggleFilter('su')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                filters.su
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Su</span>
            </button>

            <button
              onClick={() => toggleFilter('wc')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                filters.wc
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>🚻 WC</span>
            </button>

            <button
              onClick={() => toggleFilter('elektrik')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                filters.elektrik
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Elektrik</span>
            </button>
          </div>

          {/* Sıralama Seçici */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="sira">Sıra No</option>
              <option value="m2">Alan (m²) Büyükten Küçüğe</option>
              <option value="ad">Ada Göre (A-Z)</option>
            </select>
          </div>

        </div>

      </div>

      {/* 3. Toplanma Alanları Kart Listesi */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            Bulunan Alanlar: <span className="text-rose-400">{sortedAreas.length}</span> / 130
          </span>
          {(search || selectedMahalle || Object.values(filters).some(Boolean)) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedMahalle('');
                setFilters({ engelli: false, su: false, wc: false, elektrik: false });
              }}
              className="text-xs text-rose-400 hover:underline"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Acil toplanma alanları yükleniyor...</div>
        ) : sortedAreas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold">Aradığınız kriterlere uygun toplanma alanı bulunamadı.</p>
            <p className="text-xs text-slate-500">Lütfen filtreleri esnetin veya farklı bir mahalle seçin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1">
            {sortedAreas.map((area) => (
              <div
                key={area.objectid || area.siraNo}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-rose-500/60 shadow-sm space-y-3 transition flex flex-col justify-between"
              >
                <div>
                  
                  {/* Başlık & Sıra No */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-mono font-bold text-xs border border-rose-500/30">
                        #{area.siraNo}
                      </span>
                      <h4 className="font-bold text-sm text-white leading-snug">
                        {area.parkAdi || area.mevkii}
                      </h4>
                    </div>
                  </div>

                  {/* Mahalle & Mevkii */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{area.mahalle} Mah. {area.mevkii ? `— ${area.mevkii}` : ''}</span>
                  </div>

                  {/* Alan m2 & Donanımlar */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-700/60 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Toplam Alan</span>
                      <span className="font-bold text-white">
                        {area.alanM2 ? `${Number(area.alanM2).toLocaleString('tr-TR')} m²` : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Donanım Durumu</span>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        <span title="Engelli Uygun" className={area.engelliUygun ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          ♿
                        </span>
                        <span title="Su" className={area.su ? 'text-sky-400 font-bold' : 'text-slate-600'}>
                          💧
                        </span>
                        <span title="WC" className={area.wc ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                          🚻
                        </span>
                        <span title="Elektrik" className={area.elektrik ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                          ⚡
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Aksiyon Butonları */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
                  <button
                    onClick={() => onSelectAreaOnMap && onSelectAreaOnMap(area)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-xs font-semibold border border-rose-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Haritada Göster</span>
                  </button>

                  {area.latitude && area.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${area.latitude},${area.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                    >
                      <Navigation2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Yol Tarifi</span>
                    </a>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
