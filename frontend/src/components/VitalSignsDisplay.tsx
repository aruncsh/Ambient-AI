import React from 'react';
import { Heart, Wind, Thermometer, Droplets } from 'lucide-react';

const VitalSignsDisplay = ({ vitals }: { vitals: any }) => {
  const stats = [
    { label: 'Heart Rate', value: vitals?.heart_rate || '--', unit: 'bpm', icon: Heart, color: 'text-red-400' },
    { label: 'SpO2', value: vitals?.spO2 || '--', unit: '%', icon: Wind, color: 'text-blue-400' },
    { label: 'Temperature', value: vitals?.temperature || '--', unit: '°F', icon: Thermometer, color: 'text-amber-400' },
    { label: 'Respiration', value: vitals?.respiration || '--', unit: '/min', icon: Droplets, color: 'text-indigo-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="p-4 bg-slate-900 border border-slate-700 rounded-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
            <stat.icon size={16} className={stat.color} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black">{stat.value}</span>
            <span className="text-[10px] text-slate-600">{stat.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VitalSignsDisplay;
