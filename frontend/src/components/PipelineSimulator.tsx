import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, Brain, Activity, Waves } from 'lucide-react';

const PipelineSimulator: React.FC = () => {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runSimulation = async () => {
        setLoading(true);
        try {
            const resp = await fetch('/api/v1/simulate', { method: 'POST' });
            const data = await resp.json();
            setResults(data.results);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto mb-12 px-6 lg:px-12 pt-6">
            <div className="bg-zinc-900/20 border border-white/5 rounded-[2.5rem] overflow-hidden p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                            <Zap size={14} className="fill-current" /> Validation Hub
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white">Capture Pipeline Simulator</h2>
                        <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                            Run high-fidelity simulations to test multi-modal fusion, medical entity extraction, 
                            and real-time documentation workflows without external hardware.
                        </p>
                    </div>
                    
                    <button 
                        onClick={runSimulation} 
                        disabled={loading}
                        className="btn btn-secondary h-14 min-w-[240px] rounded-full group bg-white text-zinc-950 font-bold border-none hover:bg-zinc-200"
                    >
                        {loading ? 'Simulating Stream...' : 'Trigger Full Demo'}
                        <motion.span animate={{ x: loading ? 0 : [0, 4, 0] }} transition={{ repeat: Infinity }}>
                            <ChevronRight size={18} className="ml-2" />
                        </motion.span>
                    </button>
                </div>

                <AnimatePresence>
                    {results && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-white/5">
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-tight">
                                        <Waves size={14} /> Transcript Output
                                    </h4>
                                    <div className="p-5 rounded-2xl bg-zinc-950/50 border border-white/5 text-sm leading-relaxed text-zinc-400 font-medium italic">
                                        "{results?.transcript || 'No transcript generated'}"
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-tight">
                                        <Brain size={14} /> Extracted Entities
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(results?.nlp_insights || []).map((ins: any, i: number) => (
                                            <span 
                                                key={i} 
                                                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold"
                                            >
                                                {ins.value}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-tight">
                                        <Activity size={14} /> Clinical Summary
                                    </h4>
                                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Assessment</div>
                                        <div className="text-sm font-semibold text-emerald-200">{results?.analysis?.assessment || 'Pending assessment'}</div>
                                        <div className="flex gap-2">
                                            {(results?.analysis?.extracted_diagnosis || []).map((d: any, i: number) => (
                                                <span key={i} className="text-[9px] font-bold text-emerald-400/70 border border-emerald-400/20 px-2 py-0.5 rounded-lg">{d}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PipelineSimulator;
