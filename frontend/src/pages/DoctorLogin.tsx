import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Stethoscope, Video, ChevronRight, Search, 
    ShieldCheck, Activity, Brain, Clock, 
    User, Mail, ArrowRight, Loader2, AlertCircle,
    UserCheck, LogIn, Lock
} from 'lucide-react';
import { api } from '../lib/api';

const DoctorLogin = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [view, setView] = useState<'select' | 'dashboard'>('select');

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const data = await api.getDoctors();
                setDoctors(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch doctors", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDoctors();
    }, []);

    const handleSelectDoctor = async (doctor: any) => {
        setSelectedDoctor(doctor);
        setLoading(true);
        try {
            // Use the existing getAppointments with clinician_id filter
            const data = await api.getAppointments();
            const doctorAppts = Array.isArray(data) 
                ? data.filter((a: any) => 
                    (a.clinician_id === doctor.id || a.clinician_id === doctor._id) && 
                    a.type === 'Virtual'
                  ) 
                : [];
            setAppointments(doctorAppts);
            setView('dashboard');
        } catch (err) {
            console.error("Failed to fetch doctor appointments", err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (view === 'select') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
                {/* Abstract Background Decoration */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2 select-none pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full -translate-x-1/2 translate-y-1/2 select-none pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-5xl bg-slate-900/50 backdrop-blur-3xl border border-slate-800 rounded-[4rem] p-12 lg:p-20 shadow-2xl relative z-10"
                >
                    <div className="grid lg:grid-cols-2 gap-20">
                        <div className="space-y-10">
                            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
                                <Lock size={14} /> Clinical Authentication
                            </div>
                            
                            <div className="space-y-6">
                                <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
                                    Doctor <span className="text-blue-500 text-7xl block mt-2">Terminal</span>
                                </h1>
                                <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-md">
                                    Secure entry point for authorized clinical staff. Select your identity to access live teleconsultation queues.
                                </p>
                            </div>

                            <div className="pt-10 border-t border-slate-800">
                                <div className="flex items-center gap-4 text-slate-500">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                                        <ShieldCheck size={24} className="text-blue-500" />
                                    </div>
                                    <p className="text-sm font-bold uppercase tracking-widest leading-tight">
                                        Protected by clinical-grade <br />
                                        <span className="text-white">WebRTC Encryption</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 flex flex-col">
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Search clinician name..."
                                    className="w-full h-20 pl-16 pr-8 bg-slate-800/50 border border-slate-700 rounded-[2rem] text-white font-bold placeholder:text-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-inner"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {loading ? (
                                    <div className="h-40 flex flex-col items-center justify-center gap-4 text-slate-500">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing Registry...</span>
                                    </div>
                                ) : doctors.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                    <div className="h-40 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                                        <User size={32} className="opacity-20 mb-2" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">No staff identified</span>
                                    </div>
                                ) : (
                                    doctors.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map((doctor, i) => (
                                        <motion.button
                                            key={doctor.id || doctor._id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            onClick={() => handleSelectDoctor(doctor)}
                                            className="w-full p-6 bg-slate-800/30 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-[2rem] flex items-center justify-between group transition-all"
                                        >
                                            <div className="flex items-center gap-5 text-left">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-blue-500 group-hover:bg-slate-950 transition-all">
                                                    <UserCheck size={28} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors uppercase italic">{doctor.name}</h4>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{doctor.specialization || 'Clinical Lead'}</p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center text-slate-600 group-hover:border-blue-500 group-hover:text-blue-500 transition-all">
                                                <ArrowRight size={20} />
                                            </div>
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Doctor Dashboard View
    return (
        <div className="min-h-screen bg-white">
            <header className="p-10 lg:px-20 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                            <Brain size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{selectedDoctor?.name}</h2>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1 flex items-center gap-2">
                                <Activity size={12} className="animate-pulse" /> Authorized Clinical Practitioner
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                     <button 
                        onClick={() => setView('select')}
                        className="h-14 px-8 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-900 text-slate-400 hover:text-slate-900 font-black text-sm uppercase tracking-tighter transition-all"
                    >
                        Switch Identity
                    </button>
                    <button 
                        onClick={() => navigate('/')}
                        className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-tighter hover:bg-blue-600 transition-all"
                    >
                        Main Dashboard
                    </button>
                </div>
            </header>

            <main className="p-10 lg:p-20 max-w-7xl mx-auto space-y-12">
                <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Patient Queue</h3>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                        Live <span className="text-blue-600">Consults</span>
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-6">
                        {loading ? (
                            <div className="py-20 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[3rem]">
                                <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Fetching Tele-Registry...</span>
                            </div>
                        ) : appointments.length === 0 ? (
                            <div className="py-32 text-center bg-slate-50/50 border border-slate-100 rounded-[3rem] space-y-6">
                                <Video className="text-slate-200 mx-auto opacity-40" size={64} />
                                <p className="text-slate-300 font-black text-3xl uppercase tracking-widest italic leading-none">Zero Active Tele-Uplinks</p>
                                <button 
                                    onClick={() => navigate('/scheduling')}
                                    className="px-10 h-14 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-slate-900 transition-all text-slate-400 hover:text-slate-900"
                                >
                                    Schedule New Consult
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {appointments.map((appt, i) => (
                                    <motion.div
                                        key={appt.id || appt._id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="bg-white border border-slate-200 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 hover:border-blue-600/20 hover:shadow-xl hover:shadow-blue-600/5 transition-all group border-l-[12px] border-l-transparent hover:border-l-blue-600"
                                    >
                                        <div className="flex items-center gap-8 text-center md:text-left">
                                            <div className="space-y-1">
                                                <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{formatTime(appt.start_time)}</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Slot</div>
                                            </div>

                                            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105 transition-all">
                                                <User size={28} />
                                            </div>

                                            <div className="space-y-2">
                                                <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{appt.patient_name || 'Patient'}</h4>
                                                <div className="flex items-center gap-3">
                                                     <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase tracking-widest animate-pulse">Live Link</span>
                                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Clock size={12} /> {appt.reason || 'Symptom Review'}
                                                     </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => navigate(`/teleconsult/${appt.id || appt._id}`)}
                                            className="w-full md:w-auto h-20 px-12 rounded-[2rem] bg-blue-600 hover:bg-slate-900 text-white font-black text-lg uppercase tracking-tighter transition-all flex items-center justify-center gap-4 shadow-xl shadow-blue-600/20 active:scale-95 group-hover:-translate-x-2"
                                        >
                                            Join Consult <ChevronRight size={20} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-900/40">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full translate-x-12 -translate-y-12" />
                            <div className="space-y-6 relative">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-500">
                                    <Video size={24} />
                                </div>
                                <h3 className="text-2xl font-black tracking-tighter italic uppercase leading-tight">Uplink Status</h3>
                                <div className="space-y-4">
                                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                         <span>Signal Integrity</span>
                                         <span className="text-emerald-500 italic">99.8% Perfect</span>
                                     </div>
                                     <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                         <div className="h-full bg-emerald-500 w-[99%]" />
                                     </div>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">
                                    You are currently connected to the primary CureSelect microservice cluster. 256-bit AES protection active.
                                </p>
                            </div>
                        </div>

                        <div className="p-10 bg-blue-50/50 border border-blue-100 rounded-[3rem] space-y-6">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <Brain size={14} /> Clinical Optimization
                            </h3>
                            <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                System ready to auto-generate <span className="text-blue-600 font-black">SOAP Notes</span> for all sessions in this queue. Ensure your microphone is positioned within 2 meters.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DoctorLogin;
