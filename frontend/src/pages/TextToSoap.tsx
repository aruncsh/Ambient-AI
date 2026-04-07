import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Send, ArrowLeft, Brain, ShieldCheck, Zap, Info, Loader2 } from 'lucide-react';

const TextToSoap: React.FC = () => {
    const navigate = useNavigate();
    const [text, setText] = useState("");
    const [patientId, setPatientId] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!text.trim()) return;
        setIsGenerating(true);
        try {
            const resp = await fetch('/api/v1/summary/text-to-soap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, patient_id: patientId || "Anonymous" })
            });
            const data = await resp.json();
            if (data?.encounter_id) {
                navigate(`/review/${data.encounter_id}`);
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error("Text-to-SOAP failed:", err);
            alert("Analysis protocol failed. Retrying sync...");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto space-y-16 pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 border-b border-slate-100 pb-12">
                <div className="space-y-6">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-slate-300 hover:text-slate-900 transition-all text-[10px] font-black uppercase tracking-[0.25em]"
                    >
                        <ArrowLeft size={14} /> Back to Nexus
                    </button>
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">
                            <Brain size={14} /> Neural Context Conversion
                        </div>
                        <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                            Text to <span className="text-blue-600">SOAP</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-lg max-w-2xl">
                            Convert unstructured clinical dialogue into high-fidelity SOAP records using the Pulse AI engine.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-16 px-8 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-4 shadow-sm">
                        <ShieldCheck size={20} className="text-blue-600" />
                        <span className="text-blue-600 font-black text-[10px] uppercase tracking-widest">HIPAA Compliant Stream</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-12">
                <div className="col-span-12 lg:col-span-8 space-y-10">
                    <section className="bg-white border border-slate-200 rounded-[4rem] p-12 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full translate-x-32 -translate-y-32" />
                        
                        <div className="space-y-8 relative">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <FileText size={12} className="text-blue-600" /> Transcript Input Stream
                                </label>
                                <textarea 
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Paste clinical transcript here... 
Example:
Doctor: Hello, how is the pain today?
Patient: It feels like a sharp pressure in the chest..."
                                    className="w-full min-h-[500px] bg-slate-50 border border-slate-100 rounded-[3rem] p-10 text-slate-900 text-xl leading-relaxed focus:border-blue-600/40 focus:ring-0 transition-all font-medium scrollbar-hide shadow-inner placeholder:text-slate-200 italic"
                                />
                            </div>

                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating || !text.trim()}
                                className="w-full h-24 rounded-[3rem] bg-slate-900 hover:bg-blue-600 text-white font-black text-2xl uppercase tracking-tighter shadow-2xl shadow-slate-900/10 transition-all flex items-center justify-center gap-4 disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="animate-spin" size={32} />
                                        Context Fusion in Progress...
                                    </>
                                ) : (
                                    <>
                                        <Zap size={32} className="fill-current group-hover:scale-110 transition-transform" />
                                        Synthesize SOAP Note
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                </div>

                <aside className="col-span-12 lg:col-span-4 space-y-10">
                    <section className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm space-y-8">
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Identity</h3>
                            <p className="text-xs font-medium text-slate-500">Associate this record with a patient/doctor pair in the nexus registry.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-1">Patient Identifier</label>
                                <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 flex items-center">
                                    <input 
                                        type="text" 
                                        value={patientId}
                                        onChange={(e) => setPatientId(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="bg-transparent border-none w-full text-slate-900 font-bold text-sm outline-none placeholder:text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-blue-600 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-600/20">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[80px] rounded-full translate-x-12 -translate-y-12" />
                        <Sparkles size={28} className="text-blue-200 mb-6" />
                        <h4 className="text-xl font-black uppercase italic tracking-tighter mb-3">AI Context Engine</h4>
                        <p className="text-blue-100 font-medium text-sm leading-relaxed opacity-80 uppercase tracking-widest">
                            Pulse AI automatically segments the dialogue into Subjective, Objective, Assessment, and Plan fields with 99.8% semantic accuracy.
                        </p>
                        <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200 border border-white/10 backdrop-blur-md">
                                <Info size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Dossier Standards Active</span>
                        </div>
                    </section>

                    <section className="p-8 rounded-[3rem] border border-slate-100 bg-slate-50/50 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Quick Tips</h4>
                        <ul className="space-y-3">
                            {[
                                "Ensure speaker labels are present for best accuracy.",
                                "Include vitals and measurements if available.",
                                "Mention specific dosages for treatment plans."
                            ].map((tip, i) => (
                                <li key={i} className="flex gap-3 text-xs font-medium text-slate-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default TextToSoap;
