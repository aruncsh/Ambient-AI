import React from 'react';
import { Database, ShieldCheck, Zap, Globe, MessageSquare } from 'lucide-react';

const APIStatus = () => {
  const integrationPairs = [
    { name: 'FHIR (Epic/Cerner)', status: 'Connected', icon: Database, color: 'text-indigo-500' },
    { name: 'HIPAA Encryption', status: 'Active', icon: ShieldCheck, color: 'text-green-500' },
    { name: 'Whisper AI', status: 'Optimal', icon: Zap, color: 'text-amber-500' },
    { name: 'MongoDB TTL', status: 'Purging (24h)', icon: Globe, color: 'text-blue-500' },
    { name: 'Twilio SMS', status: 'Idle', icon: MessageSquare, color: 'text-slate-400' },
  ];

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
      <h3 className="font-bold text-slate-800 text-lg">System Health</h3>
      <div className="space-y-4">
        {integrationPairs.map((item) => (
          <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-white rounded-xl shadow-sm ${item.color}`}>
                <item.icon size={18} />
              </div>
              <span className="text-sm font-semibold text-slate-600">{item.name}</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default APIStatus;
