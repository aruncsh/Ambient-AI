import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, AlertTriangle, HelpCircle, FlaskConical, ChevronRight, RefreshCw, Activity, Sparkles, ShieldCheck } from 'lucide-react';

interface Suggestions {
    differential_diagnoses: string[];
    suggested_questions: string[];
    red_flags: string[];
    suggested_tests: string[];
    clinical_notes: string;
}

interface Props {
    transcript: { speaker: string; text: string; time: string }[];
    isActive: boolean;
    insights?: any[];
}

const ClinicalAssistant: React.FC<Props> = ({ transcript, isActive, insights = [] }) => {
    const [suggestions, setSuggestions] = useState<Suggestions>({
        differential_diagnoses: [],
        suggested_questions: [],
        red_flags: [],
        suggested_tests: [],
        clinical_notes: 'Awaiting clinical data stream...'
    });
    const [loading, setLoading] = useState(false);
    const [lastFetchedLength, setLastFetchedLength] = useState(0);

    const fetchSuggestions = useCallback(async () => {
        if (!transcript || transcript.length === 0) return;
        if (transcript.length === lastFetchedLength) return;

        const fullTranscript = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
        setLoading(true);
        try {
            const resp = await fetch('/api/v1/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript })
            });
            if (resp.ok) {
                const data = await resp.json();
                setSuggestions(data);
                setLastFetchedLength(transcript.length);
            }
        } catch (err) {
            console.error('Clinical suggestion fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [transcript, lastFetchedLength]);

    useEffect(() => {
        if (!isActive) return;
        const timer = setInterval(fetchSuggestions, 15000);
        return () => clearInterval(timer);
    }, [isActive, fetchSuggestions]);

    useEffect(() => {
        if (transcript.length > 0 && transcript.length % 5 === 0) {
            fetchSuggestions();
        }
    }, [transcript.length, fetchSuggestions]);

    const hasContent = suggestions.differential_diagnoses.length > 0
        || suggestions.suggested_questions.length > 0
        || suggestions.red_flags.length > 0
        || (insights && insights.length > 0);

    const SectionHeader = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${color} mb-3`}>
            <Icon size={12} className="stroke-[3]" />
            {label}
        </div>
    );

    return (
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 flex flex-col h-full min-h-0 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full translate-x-12 -translate-y-12" />
            
            <div className="flex items-center justify-between mb-8 relative">
                <div className="space-y-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                        <Brain size={16} className="text-blue-600" />
                        Clinical Intelligence
                    </h3>
                </div>
                <button
                    onClick={fetchSuggestions}
                    disabled={loading}
                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center text-slate-400"
                >
                    <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide relative">
                {!hasContent ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30 grayscale">
                        <Brain size={48} className="mb-6 text-slate-200" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            {isActive ? 'Analyzing Neural Stream...' : 'Awaiting Atmosphere Activation'}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {/* Real-time Insights (Entities, ICD-10, Billing) */}
                        {insights && insights.length > 0 && (
                            <motion.div
                                key="live_insights"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 space-y-4"
                            >
                                <SectionHeader icon={Activity} label="Nexus Insights" color="text-blue-600" />
                                {insights.map((insight, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-black text-slate-900 uppercase italic">{insight.value}</span>
                                            <span className="text-[9px] font-black uppercase text-blue-600/50 tracking-widest">{insight.type}</span>
                                        </div>
                                        {insight.icd10_suggestions?.map((s: any, sidx: number) => (
                                            <div key={sidx} className="flex items-center justify-between bg-white/50 p-2.5 rounded-xl border border-blue-100/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-blue-600">{s.code}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 truncate w-32">{s.description}</span>
                                                </div>
                                                <div className="h-6 px-2 rounded-full bg-blue-100 text-blue-600 text-[8px] font-black flex items-center">{Math.round(s.confidence * 100)}%</div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Red Flags */}
                        {suggestions.red_flags.length > 0 && (
                            <motion.div
                                key="red_flags"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100"
                            >
                                <SectionHeader icon={AlertTriangle} label="Critical Alerts" color="text-rose-600" />
                                <ul className="space-y-2">
                                    {suggestions.red_flags.map((flag, i) => (
                                        <li key={i} className="text-xs text-rose-900 font-bold flex items-start gap-3 bg-white/40 p-2.5 rounded-xl border border-rose-100">
                                            <ChevronRight size={14} className="text-rose-600 mt-0.5 flex-shrink-0" />
                                            {flag}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        )}

                        {/* Differential Diagnoses */}
                        {suggestions.differential_diagnoses.length > 0 && (
                            <motion.div
                                key="diagnoses"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100"
                            >
                                <SectionHeader icon={Sparkles} label="Differential Flux" color="text-slate-900" />
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.differential_diagnoses.map((d, i) => (
                                        <span key={i} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-900 uppercase tracking-tight shadow-sm italic hover:scale-105 transition-all">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Suggested Questions */}
                        {suggestions.suggested_questions.length > 0 && (
                            <motion.div
                                key="questions"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100"
                            >
                                <SectionHeader icon={HelpCircle} label="Deep Clinical Inquiry" color="text-emerald-600" />
                                <ul className="space-y-2">
                                    {suggestions.suggested_questions.map((q, i) => (
                                        <li key={i} className="text-xs text-emerald-900 font-bold flex items-start gap-3 bg-white/40 p-2.5 rounded-xl border border-emerald-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5" />
                                            {q}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        )}

                        {/* Suggested Tests */}
                        {suggestions.suggested_tests.length > 0 && (
                            <motion.div
                                key="tests"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100"
                            >
                                <SectionHeader icon={FlaskConical} label="Laboratory Protocols" color="text-blue-600" />
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.suggested_tests.map((t, i) => (
                                        <span key={i} className="px-4 py-2 rounded-xl bg-white border border-blue-200 text-[9px] font-black text-blue-600 uppercase tracking-widest shadow-sm">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-300" />
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Neural Encryption Verified</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1 h-3 bg-blue-600 rounded-full animate-bounce [animation-delay:0s]" />
                    <div className="w-1 h-3 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-3 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
            </div>
        </div>
    );
};

export default ClinicalAssistant;
