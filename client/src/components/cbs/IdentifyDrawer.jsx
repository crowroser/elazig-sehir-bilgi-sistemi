import React, { useState } from 'react';
import {
  X,
  MapPin,
  Building2,
  Home,
  Phone,
  Landmark,
  ShieldAlert,
  Compass,
  Trees,
  CheckCircle2,
  Layers,
  Calendar,
  Sparkles,
  Camera,
  Image as ImageIcon,
  ZoomIn,
  Info,
  Accessibility,
  Droplets,
  Users,
  Zap
} from 'lucide-react';

export default function IdentifyDrawer({ data, loading, onClose }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  if (!data && !loading) return null;

  const photos = [
    ...(data?.yapi?.photos || []),
    ...(data?.numarataj?.photos || [])
  ];

  return (
    <>
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[440px] max-h-[78vh] z-30 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-200">
        
        {/* 1. Üst Başlık Çubuğu */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-950 to-zinc-900 border-b border-rose-900/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-900/40 text-rose-400 flex items-center justify-center border border-rose-800/50">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-zinc-100">
                Tıklanan Nokta CBS Bilgisi
              </h3>
              {data?.coordinates && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  {data.coordinates.lat.toFixed(5)}, {data.coordinates.lng.toFixed(5)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. İçerik */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          {loading ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-semibold text-zinc-300">CBS Veritabanından Sorgulanıyor...</p>
              <p className="text-[11px] text-zinc-500">Yapı, Kadastro, Numarataj ve Saha Fotoğrafları taranıyor.</p>
            </div>
          ) : (
            <>
              {/* Saha Tespiti Fotoğrafları Galerisi */}
              {photos.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                      <Camera className="w-4 h-4" />
                      <span>Saha Tespiti Fotoğrafları</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-[10px] border border-amber-500/30">
                      {photos.length} Fotoğraf
                    </span>
                  </div>

                  {/* Fotoğraf Küçük Resimler (Thumbnails) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo)}
                        className="group relative aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 cursor-pointer shadow-md hover:border-amber-500 transition"
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                        <span className="absolute bottom-1 left-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[9px] text-zinc-200 truncate backdrop-blur-xs">
                          {photo.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mahalle & Muhtar Bilgisi */}
              {data?.mahalle && (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                      <Landmark className="w-4 h-4" />
                      <span>{data.mahalle.ad} Mahallesi</span>
                    </div>
                    {data.mahalle.alanM2 && (
                      <span className="text-[10px] text-zinc-400">
                        {(data.mahalle.alanM2 / 10000).toFixed(1)} ha
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="space-y-0.5">
                      <span className="text-zinc-400 block text-[10px]">Muhtar</span>
                      <span className="font-bold text-zinc-200">{data.mahalle.muhtarAdi}</span>
                    </div>

                    {data.mahalle.muhtarTelefon && data.mahalle.muhtarTelefon !== '-' && (
                      <a
                        href={`tel:${data.mahalle.muhtarTelefon.replace(/\s+/g, '')}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{data.mahalle.muhtarTelefon}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Kadastro (Ada / Parsel) */}
              {data?.kadastro && (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                      <Layers className="w-4 h-4" />
                      <span>Kadastro Bilgisi</span>
                    </div>
                    {data.kadastro.alanM2 && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Parsel Alanı: {data.kadastro.alanM2.toLocaleString('tr-TR')} m²
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Ada No</span>
                      <span className="font-bold text-zinc-100 font-mono">{data.kadastro.ada}</span>
                    </div>
                    <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Parsel No</span>
                      <span className="font-bold text-zinc-100 font-mono">{data.kadastro.parsel}</span>
                    </div>
                    <div className="bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Ada / Parsel</span>
                      <span className="font-bold text-amber-500 font-mono">{data.kadastro.adaParsel}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Yapı / Bina Detayı */}
              {data?.yapi ? (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Building2 className="w-4 h-4" />
                      <span>{data.yapi.ad}</span>
                    </div>
                    {data.yapi.tabanAlaniM2 && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Taban: {data.yapi.tabanAlaniM2} m²
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Kat Sayısı</span>
                      <span className="font-bold text-zinc-100">
                        {data.yapi.zeminUstuKat} Üst + {data.yapi.zeminAltiKat} Alt
                      </span>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Mesken / İşyeri</span>
                      <span className="font-bold text-zinc-100">
                        {data.yapi.meskenSayisi} Mes. / {data.yapi.isyeriSayisi} İş.
                      </span>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Asansör / Otopark</span>
                      <span className="font-bold text-zinc-100">
                        {data.yapi.asansor} / {data.yapi.otopark}
                      </span>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Yapı Sınıfı</span>
                      <span className="font-bold text-zinc-100">{data.yapi.yapiSinifi}</span>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Dış Cephe</span>
                      <span className="font-bold text-zinc-100">{data.yapi.disCephe}</span>
                    </div>

                    <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <span className="text-zinc-400 text-[10px] block">Yapım Yılı</span>
                      <span className="font-bold text-zinc-100">{data.yapi.yapimYili}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-zinc-800/30 border border-zinc-700/30 text-zinc-400 text-[11px] flex items-center justify-center gap-1.5">
                  <Info className="w-4 h-4 text-zinc-400" />
                  <span>Tıklanan noktada kayıtlı bina poligonu bulunmuyor (Boş arsa, yol veya yeşil alan olabilir).</span>
                </div>
              )}

              {/* Numarataj / En Yakın Kapı ve Cadde */}
              {data?.numarataj && (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                      <MapPin className="w-4 h-4" />
                      <span>En Yakın Numarataj / Adres</span>
                    </div>
                    {data.numarataj.distanceText && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {data.numarataj.distanceText}
                      </span>
                    )}
                  </div>

                  <div className="bg-zinc-950/50 p-2.5 rounded-lg space-y-1 text-zinc-200 border border-zinc-800/50">
                    <div className="font-bold text-zinc-100">
                      {data.numarataj.csbm} {data.numarataj.kapiNo ? `No: ${data.numarataj.kapiNo}` : ''}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span>{data.numarataj.mahalle} Mah.</span>
                      <span>•</span>
                      <span>Mesken: {data.numarataj.meskenSayisi}</span>
                      <span>•</span>
                      <span>İşyeri: {data.numarataj.isyeriSayisi}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* En Yakın Acil Toplanma Alanı */}
              {data?.nearestEmergency && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-500 font-bold">
                      <ShieldAlert className="w-4 h-4" />
                      <span>En Yakın Acil Toplanma Alanı</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-900/50 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {data.nearestEmergency.distanceText}
                    </span>
                  </div>

                  <div className="bg-zinc-950/60 p-2.5 rounded-lg space-y-1.5 border border-zinc-800/40">
                    <div className="font-bold text-zinc-100 text-xs">
                      {data.nearestEmergency.parkAdi || data.nearestEmergency.mevkii}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {data.nearestEmergency.mahalle} Mah. {data.nearestEmergency.mevkii ? `— ${data.nearestEmergency.mevkii}` : ''}
                    </div>

                    <div className="flex items-center gap-3 pt-1.5 border-t border-zinc-800/60 text-[10px]">
                      <span className={`flex items-center gap-1 ${data.nearestEmergency.engelliUygun ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        <Accessibility className="w-3 h-3" /> Engelli
                      </span>
                      <span className={`flex items-center gap-1 ${data.nearestEmergency.su ? 'text-sky-400' : 'text-zinc-500'}`}>
                        <Droplets className="w-3 h-3" /> Su
                      </span>
                      <span className={`flex items-center gap-1 ${data.nearestEmergency.wc ? 'text-indigo-400' : 'text-zinc-500'}`}>
                        <Users className="w-3 h-3" /> WC
                      </span>
                      <span className={`flex items-center gap-1 ${data.nearestEmergency.elektrik ? 'text-amber-400' : 'text-zinc-500'}`}>
                        <Zap className="w-3 h-3" /> Elektrik
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Park / Yeşil Alan Bilgisi */}
              {data?.park && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold">
                    <Trees className="w-4 h-4" />
                    <span>{data.park.ad}</span>
                  </div>
                  {data.park.alanM2 && (
                    <span className="text-xs text-emerald-400 font-mono">
                      {data.park.alanM2.toLocaleString('tr-TR')} m²
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* 3. Tam Ekran Fotoğraf Lightbox Modalı */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm text-zinc-100">{selectedPhoto.name}</span>
                {selectedPhoto.size && (
                  <span className="text-[11px] text-zinc-400">
                    ({Math.round(selectedPhoto.size / 1024)} KB)
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 flex items-center justify-center bg-black/40 overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
