import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    History as HistoryIcon, Search, Calendar, ChevronRight, FileText, 
    Filter, Loader2, Download, ShieldCheck, Clock, CheckCircle2,
    Database, Activity, MapPin, SearchSlash
} from 'lucide-react';
import { api } from '../lib/api';

const History = () => {
    const navigate = useNavigate();
    const [encounters, setEncounters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchEncounters = async () => {
        try {
            setLoading(true);
            const data = await api.getEncounters();
            setEncounters(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch encounters", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEncounters();
    }, []);

    const filteredEncounters = encounters
        .filter(enc => 
            enc.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            enc.patient_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            enc.status?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const downloadRegistry = () => {
        if (encounters.length === 0) return;
        
        const headers = ["Patient ID", "Patient Name", "Status", "Date", "Time", "Clinician"];
        const rows = encounters.map(enc => [
            enc.patient_id || enc.id || enc._id,
            enc.patient_name || "Unknown",
            enc.status || "Draft",
            new Date(enc.created_at).toLocaleDateString(),
            new Date(enc.created_at).toLocaleTimeString(),
            enc.clinician_id || "Unassigned"
        ]);
        
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `clinical_registry_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Professional Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 border-b border-slate-200 pb-10">
                <div className="space-y-1">
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Clinical Registry</h1>
                    <p className="text-slate-500 font-medium tracking-tight italic leading-relaxed">View and manage historical patient sessions and documentation.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search records..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-12 w-80 bg-white border border-slate-200 rounded-xl pl-14 pr-6 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm"
                        />
                    </div>
                    <button 
                        onClick={downloadRegistry}
                        className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </header>

            {/* Standard Registry List */}
            <main className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">
                                <th className="py-6 px-10">Clinical Identity</th>
                                <th className="py-6 px-10">Status</th>
                                <th className="py-6 px-10">Date & Time</th>
                                <th className="py-6 px-10">Clinician</th>
                                <th className="py-6 px-10 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <HistoryIcon size={24} className="animate-spin text-blue-600" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading registry...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEncounters.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center">
                                        <SearchSlash size={48} className="mx-auto text-slate-200 mb-4" />
                                        <span className="text-lg font-bold text-slate-300 uppercase tracking-widest italic leading-relaxed items-center">No Records Found</span>
                                    </td>
                                </tr>
                            ) : filteredEncounters.map((item, idx) => (
                                <tr 
                                    key={item.id || idx}
                                    onClick={() => navigate(`/review/${item.id || item._id}`)}
                                    className="group hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <td className="py-6 px-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                {String(item.patient_name || 'U').charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-lg leading-relaxed italic items-center">{item.patient_name || 'Unknown Patient'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono italic leading-relaxed items-center">ID: #{String(item.id || item._id).slice(-8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-10 text-centre">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
                                                item.status === 'completed' 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                : 'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                                {item.status === 'completed' ? 'Finalized' : 'Draft'}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 items-baseline italic leading-relaxed items-center py-2 px-1 rounded-sm shadow-sm transition-all text-centre">
                                                <ShieldCheck size={12} className={item.status === 'completed' ? 'text-emerald-500' : 'text-blue-500'} />
                                                Verified Access
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-10">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-slate-800 tracking-tight italic leading-relaxed items-center">{new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 items-baseline italic leading-relaxed items-center pb-2 bg-white rounded-sm shadow-sm transition-all text-centre">
                                                 <Clock size={12} /> {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="py-6 px-10 text-centre">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase">
                                                {String(item.clinician_id || 'U').charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 leading-relaxed italic items-center">{item.clinician_id || 'Unassigned'}</span>
                                        </div>
                                    </td>
                                    <td className="py-6 px-10 text-right">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all ml-auto shadow-sm">
                                            <ChevronRight size={18} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Compliance Note */}
            <footer className="p-8 rounded-3xl bg-blue-50 border border-blue-100 flex items-start gap-6 border-b-4 border-b-blue-600 shadow-sm items-center py-2 px-1 rounded-sm shadow-sm transition-all text-centre">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0 shadow-sm items-center py-2 px-1 rounded-sm shadow-sm transition-all text-centre">
                    <ShieldCheck size={24} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em] font-medium leading-relaxed italic items-center py-2 px-1 rounded-sm shadow-sm transition-all text-centre">Digital Health Protocol</h4>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic items-center py-2 px-1 rounded-sm shadow-sm transition-all text-centre">
                        Session logs older than 24 hours are automatically purged of raw audio. Only structured SOAP summaries and non-PII metadata are retained for permanent record keeping.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default History;
