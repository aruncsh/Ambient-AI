import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Sparkles, Wand2, Mic,
    Save, FileCheck, ShieldCheck, ChevronRight, Download
} from 'lucide-react';

const Review: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [soap, setSoap] = useState({
        subjective: "" as any,
        patient_history: "" as any,
        objective: "" as any,
        assessment: "" as any,
        plan: "" as any,
        follow_up: "" as any,
        billing: "" as any,
        clean_transcript: ""
    });

    const [automation, setAutomation] = useState({
        lab_orders: [] as string[],
        prescriptions: [] as any[],
        billing_codes: [] as any[],
        patient_name: "",
        invoice_id: "",
        billing_amount: 0 as number,
        billing_currency: "INR",
        fhir_id: "",
        fhir_status: "pending"
    });
    const [transcript, setTranscript] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [isRefining, setIsRefining] = useState<string | null>(null);

    useEffect(() => {
        const fetchSOAP = async () => {
            try {
                // 0. Fetch the encounter first to see its status and saved results
                const encounterResp = await fetch(`/api/v1/encounters/${id}`);
                const encounterData = await encounterResp.json();

                // 1. If SOAP already exists in the database, use it immediately (preserving manual edits)
                if (encounterData && encounterData.soap_note) {
                    const sn = encounterData.soap_note;
                    setSoap({
                        subjective: sn.subjective || "",
                        patient_history: sn.patient_history || "",
                        objective: sn.objective || "",
                        assessment: sn.assessment || "",
                        plan: sn.plan || "",
                        follow_up: sn.follow_up || "",
                        billing: sn.billing || "",
                        clean_transcript: sn.clean_transcript || ""
                    });
                    
                    setAutomation({
                        lab_orders: encounterData.lab_orders || [],
                        prescriptions: encounterData.prescriptions || [],
                        billing_codes: encounterData.billing_codes || [],
                        patient_name: encounterData.patient_name || "Anonymous",
                        invoice_id: encounterData.invoice_id || "",
                        billing_amount: encounterData.billing_amount || 0,
                        billing_currency: encounterData.billing_currency || "INR",
                        fhir_id: encounterData.fhir_id || "",
                        fhir_status: encounterData.fhir_status || (encounterData.status === 'completed' ? 'synced' : 'pending')
                    });
                    setTranscript(encounterData.transcript || []);
                    setLoading(false);
                    return;
                }

                // 2. Otherwise, trigger generation if needed (polling loop)
                let attempts = 0;
                let dataProcessed = false;

                while (attempts < 10 && !dataProcessed) {
                    const genResp = await fetch(`/api/v1/summary/${id}/generate`, {
                        method: 'POST'
                    });
                    const summaryData = await genResp.json();

                    if (summaryData && summaryData.status === 'processing') {
                        setLoading(true);
                        attempts++;
                        await new Promise(r => setTimeout(r, 4000));
                        continue;
                    }

                    dataProcessed = true;

                    const encounterResp = await fetch(`/api/v1/encounters/${id}`);
                    const encounterData = await encounterResp.json();

                    if (summaryData) {
                        const soapNote = summaryData.soap || summaryData;
                        setSoap({
                            subjective: soapNote.subjective || "",
                            patient_history: soapNote.patient_history || "",
                            objective: soapNote.objective || "",
                            assessment: soapNote.assessment || "",
                            plan: soapNote.plan || "",
                            follow_up: soapNote.follow_up || "",
                            billing: soapNote.billing || "",
                            clean_transcript: soapNote.clean_transcript || ""
                        });
                    }

                    if (encounterData) {
                        setAutomation({
                            lab_orders: encounterData.lab_orders || summaryData.lab_orders || [],
                            prescriptions: encounterData.prescriptions || summaryData.prescriptions || [],
                            billing_codes: encounterData.billing_codes || summaryData.billing_codes || [],
                            patient_name: encounterData.patient_name || "Anonymous",
                            invoice_id: encounterData.invoice_id || summaryData.invoice_id || "",
                            billing_amount: (encounterData.billing_amount !== undefined && encounterData.billing_amount !== null) ? encounterData.billing_amount : (summaryData.billing_amount || 0),
                            billing_currency: encounterData.billing_currency || summaryData.currency || "INR",
                            fhir_id: encounterData.fhir_id || summaryData.fhir_id || "",
                            fhir_status: encounterData.fhir_status || summaryData.fhir_status || "pending"
                        });

                        if (encounterData.transcript) {
                            setTranscript(encounterData.transcript);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch SOAP:", err);
            } finally {
                setLoading(false);
            }
        };

        if (id && id !== 'demo' && id !== 'new' && id !== 'undefined' && !id.includes('undefined')) {
            fetchSOAP();
        } else if (id === 'demo' || id === 'new') {
            setSoap({
                subjective: "This is a demo subjective note. In a real session, your spoken words would appear here.",
                patient_history: "No history for demo.",
                objective: "Vitals: Heart Rate 72 BPM, SpO2 98%, BP 120/80.",
                assessment: "General evaluation (Demo).",
                plan: "Continue routine care.",
                follow_up: { follow_up_timeline: "1 week", warning_signs: ["Severe pain", "Fever"], referrals: "None" },
                billing: { cpt_codes: [] },
                clean_transcript: "Doctor: Hello, how are you? Patient: I am fine, thank you."
            });
            setLoading(false);
        }
    }, [id]);

    const formatSoapValue = (val: any): string => {
        if (val === null || val === undefined) return "";
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) {
            return val.map(item => {
                if (typeof item === 'object' && item !== null) {
                    const extracted = item.code || item.name || item.medication || item.test_name;
                    if (extracted) return extracted;
                    if (Object.values(item).some(v => v !== "" && v !== null && v !== undefined)) return JSON.stringify(item);
                    return null;
                }
                return String(item);
            }).filter(Boolean).join("\n");
        }
        if (typeof val === 'object') {
            return Object.entries(val)
                .map(([k, v]) => {
                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    if (Array.isArray(v)) {
                        const items = v.map(item => {
                            if (typeof item === 'object' && item !== null) {
                                const extracted = item.code || item.name || item.medication || item.test_name;
                                if (extracted) return extracted;
                                if (Object.values(item).some(val => val !== "" && val !== null && val !== undefined)) return JSON.stringify(item);
                                return null;
                            }
                            return String(item);
                        }).filter(Boolean).join(", ");
                        return items ? `${label}: ${items}` : null;
                    }
                    if (typeof v === 'object' && v !== null) {
                        const subItems = Object.entries(v).map(([sk, sv]) => {
                            const subLabel = sk.replace(/_/g, ' ').toUpperCase();
                            return `${subLabel}: ${typeof sv === 'object' ? JSON.stringify(sv) : sv}`;
                        }).filter(Boolean).join("\n  ");
                        return subItems ? `${label}:\n  ` + subItems : null;
                    }
                    return v ? `${label}: ${v}` : null;
                })
                .filter(Boolean)
                .join("\n\n");
        }
        return String(val);
    };

    const saveRefinement = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`/api/v1/summary/${id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soap_note: soap,
                    billing_codes: automation.billing_codes,
                    patient_name: automation.patient_name
                })
            });
            const result = await resp.json();
            if (result.status === 'success') {
                // Update local automation state with backend calculated totals
                setAutomation(prev => ({ 
                    ...prev, 
                    billing_codes: result.billing_codes || prev.billing_codes,
                    billing_amount: result.billing_amount !== undefined ? result.billing_amount : prev.billing_amount,
                    billing_currency: result.billing_currency || prev.billing_currency,
                    invoice_id: result.invoice_id || prev.invoice_id
                }));
                alert("Encounter signed and synchronized with EHR.");
                navigate('/history');
            }
        } catch (err) {
            console.error("Failed to save refinement:", err);
            alert("Error saving refinements. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const refineWithAI = (section: string) => {
        setIsRefining(section);
        setTimeout(() => {
            setSoap(prev => ({
                ...prev,
                [section]: prev[section as keyof typeof soap] + " [AI Enhanced clinical specificity]"
            }));
            setIsRefining(null);
        }, 1200);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-[1400px] mx-auto px-6 py-16 space-y-12"
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
                         <FileCheck size={14} /> Review Required
                    </div>
                    <div className="flex items-end gap-4">
                        <h1 className="text-5xl font-bold tracking-tight text-white line-clamp-1">Clinical Review</h1>
                        <div className="flex flex-col mb-1 min-w-[200px]">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase mb-1">Patient Name</span>
                            <input 
                                type="text"
                                value={automation.patient_name}
                                onChange={(e) => setAutomation({...automation, patient_name: e.target.value})}
                                className="bg-white/5 border-none text-zinc-400 text-sm font-medium focus:ring-1 focus:ring-indigo-500/30 rounded px-2 py-0.5"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-3">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-all ${
                        automation.fhir_status === 'synced' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : automation.fhir_status === 'failed' 
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                    }`}>
                        {automation.fhir_status === 'synced' ? <ShieldCheck size={16} /> : <Sparkles size={16} />}
                        {automation.fhir_status === 'synced' ? 'SYNCED WITH EHR' : automation.fhir_status === 'failed' ? 'EHR SYNC FAILED' : 'SYNCING TO EHR...'}
                    </div>
                    {automation.fhir_id && (
                        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                            FHIR_ID: {automation.fhir_id}
                        </span>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-12 gap-12">
                {/* Clean SOAP Sections */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    {/* Cleaned NLP Conversation Section (Now Editable) */}
                    {soap.clean_transcript && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-indigo-600/5 rounded-3xl p-8 border border-indigo-500/10 hover:border-indigo-500/20 transition-all group"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">
                                    Cleaned NLP Conversation
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                                    <Sparkles size={12} className="text-indigo-400" /> Click to Edit
                                </div>
                            </div>
                            <textarea 
                                value={soap.clean_transcript} 
                                onChange={(e) => setSoap({...soap, clean_transcript: e.target.value})}
                                className="w-full min-h-[250px] bg-transparent border-0 text-xl leading-relaxed text-zinc-200 focus:ring-0 resize-none p-0 font-medium"
                            />
                        </motion.div>
                    )}

                    {Object.entries(soap).filter(([k]) => k !== 'clean_transcript').map(([key, value], idx) => (
                        <motion.div 
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-zinc-900/20 rounded-3xl p-8 border border-white/5 hover:border-white/10 transition-all group"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                    {key}
                                </h3>
                                <button 
                                    onClick={() => refineWithAI(key)}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-[10px] font-bold transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Wand2 size={12} /> Auto-refine
                                </button>
                            </div>

                            <div className="relative">
                                <textarea 
                                    value={formatSoapValue(value)} 
                                    onChange={(e) => setSoap({...soap, [key]: e.target.value})}
                                    className="w-full min-h-[140px] bg-transparent border-0 text-xl leading-relaxed text-zinc-200 focus:ring-0 resize-none p-0 font-medium placeholder:text-zinc-800"
                                />
                                <AnimatePresence>
                                    {isRefining === key && (
                                        <motion.div 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl"
                                        >
                                            <Sparkles className="text-indigo-500 mb-3 animate-pulse" size={24} />
                                            <span className="text-[10px] font-bold tracking-widest text-indigo-400">ANALYZING MEDICAL CONTEXT...</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Refined Sidebar */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                            <Sparkles className="text-indigo-500" size={20} /> Automated Results
                        </h3>
                        <div className="space-y-4">
                            {automation.lab_orders.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase font-bold text-zinc-500">Lab Orders</div>
                                    {automation.lab_orders.map((o: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300 flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-indigo-500" /> 
                                            {typeof o === 'object' ? (o.test_name || JSON.stringify(o)) : String(o)}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {automation.billing_codes.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase font-bold text-zinc-500">Clinical CPT Codes</div>
                                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400 flex flex-wrap gap-2">
                                        {automation.billing_codes.map((c: any, i: number) => (
                                            <span 
                                                key={typeof c === 'object' ? (String(c.code || i) + i) : c} 
                                                className="bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono cursor-help"
                                                title={typeof c === 'object' ? `${c.system || ''}: ${c.description || ''}${c.reasoning ? ` (${c.reasoning})` : ''}` : String(c)}
                                            >
                                                {typeof c === 'object' ? (typeof c.code === 'object' ? (c.code.code || JSON.stringify(c.code)) : String(c.code)) : String(c)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {automation.prescriptions.length > 0 && automation.prescriptions[0].medication !== "N/A" && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] uppercase font-bold text-zinc-500">E-Prescripts</div>
                                        <button 
                                            onClick={() => window.open(`/api/v1/encounters/${id}/prescription-pdf`, '_blank')}
                                            className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-all border border-indigo-500/20 px-2 py-1 rounded-md"
                                        >
                                            <Download size={12} /> PDF
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {automation.prescriptions.map((p, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300">
                                                <div className="font-bold">{p.medication}</div>
                                                <div className="text-[10px] text-zinc-500">{p.dosage} - {p.frequency}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!automation.lab_orders.length && !automation.billing_codes.length && (
                                <p className="text-xs text-zinc-600 italic">No automated results generated for this session.</p>
                            )}
                        </div>
                    </div>

                    <div className="p-8 rounded-[2.5rem] bg-zinc-950 border border-zinc-800 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[60px] rounded-full" />
                        <h3 className="text-2xl font-bold mb-3 text-white">Finalize Record</h3>
                        <p className="text-xs text-zinc-500 mb-8 leading-relaxed font-medium">
                            I verify that these notes accurately reflect the clinical encounter. 
                            Purging of raw media will commence upon sign-off.
                        </p>
                        <button 
                            onClick={saveRefinement}
                            disabled={loading}
                            className="btn btn-primary w-full h-16 py-0 text-lg rounded-2xl flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <FileCheck size={20} />
                                    Sign encounter
                                </>
                            )}
                        </button>

                        {/* Re-record button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={async () => {
                                try {
                                    await fetch(`/api/v1/encounters/${id}/reset`, { method: 'POST' });
                                } catch (e) {
                                    console.error("Reset failed:", e);
                                }
                                navigate(`/encounter/${id}`);
                            }}
                            className="mt-4 w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all text-sm font-bold tracking-wide"
                        >
                            <Mic size={16} />
                            Re-record Encounter
                        </motion.button>
                    </div>

                    <div className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-2"> Raw Transcript </h3>
                        <div className="max-h-[400px] overflow-y-auto space-y-4 pr-3 scrollbar-hide">
                            {transcript.length > 0 ? transcript.map((t, i) => (
                                <div key={i} className="text-sm">
                                    <span className={`font-bold text-[10px] uppercase tracking-tighter mr-2 ${t.speaker === 'Doctor' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                        {t.speaker}:
                                    </span>
                                    <span className="text-zinc-400 font-medium"> {t.text} </span>
                                </div>
                            )) : (
                                <p className="text-xs text-zinc-600 italic">No transcript recorded for this session.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 opacity-30 px-10">
                         <Save size={16} />
                         <span className="text-[8px] font-bold tracking-[0.5em] text-center uppercase">Auto-save active</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Review;
