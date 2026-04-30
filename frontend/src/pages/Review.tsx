import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Sparkles, Wand2, Mic,
    Save, FileCheck, ShieldCheck, ChevronRight, Download, Activity,
    Stethoscope, FileText, Pill, ClipboardList, TrendingUp, AlertCircle,
    RotateCcw, History as HistoryIcon, Clock, Users, Fingerprint, Globe, MapPin, 
    Zap, Cpu, ShieldAlert, ArrowRight, Verified, Loader2,
    Heart, Thermometer, Wind, Droplets, Scale, Gauge, Menu, X, Plus
} from 'lucide-react';
import { API_BASE } from '../lib/api';

const ROS_SYSTEMS = [
    { id: 'constitutional', label: 'Constitutional', symptoms: 'Fever, chills, weight change' },
    { id: 'eyes', label: 'Eyes', symptoms: 'Vision changes, redness' },
    { id: 'ent', label: 'ENT/Mouth', symptoms: 'Hearing loss, sore throat' },
    { id: 'cv', label: 'Cardiovascular', symptoms: 'Chest pain, palpitations' },
    { id: 'resp', label: 'Respiratory', symptoms: 'S.O.B, cough' },
    { id: 'gi', label: 'Gastrointestinal', symptoms: 'Nausea, abd pain' },
    { id: 'gu', label: 'Genitourinary', symptoms: 'Frequency, dysuria' },
    { id: 'ms', label: 'Musculoskeletal', symptoms: 'Joint pain, weakness' },
    { id: 'skin', label: 'Skin/Breast', symptoms: 'Rashes, lesions' },
    { id: 'neuro', label: 'Neurological', symptoms: 'Headaches, dizziness' },
    { id: 'psych', label: 'Psychiatric', symptoms: 'Anxiety, depression' },
    { id: 'endo', label: 'Endocrine', symptoms: 'Thirst, intolerance' },
    { id: 'heme', label: 'Heme/Lymph', symptoms: 'Bruising, glands' },
    { id: 'allergy', label: 'Allergy/Immuno', symptoms: 'Hives, allergies' }
];

