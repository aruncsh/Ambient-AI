import React, { useState, useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, ChevronRight, Edit3, Mic, 
    ShieldCheck, ArrowLeft, RotateCcw, Users, Stethoscope,
    AlertCircle, Play, Pause, Trash2
} from 'lucide-react';
import { api } from '../lib/api';

const Consent: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>(location.state?.patientId || "");
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [patientName, setPatientName] = useState(location.state?.patientName || "");
    const [doctorName, setDoctorName] = useState("");
    const [consentType, setConsentType] = useState<'signature' | 'verbal' | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [step, setStep] = useState(1);
    const [signature, setSignature] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [pts, docs] = await Promise.all([
                    api.getPatients(),
                    api.getDoctors()
                ]);
                setPatients(pts || []);
                setDoctors(docs || []);
                
                if (!selectedPatientId && pts && pts.length > 0) {
                    setSelectedPatientId(pts[0].id || pts[0]._id);
                    setPatientName(pts[0].name);
                }
                
                if (docs && docs.length > 0) {
                    setSelectedDoctorId(docs[0].id || docs[0]._id);
                    setDoctorName(docs[0].name);
                }
            } catch (err) {
                console.error("Failed to fetch intake data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, []);

    useEffect(() => {
        if (consentType === 'signature' && step === 3) {
            let resizeObserver: ResizeObserver | null = null;
            const initPad = () => {
                const canvas = canvasRef.current;
                if (!canvas || canvas.offsetWidth === 0) return;
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.scale(ratio, ratio);
                if (signaturePadRef.current) signaturePadRef.current.off();
                signaturePadRef.current = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: 'rgb(15, 23, 42)', 
                    velocityFilterWeight: 0.7
                });
            };
            const timer = setTimeout(() => {
                initPad();
                const canvas = canvasRef.current;
                if (canvas) {
                    resizeObserver = new ResizeObserver(() => initPad());
                    resizeObserver.observe(canvas.parentElement || canvas);
                }
            }, 500);
            return () => {
                clearTimeout(timer);
                if (resizeObserver) resizeObserver.disconnect();
                if (signaturePadRef.current) signaturePadRef.current.off();
            };
        }
    }, [consentType, step]);

    const handleClear = () => signaturePadRef.current?.clear();
    
    const saveSignature = () => {
        if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) return;
        setSignature(signaturePadRef.current.toDataURL());
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
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setStep(4);
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 10) {
                        stopRecording();
                        return 10;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error("Mic access failed", err);
            alert("Microphone access is required for verbal consent.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleFinalize = async () => {
        if (finalizing) return;
        setFinalizing(true);
        try {
            const resp = await fetch('/api/v1/encounters/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    patient_id: selectedPatientId || patientName, 
                    patient_name: patientName,
                    clinician_id: doctorName || "System",
                    consent_obtained: true,
                    consent_signature_url: signature,
                    consent_audio_url: audioUrl
                })
            });
            const encounter = await resp.json();
            const encounterId = encounter.id || encounter._id;
            navigate(`/encounter/${encounterId}`);
        } catch (err) {
            console.error("Failed to finalize", err);
            setFinalizing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            {/* Professional Progress Steps */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-10">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Patient Consent</h1>
                    <p className="text-slate-500 font-medium tracking-tight italic leading-relaxed">Secure clinical authorization for session capture.</p>
                </div>
                <div className="flex items-center gap-3">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${step >= s ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                {step > s ? <CheckCircle2 size={18} /> : s}
                            </div>
                            {s < 4 && <div className={`w-8 h-0.5 rounded-full ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>
            </header>

            <main className="bg-white border border-slate-200 rounded-3xl shadow-sm p-10 lg:p-16 relative overflow-hidden group">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="st1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2"><Stethoscope size={14} /> Attending Clinician</label>
                                    <div className="h-14 bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-6 gap-4 focus-within:border-blue-600 transition-all shadow-inner">
                                        <select 
                                            value={selectedDoctorId}
                                            onChange={(e) => {
                                                const d = doctors.find(d => (d.id || d._id) === e.target.value);
                                                setSelectedDoctorId(e.target.value);
                                                if (d) setDoctorName(d.name);
                                            }}
                                            className="flex-1 bg-transparent border-none text-slate-900 font-bold text-base outline-none cursor-pointer"
                                        >
                                            {doctors.map(d => <option key={d.id || d._id} value={d.id || d._id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2"><Users size={14} /> Patient Identity</label>
                                    <div className="h-14 bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-6 gap-4 focus-within:border-blue-600 transition-all shadow-inner">
                                        <select 
                                            value={selectedPatientId}
                                            onChange={(e) => {
                                                const p = patients.find(p => (p.id || p._id) === e.target.value);
                                                setSelectedPatientId(e.target.value);
                                                if (p) setPatientName(p.name);
                                            }}
                                            className="flex-1 bg-transparent border-none text-slate-900 font-bold text-base outline-none cursor-pointer"
                                        >
                                            {patients.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-4">
                                <AlertCircle size={20} className="text-blue-600 mt-1" />
                                <p className="text-slate-700 font-medium leading-relaxed italic">
                                    I, <span className="text-blue-600 font-bold">{patientName}</span>, hereby authorize the use of Ambient AI technology for clinical documentation of this session.
                                </p>
                            </div>

                            <button onClick={() => setStep(2)} className="h-16 w-full rounded-2xl bg-slate-900 text-white font-bold text-lg hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3">
                                Proceed to Consent <ChevronRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="st2" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12 text-center">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-bold text-slate-900 tracking-tight italic leading-relaxed">Capture Authorization</h2>
                                <p className="text-slate-400 font-medium">Select your preferred method of clinical consent.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                                <button onClick={() => { setConsentType('signature'); setStep(3); }} className="p-10 rounded-3xl bg-white border border-slate-200 hover:border-blue-600 transition-all shadow-sm hover:shadow-lg group">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Edit3 size={28} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-1 leading-relaxed italic">Digital Signature</h3>
                                    <p className="text-xs text-slate-400 font-medium tracking-tight italic leading-relaxed">Sign directly on screen</p>
                                </button>
                                <button onClick={() => { setConsentType('verbal'); setStep(3); }} className="p-10 rounded-3xl bg-white border border-slate-200 hover:border-emerald-600 transition-all shadow-sm hover:shadow-lg group">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <Mic size={28} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-1 leading-relaxed italic">Verbal Attestation</h3>
                                    <p className="text-xs text-slate-400 font-medium tracking-tight italic leading-relaxed">Voice recording authorization</p>
                                </button>
                            </div>
                            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-sm tracking-tight italic leading-relaxed">
                                <ArrowLeft size={16} /> Revise Patient Data
                            </button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="st3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                            {consentType === 'signature' ? (
                                <div className="space-y-8">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-bold text-slate-900 tracking-tight italic leading-relaxed">Digital Capture</h3>
                                            <p className="text-sm text-slate-400 font-medium tracking-tight italic leading-relaxed">Sign within the capture boundary.</p>
                                        </div>
                                        <button onClick={handleClear} className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 items-center justify-center flex hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                            <RotateCcw size={18} />
                                        </button>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl h-80 border-2 border-slate-100 relative group overflow-hidden shadow-inner">
                                        <canvas ref={canvasRef} className="w-full h-full relative z-10 touch-none cursor-crosshair" />
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-200 text-3xl font-bold uppercase tracking-widest pointer-events-none opacity-20 italic items-center justify-center">
                                            SECURE AUTHORIZATION HUB
                                        </div>
                                    </div>
                                    <button onClick={saveSignature} className="h-16 w-full rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 shadow-inner italic leading-relaxed">
                                        Capture Official Seal
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-10 py-4 flex flex-col items-center">
                                    <div className="text-center space-y-4">
                                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight italic leading-relaxed">Voice Recording</h3>
                                        <div className="p-8 rounded-2xl bg-blue-50 border border-blue-100 border-b-4 border-b-blue-600">
                                            <p className="text-blue-600 font-bold text-xl leading-relaxed italic text-centre">
                                                "I, {patientName}, authorize clinical capture."
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full max-w-sm space-y-8 flex flex-col items-center">
                                        <button 
                                            onClick={isRecording ? stopRecording : startRecording} 
                                            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-rose-500 shadow-2xl animate-pulse' : 'bg-slate-900 shadow-xl shadow-slate-900/10 hover:scale-105'}`}
                                        >
                                            {isRecording ? <div className="w-8 h-8 bg-white rounded-lg shadow-inner" /> : <Mic size={40} className="text-white" />}
                                        </button>
                                        <div className="w-full space-y-4">
                                            <div className="flex justify-between text-xs font-bold text-slate-400 capitalize items-center">
                                                <span>{isRecording ? 'Capturing...' : 'Ready'}</span>
                                                <span className="text-slate-900">{recordingTime}s / 10s</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                                                <motion.div className="h-full bg-blue-600" initial={{ width: 0 }} animate={{ width: `${(recordingTime / 10) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setStep(2)} className="block mx-auto text-slate-400 hover:text-slate-900 font-bold text-sm tracking-tight italic leading-relaxed">Switch Method</button>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div key="st4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12 py-10 max-w-xl mx-auto text-center">
                            <div className="w-24 h-24 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
                                <CheckCircle2 size={48} className="text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-bold text-slate-900 tracking-tight italic leading-relaxed items-center">Authorization Captured</h2>
                                <p className="text-slate-400 font-medium">Please finalize to begin the clinical session.</p>
                            </div>
                            
                            <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center gap-6 shadow-inner">
                                {consentType === 'signature' && signature && (
                                    <img src={signature} alt="Signature" className="max-h-32 object-contain" />
                                )}
                                {consentType === 'verbal' && (
                                    <div className="w-full flex flex-col items-center gap-4">
                                         <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg">
                                             <Pause size={24} />
                                         </div>
                                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Acoustic fingerprint verified</p>
                                    </div>
                                )}
                                <button onClick={() => setStep(3)} className="text-rose-500 hover:text-rose-600 font-bold text-sm tracking-tight italic leading-relaxed text-centre">Invalidate & Retake</button>
                            </div>

                            <button onClick={handleFinalize} disabled={finalizing} className="h-16 w-full rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3">
                                {finalizing ? <Loader2 className="animate-spin" /> : <>Start Clinical Session <ChevronRight size={20} /></>}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const Loader2 = ({className}: {className?: string}) => (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className={className}>
        <RotateCcw size={20} />
    </motion.div>
);

export default Consent;
