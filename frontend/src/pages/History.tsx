import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History as HistoryIcon, Search, Calendar, ChevronRight, FileText, Filter } from 'lucide-react';

const History = () => {
  const [historyItems] = useState([
    { id: '101', patient: 'Jane Cooper', date: 'Oct 12, 2023', type: 'General Checkup', status: 'Archived' },
    { id: '102', patient: 'Cody Fisher', date: 'Oct 11, 2023', type: 'Neurological Follow-up', status: 'Cleared' },
    { id: '103', patient: 'Esther Howard', date: 'Oct 10, 2023', type: 'Medication Review', status: 'Archived' },
    { id: '104', patient: 'Robert Fox', date: 'Oct 08, 2023', type: 'Post-Op Consultation', status: 'Archived' },
  ]);

  return (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-white/5 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
             <HistoryIcon size={14} /> Data Compliance Vault
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">Clinical History</h1>
          <p className="text-zinc-500 text-base max-w-xl font-medium"> Access past encounters and clinical summaries. Raw audio is purged after 24h as per privacy policy.</p>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="relative group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search repository..." 
                className="bg-zinc-900 shadow-inner border-zinc-800 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none w-80"
              />
           </div>
           <button className="btn bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white px-6">
              <Filter size={18} className="mr-2" /> Filter
           </button>
        </div>
      </header>

      <div className="glass-card p-0 overflow-hidden border-white/5 bg-zinc-950/20">
        <div className="grid grid-cols-12 gap-0 border-b border-white/5 px-8 py-5">
           <div className="col-span-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Patient Identity</div>
           <div className="col-span-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Encounter Type</div>
           <div className="col-span-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Timestamp</div>
           <div className="col-span-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest text-center">Compliance</div>
           <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-white/5">
           {historyItems.map((item, idx) => (
             <motion.div 
               key={item.id}
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.05 }}
               className="grid grid-cols-12 gap-0 px-8 py-8 items-center hover:bg-white/[0.02] cursor-pointer transition-colors group"
             >
                <div className="col-span-4 flex items-center gap-5">
                   <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 transition-colors">
                      <FileText size={20} />
                   </div>
                   <span className="font-bold text-white tracking-tight">{item.patient}</span>
                </div>
                <div className="col-span-3 text-center">
                   <span className="text-xs font-medium text-zinc-400 italic">"{item.type}"</span>
                </div>
                <div className="col-span-2 text-center">
                   <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-white">{item.date}</span>
                      <span className="text-[10px] text-zinc-600 font-medium">10:42 AM</span>
                   </div>
                </div>
                <div className="col-span-2 text-center">
                   <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {item.status}
                   </span>
                </div>
                <div className="col-span-1 flex justify-end">
                   <ChevronRight size={18} className="text-zinc-800 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                </div>
             </motion.div>
           ))}
        </div>
      </div>

      <footer className="bg-rose-500/5 border border-rose-500/10 p-8 rounded-[2.5rem] flex items-center gap-6">
         <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
            <HistoryIcon size={24} />
         </div>
         <p className="text-sm font-medium text-rose-200/60 leading-relaxed">
            Note: Clinical logs older than 24 hours only contain structured summaries (SOAP) and metadata. 
            <span className="text-rose-400 font-bold ml-2 underline cursor-pointer">Read Data Scrub Policy</span>
         </p>
      </footer>
    </motion.div>
  );
};

export default History;
