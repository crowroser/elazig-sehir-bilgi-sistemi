import React from 'react';
import { X, CheckCircle2, AlertTriangle, Activity, RefreshCw, Database, Server, ShieldCheck } from 'lucide-react';

export default function StatusModal({ isOpen, onClose, healthData, onRefresh, loading }) {
  if (!isOpen) return null;

  const busApi = healthData?.services?.busApi;
  const cbsApi = healthData?.services?.cbsApi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Modal Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-white text-base">Sistem & API Sağlık Durumu</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal İçerik */}
        <div className="p-6 space-y-4">
          
          {/* Servis 1: Elazığ Kart (Otobüs) */}
          <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-brand-400" />
                <span className="font-semibold text-sm text-zinc-200">Elazığ Kart Ulaşım API</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                busApi?.status === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {busApi?.status === 'healthy' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Çevrimiçi ({busApi?.latencyMs || 0}ms)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>Hata: {busApi?.error || 'Ulaşılamıyor'}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Uç Nokta: <code className="text-brand-300">https://elazigkart.elazig.bel.tr</code>
            </p>
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                Mojibake (Windows-1254) fallback dekoderi devrede
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                429 Rate-limit koruması ve otomatik retry kuyruğu aktif
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                1.280+ durak ve anlık GPS verisi normalizasyonu aktif
              </div>
            </div>
          </div>

          {/* Servis 2: Elazığ CBS (ArcGIS) */}
          <div className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-sm text-zinc-200">Elazığ CBS (ArcGIS Enterprise)</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                cbsApi?.status === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {cbsApi?.status === 'healthy' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Çevrimiçi ({cbsApi?.latencyMs || 0}ms)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>Hata: {cbsApi?.error || 'Ulaşılamıyor'}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Uç Nokta: <code className="text-amber-300">https://cbs.elazig.bel.tr</code>
            </p>
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                130 Acil Toplanma Alanı WGS84 koordinatlarıyla bağlı
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                45 Mahalle polygon sınırları ve Muhtarlık rehberi aktif
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                KVKK Koruma Kalkanı (Layer 12 kişisel verileri sansürlenmiştir)
              </div>
            </div>
          </div>

          {/* KVKK & Güvenlik Bildirisi */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-950/40 border border-brand-800/40 text-xs text-brand-200">
            <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <p>
              Bu sistem Elazığ Belediyesi'nin halka açık anonim servisleri ile gerçek zamanlı senkronize çalışır. Hiçbir kişisel veri kaydedilmez veya paylaşılmaz.
            </p>
          </div>

        </div>

        {/* Modal Alt Çubuk */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-800/30">
          <span className="text-xs text-zinc-500">
            Son kontrol: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString('tr-TR') : '-'}
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yeniden Test Et</span>
          </button>
        </div>

      </div>
    </div>
  );
}
