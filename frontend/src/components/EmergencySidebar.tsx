import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Heart, Clock, Activity, AlertCircle, Droplets, Info, Save, CheckCircle2, UserCheck, Search, Fingerprint } from 'lucide-react';
import { api } from '../lib/api';

interface EmergencySidebarProps {
    encounterId: string;
    emergencyData: any;
    setEmergencyData: React.Dispatch<React.SetStateAction<any>>;
}

const EmergencySidebar: React.FC<EmergencySidebarProps> = ({ encounterId, emergencyData, setEmergencyData }) => {
    if (!emergencyData) return null;

    return (
        <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 bg-slate-900 text-white border border-slate-800 rounded-[3rem] shadow-2xl space-y-10 relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[80px] rounded-full -translate-y-16 translate-x-16" />
            
            <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="font-black flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-blue-500">
                         <Fingerprint size={20} /> Ambient Identity Registry
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-10">Real-time Forensic Extraction</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border ${
                    emergencyData.registration_status === 'new' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 
                    emergencyData.registration_status === 'existing' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 
                    'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                        emergencyData.registration_status === 'new' ? 'bg-emerald-500' : 
                        emergencyData.registration_status === 'existing' ? 'bg-blue-500' : 
                        'bg-amber-500'
                    }`} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                        {emergencyData.registration_status || 'Analyzing'}
                    </span>
                </div>
            </div>

            {/* Editable Demographics Form - High Tech Grid */}
            <div className="grid grid-cols-1 gap-4 pt-4 relative z-10">
                {[
                    { key: 'name', label: 'Identity Name', icon: <UserCheck size={14} /> },
                    { key: 'age', label: 'Biological Age', icon: <Search size={14} /> },
                    { key: 'gender', label: 'Gender Matrix', icon: <Activity size={14} /> },
                    { key: 'phone', label: 'Comm. ID', icon: <AlertCircle size={14} /> },
                    { key: 'blood_group', label: 'Hematology', icon: <Droplets size={14} /> },
                    { key: 'address', label: 'Geo-Coordinates', icon: <Info size={14} /> }
                ].map((field) => (
                    <div key={field.key} className="space-y-2 group">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 group-focus-within:text-blue-500 transition-colors">
                                {field.icon} {field.label}
                            </label>
                            {emergencyData.demographics?.[field.key] && (
                                <span className="text-[8px] font-black text-emerald-500 uppercase">Extracted</span>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type="text"
                                value={emergencyData.demographics?.[field.key] || ''}
                                onChange={(e) => {
                                    const newVal = e.target.value;
                                    setEmergencyData((prev: any) => ({
                                        ...prev,
                                        demographics: { ...prev.demographics, [field.key]: newVal }
                                    }));
                                }}
                                onBlur={async () => {
                                    try {
                                        await api.updateDemographics(encounterId, { [field.key]: emergencyData.demographics?.[field.key] });
                                    } catch (err) {
                                        console.error("Failed to auto-sync field", field.key, err);
                                    }
                                }}
                                placeholder="..."
                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white placeholder:text-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/20 transition-all font-mono"
                            />
                            {/* Blinking dot if being extracted */}
                            <AnimatePresence>
                                {!emergencyData.demographics?.[field.key] && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500/30"
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actionable Prompt Area */}
            <div className="relative z-10 pt-6 border-t border-white/5 space-y-6">
                {emergencyData.missing_fields && emergencyData.missing_fields.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-3">
                                <AlertCircle size={16} /> Flux Gaps Identified
                            </p>
                            <span className="text-[9px] font-bold text-slate-500">Suggested Inquiries</span>
                        </div>
                        <div className="space-y-3">
                            {emergencyData.missing_fields.map((f: any, i: number) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="p-5 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/10 space-y-2 group hover:bg-rose-500/10 transition-all cursor-help"
                                >
                                    <p className="text-[9px] font-black text-rose-500/70 uppercase tracking-widest">{f.field}</p>
                                    <p className="text-xs font-bold text-slate-200 leading-snug tracking-tight">"{f.question}"</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Atmosphere Saturated</p>
                            <p className="text-xs font-bold text-emerald-500/60 leading-tight">All critical clinical identifiers have been successfully extracted.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-10 pt-4">
                <button
                    onClick={async () => {
                        try {
                            const patient = await api.createPatient(emergencyData.demographics);
                            if (patient && patient._id) {
                                await api.updateDemographics(encounterId, { 
                                    ...emergencyData.demographics,
                                    patient_id: patient._id,
                                    registration_status: 'new'
                                });
                                setEmergencyData((prev: any) => ({ ...prev, registration_status: 'new' }));
                                alert(`Identity Stabilized: ${patient.name}`);
                            }
                        } catch (err) {
                            console.error("Manual stabilization error", err);
                            alert("Stabilization failed. Please verify required matrix fields.");
                        }
                    }}
                    disabled={emergencyData.registration_status === 'new' || emergencyData.registration_status === 'existing'}
                    className={`w-full h-16 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-3 ${
                        emergencyData.registration_status === 'pending' 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:scale-[1.02]' 
                            : 'bg-emerald-500 text-white shadow-emerald-500/20 cursor-default'
                    }`}
                >
                    {emergencyData.registration_status === 'pending' ? <><Save size={20} /> Finalize Identification</> : <><CheckCircle2 size={20} /> Matrix Sync Complete</>}
                </button>
            </div>
        </motion.section>
    );
};

export default EmergencySidebar;
