import React, { useState, useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, Mic, Trash2, CheckCircle2, ChevronRight, Info, Edit3, Volume2 } from 'lucide-react';

const Consent: React.FC = () => {
    const [patientName, setPatientName] = useState("Jane Doe");
    const [consentType, setConsentType] = useState<'signature' | 'verbal' | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [step, setStep] = useState(1); // 1: Info/Name, 2: Choose Method, 3: Capture, 4: Done
    const [signature, setSignature] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (consentType === 'signature' && canvasRef.current) {
            signaturePadRef.current = new SignaturePad(canvasRef.current);
        }
    }, [consentType, step]);

    const handleClear = () => signaturePadRef.current?.clear();
    
    const saveSignature = () => {
        if (signaturePadRef.current?.isEmpty()) return alert("Please sign first");
        setSignature(signaturePadRef.current?.toDataURL() || null);
        setStep(4);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks: Blob[] = [];
            
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/wav' });
                setAudioBlob(blob);
                setStep(4);
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            // Record for 10 seconds as per requirement
            setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    setIsRecording(false);
                }
            }, 10000);
        } catch (err) {
            console.error("Mic access failed:", err);
            alert("Microphone access is required for verbal consent.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleFinalize = async () => {
        try {
            // 1. Create Encounter first
            const resp = await fetch('/api/v1/encounters/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id: patientName, clinician_id: "Dr. Smith" })
            });
            const encounter = await resp.json();
            const encounterId = encounter.id || encounter._id;

            // 2. Submit Consent
            let consentData = "";
            if (consentType === 'signature' && signature) {
                consentData = signature;
            } else if (consentType === 'verbal' && audioBlob) {
                consentData = await blobToBase64(audioBlob);
            }

            if (consentData) {
                await fetch(`/api/v1/consent/${encounterId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: consentType, data: consentData })
                });
            }

            navigate(`/encounter/${encounterId}`);
        } catch (err) {
            console.error("Failed to finalize consent/encounter:", err);
            alert("Error finalizing session. Please try again.");
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto py-12 px-6"
        >
            <div className="glass-card p-12 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                            <header>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider mb-6">
                                    <Info size={14} /> Intake & Compliance
                                </div>
                                <h1 className="text-4xl font-bold text-white mb-4">Patient Consent</h1>
                                <p className="text-zinc-400 text-lg leading-relaxed">
                                    I, <input 
                                        type="text" 
                                        value={patientName} 
                                        onChange={(e) => setPatientName(e.target.value)}
                                        className="bg-transparent border-b border-indigo-500/50 text-white focus:outline-none focus:border-indigo-400 px-1 font-semibold"
                                    />, consent to the recording and AI-assisted transcription of this medical consultation.
                                </p>
                                <p className="text-zinc-500 mt-4 text-sm italic">
                                    I understand that the recording will be used solely for generating clinical documentation and will be stored securely in accordance with HIPAA regulations.
                                </p>
                            </header>
                            <button onClick={() => setStep(2)} className="btn btn-primary h-16 w-full text-lg rounded-2xl">
                                Continue to Consent Method <ChevronRight size={20} className="ml-2" />
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                            <h2 className="text-3xl font-bold text-white text-center">How would you like to provide consent?</h2>
                            <div className="grid grid-cols-2 gap-8">
                                <button 
                                    onClick={() => { setConsentType('signature'); setStep(3); }}
                                    className="glass-card p-10 flex flex-col items-center gap-6 hover:bg-white/5 transition-all text-white group"
                                >
                                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Edit3 size={32} className="text-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold">Digital Signature</div>
                                        <div className="text-sm text-zinc-500 mt-2">Sign on the screen</div>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => { setConsentType('verbal'); setStep(3); }}
                                    className="glass-card p-10 flex flex-col items-center gap-6 hover:bg-white/5 transition-all text-white group"
                                >
                                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Mic size={32} className="text-emerald-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold">Verbal Consent</div>
                                        <div className="text-sm text-zinc-500 mt-2">Record "I consent"</div>
                                    </div>
                                </button>
                            </div>
                            <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium block mx-auto">
                                Back to details
                            </button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-8">
                            {consentType === 'signature' ? (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-2xl font-bold text-white">Draw Signature</h3>
                                        <button onClick={handleClear} className="text-zinc-500 hover:text-red-400 flex items-center gap-2 text-sm uppercase font-bold tracking-widest">
                                            <Trash2 size={16} /> Clear
                                        </button>
                                    </div>
                                    <div className="bg-white rounded-3xl overflow-hidden h-64 border-4 border-white/5 shadow-2xl">
                                        <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" width={800} height={256} />
                                    </div>
                                    <button onClick={saveSignature} className="btn btn-primary h-16 w-full rounded-2xl text-lg">
                                        Confirm Signature <CheckCircle2 size={20} className="ml-2" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-10 py-10 flex flex-col items-center">
                                    <div className="text-center space-y-4">
                                        <h3 className="text-2xl font-bold text-white">Record Verbal Consent</h3>
                                        <p className="text-zinc-500">Please say clearly: "I, {patientName}, consent to being recorded."</p>
                                    </div>
                                    
                                    <div className="relative">
                                        {isRecording && (
                                            <motion.div 
                                                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="absolute inset-0 bg-emerald-500/20 rounded-full"
                                            />
                                        )}
                                        <button 
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                                                isRecording ? 'bg-red-500 shadow-xl shadow-red-500/20 scale-110' : 'bg-emerald-500 hover:bg-emerald-400'
                                            }`}
                                        >
                                            {isRecording ? <div className="w-8 h-8 bg-white rounded-sm" /> : <Mic size={40} className="text-white" />}
                                        </button>
                                    </div>

                                    {isRecording ? (
                                        <p className="text-red-400 font-bold animate-pulse uppercase tracking-widest text-sm">Recording... (10s max)</p>
                                    ) : (
                                        <p className="text-zinc-500 text-sm">Click to start recording</p>
                                    )}
                                </div>
                            )}
                            <button onClick={() => setStep(2)} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium block mx-auto">
                                Change method
                            </button>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-10 py-10">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                                <CheckCircle2 size={48} className="text-emerald-400" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-bold text-white">Consent Captured Successfully</h2>
                                <p className="text-zinc-500">Session is ready for initialization.</p>
                            </div>
                            <button onClick={handleFinalize} className="btn btn-primary h-20 w-full text-xl rounded-2xl shadow-indigo-500/20 shadow-xl">
                                Start Encounter Hub <ChevronRight size={24} className="ml-2" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default Consent;
