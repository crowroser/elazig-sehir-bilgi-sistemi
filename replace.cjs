const fs = require('fs');

function processFile(path, processors) {
  let content = fs.readFileSync(path, 'utf8');
  for (const proc of processors) {
    content = proc(content);
  }
  fs.writeFileSync(path, content, 'utf8');
}

// 1. BusTracker
processFile('client/src/components/bus/BusTracker.jsx', [
  c => c.replace(/slate-/g, 'zinc-'),
  c => c.replace(/import \{([\s\S]*?)\} from 'lucide-react';/, (m, g) => {
    if(!g.includes('User')) g += ',\n  User';
    if(!g.includes('X')) g += ',\n  X';
    return 'import {' + g + '\n} from \'lucide-react\';';
  }),
  c => c.replace(/🚏/g, '<MapPin className="w-4 h-4" />'),
  c => c.replace(/📍/g, '<Navigation className="w-3.5 h-3.5 inline" />'),
  c => c.replace(/💡 /g, ''),
  c => c.replace(/✕/g, '<X className="w-4 h-4" />'),
  c => c.replace(/👤/g, '<User className="w-3 h-3 inline mr-1" />'),
  c => c.replace(/❄️ Klima/g, '<span className="flex items-center gap-1"><Wind className="w-3 h-3" /> Klima</span>'),
  c => c.replace(/♿ Engelli/g, '<span className="flex items-center gap-1"><Accessibility className="w-3 h-3" /> Engelli</span>'),
  c => c.replace(/⚡ Sıradaki Kalkışlar/g, '<span className="flex items-center gap-1 justify-center"><Clock className="w-4 h-4" /> Sıradaki Kalkışlar</span>'),
  c => c.replace(/\{\/\* Alt Satır: Sürücü & Donanım \*\/\}/, (m) => {
    return `{/* Doluluk Göstergesi */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Doluluk</span>
                        <span className={\`font-semibold \${
                          bus.seferYolcu < 15 ? 'text-emerald-400' : bus.seferYolcu < 35 ? 'text-amber-400' : 'text-rose-400'
                        }\`}>
                          {bus.seferYolcu < 15 ? 'Boş' : bus.seferYolcu < 35 ? 'Orta' : 'Kalabalık'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className={\`h-full rounded-full transition-all duration-500 \${
                            bus.seferYolcu < 15 ? 'bg-emerald-500' : bus.seferYolcu < 35 ? 'bg-amber-500' : 'bg-rose-500'
                          }\`}
                          style={{ width: \`\${Math.min((bus.seferYolcu / 50) * 100, 100)}%\` }}
                        />
                      </div>
                    </div>

                    ${m}`;
  })
]);

// 2. CbsExplorer
processFile('client/src/components/cbs/CbsExplorer.jsx', [
  c => c.replace(/slate-/g, 'zinc-'),
  c => c.replace(/import \{([\s\S]*?)\} from 'lucide-react';/, (m, g) => {
    if(!g.includes('Calendar')) g += ',\n  Calendar';
    if(!g.includes('Camera')) g += ',\n  Camera';
    return 'import {' + g + '\n} from \'lucide-react\';';
  }),
  c => c.replace(/bg-amber-500 text-zinc-950/g, 'bg-amber-600 text-white'),
  c => c.replace(/🏛️ 45 Mahalle & Muhtarlık/g, '<span className="flex items-center justify-center gap-1.5"><Landmark className="w-4 h-4" /> 45 Mahalle & Muhtarlık</span>'),
  c => c.replace(/📍 Numarataj & Adres/g, '<span className="flex items-center justify-center gap-1.5"><MapPin className="w-4 h-4" /> Numarataj & Adres</span>'),
  c => c.replace(/🏢 Ada \/ Parsel & Yapı/g, '<span className="flex items-center justify-center gap-1.5"><Building2 className="w-4 h-4" /> Ada / Parsel & Yapı</span>'),
  c => c.replace(/🏠 Mesken:/g, '<span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> Mesken:</span>'),
  c => c.replace(/🏪 İşyeri:/g, '<span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> İşyeri:</span>'),
  c => c.replace(/📅 Güncelleme:/g, '<span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Güncelleme:</span>'),
  c => c.replace(/📷 Saha Fotoğrafları/g, '<span className="flex items-center gap-1"><Camera className="w-4 h-4" /> Saha Fotoğrafları</span>')
]);

// 3. EmergencyAssembly
processFile('client/src/components/emergency/EmergencyAssembly.jsx', [
  c => c.replace(/slate-/g, 'zinc-'),
  c => c.replace(/import \{([\s\S]*?)\} from 'lucide-react';/, (m, g) => {
    if(!g.includes('PersonStanding')) g += ',\n  PersonStanding';
    if(!g.includes('TreePine')) g += ',\n  TreePine';
    return 'import {' + g + '\n} from \'lucide-react\';';
  }),
  c => c.replace(/bg-emerald-500 text-white shadow-md shadow-emerald-500\/30/g, 'bg-rose-600/20 border-rose-500 text-rose-300'),
  c => c.replace(/bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/g, 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800'),
  c => c.replace(/bg-sky-500 text-white shadow-md shadow-sky-500\/30/g, 'bg-rose-600/20 border-rose-500 text-rose-300'),
  c => c.replace(/bg-indigo-500 text-white shadow-md shadow-indigo-500\/30/g, 'bg-rose-600/20 border-rose-500 text-rose-300'),
  c => c.replace(/bg-amber-500 text-white shadow-md shadow-amber-500\/30/g, 'bg-rose-600/20 border-rose-500 text-rose-300'),
  c => c.replace(/<span>🚻 WC<\/span>/g, '<span className="flex items-center gap-1"><PersonStanding className="w-3.5 h-3.5" /> WC</span>'),
  c => c.replace(/>\s*♿\s*</g, '><Accessibility className="w-4 h-4" /><'),
  c => c.replace(/>\s*💧\s*</g, '><Droplets className="w-4 h-4" /><'),
  c => c.replace(/>\s*🚻\s*</g, '><PersonStanding className="w-4 h-4" /><'),
  c => c.replace(/>\s*⚡\s*</g, '><Zap className="w-4 h-4" /><')
]);
