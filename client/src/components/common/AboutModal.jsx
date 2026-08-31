import React from 'react';
import { X, Shield, Server, Globe, Code2, Heart, ExternalLink, GitFork } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-modal overflow-hidden max-h-[85vh] flex flex-col">
        
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-800/40">
          <h3 className="font-bold text-white text-base">Proje Hakkında</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Proje Açıklaması */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-400" />
              Elazığ Şehir Bilgi Sistemi
            </h4>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Bu platform, Elazığ Belediyesi'ne ait iki bağımsız kamu veri altyapısını 
              — <strong className="text-white">Elazığ Kart Ulaşım API</strong> ve <strong className="text-white">Elazığ CBS ArcGIS Enterprise</strong> — 
              tersine mühendislik ile analiz ederek modern web standartlarında birleştiren 
              açık kaynaklı bir Kent Bilgi Sistemidir.
            </p>
          </div>

          {/* Ne Sunar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40 space-y-1.5">
              <div className="text-2xl font-extrabold text-brand-400">1.286</div>
              <div className="text-xs text-zinc-400">Aktif otobüs durağı, canlı GPS takip ve sefer saatleri</div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40 space-y-1.5">
              <div className="text-2xl font-extrabold text-amber-400">45</div>
              <div className="text-xs text-zinc-400">Mahalle sınırı, muhtarlık rehberi ve 141.950 kapı kaydı</div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40 space-y-1.5">
              <div className="text-2xl font-extrabold text-rose-400">130</div>
              <div className="text-xs text-zinc-400">Afet ve acil durum toplanma alanı, donanım filtreleri</div>
            </div>
          </div>

          {/* Teknik Zorluklar */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              Çözülen Teknik Zorluklar
            </h4>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-none">
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                <span><strong className="text-zinc-200">Karakter Kodlama Onarımı:</strong> Windows-1254 / ISO-8859-9 bozuk yanıtlar otomatik algılanıp düzeltilir.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                <span><strong className="text-zinc-200">Koordinat Doğrulama:</strong> Sahte/test duraklar Elazığ coğrafi sınır filtresi ile ayıklanır.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                <span><strong className="text-zinc-200">Akıllı Türkçe Arama:</strong> Karakter ve yazım varyasyonları otomatik genişletilir.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                <span><strong className="text-zinc-200">Fotoğraf Proxy:</strong> Referer korumalı CBS fotoğrafları backend üzerinden güvenle sunulur.</span>
              </li>
            </ul>
          </div>

          {/* Teknolojiler */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Teknoloji Yığını
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {['React 18', 'Vite 5', 'Tailwind CSS', 'Leaflet', 'Node.js', 'Express', 'OpenAPI 3.0'].map((tech) => (
                <span key={tech} className="px-2 py-1 rounded-md bg-zinc-800/70 border border-zinc-700/40 text-xs text-zinc-300 font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* KVKK */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-elazig-950/30 border border-elazig-900/40 text-xs text-zinc-300">
            <Shield className="w-4 h-4 text-elazig-400 shrink-0 mt-0.5" />
            <p>
              Bu sistem KVKK kapsamında hiçbir kişisel veri işlemez veya saklamaz. 
              Yalnızca kamuya açık belediye servisleri ile anonim olarak senkronize çalışır.
            </p>
          </div>

          {/* Geliştirici */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Heart className="w-3.5 h-3.5 text-elazig-500" />
              <span>Geliştirici: <strong className="text-zinc-200">Muhammed Fatih Gülcü</strong></span>
            </div>
            <a
              href="https://github.com/crowroser/elazig-sehir-bilgi-sistemi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-700/70 border border-zinc-700/40 text-xs font-semibold text-zinc-300 transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>
          </div>

          <div className="text-center text-[11px] text-zinc-500">
            v2.0.0 — Açık Kaynak Kent Bilgi Sistemi © 2026
          </div>

        </div>
      </div>
    </div>
  );
}
