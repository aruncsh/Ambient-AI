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
        subjective: "",
        patient_history: "",
        objective: "",
        assessment: "",
        plan: "",
        referrals: "",
        follow_ups: "",
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
                // First, trigger generation to ensure we have the latest from the transcript
                const genResp = await fetch(`/api/summary/${id}/generate`, {
                    method: 'POST'
                });
                const summaryData = await genResp.json();
                
                // Also fetch the full encounter for automation and EHR results
                const encounterResp = await fetch(`/api/encounters/${id}`);
                const encounterData = await encounterResp.json();
                
                if (summaryData) {
                    const soapNote = summaryData.soap || summaryData;
                    setSoap({
                        subjective: soapNote.subjective || "",
                        patient_history: soapNote.patient_history || "",
                        objective: soapNote.objective || "",
                        assessment: soapNote.assessment || "",
                        plan: soapNote.plan || "",
                        referrals: soapNote.follow_up?.referrals || soapNote.referrals || "",
                        follow_ups: soapNote.follow_up 
                            ? `${soapNote.follow_up.follow_up_timeline || 'As needed'}\n\nWarning Signs: ${soapNote.follow_up.warning_signs?.join(', ') || 'None'}`
                            : soapNote.follow_ups || "",
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
                }
                
                if (encounterData && encounterData.transcript) {
                    setTranscript(encounterData.transcript);
                }
            } catch (err) {
                console.error("Failed to fetch SOAP:", err);
            } finally {
                setLoading(false);
            }
        };

        if (id && id !== 'demo' && id !== 'new') {
            fetchSOAP();
        } else {
            // Fallback for demo mode if no real ID or if ID is "new"
            setSoap({
                subjective: "This is a demo subjective note. In a real session, your spoken words would appear here.",
                patient_history: "No history for demo. This section captures past medical records.",
                objective: "Vitals: Heart Rate 72 BPM, SpO2 98%, BP 120/80.",
                assessment: "General evaluation (Demo).",
                plan: "Continue routine care.",
                referrals: "None for demo.",
                follow_ups: "1 week follow-up.",
                clean_transcript: "Demo: Hello, how are you? Patient: I am fine, thank you."
            });
            setLoading(false);
        }
    }, [id]);

    const formatSoapValue = (val: any): string => {
        if (!val) return "";
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) {
            return val.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return item.code || item.name || JSON.stringify(item);
                }
                return String(item);
            }).join("\n");
        }
        if (typeof val === 'object') {
            return Object.entries(val)
                .map(([k, v]) => {
                    const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    if (Array.isArray(v)) return `${label}: ${v.join(", ")}`;
                    if (typeof v === 'object' && v !== null) {
                        return `${label}:\n  ` + Object.entries(v).map(([sk, sv]) => `${sk.replace(/_/g, ' ').toUpperCase()}: ${sv}`).join("\n  ");
                    }
                    return `${label}: ${v}`;
                })
                .join("\n\n");
        }
        return String(val);
    };

    const saveRefinement = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`/api/summary/${id}/update`, {
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
                    <h1 className="text-5xl font-bold tracking-tight text-white">Clinical Notes Review</h1>
                    <div className="flex items-center gap-4 text-zinc-500 text-sm font-medium">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-zinc-400">
                            {id || 'PENDING'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span>Jane Doe</span>
                        {loading && (
                            <motion.span 
                                animate={{ opacity: [0.3, 1, 0.3] }} 
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-indigo-400 text-[10px] font-bold uppercase ml-4"
                            >
                                Generating Real SOAP...
                            </motion.span>
                        )}
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
                    {/* Cleaned NLP Conversation Section */}
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
                                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400">
                                    <Sparkles size={12} /> Step 1: Noise & Filler Removal
                                </div>
                            </div>
                            <div className="text-xl leading-relaxed text-zinc-200 font-medium whitespace-pre-wrap">
                                {soap.clean_transcript}
                            </div>
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
                                    {automation.lab_orders.map(o => (
                                        <div key={o} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300 flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-indigo-500" /> {o}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {automation.billing_codes.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] uppercase font-bold text-zinc-500">Codes & Billing</div>
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
                                        {automation.invoice_id && (
                                            <div className="w-full mt-2 pt-2 border-t border-emerald-500/10 flex justify-between items-center">
                                                <div className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider">ID: {automation.invoice_id}</div>
                                                <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded flex items-baseline gap-1">
                                                    <span className="text-[10px] opacity-60">₹</span>
                                                    {automation.billing_amount !== undefined ? automation.billing_amount.toLocaleString() : '0'}
                                                    <span className="text-[8px] opacity-60 ml-0.5">{automation.billing_currency || 'INR'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {automation.prescriptions.length > 0 && automation.prescriptions[0].medication !== "N/A" && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] uppercase font-bold text-zinc-500">E-Prescripts</div>
                                        <button 
                                            onClick={() => window.open(`/api/encounters/${id}/prescription-pdf`, '_blank')}
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
                                    await fetch(`/api/encounters/${id}/reset`, { method: 'POST' });
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
