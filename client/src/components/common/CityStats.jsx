import React from 'react';
import { MapPin, Home, ShieldAlert, DoorOpen, Bus } from 'lucide-react';

export default function CityStats({ stationCount, neighborhoodCount, emergencyCount }) {
  const stats = [
    { 
      label: 'Aktif Durak', 
      value: stationCount || 1286, 
      icon: MapPin, 
      color: 'text-brand-400' 
    },
    { 
      label: 'Mahalle', 
      value: neighborhoodCount || 45, 
      icon: Home, 
      color: 'text-amber-400' 
    },
    { 
      label: 'Toplanma Alanı', 
      value: emergencyCount || 130, 
      icon: ShieldAlert, 
      color: 'text-rose-400' 
    },
    { 
      label: 'Kapı Kaydı', 
      value: 141950, 
      icon: DoorOpen, 
      color: 'text-emerald-400' 
    },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 overflow-x-auto">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5 shrink-0">
          <stat.icon className={`w-3 h-3 ${stat.color}`} />
          <span className="text-[11px] text-zinc-400">
            <strong className="text-zinc-200 font-semibold">{stat.value.toLocaleString('tr-TR')}</strong>
            {' '}{stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
