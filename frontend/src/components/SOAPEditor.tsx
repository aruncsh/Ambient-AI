import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';

const SOAPEditor = ({ initialSoap }: { initialSoap?: any }) => {
  const [soap, setSoap] = useState(initialSoap || {
    subjective: "", objective: "", assessment: "", plan: ""
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {Object.entries(soap).map(([key, value]) => (
        <div key={key} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 space-y-4 group hover:border-indigo-300 transition-colors">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{key}</h3>
            <Check size={16} className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <textarea
            className="w-full h-48 p-0 border-none focus:ring-0 text-slate-700 font-serif text-lg leading-relaxed resize-none italic"
            value={value as string}
            onChange={(e) => setSoap({ ...soap, [key]: e.target.value })}
            placeholder={`Document ${key} findings...`}
          />
        </div>
      ))}
    </div>
  );
};

export default SOAPEditor;
