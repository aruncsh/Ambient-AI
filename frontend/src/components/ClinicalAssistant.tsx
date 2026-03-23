import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, AlertTriangle, HelpCircle, FlaskConical, ChevronRight, RefreshCw, Activity } from 'lucide-react';

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
        clinical_notes: 'Awaiting conversation data...'
    });
    const [loading, setLoading] = useState(false);
    const [lastFetchedLength, setLastFetchedLength] = useState(0);

    const fetchSuggestions = useCallback(async () => {
        if (!transcript || transcript.length === 0) return;
        if (transcript.length === lastFetchedLength) return; // Skip if no new data

        const fullTranscript = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
        setLoading(true);
        try {
            const resp = await fetch('/api/ai/suggest', {
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

    // Auto-refresh every 15s during active encounter
    useEffect(() => {
        if (!isActive) return;
        const timer = setInterval(fetchSuggestions, 15000);
        return () => clearInterval(timer);
    }, [isActive, fetchSuggestions]);

    // Also fetch when encounter ends or transcript grows significantly
    useEffect(() => {
        if (transcript.length > 0 && transcript.length % 5 === 0) {
            fetchSuggestions();
        }
    }, [transcript.length]);

    const hasContent = suggestions.differential_diagnoses.length > 0
        || suggestions.suggested_questions.length > 0
        || suggestions.red_flags.length > 0;

    const SectionHeader = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
        <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${color} mb-2`}>
            <Icon size={11} />
            {label}
        </div>
    );

    return (
        <div className="glass-card flex-1 flex flex-col bg-zinc-900/10 h-full min-h-0">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Brain size={16} className="text-indigo-500" />
                    Clinical Intelligence
                </h3>
                <button
                    onClick={fetchSuggestions}
                    disabled={loading}
                    title="Refresh suggestions"
                    className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                    <RefreshCw size={12} className={`text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 scrollbar-hide">
                {!hasContent ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-30">
                        <Brain size={28} className="mb-3 text-zinc-600" />
                        <p className="text-sm font-medium text-zinc-500">
                            {isActive ? 'Analyzing conversation...' : 'Start a conversation to get AI suggestions'}
                        </p>
                        {suggestions.clinical_notes && (
                            <p className="text-xs text-zinc-600 mt-2">{suggestions.clinical_notes}</p>
                        )}
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {/* Real-time Insights (Entities, ICD-10, Billing) */}
                        {insights.length > 0 && (
                            <motion.div
                                key="live_insights"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4"
                            >
                                <SectionHeader icon={Activity} label="Real-Time Insights" color="text-indigo-400" />
                                {insights.map((insight, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white">{insight.value}</span>
                                            <span className="text-[9px] font-black uppercase text-indigo-500/50 tracking-tighter">{insight.type}</span>
                                        </div>
                                        {insight.icd10_suggestions?.map((s: any, sidx: number) => (
                                            <div key={sidx} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-indigo-300">{s.code}</span>
                                                    <span className="text-[9px] text-zinc-500 truncate w-40">{s.description}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-emerald-500">{Math.round(s.confidence * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Red Flags — shown first if present */}
                        {suggestions.red_flags.length > 0 && (
                            <motion.div
                                key="red_flags"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30"
                            >
                                <SectionHeader icon={AlertTriangle} label="Red Flags" color="text-rose-400" />
                                <ul className="space-y-1.5">
                                    {suggestions.red_flags.map((flag, i) => (
                                        <li key={i} className="text-sm text-rose-200 font-medium flex items-start gap-2">
                                            <ChevronRight size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
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
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 }}
                                className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20"
                            >
                                <SectionHeader icon={Brain} label="Differential Diagnoses" color="text-indigo-400" />
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.differential_diagnoses.map((d, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300">
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
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                            >
                                <SectionHeader icon={HelpCircle} label="Suggested Questions" color="text-amber-400" />
                                <ul className="space-y-1.5">
                                    {suggestions.suggested_questions.map((q, i) => (
                                        <li key={i} className="text-sm text-amber-200 font-medium flex items-start gap-2">
                                            <ChevronRight size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
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
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                            >
                                <SectionHeader icon={FlaskConical} label="Suggested Tests" color="text-emerald-400" />
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.suggested_tests.map((t, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Clinical Notes */}
                        {suggestions.clinical_notes && suggestions.clinical_notes !== 'Awaiting conversation data...' && (
                            <motion.div
                                key="notes"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-[11px] text-zinc-500 italic px-2 leading-relaxed"
                            >
                                {suggestions.clinical_notes}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default ClinicalAssistant;
