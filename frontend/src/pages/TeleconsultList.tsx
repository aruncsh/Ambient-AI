import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Video, Clock, User, ChevronRight, Search, 
    Filter, Activity, Radio, ShieldCheck, 
    Calendar, MoreHorizontal, ArrowRight,
    Loader2, AlertCircle, Brain, Trash2, PhoneOff
} from 'lucide-react';
import { api } from '../lib/api';
import AppointmentModal from '../components/AppointmentModal';

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
  additional_info?: any;
}

const TeleconsultList = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<AppointmentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isApptModalOpen, setIsApptModalOpen] = useState(false);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const data = await api.getAppointments();
            // Filter only virtual appointments
            setAppointments(Array.isArray(data) ? data.filter((a: any) => a.type === 'Virtual') : []);
        } catch (err) {
            console.error("Failed to fetch teleconsults", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const filtered = appointments.filter(a => 
        (a.patient_name || a.patient_id).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeSessions = filtered.filter(a => a.status === 'scheduled');
    const completedSessions = filtered.filter(a => a.status === 'completed');
    const handleDelete = async (id?: string) => {
        if (!id || !window.confirm("Delete this appointment and cancel the clinical consult?")) return;
        try {
            await api.deleteAppointment(id);
            fetchAppointments();
        } catch (err) {
            console.error("Failed to delete", err);
        }
    };

    const handleEndSession = async (appt: AppointmentType) => {
        if (!window.confirm("End this active teleconsultation session?")) return;
        try {
            // If we have an external ID, try to end it
            // Note: In a real app we'd need the token or the participant details
            // For now we'll just update local status via api.updateAppointment
            await api.updateAppointment(appt.id || appt._id || "", 'completed');
            fetchAppointments();
        } catch (err) {
            console.error("Failed to end session", err);
        }
    };

    return (
        <div className="space-y-10">
            {/* Professional Virtual Clinic Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 border-b border-slate-100 pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em]">
                        <Radio size={14} className="animate-pulse" /> Live Tele-Health Hub
                    </div>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                        Tele <span className="text-indigo-600">Consults</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-lg max-w-2xl">
                        Managing high-fidelity remote clinical throughput via encrypted WebRTC uplinks.
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button 
                        onClick={() => setIsApptModalOpen(true)}
                        className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-sm uppercase tracking-tighter hover:bg-slate-900 transition-all flex items-center gap-3 shadow-lg shadow-indigo-600/20"
                    >
                        <Video size={20} /> New Teleconsult
                    </button>
                    <div className="relative flex-1 lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search clinical identity..."
                            className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-600/5 font-bold text-sm text-slate-900 placeholder:text-slate-300"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: 'Active Queue', val: activeSessions.length, sub: 'Awaiting Uplink', icon: Video, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Avg Latency', val: '24ms', sub: 'Signal Integrity: 99%', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Secure Sessions', val: completedSessions.length, sub: 'Doc-Encrypted Today', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' }
                ].map((m, i) => (
                    <div key={i} className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm flex items-start justify-between group hover:border-indigo-600/20 transition-all hover:scale-[1.02]">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
                            <h2 className="text-4xl font-black text-slate-900 truncate tracking-tighter italic uppercase">{m.val}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.sub}</p>
                        </div>
                        <div className={`w-14 h-14 ${m.bg} ${m.color} rounded-2xl flex items-center justify-center`}>
                           <m.icon size={28} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Active Encounters List */}
            <section className="bg-white border border-slate-200 rounded-[3.5rem] shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <div className="space-y-1">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Patient Waiting Room</h3>
                        <p className="text-2xl font-black text-slate-800 italic uppercase italic tracking-tighter flex items-center gap-3">
                            Current Uplinks <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </p>
                    </div>
                </div>

                <div className="divide-y divide-slate-50">
                    {loading ? (
                        <div className="py-32 text-center">
                            <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Tele-Registry...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-32 text-center">
                            <Video className="text-slate-200 mx-auto mb-6 opacity-30" size={64} />
                            <p className="font-black text-slate-200 text-3xl uppercase tracking-widest italic opacity-40">Zero Active Tele-Consults</p>
                        </div>
                    ) : (
                        filtered.map((appt, idx) => (
                            <motion.div 
                                key={appt.id || appt._id || idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="p-10 flex items-center justify-between hover:bg-indigo-50/30 transition-all border-l-[6px] border-transparent hover:border-indigo-600 group"
                            >
                                <div className="flex items-center gap-10">
                                    <div className="text-right min-w-[80px]">
                                        <div className="text-xl font-black text-slate-900 tracking-tighter">{formatTime(appt.start_time)}</div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDate(appt.start_time)}</div>
                                    </div>

                                    <div className="w-16 h-16 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-105 transition-all">
                                        <User size={28} />
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{appt.patient_name || appt.patient_id}</h4>
                                            {appt.status === 'scheduled' && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase tracking-widest animate-pulse">Ready</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[.15em] flex items-center gap-2">
                                                <AlertCircle size={14} className="text-indigo-400" /> {appt.reason || "Scheduled Review"}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Doc-to-Doc Referral</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {appt.status !== 'completed' ? (
                                        <>
                                            <div className="flex flex-col gap-2">
                                                <button 
                                                    onClick={() => navigate(`/teleconsult/${appt.id || appt._id}`)}
                                                    className="px-6 h-10 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                                                >
                                                    <ShieldCheck size={14} /> Join as Doctor
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const subToken = appt.additional_info?.subscriber_token;
                                                        if (subToken) {
                                                            window.open(`https://teleconsult.a2zhealth.in/consult/${subToken}`, '_blank');
                                                        } else {
                                                            navigate(`/teleconsult/${appt.id || appt._id}`);
                                                        }
                                                    }}
                                                    className="px-6 h-10 bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-400 hover:text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                                                >
                                                    <User size={14} /> Join as Patient
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => handleEndSession(appt)}
                                                className="h-14 px-6 rounded-2xl bg-white border border-slate-200 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center gap-2 active:scale-95"
                                            >
                                                <PhoneOff size={16} /> End Call
                                            </button>
                                        </>
                                    ) : (
                                        <div className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest select-none">
                                            Terminated
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handleDelete(appt.id || appt._id)}
                                        className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-90"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>

            {/* AI Patient Triage Hint */}
            <div className="bg-indigo-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-600/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full translate-x-24 -translate-y-24" />
                <div className="flex items-start gap-10">
                    <div className="w-20 h-20 rounded-[2rem] bg-white/10 backdrop-blur-md flex items-center justify-center">
                        <Brain size={40} />
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-3xl font-black uppercase italic tracking-tighter">Capacity Intel Engine</h4>
                        <p className="text-xl text-indigo-100 font-medium leading-relaxed max-w-3xl">
                            Next slot optimization: High-latency windows detected between 15:00-16:00. Recommend prioritizing local clinical encounters during this period for maximum QoS.
                        </p>
                    </div>
                </div>
            </div>
            <AppointmentModal 
                isOpen={isApptModalOpen} 
                onClose={() => setIsApptModalOpen(false)} 
                onSuccess={fetchAppointments}
                initialType="Virtual"
            />
        </div>
    );
};

export default TeleconsultList;
