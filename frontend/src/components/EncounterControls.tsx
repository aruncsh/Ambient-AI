import React from 'react';
import { Mic, Square, Save } from 'lucide-react';

const EncounterControls = ({ recording, onToggle, onStop }: any) => {
  return (
    <div className="flex gap-4 justify-center py-6">
      <button 
        onClick={onToggle}
        className={`px-10 py-4 rounded-3xl font-bold flex items-center gap-3 transition-all ${
          recording 
          ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' 
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {recording ? <Square size={24} /> : <Mic size={24} />}
        {recording ? 'Stop Recording' : 'Start Ambient Capture'}
      </button>

      <button 
        onClick={onStop}
        className="px-10 py-4 bg-slate-800 text-white rounded-3xl font-bold flex items-center gap-3 hover:bg-slate-700 transition-all border border-slate-700"
      >
        <Save size={24} />
        Finalize & Generate SOAP
      </button>
    </div>
  );
};

export default EncounterControls;
