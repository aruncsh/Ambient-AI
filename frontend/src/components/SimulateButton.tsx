import React, { useState } from 'react';
import { api } from '../lib/api';
import { Rocket, Loader2 } from 'lucide-react';

const SimulateButton = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const runSimulation = async () => {
    setLoading(true);
    setLogs(["Initializing Simulation Pipeline...", "Encounter Created.", "Syncing Data...", "AI Reasoning..."]);
    
    try {
      const res = await api.simulate();
      setLogs(prev => [...prev, "Final Result: Success", JSON.stringify(res, null, 2)]);
    } catch (e) {
      setLogs(prev => [...prev, "Simulation Error: Failed to reach backend"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group">
      <button 
        onClick={runSimulation}
        disabled={loading}
        className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />}
        Simulate Pipeline
      </button>

      {logs.length > 0 && (
        <div className="absolute top-14 right-0 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl z-50 animate-in zoom-in-95">
          <h5 className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-3">Live Simulation Logs</h5>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
            {logs.map((log, i) => (
              <p key={i} className="text-[10px] font-mono text-slate-400 break-words leading-relaxed">
                [{i}] {log}
              </p>
            ))}
          </div>
          <button onClick={() => setLogs([])} className="mt-4 text-[10px] text-slate-600 hover:text-white transition-colors">Clear Console</button>
        </div>
      )}
    </div>
  );
};

export default SimulateButton;