const Review: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Core Clinical State
    const [soap, setSoap] = useState({
        subjective: "" as any,
        patient_history: "" as any,
        objective: "" as any,
        assessment: "" as any,
        plan: "" as any,
        follow_up: "" as any,
        ros: "" as any,
        clean_transcript: ""
    });

    const [vitals, setVitals] = useState<any>({
        heart_rate: { value: null, label: "Heart Rate", unit: "bpm", icon: <Heart size={20} className="text-rose-500" /> },
        blood_pressure: { value: null, label: "Blood Pressure", unit: "mmHg", icon: <Activity size={20} className="text-emerald-500" /> },
        oxygen_saturation: { value: null, label: "SpO2", unit: "%", icon: <Droplets size={20} className="text-blue-500" /> },
        temperature: { value: null, label: "Temp", unit: "°F", icon: <Thermometer size={20} className="text-orange-500" /> },
        respiratory_rate: { value: null, label: "Resp Rate", unit: "/min", icon: <Wind size={20} className="text-sky-500" /> },
        weight: { value: null, label: "Weight", unit: "kg", icon: <Scale size={20} className="text-slate-500" /> },
        blood_sugar: { value: null, label: "Blood Sugar", unit: "mg/dL", icon: <Gauge size={20} className="text-purple-500" /> }
    });

    const [rosStructured, setRosStructured] = useState<Record<string, 'normal' | 'abnormal' | null>>({});

    const [automation, setAutomation] = useState({
        lab_orders: [] as any[],
        prescriptions: [] as any[],
        patient_name: "Anonymous Patient",
        fhir_id: "",
        fhir_status: "pending"
    });

    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefining, setIsRefining] = useState<string | null>(null);
    const [nlpInsights, setNlpInsights] = useState<{
        symptoms: string[],
        diagnoses: string[]
    }>({ symptoms: [], diagnoses: [] });

    useEffect(() => {
        const fetchEncounter = async () => {
            try {
                const resp = await fetch(`${API_BASE}/encounters/${id}`);
                const data = await resp.json();

                if (!data) return;

                // Sync SOAP Note
                if (data.soap_note) {
                    const sn = data.soap_note;
                    setSoap({
                        subjective: sn.subjective || "",
                        patient_history: sn.patient_history || "",
                        objective: sn.objective || "",
                        assessment: sn.assessment || "",
                        plan: sn.plan || "",
                        follow_up: sn.follow_up || "",
                        ros: sn.ros || "",
                        clean_transcript: sn.clean_transcript || ""
                    });
                }

                // Sync Vitals (Merge IoT and AI-extracted)
                setVitals((prev: any) => {
                    const merged = { ...prev };
                    
                    // 1. Check live stream vitals
                    if (data.vitals) {
                        Object.entries(data.vitals).forEach(([key, val]: [string, any]) => {
                            if (merged[key] && (val?.value !== null)) {
                                merged[key].value = val.value;
                                merged[key].source = "Live";
                            }
                        });
                    }
                    
                    // 2. Check AI-extracted vitals
                    const ai_vitals = data.soap_note?.objective?.vitals || data.soap_note?.extracted_vitals || {};
                    Object.entries(ai_vitals).forEach(([key, val]) => {
                        if (merged[key] && !merged[key].value && val) {
                            merged[key].value = val;
                            merged[key].source = "AI";
                        }
                    });
                    return merged;
                });

                // Sync Automation
                setAutomation({
                    lab_orders: data.lab_orders || [],
                    prescriptions: data.prescriptions || [],
                    patient_name: data.patient_name || "Anonymous Patient",
                    fhir_id: data.fhir_id || "",
                    fhir_status: data.fhir_status || (data.status === 'completed' ? 'synced' : 'pending')
                });

                if (data.nlp_insights) setNlpInsights({
                    symptoms: data.nlp_insights.symptoms || [],
                    diagnoses: data.nlp_insights.diagnoses || []
                });
                setTranscript(data.transcript || []);
                setLoading(false);
            } catch (err) {
                console.error("Fetch failed:", err);
            } finally {
                setLoading(false);
            }
        };

        if (id && id !== 'demo' && !id.includes('undefined')) {
            fetchEncounter();
        }
    }, [id]);

    // ROS Text Generator
    useEffect(() => {
        const selections = Object.entries(rosStructured).filter(([_, status]) => status !== null);
        if (selections.length === 0) return;

        const normalOnes = selections.filter(([_, status]) => status === 'normal').map(([id]) => ROS_SYSTEMS.find(s => s.id === id)?.label);
        const abnormalOnes = selections.filter(([_, status]) => status === 'abnormal').map(([id]) => ROS_SYSTEMS.find(s => s.id === id)?.label);

        let rosText = "";
        if (normalOnes.length > 0) rosText += `Normal: ${normalOnes.join(', ')}. `;
        if (abnormalOnes.length > 0) rosText += `Abnormal: ${abnormalOnes.join(', ')}.`;
        
        if (rosText && (rosText !== soap.ros)) {
            setSoap(prev => ({ ...prev, ros: rosText }));
        }
    }, [rosStructured, soap.ros]);

    const formatSoapValue = (val: any): string => {
        if (val === null || val === undefined) return "";
        if (typeof val === 'string') return val;
        
        if (Array.isArray(val)) {
            return val.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return item.code || item.name || item.medication || item.test_name || JSON.stringify(item);
                }
                return String(item);
            }).filter(Boolean).join("\n");
        }
        
        if (typeof val === 'object' && val !== null) {
            return Object.entries(val).map(([k, v]) => {
                if (!v || (Array.isArray(v) && v.length === 0)) return "";
                
                const isVitalSection = k.toLowerCase().includes('vitals');
                const displayLabel = k.replace(/_/g, ' ').toUpperCase();
                let sectionContent = "";
                
                if (Array.isArray(v)) {
                    sectionContent = v.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(", ");
                } else if (typeof v === 'object' && v !== null) {
                    sectionContent = Object.entries(v)
                        .filter(([_, vv]) => isVitalSection || (vv !== null && vv !== undefined && vv !== ""))
                        .map(([vk, vv]) => `${vk.replace(/_/g, ' ')}: ${vv || '---'}`)
                        .join(", ");
                } else {
                    sectionContent = String(v);
                }
                
                if (sectionContent || isVitalSection) {
                    return `${displayLabel}: ${sectionContent}`;
                }
                return "";
            }).filter(Boolean).join("\n");
        }
        
        return String(val);
    };

    const saveRefinement = async () => {
        setLoading(true);
        try {
            const cleanVitals = Object.entries(vitals).reduce((acc: any, [key, data]: [string, any]) => {
                acc[key] = {
                    value: data.value,
                    label: data.label,
                    unit: data.unit,
                    source: data.source
                };
                return acc;
            }, {});

            await fetch(`${API_BASE}/summary/${id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soap_note: soap,
                    vitals: cleanVitals,
                    patient_name: automation.patient_name
                })
            });
            navigate('/history');
        } catch (err) {
            console.error("Save failed:", err);
            alert("Error saving refinements.");
        } finally {
            setLoading(false);
        }
    };

    const refineWithAI = (section: string) => {
        setIsRefining(section);
        setTimeout(() => setIsRefining(null), 1500);
    };

    const toggleRos = (systemId: string) => {
        setRosStructured(prev => {
            const current = prev[systemId];
            if (current === 'normal') return { ...prev, [systemId]: 'abnormal' };
            if (current === 'abnormal') return { ...prev, [systemId]: null };
            return { ...prev, [systemId]: 'normal' };
        });
    };

    const markRemainingNormal = () => {
        const newRos = { ...rosStructured };
        ROS_SYSTEMS.forEach(system => {
            if (!newRos[system.id]) {
                newRos[system.id] = 'normal';
            }
        });
        setRosStructured(newRos);
    };

    const clearRos = () => {
        setRosStructured({});
        setSoap(prev => ({ ...prev, ros: "" }));
    };

    if (loading) {
        return (
            <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <Sparkles className="absolute -top-2 -right-2 text-indigo-500 animate-pulse" size={24} />
                </div>
                <div className="text-center space-y-2">
                    <p className="font-bold text-slate-800 uppercase tracking-[0.2em] text-xs">Synthesizing Clinical Record</p>
                    <p className="text-slate-400 text-sm font-medium animate-pulse">Ambient AI is processing multi-modal signals...</p>
                </div>
            </div>
        );
    }

    const SidebarContent = () => (
        <div className="space-y-8">
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                        <Verified size={20} />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Review Core</h2>
                </div>
                
                <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 transition-all hover:border-indigo-100 hover:bg-slate-50 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Session Ref</p>
                        <p className="text-sm font-bold text-slate-900">#{id?.slice(-8).toUpperCase()}</p>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 transition-all hover:border-indigo-100 hover:bg-slate-50 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Patient Participant</p>
                        <input 
                            type="text" 
                            value={automation.patient_name} 
                            onChange={(e) => setAutomation({...automation, patient_name: e.target.value})}
                            className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-900 placeholder:text-slate-300"
                            placeholder="Enter patient name"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <button 
                    onClick={saveRefinement}
                    className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    <FileCheck size={20} />
                    <span>Sign & Archive</span>
                </button>
                <button 
                    onClick={() => navigate('/history')}
                    className="w-full py-4 rounded-xl bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    <RotateCcw size={18} />
                    <span>Back to History</span>
                </button>
                <button 
                    onClick={() => navigate('/')}
                    className="w-full py-3 rounded-xl text-slate-400 text-xs font-bold hover:text-rose-500 hover:bg-rose-50 transition-all"
                >
                    Discard Session
                </button>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">EHR Integration</span>
                        <span className={`text-xs font-bold uppercase ${automation.fhir_status === 'synced' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {automation.fhir_status}
                        </span>
                    </div>
                    <Globe size={18} className={automation.fhir_status === 'synced' ? 'text-emerald-500' : 'text-amber-500'} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* MOBILE HEADER */}
            <header className="lg:hidden h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                        <Verified size={18} />
                    </div>
                    <span className="font-bold text-slate-900">Review Core</span>
                </div>
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 rounded-lg bg-slate-100 text-slate-600"
                >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </header>

            {/* MOBILE SIDEBAR OVERLAY */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
                        />
                        <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 left-0 w-[280px] bg-white z-[70] p-6 shadow-2xl lg:hidden flex flex-col"
                        >
                            <div className="flex-1 overflow-y-auto pb-6">
                                <SidebarContent />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
                    
                    {/* DESKTOP SIDEBAR */}
                    <aside className="hidden lg:block lg:w-80 shrink-0">
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-white sticky top-10">
                            <SidebarContent />
                        </div>
                    </aside>

                    {/* MAIN CONTENT AREA */}
                    <div className="flex-1 space-y-8 lg:space-y-12">
                        
                        {/* THE PHYSIOLOGICAL CONSOLE (UNIFIED VITALS) */}
                        <section className="bg-white rounded-3xl p-6 lg:p-10 shadow-xl shadow-slate-200/50 border border-white space-y-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                        <Activity size={28} className="text-rose-500" /> Physiological Hub
                                    </h3>
                                    <p className="text-slate-400 text-sm font-medium">Unified biometrics from IoT stream and Clinical Extraction</p>
                                </div>
                                <div className="self-start sm:self-center px-4 py-2 rounded-xl bg-slate-900 text-white flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live Intelligence Active</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 lg:gap-6">
                                {Object.entries(vitals).map(([key, data]: [string, any]) => (
                                    <div key={key} className="relative group min-w-0">
                                        <div className={`p-5 rounded-2xl border transition-all duration-300 h-full flex flex-col justify-between ${data.value ? 'bg-slate-50/50 border-slate-200/60 shadow-sm' : 'bg-slate-50/30 border-dashed border-slate-200'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                                    {data.icon}
                                                </div>
                                                {data.source && (
                                                    <div className="text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-indigo-600 text-white shadow shadow-indigo-600/20">
                                                        {data.source}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{data.label}</p>
                                                <div className="flex items-baseline gap-1 overflow-hidden">
                                                    <span className={`text-xl font-black truncate ${data.value ? 'text-slate-900' : 'text-slate-200'}`}>
                                                        {data.value || '---'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 lowercase flex-shrink-0">{data.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
                            
                            {/* LEFT COLUMN: CORE DOCUMENTATION */}
                            <div className="xl:col-span-8 space-y-8 lg:space-y-12">
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">SOAP Master Record</h4>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Clock size={14} />
                                            <span className="text-[10px] font-bold">Auto-saved 2m ago</span>
                                        </div>
                                    </div>
                                    <div className="space-y-6 lg:space-y-8">
                                        {Object.entries(soap).filter(([k]) => k !== 'clean_transcript').map(([key, value]) => {
                                            const formattedValue = formatSoapValue(value);
                                            // Core fields always show, others show if populated
                                            if (!formattedValue && !['subjective', 'objective', 'assessment', 'plan', 'ros'].includes(key)) return null;
                                            
                                            return (
                                                <div key={key} className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 group relative transition-all hover:shadow-xl hover:shadow-slate-200/50">
                                                    <div className="flex flex-col">
                                                        <div className="px-6 lg:px-8 py-5 lg:py-6 flex items-center justify-between border-b border-slate-50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                                                                <div className="flex flex-col">
                                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{key}</h3>
                                                                    {key === 'ros' && (
                                                                        <span className="text-[9px] font-bold text-slate-400">System Checklist</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {key === 'ros' && (
                                                                    <div className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-100">
                                                                        <button 
                                                                            onClick={markRemainingNormal}
                                                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all border border-emerald-100"
                                                                        >
                                                                            Mark All Normal
                                                                        </button>
                                                                        <button 
                                                                            onClick={clearRos}
                                                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-all border border-slate-100"
                                                                        >
                                                                            Reset
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <button 
                                                                    onClick={() => refineWithAI(key)}
                                                                    className="lg:opacity-0 lg:group-hover:opacity-100 transition-all flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider active:scale-95 shadow-sm"
                                                                >
                                                                    <Zap size={14} className="text-amber-400 fill-amber-400" /> 
                                                                    <span className="hidden sm:inline">AI Refine</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {key === 'ros' && (
                                                            <div className="p-6 lg:p-8 bg-slate-50/20 border-b border-slate-50">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                    {ROS_SYSTEMS.map((system) => {
                                                                        const status = rosStructured[system.id];
                                                                        return (
                                                                            <button
                                                                                key={system.id}
                                                                                onClick={() => toggleRos(system.id)}
                                                                                className={`p-5 rounded-2xl transition-all duration-300 border flex flex-col gap-3 group relative overflow-hidden text-left ${
                                                                                    status === 'normal' ? 'bg-white border-emerald-200 shadow-md shadow-emerald-500/5' :
                                                                                    status === 'abnormal' ? 'bg-white border-rose-200 shadow-md shadow-rose-500/5' :
                                                                                    'bg-white/50 border-slate-100 hover:border-indigo-200 hover:bg-white shadow-sm'
                                                                                }`}
                                                                            >
                                                                                {/* Status Indicator Bar */}
                                                                                <div className={`absolute top-0 left-0 right-0 h-1 transition-all ${
                                                                                    status === 'normal' ? 'bg-emerald-500' :
                                                                                    status === 'abnormal' ? 'bg-rose-500' :
                                                                                    'bg-transparent group-hover:bg-indigo-500/10'
                                                                                }`} />
                                                                                
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className={`text-[10px] font-black uppercase tracking-widest break-words pr-2 ${
                                                                                        status === 'normal' ? 'text-emerald-700' :
                                                                                        status === 'abnormal' ? 'text-rose-700' :
                                                                                        'text-slate-500 group-hover:text-indigo-600'
                                                                                    }`}>
                                                                                        {system.label}
                                                                                    </span>
                                                                                    <div className={`shrink-0 p-1.5 rounded-lg transition-all ${
                                                                                        status === 'normal' ? 'bg-emerald-100 text-emerald-600' :
                                                                                        status === 'abnormal' ? 'bg-rose-100 text-rose-600' :
                                                                                        'bg-slate-50 text-slate-300 group-hover:text-indigo-400'
                                                                                    }`}>
                                                                                        {status === 'normal' ? <CheckCircle2 size={16} /> : 
                                                                                         status === 'abnormal' ? <AlertCircle size={16} /> : 
                                                                                         <Plus size={16} />}
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                <p className={`text-[9px] font-bold leading-relaxed transition-all ${
                                                                                    status ? 'text-slate-600' : 'text-slate-400'
                                                                                }`}>
                                                                                    {system.symptoms}
                                                                                </p>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="px-6 lg:px-10 py-6 lg:pb-10 relative">
                                                            <textarea 
                                                                className="w-full bg-transparent border-none p-0 text-slate-600 text-sm lg:text-base leading-relaxed focus:ring-0 resize-none font-medium min-h-[140px] lg:min-h-[180px] placeholder:text-slate-200"
                                                                placeholder={`Synthesizing ${key} content from stream...`}
                                                                value={formattedValue}
                                                                onChange={(e) => setSoap({...soap, [key]: e.target.value})}
                                                            />
                                                            <AnimatePresence>
                                                                {isRefining === key && (
                                                                    <motion.div 
                                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                                        className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20"
                                                                    >
                                                                        <div className="flex flex-col items-center gap-4">
                                                                            <Loader2 className="animate-spin text-indigo-600" size={32} />
                                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] animate-pulse">Context Refinement</span>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>

                            {/* RIGHT COLUMN: INTELLIGENCE & EVIDENCE */}
                            <div className="xl:col-span-4 space-y-8 lg:space-y-12">
                                
                                {/* AI INTELLIGENCE HUB */}
                                <section className="bg-slate-900 rounded-3xl p-8 lg:p-10 text-white shadow-2xl shadow-indigo-900/30 space-y-8 lg:space-y-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 blur-[80px] rounded-full -mr-10 -mt-10" />
                                    <div className="space-y-1 relative">
                                        <h3 className="text-xl font-bold flex items-center gap-3 text-indigo-200">
                                            <Sparkles size={24} className="text-indigo-400" /> Intelligence Hub
                                        </h3>
                                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">Contextual Insights</p>
                                    </div>

                                    <div className="space-y-8 relative">
                                        {nlpInsights?.diagnoses?.length > 0 && (
                                            <div className="space-y-4">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Suggested Labels</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {nlpInsights.diagnoses.map((d, i) => (
                                                        <div key={i} className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-bold group hover:bg-indigo-600 hover:border-indigo-500 transition-all cursor-pointer">
                                                            {typeof d === 'object' ? (d as any).name : String(d)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {nlpInsights?.symptoms?.length > 0 && (
                                            <div className="space-y-4">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Detected Signs</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {nlpInsights.symptoms.map((s, i) => (
                                                        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold flex items-center gap-3 hover:translate-x-1 transition-all w-full sm:w-auto">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                            {typeof s === 'object' ? (s as any).name || (s as any).value : String(s)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* EVIDENCE STREAM (TRANSCRIPT) */}
                                <section className="bg-white rounded-3xl p-8 lg:p-10 shadow-xl border border-slate-200/60 h-[500px] lg:h-[600px] flex flex-col">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-xl font-bold flex items-center gap-3 text-slate-900">
                                            <Mic size={24} className="text-rose-500" /> Evidence Stream
                                        </h3>
                                        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {transcript.length} Segments
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                        {transcript.map((t, i) => (
                                            <div key={i} className="group relative">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${t.speaker === 'Doctor' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                        {t.speaker}
                                                    </span>
                                                    <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed transition-all ${t.speaker === 'Doctor' ? 'bg-indigo-50/40 text-slate-700' : 'bg-emerald-50/40 text-slate-700 border border-emerald-100/30'}`}>
                                                        {t.text}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {transcript.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                                <Mic size={48} className="text-slate-300 mb-4" />
                                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Transcript Available</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                
                @media (max-width: 400px) {
                    .xs\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
            `}</style>
        </div>
    );
};

export default Review;

