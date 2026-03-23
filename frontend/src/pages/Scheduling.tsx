import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar as CalendarIcon, Clock, User, Plus, 
    ChevronLeft, ChevronRight, MapPin, MoreHorizontal, Sparkles
} from 'lucide-react';

const Scheduling = () => {
  const [appointments] = useState([
    { id: 1, patient: 'Jane Cooper', time: '09:00 AM', reason: 'Annual Physical', type: 'In-person' },
    { id: 2, patient: 'Cody Fisher', time: '10:30 AM', reason: 'Post-Op Checkup', type: 'Virtual' },
    { id: 3, patient: 'Esther Howard', time: '01:00 PM', reason: 'Medication Sync', type: 'In-person' },
    { id: 4, patient: 'Robert Fox', time: '03:15 PM', reason: 'Consultation', type: 'Urgent' },
  ]);

  return (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-white/5 pb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
             <CalendarIcon size={14} /> Operations Management
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">Scheduling Hub</h1>
          <p className="text-zinc-500 text-base max-w-xl font-medium">Orchestrate patient flow and clinician availability with AI-assisted slot optimization.</p>
        </div>
        
        <button className="btn btn-primary px-10 h-14 rounded-full shadow-indigo-500/20">
          <Plus size={20} className="mr-2" /> Book New Appointment
        </button>
      </header>

      <div className="grid grid-cols-12 gap-12">
        {/* Calendar Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="glass-card border-white/5">
             <div className="flex justify-between items-center mb-8">
                <h4 className="text-xl font-bold text-white">October 2023</h4>
                <div className="flex gap-2">
                   <button className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500"><ChevronLeft size={20} /></button>
                   <button className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500"><ChevronRight size={20} /></button>
                </div>
             </div>
             
             <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {['M','T','W','T','F','S','S'].map(d => (
                    <div key={d} className="text-[10px] font-black text-zinc-700">{d}</div>
                ))}
             </div>
             <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({length: 31}, (_, i) => (
                    <button key={i} className={`h-10 w-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                        i === 11 ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40' : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                    }`}>
                        {i + 1}
                    </button>
                ))}
             </div>
          </div>

          <div className="glass-card p-10 bg-indigo-600/5 border-indigo-500/10">
             <Sparkles size={24} className="text-indigo-500 mb-6" />
             <h4 className="text-lg font-bold text-white mb-2">Smart Availability</h4>
             <p className="text-xs text-zinc-500 leading-relaxed font-medium">AI analysis suggests Tuesday afternoons are your most efficient block for complex consultations.</p>
          </div>
        </div>

        {/* Timeline Hub */}
        <div className="col-span-12 lg:col-span-8 space-y-10">
           <div className="glass-card p-0 overflow-hidden border-white/5 bg-zinc-950/20">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Today's Timeline</h3>
                 <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">4 Appointments</span>
              </div>
              
              <div className="divide-y divide-white/5">
                {appointments.map((appt, idx) => (
                    <motion.div 
                        key={appt.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-8 flex items-center justify-between hover:bg-white/[0.02] transition-all group cursor-pointer"
                    >
                        <div className="flex items-center gap-8">
                            <div className="text-right w-20">
                                <div className="text-sm font-bold text-white">{appt.time}</div>
                                <div className="text-[10px] text-zinc-600 font-bold uppercase">45 min</div>
                            </div>
                            <div className="w-px h-12 bg-zinc-800 group-hover:bg-indigo-500/50 transition-colors" />
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5 text-zinc-500 group-hover:text-indigo-400 transition-colors">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-xl tracking-tight">{appt.patient}</h4>
                                    <p className="text-xs text-zinc-500 font-medium flex items-center gap-2 mt-1">
                                        <MapPin size={12} /> {appt.type} Hub — <span className="text-zinc-400 italic">"{appt.reason}"</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-500 hover:text-white hover:border-indigo-500 transition-all">
                            <MoreHorizontal size={20} />
                        </button>
                    </motion.div>
                ))}
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Scheduling;
