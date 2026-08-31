import React from 'react';
import { Bus, Landmark, ShieldAlert, Activity, BookOpen, Info } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, onOpenStatus, onOpenAbout, healthData }) {
  const isHealthy = healthData?.status === 'ok';

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/80 text-white shadow-elevated">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Logo & Başlık */}
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setActiveTab('bus')}>
            <div className="w-9 h-9 rounded-lg bg-elazig-900 flex items-center justify-center shadow-md">
              <span className="text-white font-extrabold text-xs tracking-tight">KBS</span>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">
                ELAZIĞ
              </span>
              <p className="text-[10px] text-zinc-400 font-medium hidden sm:block leading-tight">
                Şehir Bilgi Sistemi
              </p>
            </div>
          </div>

          {/* Navigasyon Sekmeleri */}
          <nav className="flex items-center gap-0.5 bg-zinc-800/70 p-0.5 rounded-lg border border-zinc-700/50">
            <button
              onClick={() => setActiveTab('bus')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'bus'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
              }`}
            >
              <Bus className="w-4 h-4" />
              <span>Otobüs Takip</span>
            </button>

            <button
              onClick={() => setActiveTab('cbs')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'cbs'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Kent Bilgisi</span>
            </button>

            <button
              onClick={() => setActiveTab('emergency')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === 'emergency'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden md:inline">Acil Toplanma</span>
              <span className="md:hidden">Acil</span>
            </button>
          </nav>

          {/* Sağ Bölüm */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenAbout}
              title="Proje Hakkında"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60 transition text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Hakkında</span>
            </button>

            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              title="Swagger API Dokümantasyonu"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60 transition text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">API</span>
            </a>

            <button
              onClick={onOpenStatus}
              title="API ve Servis Durumu"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 hover:bg-zinc-700/60 transition text-xs font-medium text-zinc-400"
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHealthy ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
