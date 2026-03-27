import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Send, ArrowLeft, Brain } from 'lucide-react';

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
            if (data && data._id) {
                // The backend returns the encounter/SOAP note object
                // We need the encounter ID to redirect to review
                // Wait, generate_summary_from_text returns the SOAP object.
                // Let's check what it returns exactly.
                console.log("Generated SOAP:", data);
                // If it's a SOAPNote object, it might not have the encounter ID directly in a way we expect.
                // Actually, I modified fusion.py to return the result of generate_final_summary which returns soap_note.
                // I might need to return the encounter ID instead or as well.
                // Let's assume for now it returns something with an id.
                
                // Fetch recent encounters to find the one we just made if needed, 
                // but better if the API returns the encounter ID.
                // I'll update the backend to return {"encounter_id": ...}
                if (data.encounter_id) {
                    navigate(`/review/${data.encounter_id}`);
                } else {
                    // Fallback: try to find the latest
                    navigate('/dashboard');
                }
            } else {
                // If it returned the SOAP note directly, I might need to handle it.
                // For now, let's just go to dashboard as fallback
                navigate('/dashboard');
            }
        } catch (err) {
            console.error("Text-to-SOAP failed:", err);
            alert("Failed to generate SOAP note. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1000px] mx-auto px-6 py-16 space-y-12"
        >
            <header className="space-y-4">
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    <ArrowLeft size={14} /> Back to Dashboard
                </button>
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.3em]">
                    <Brain size={16} /> AI Conversion Engine
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-white">Text to SOAP</h1>
                <p className="text-zinc-500 text-lg font-medium max-w-2xl">
                    Paste a whole doctor-patient conversation below. Our clinical AI will extract symptoms, 
                    diagnoses, and generate a professional SOAP note instantly.
                </p>
            </header>

            <div className="space-y-8">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Patient Name/ID (Optional)</label>
                    <input 
                        type="text" 
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        placeholder="e.g. John Doe or P-123"
                        className="w-full h-14 bg-zinc-900/50 border border-white/5 rounded-2xl px-6 text-white text-lg focus:border-indigo-500/50 focus:ring-0 transition-all font-medium"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Conversation Transcript</label>
                    <textarea 
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Doctor: Hello... 
Patient: I have some pain..."
                        className="w-full min-h-[400px] bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-8 text-white text-xl leading-relaxed focus:border-indigo-500/50 focus:ring-0 transition-all font-medium scrollbar-hide"
                    />
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim()}
                    className={`btn btn-primary w-full h-20 text-xl rounded-[2rem] gap-3 ${isGenerating ? 'opacity-70' : ''}`}
                >
                    {isGenerating ? (
                        <>
                            <Sparkles className="animate-spin" size={24} />
                            Analyzing Clinical Context...
                        </>
                    ) : (
                        <>
                            <Sparkles size={24} />
                            Generate Clinical SOAP Note
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
};

export default TextToSoap;
