import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Sparkles, Wand2, Mic,
    Save, FileCheck, ShieldCheck, ChevronRight, Download, Activity,
    Stethoscope, FileText, Pill, ClipboardList, TrendingUp, AlertCircle,
    RotateCcw, History as HistoryIcon, Clock, Users, Fingerprint, Globe, MapPin, 
    Zap, Cpu, BarChart3, ShieldAlert, ArrowRight, Verified, Loader2,
    Heart, Thermometer, Wind, Droplets, Scale, Gauge
} from 'lucide-react';

const Review: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Core Clinical State
    const [soap, setSoap] = useState({
        subjective: "" as any,
        patient_history: "" as any,
        objective: "" as any,
        assessment: "" as any,
        plan: "" as any,
        follow_up: "" as any,
        billing: "" as any,
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

    const [automation, setAutomation] = useState({
        lab_orders: [] as any[],
        prescriptions: [] as any[],
        billing_codes: [] as any[],
        patient_name: "Anonymous Patient",
        invoice_id: "",
        billing_amount: 500,
        billing_currency: "INR",
        fhir_id: "",
        fhir_status: "pending"
    });

    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefining, setIsRefining] = useState<string | null>(null);
    const [nlpInsights, setNlpInsights] = useState<{
        symptoms: string[],
        diagnoses: string[],
        billing_codes: any[]
    }>({ symptoms: [], diagnoses: [], billing_codes: [] });

    useEffect(() => {
        const fetchEncounter = async () => {
            try {
                const resp = await fetch(`/api/v1/encounters/${id}`);
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
                        billing: sn.billing || "",
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
                    billing_codes: data.billing_codes || [],
                    patient_name: data.patient_name || "Anonymous Patient",
                    invoice_id: data.invoice_id || "",
                    billing_amount: data.billing_amount || 500,
                    billing_currency: data.billing_currency || "INR",
                    fhir_id: data.fhir_id || "",
                    fhir_status: data.fhir_status || (data.status === 'completed' ? 'synced' : 'pending')
                });

                if (data.nlp_insights) setNlpInsights({
                    symptoms: data.nlp_insights.symptoms || [],
                    diagnoses: data.nlp_insights.diagnoses || [],
                    billing_codes: data.nlp_insights.billing_codes || []
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
            // Strip UI-only components (icons) from vitals to avoid circular JSON error
            const cleanVitals = Object.entries(vitals).reduce((acc: any, [key, data]: [string, any]) => {
                acc[key] = {
                    value: data.value,
                    label: data.label,
                    unit: data.unit,
                    source: data.source
                };
                return acc;
            }, {});

            await fetch(`/api/v1/summary/${id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soap_note: soap,
                    vitals: cleanVitals,
                    billing_codes: automation.billing_codes,
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

    if (loading) {
        return (
            <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <Sparkles className="absolute -top-2 -right-2 text-blue-500 animate-pulse" size={24} />
                </div>
                <div className="text-center space-y-2">
                    <p className="font-bold text-slate-800 uppercase tracking-[0.2em] text-xs">Synthesizing Clinical Record</p>
                    <p className="text-slate-400 text-sm font-medium animate-pulse">Ambient AI is processing multi-modal signals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            <div className="max-w-[1600px] mx-auto px-6 py-10">
                <div className="flex flex-col lg:flex-row gap-10">
                    
                    {/* LEFT SIDEBAR: DASHBOARD CONSOLE */}
                    <div className="lg:w-80 shrink-0 space-y-8">
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-white space-y-8 sticky top-10">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                                        <Verified size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold tracking-tight">Review Core</h2>
                                </div>
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Session Ref</p>
                                    <p className="text-sm font-bold text-slate-900">#{id?.slice(-8).toUpperCase()}</p>
                                </div>
                                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Patient Participant</p>
                                    <input 
                                        type="text" 
                                        value={automation.patient_name} 
                                        onChange={(e) => setAutomation({...automation, patient_name: e.target.value})}
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-bold text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button 
                                    onClick={saveRefinement}
                                    className="w-full py-5 rounded-[2rem] bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <FileCheck size={20} />
                                    <span>Sign & Archive</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/history')}
                                    className="w-full py-5 rounded-[2rem] bg-slate-100 text-slate-900 font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
                                >
                                    <RotateCcw size={18} />
                                    <span>Back to History</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/')}
                                    className="w-full py-3 rounded-[1.5rem] text-slate-400 text-xs font-bold hover:text-slate-600 transition-all"
                                >
                                    Discard Session
                                </button>
                            </div>

                            <div className="pt-6 border-t border-slate-100 space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EHR Integration</span>
                                        <span className="text-sm font-bold text-emerald-600 uppercase tracking-tighter">{automation.fhir_status}</span>
                                    </div>
                                    <Globe size={18} className="text-emerald-400" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultation Fee</span>
                                        <span className="text-sm font-bold text-blue-600">{automation.billing_currency} {automation.billing_amount.toLocaleString()}</span>
                                    </div>
                                    <BarChart3 size={18} className="text-blue-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="flex-1 space-y-12">
                        
                        {/* THE PHYSIOLOGICAL CONSOLE (UNIFIED VITALS) */}
                        <section className="bg-white rounded-[3rem] p-10 shadow-xl shadow-slate-200/50 border border-white space-y-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                        <Activity size={28} className="text-rose-500" /> Physiological Hub
                                    </h3>
                                    <p className="text-slate-400 text-sm font-medium">Unified biometrics from IoT stream and Clinical Extraction</p>
                                </div>
                                <div className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Live Intelligence Active</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                                {Object.entries(vitals).map(([key, data]: [string, any]) => (
                                    <div key={key} className="relative group">
                                        <div className={`p-6 rounded-[2rem] border transition-all duration-300 ${data.value ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-slate-50/30 border-dashed border-slate-200'}`}>
                                            <div className="mb-4 bg-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm">
                                                {data.icon}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{data.label}</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-xl font-black ${data.value ? 'text-slate-900' : 'text-slate-200'}`}>
                                                        {data.value || '---'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 lowercase">{data.unit}</span>
                                                </div>
                                            </div>
                                            {data.source && (
                                                <div className="absolute top-4 right-4 text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                                    {data.source}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                            
                            {/* LEFT COLUMN: CORE DOCUMENTATION */}
                            <div className="xl:col-span-8 space-y-12">
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between px-6">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">SOAP Master Record</h4>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Clock size={14} />
                                            <span className="text-[10px] font-bold">Auto-saved 2m ago</span>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        {Object.entries(soap).filter(([k]) => k !== 'clean_transcript').map(([key, value]) => {
                                            const formattedValue = formatSoapValue(value);
                                            // Core fields always show, others show if populated
                                            if (!formattedValue && !['subjective', 'objective', 'assessment', 'plan', 'ros'].includes(key)) return null;
                                            
                                            return (
                                                <div key={key} className="bg-white rounded-[3rem] p-2 shadow-xl shadow-slate-200/30 border border-white group relative">
                                                    <div className="flex flex-col">
                                                        <div className="px-8 py-6 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                                                <h3 className="text-sm font-black text-slate-900 shadow-blue-500/10 uppercase tracking-widest">{key}</h3>
                                                            </div>
                                                            <button 
                                                                onClick={() => refineWithAI(key)}
                                                                className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider active:scale-95"
                                                            >
                                                                <Zap size={14} className="text-yellow-400 fill-yellow-400" /> AI Refine
                                                            </button>
                                                        </div>
                                                        <div className="px-10 pb-10 relative">
                                                            <textarea 
                                                                className="w-full bg-transparent border-none p-0 text-slate-600 text-base leading-relaxed focus:ring-0 resize-none font-medium min-h-[160px] placeholder:text-slate-200"
                                                                placeholder={`Synthesizing ${key} content from stream...`}
                                                                value={formattedValue}
                                                                onChange={(e) => setSoap({...soap, [key]: e.target.value})}
                                                            />
                                                            <AnimatePresence>
                                                                {isRefining === key && (
                                                                    <motion.div 
                                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                                        className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-[2rem] flex items-center justify-center z-20"
                                                                    >
                                                                        <div className="flex flex-col items-center gap-4">
                                                                            <Loader2 className="animate-spin text-blue-600" size={32} />
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
                            <div className="xl:col-span-4 space-y-12">
                                
                                {/* AI INTELLIGENCE HUB */}
                                <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-900/40 space-y-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full" />
                                    <div className="space-y-1 relative">
                                        <h3 className="text-xl font-bold flex items-center gap-3">
                                            <Sparkles size={24} className="text-blue-400" /> Intelligence Hub
                                        </h3>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Contextual Insights</p>
                                    </div>

                                    <div className="space-y-8 relative">
                                        {nlpInsights?.diagnoses?.length > 0 && (
                                            <div className="space-y-4">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Suggested Labels</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {nlpInsights.diagnoses.map((d, i) => (
                                                        <div key={i} className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-bold group hover:bg-blue-600 hover:border-blue-500 transition-all cursor-pointer">
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
                                                        <div key={i} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold flex items-center gap-3 hover:translate-x-1 transition-all">
                                                            <div className="w-1 h-1 rounded-full bg-rose-500" />
                                                            {typeof s === 'object' ? (s as any).name || (s as any).value : String(s)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {automation.billing_codes.length > 0 && (
                                            <div className="space-y-4 pt-8 border-t border-white/10">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Coded Procedures</label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {automation.billing_codes.map((c, i) => (
                                                        <div key={i} className="p-4 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between group hover:bg-blue-500/10 transition-all">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-blue-400">{typeof c === 'object' ? c.code : c}</span>
                                                                <span className="text-[9px] text-slate-400 font-medium truncate max-w-[120px]">{typeof c === 'object' ? c.description : 'Clinical Service'}</span>
                                                            </div>
                                                            <ArrowRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-all" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* EVIDENCE STREAM (TRANSCRIPT) */}
                                <section className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200 h-[600px] flex flex-col">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-xl font-bold flex items-center gap-3">
                                            <Mic size={24} className="text-rose-500" /> Evidence Stream
                                        </h3>
                                        <div className="px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {transcript.length} Segments
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
                                        {transcript.map((t, i) => (
                                            <div key={i} className="group relative">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${t.speaker === 'Doctor' ? 'text-blue-600' : 'text-emerald-600 font-black'}`}>
                                                        {t.speaker}
                                                    </span>
                                                    <div className={`p-5 rounded-[2rem] text-sm font-medium leading-relaxed transition-all ${t.speaker === 'Doctor' ? 'bg-blue-50/50 text-slate-700' : 'bg-emerald-50/50 text-slate-700 border border-emerald-100/50 shadow-sm shadow-emerald-100'}`}>
                                                        {t.text}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* INLINE CUSTOM SCROLLBAR CSS */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};

export default Review;
