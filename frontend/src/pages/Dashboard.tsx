import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, ChevronRight, Clock, User as UserIcon, Activity, ShieldCheck, Zap, Brain } from 'lucide-react';

const Dashboard = () => {
  const [encounters, setEncounters] = useState<any[]>([
    { id: '1', patient_id: 'Jane Cooper', status: 'completed', time: '2h ago' },
    { id: '2', patient_id: 'Cody Fisher', status: 'active', time: 'Now' },
    { id: '3', patient_id: 'Esther Howard', status: 'completed', time: '5h ago' }
  ]);
  const navigate = useNavigate();

  return (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/5 pb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
             <Activity size={14} /> Clinical command center
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-zinc-500 text-base max-w-xl font-medium"> Orchestrate your high-performance clinical workflow through AI-assisted encounter capture.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/text-to-soap')}
            className="btn h-14 px-10 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all font-bold"
          >
            <FileText size={20} className="mr-2" /> Paste Conversation
          </button>
          <button 
            onClick={() => navigate('/consent')}
            className="btn btn-primary h-14 px-10 rounded-full shadow-indigo-500/20"
          >
            <Plus size={20} className="mr-2" /> New Captured Session
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10">
        {/* Main Content */}
        <div className="col-span-12 lg:col-span-8 space-y-10">
          <div className="glass-card bg-zinc-950/20 border-white/5 space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Activity HUD</h3>
              <button className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors">Complete Archive</button>
            </div>
            
            <div className="space-y-4">
              {encounters.map((enc, idx) => (
                <motion.div 
                  key={enc.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => navigate(`/review/${enc.id}`)}
                  className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-indigo-500/30 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 transition-colors border border-white/5">
                      <UserIcon size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg tracking-tight">{enc.patient_id}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1 font-medium">
                        <span className="flex items-center gap-1.5"><Clock size={14} /> {enc.time}</span>
                        <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                        <span className={`flex items-center gap-1.5 ${enc.status === 'active' ? 'text-indigo-400' : 'text-zinc-600'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${enc.status === 'active' ? 'bg-indigo-500 shadow-indigo-500/50 pulse' : 'bg-zinc-700'}`} />
                          {enc.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <ChevronRight size={18} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
             <div className="glass-card p-10 bg-indigo-600/5 border-indigo-500/10">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Patient Intelligence</h4>
                <div className="text-3xl font-bold text-white">124</div>
                <div className="text-xs text-zinc-500 mt-2 font-medium">Encounters captured this month</div>
             </div>
             <div className="glass-card p-10 bg-rose-600/5 border-rose-500/10">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4">Time Optimization</h4>
                <div className="text-3xl font-bold text-white">42h</div>
                <div className="text-xs text-zinc-500 mt-2 font-medium">Saved via AI SOAP generation</div>
             </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="col-span-12 lg:col-span-4 space-y-10">
          <div className="glass-card p-10 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-700" />
            <ShieldCheck size={40} className="mb-6 opacity-80" />
            <h4 className="text-2xl font-bold mb-4 tracking-tight">Security Protocol Active</h4>
            <p className="text-indigo-100/70 text-sm leading-relaxed mb-8 font-medium">
              E2E Encryption engaged. Zero-knowledge transcription pipeline verified. Raw data scrub scheduled for T-24h.
            </p>
            <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_#4ade80]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Validated AES-256 Hub</span>
            </div>
          </div>

          <div className="glass-card p-10 border-white/5 space-y-6">
             <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live System Nodes</h4>
             <div className="space-y-4">
                {[
                    { name: 'Transcription Core', icon: Zap, status: 'Online' },
                    { name: 'Medical NLP Engine', icon: Brain, status: 'Active' },
                    { name: 'EHR Sync Node', icon: Activity, status: 'Standby' }
                ].map((node, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-3">
                            <node.icon size={16} className="text-indigo-500" />
                            <span className="text-xs font-semibold text-zinc-300">{node.name}</span>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{node.status}</span>
                    </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
