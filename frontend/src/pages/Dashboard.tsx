import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, Clock, Users, Stethoscope,
  Search, BarChart3, Fingerprint, Activity, Radio,
  ChevronRight, Calendar, AlertCircle, ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api';
import AppointmentModal from '../components/AppointmentModal';

const Dashboard = () => {
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [stats, setStats] = useState({
        opd_flow_today: "INR 0.00",
        active_teleconsults: 0,
        avg_consult_time: "0.0m",
        total_sessions: 0
    });
    const [loading, setLoading] = useState(true);
    const [isApptModalOpen, setIsApptModalOpen] = useState(false);
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            setLoading(true);
            const [patData, docData, statsData] = await Promise.all([
                api.getPatients(),
                api.getDoctors(),
                api.getStats()
            ]);
            setPatients(patData || []);
            setDoctors(docData || []);
            setStats(statsData || {
                opd_flow_today: "INR 0.00",
                active_teleconsults: 0,
                avg_consult_time: "0.0m",
                total_sessions: 0
            });
        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const metrics = [
        { label: 'OPD Flow (Today)', val: stats.opd_flow_today || "INR 0.00", sub: 'Real-time Daily Revenue', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Tele-Consults', val: String(stats.active_teleconsults ?? 0), sub: 'Ongoing Live Sessions', icon: Radio, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Avg Consult Time', val: stats.avg_consult_time || "0.0m", sub: 'Registry Statistics', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
        { label: 'Total Sessions', val: String(stats.total_sessions ?? 0), sub: 'Historical Registry', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-8">
            {/* Standard Professional Header */}
            <header className="flex justify-between items-center py-6 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500">Welcome to Ambient AI Clinical Portal.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setIsApptModalOpen(true)}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Calendar size={18} className="text-blue-600" /> New Appointment
                    </button>
                    <button 
                        onClick={async () => {
                            const enc = await api.createEmergencyEncounter();
                            navigate(`/encounter/${enc._id || enc.id}`);
                        }}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20"
                    >
                        <AlertCircle size={18} /> Emergency
                    </button>
                    <button 
                        onClick={() => navigate('/consent')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md"
                    >
                        <Plus size={18} /> New Encounter
                    </button>
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m, i) => (
                    <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                        <div className={`w-12 h-12 ${m.bg} ${m.color} rounded-xl flex items-center justify-center`}>
                            <m.icon size={22} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-500">{m.label}</p>
                            <h2 className="text-2xl font-bold text-slate-900">{m.val}</h2>
                            <p className="text-xs font-semibold text-slate-400 mt-1">{m.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Patient List */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Users size={18} className="text-blue-600" /> Patient Registry
                        </h3>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search..." className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/10 outline-none" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="px-6 py-4">Patient</th>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {patients.length > 0 && patients.slice(0, 5).map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{p.name || 'Anonymous'}</td>
                                        <td className="px-6 py-4 text-slate-500 font-mono">{p.id || p._id || 'N/A'}</td>
                                        <td className="px-6 py-4 flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">Ready</span>
                                            {p.is_consent_given && (
                                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center gap-1">
                                                    <ShieldCheck size={10} /> Consent
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => navigate('/consent', { state: { patientId: p.id || p._id, patientName: p.name } })}
                                                className="text-blue-600 hover:underline font-bold text-xs flex items-center gap-1 ml-auto"
                                            >
                                                Session <ChevronRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Doctor List */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Stethoscope size={18} className="text-blue-600" /> Clinicians
                    </h3>
                    <div className="space-y-4">
                        {doctors.filter(d => d.is_active).slice(0, 5).map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                        {d.name.split(' ').pop()?.charAt(0) || 'D'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{d.name}</p>
                                        <p className="text-[9px] font-medium text-slate-400 capitalize">{d.specialization || 'Clinical Lead'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase text-emerald-500 tracking-tighter">Active</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <AppointmentModal 
                isOpen={isApptModalOpen} 
                onClose={() => setIsApptModalOpen(false)} 
                onSuccess={fetchData} 
            />
        </div>
    );
};

export default Dashboard;
