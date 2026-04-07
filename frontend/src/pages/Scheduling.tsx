import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar as CalendarIcon, Clock, User, Plus, 
    ChevronLeft, ChevronRight, MapPin, Trash2, Sparkles, X, Loader2,
    CalendarDays, Users, LayoutGrid, CalendarRange, Filter, Search,
    ArrowLeft, ArrowRight, ShieldCheck, Video
} from 'lucide-react';
import AppointmentModal from '../components/AppointmentModal';
import { api } from '../lib/api';

interface AppointmentType {
  id?: string;
  _id?: string;
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
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({
    patient_name: '',
    patient_id: 'P' + Math.floor(Math.random() * 1000),
    start_time: '',
    reason: '',
    type: 'In-person'
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      setAppointments(Array.isArray(data) ? data : []);
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
      const start = new Date(newAppt.start_time);
      const end = new Date(start.getTime() + 45 * 60000);
      const payload = {
        ...newAppt,
        clinician_id: 'D123',
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
    if (!id) return;
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
    return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const filteredAppointments = appointments.filter(appt => {
    const apptDate = new Date(appt.start_time);
    return apptDate.getDate() === selectedDate.getDate() &&
           apptDate.getMonth() === selectedDate.getMonth() &&
           apptDate.getFullYear() === selectedDate.getFullYear();
  });

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-12">
      {/* Professional Header */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12 border-b border-slate-100 pb-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">
            <CalendarDays size={14} /> Intake Orchestration
          </div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Scheduling <span className="text-blue-600">Hub</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Streamlined throughput management for high-performance clinical environments.
          </p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="h-16 px-10 rounded-[1.5rem] bg-slate-900 text-white font-black text-lg uppercase tracking-tighter hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3"
        >
          <Plus size={24} /> New Appointment
        </button>
      </header>

      <div className="grid grid-cols-12 gap-12">
        {/* Calendar Column */}
        <aside className="col-span-12 lg:col-span-4 space-y-10">
          <section className="bg-white border border-slate-200 rounded-[3.5rem] p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full translate-x-12 -translate-y-12" />
            
            <div className="flex justify-between items-center mb-8 px-2">
              <h4 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">{monthYear}</h4>
              <div className="flex gap-2">
                <button onClick={handlePrevMonth} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center text-slate-400">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={handleNextMonth} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center text-slate-400">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={`${d}-${i}`} className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({length: startDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())}, (_, i) => (
                <div key={`p-${i}`} className="h-12 w-12" />
              ))}
              {Array.from({length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth())}, (_, i) => {
                const day = i + 1;
                const isSel = day === selectedDate.getDate() && currentDate.getMonth() === selectedDate.getMonth();
                const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                return (
                  <button 
                    key={day} 
                    onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${
                      isSel ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                      : isToday ? 'bg-blue-50 text-blue-600 border border-blue-100'
                      : 'hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-blue-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-600/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[80px] rounded-full translate-x-12 -translate-y-12" />
            <Sparkles size={28} className="text-blue-200 mb-6" />
            <h4 className="text-xl font-black uppercase italic tracking-tighter mb-3">AI Capacity Analysis</h4>
            <p className="text-blue-100 font-medium text-sm leading-relaxed opacity-80 uppercase tracking-widest">
              Slot optimization: Tuesdays between 14:00 and 16:00 show highest patient throughput efficiency.
            </p>
          </section>
        </aside>

        {/* Timeline Hub */}
        <main className="col-span-12 lg:col-span-8 space-y-10">
          <section className="bg-white border border-slate-200 rounded-[3.5rem] shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Timeline Visualization</h3>
                <p className="text-2xl font-black text-slate-800 italic uppercase italic tracking-tighter">
                  {selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="h-10 px-6 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                {filteredAppointments.length} Active Slots
              </div>
            </div>
            
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="py-32 text-center">
                  <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Registry...</span>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="py-32 text-center text-slate-200 font-black italic text-4xl uppercase tracking-[0.2em] opacity-30">Zero Encounters</div>
              ) : filteredAppointments.map((appt, idx) => (
                <motion.div 
                  key={appt.id || appt._id || idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-10 flex items-center justify-between hover:bg-blue-50/30 group transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-600"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-10">
                      <div className="text-right min-w-[100px]">
                        <div className="text-lg font-black text-slate-900 tracking-tighter">{formatTime(appt.start_time)}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{appt.status}</div>
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105 transition-all shadow-sm">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{appt.patient_name || appt.patient_id}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            {appt.type === 'Virtual' ? <Video size={12} className="text-indigo-500" /> : <MapPin size={12} className="text-blue-500" />} 
                            {appt.type || "In-person"} Hub
                          </span>
                          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest px-2 py-0.5 bg-blue-50 rounded italic">
                            {appt.reason || "Scheduled Consult"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {appt.type === 'Virtual' && appt.status !== 'completed' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/teleconsult/${appt.id || appt._id}`);
                        }}
                        className="h-10 px-6 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                      >
                        <Video size={14} /> Join Call
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDelete(appt.id || appt._id)}
                    className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={24} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        </main>
      </div>

      <AppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchAppointments} 
      />
    </div>
  );
};

export default Scheduling;
