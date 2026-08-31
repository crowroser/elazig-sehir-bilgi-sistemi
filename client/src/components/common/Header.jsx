import React from 'react';
import { Bus, Landmark, ShieldAlert, Activity, BookOpen, Sparkles } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, onOpenStatus, healthData }) {
  const isHealthy = healthData?.status === 'ok';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Başlık */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('bus')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-rose-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-xl">🏙️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ELAZIĞ
                </span>
                <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold border border-brand-500/30">
                  Şehir Bilgi
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Canlı Ulaşım & Kent Bilgi Sistemi
              </p>
            </div>
          </div>

          {/* Navigasyon Sekmeleri */}
          <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveTab('bus')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'bus'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bus className="w-4 h-4 text-brand-300" />
              <span>Otobüs Takip</span>
            </button>

            <button
              onClick={() => setActiveTab('cbs')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'cbs'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Landmark className="w-4 h-4 text-amber-400" />
              <span>Kent Bilgisi (CBS)</span>
            </button>

            <button
              onClick={() => setActiveTab('emergency')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'emergency'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-300" />
              <span className="hidden md:inline">Acil Toplanma</span>
              <span className="md:hidden">Acil</span>
            </button>
          </nav>

          {/* Sağ Bölüm: Swagger UI & Sistem Durumu */}
          <div className="flex items-center gap-2">
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              title="Swagger API Dokümantasyonu"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700/80 hover:text-white transition text-xs font-semibold text-brand-300 shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline">Swagger API</span>
            </a>

            <button
              onClick={onOpenStatus}
              title="API ve Servis Durumu"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700/80 transition text-xs font-medium text-slate-300"
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHealthy ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="hidden lg:inline">API Durumu</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
