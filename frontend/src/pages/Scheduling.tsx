import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar as CalendarIcon, Clock, User, Plus, 
    ChevronLeft, ChevronRight, MapPin, Trash2, Sparkles, X, Loader2
} from 'lucide-react';
import { api } from '../lib/api';

interface AppointmentType {
  id?: string;
  patient_id: string;
  patient_name?: string;
  clinician_id: string;
  start_time: string;
  end_time: string;
  status: string;
  type?: string;
  reason?: string;
}

const Scheduling = () => {
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({
    patient_name: '',
    patient_id: 'P' + Math.floor(Math.random() * 1000), // Mocked ID
    start_time: '',
    reason: '',
    type: 'In-person'
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Set end_time to +45 mins for simplicity
      const start = new Date(newAppt.start_time);
      const end = new Date(start.getTime() + 45 * 60000);
      
      const payload = {
        ...newAppt,
        clinician_id: 'D123', // Mocked Clinician
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled'
      };
      
      await api.createAppointment(payload);
      fetchAppointments();
      setIsModalOpen(false);
      setNewAppt({ patient_name: '', patient_id: 'P' + Math.floor(Math.random() * 1000), start_time: '', reason: '', type: 'In-person' });
    } catch (err) {
      console.error("Failed to book appointment", err);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDelete = async (id?: string) => {
    if (!id || !window.confirm("Delete this appointment?")) return;
    try {
      await api.deleteAppointment(id);
      fetchAppointments();
    } catch (err) {
      console.error("Failed to delete appointment", err);
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Sun -> 0=Mon)
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const isSelected = (day: number) => {
    return day === selectedDate.getDate() && 
           currentDate.getMonth() === selectedDate.getMonth() && 
           currentDate.getFullYear() === selectedDate.getFullYear();
  };

  const filteredAppointments = appointments.filter(appt => {
    const apptDate = new Date(appt.start_time);
    return apptDate.getDate() === selectedDate.getDate() &&
           apptDate.getMonth() === selectedDate.getMonth() &&
           apptDate.getFullYear() === selectedDate.getFullYear();
  });

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

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
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary px-10 h-14 rounded-full shadow-indigo-500/20 flex items-center gap-2"
        >
          <Plus size={20} /> Book New Appointment
        </button>
      </header>

      <div className="grid grid-cols-12 gap-12">
        {/* Calendar Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="glass-card border-white/5">
             <div className="flex justify-between items-center mb-8">
                <h4 className="text-xl font-bold text-white">{monthYear}</h4>
                <div className="flex gap-2">
                   <button onClick={handlePrevMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500"><ChevronLeft size={20} /></button>
                   <button onClick={handleNextMonth} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500"><ChevronRight size={20} /></button>
                </div>
             </div>
             
             <div className="grid grid-cols-7 gap-1 text-center mb-4">
                {['M','T','W','T','F','S','S'].map(d => (
                    <div key={d} className="text-[10px] font-black text-zinc-700">{d}</div>
                ))}
             </div>
             <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({length: startDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())}, (_, i) => (
                    <div key={`pad-${i}`} className="h-10 w-10" />
                ))}
                {Array.from({length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth())}, (_, i) => {
                    const day = i + 1;
                    return (
                        <button 
                            key={day} 
                            onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                            className={`h-10 w-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${
                                isSelected(day) 
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40' 
                                : isToday(day)
                                ? 'text-indigo-400 border border-indigo-500/30'
                                : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            {day}
                        </button>
                    );
                })}
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
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Appointments for {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                 <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">{filteredAppointments.length} Scheduled</span>
              </div>
              
              <div className="divide-y divide-white/5">
                {loading ? (
                    <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="p-20 text-center text-zinc-500 font-medium">No appointments scheduled for this day.</div>
                ) : filteredAppointments.map((appt, idx) => (
                    <motion.div 
                        key={appt.id || idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-8 flex items-center justify-between hover:bg-white/[0.02] transition-all group cursor-pointer"
                    >
                        <div className="flex items-center gap-8">
                            <div className="text-right w-24">
                                <div className="text-sm font-bold text-white">{formatTime(appt.start_time)}</div>
                                <div className="text-[10px] text-zinc-600 font-bold uppercase">{appt.status}</div>
                            </div>
                            <div className="w-px h-12 bg-zinc-800 group-hover:bg-indigo-500/50 transition-colors" />
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5 text-zinc-500 group-hover:text-indigo-400 transition-colors">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-xl tracking-tight">{appt.patient_name || appt.patient_id}</h4>
                                    <p className="text-xs text-zinc-500 font-medium flex items-center gap-2 mt-1">
                                        <MapPin size={12} /> {appt.type || "In-person"} Hub — <span className="text-zinc-400 italic">"{appt.reason || "General Checkup"}"</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDelete(appt.id)}
                            className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-500 hover:text-rose-500 hover:border-rose-500/50 transition-all"
                        >
                            <Trash2 size={20} />
                        </button>
                    </motion.div>
                ))}
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-xl p-10 border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-white">Book Appointment</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={24} /></button>
              </div>

              <form onSubmit={handleBook} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Patient Name</label>
                  <input 
                    required
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 outline-none focus:border-indigo-500/50 text-white transition-all"
                    placeholder="Enter patient name..."
                    value={newAppt.patient_name}
                    onChange={e => setNewAppt({...newAppt, patient_name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Status/Type</label>
                    <select 
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 outline-none focus:border-indigo-500/50 text-white transition-all appearance-none"
                      value={newAppt.type}
                      onChange={e => setNewAppt({...newAppt, type: e.target.value})}
                    >
                      <option value="In-person">In-person</option>
                      <option value="Virtual">Virtual</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Start Time</label>
                    <input 
                      required
                      type="datetime-local"
                      className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 outline-none focus:border-indigo-500/50 text-white transition-all"
                      value={newAppt.start_time}
                      onChange={e => setNewAppt({...newAppt, start_time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Reason for Visit</label>
                  <input 
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 outline-none focus:border-indigo-500/50 text-white transition-all"
                    placeholder="e.g. Annual Physical"
                    value={newAppt.reason}
                    onChange={e => setNewAppt({...newAppt, reason: e.target.value})}
                  />
                </div>

                <button type="submit" className="w-full btn btn-primary h-16 rounded-2xl mt-4 font-bold text-lg shadow-xl shadow-indigo-500/20 text-white">
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Scheduling;
