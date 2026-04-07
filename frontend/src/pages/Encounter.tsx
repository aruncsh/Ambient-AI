import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Mic, MicOff, Save, FileCheck, ShieldCheck, ChevronRight, 
    Download, Activity, Stethoscope, FileText, Pill, ClipboardList,
    TrendingUp, Info, AlertCircle, Play, Pause, RotateCcw, 
    X, CheckCircle2, MoreHorizontal, Clock, Heart, Thermometer, Droplets,
    Radio, Zap, Volume2
} from 'lucide-react';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import EmergencySidebar from '../components/EmergencySidebar';

const Encounter = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<any>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [emergencyData, setEmergencyData] = useState<any>(null);
    const [isEmergency, setIsEmergency] = useState(false);

    useEffect(() => {
        const fetchEncounter = async () => {
            try {
                setLoading(true);
                const data = await api.getEncounter(id!);
                if (data && data.status === 'completed') {
                    navigate(`/review/${id}`);
                    return;
                }
                setTranscript(data.transcript || []);
                setIsEmergency(data.is_emergency || false);
                setEmergencyData({
                    demographics: data.current_demographics || {},
                    missing_fields: data.missing_fields || [],
                    registration_status: data.registration_status || 'pending'
                });
                setLoading(false);
            } catch (err) {
                console.error("Failed to fetch encounter", err);
                setLoading(false);
            }
        };
        if (id && id !== 'demo') fetchEncounter();

        // Connect to WebSocket for live transcription
        if (id) {
            console.log(`Encounter: Subscribing to stream ${id}`);
            wsClient.connect(id, (msg) => {
                console.log("WS: Message Received", msg);
                if (msg.transcript) {
                    setTranscript(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.text === msg.transcript && last.speaker === msg.speaker) return prev;
                        const newTranscript = [...prev, { 
                            speaker: msg.speaker || 'Doctor', 
                            text: msg.transcript, 
                            timestamp: msg.timestamp || new Date().toISOString() 
                        }];
                        console.log("UI: Transcript updated", newTranscript.length);
                        return newTranscript;
                    });
                }
                if (msg.emergency) {
                    console.log("WS: Emergency Data Received:", msg.emergency);
                    setEmergencyData((prev: any) => {
                        const incomingDemos = msg.emergency.demographics || {};
                        const currentDemos = prev?.demographics || {};
                        const mergedDemos = { ...currentDemos };
                        Object.entries(incomingDemos).forEach(([k, v]) => {
                            if (v && v !== "null" && v !== "None") {
                                mergedDemos[k] = v;
                            }
                        });
                        return { ...msg.emergency, demographics: mergedDemos };
                    });
                }
            });
        }

        return () => {
            wsClient.disconnect();
            if (timerRef.current) clearInterval(timerRef.current);
            stopRecording();
        };
    }, [id]);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = (reader.result as string).split(',')[1];
                        wsClient.send({ type: 'audio', data: base64data });
                    };
                    reader.readAsDataURL(e.data);
                }
            };

            mediaRecorder.start(4000); // Increased to 4s for better AI context
            setIsRecording(true);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to start recording", err);
            alert("Microphone access required.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const toggleRecording = () => isRecording ? stopRecording() : startRecording();

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleFinish = async () => {
        try {
            setLoading(true);
            if (isRecording) {
                stopRecording();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const finalBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            await api.completeEncounter(id!, finalBlob);
            navigate(`/review/${id}`);
        } catch (err) {
            console.error("Failed to finish", err);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10">
            {/* Header: Identity & Status */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 border-b border-slate-200 pb-10">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Live Encounter</h1>
                            <div className="flex items-center gap-3 mt-1">
                                {isEmergency && (
                                    <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                                        Critical Emergency
                                    </span>
                                )}
                                <span className={`flex items-center gap-2 text-xs font-bold ${isRecording ? 'text-rose-500' : 'text-slate-400'}`}>
                                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
                                    {isRecording ? 'Acoustic Capture Active' : 'Atmosphere Standby'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="h-16 px-8 rounded-3xl border border-slate-200 bg-white flex flex-col justify-center shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session Flux</span>
                        <span className="text-xl font-mono font-bold text-slate-900">{formatTime(recordingTime)}</span>
                    </div>
                    
                    <button 
                        onClick={toggleRecording} 
                        className={`h-16 w-16 flex items-center justify-center rounded-3xl transition-all shadow-xl ${isRecording ? 'bg-rose-500 text-white shadow-rose-500/20 hover:scale-105' : 'bg-blue-600 text-white shadow-blue-600/20 hover:scale-105'}`}
                    >
                        {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                    </button>

                    <button 
                        onClick={handleFinish} 
                        disabled={loading}
                        className="h-16 px-10 rounded-3xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-50 flex items-center gap-3"
                    >
                        {loading ? <RotateCcw className="animate-spin" size={20} /> : <FileCheck size={20} />}
                        Finalize Encounter
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Live Transcript Stream - The "Live Stream Screen" */}
                <div className="xl:col-span-8 flex flex-col h-[750px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)] pointer-events-none" />
                    
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center z-10">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-200 text-slate-500'}`}>
                                <Radio size={20} className={isRecording ? 'animate-pulse' : ''} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-black text-slate-900 text-xs uppercase tracking-widest">Live Capture Screen</h2>
                                    {isRecording && <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[9px] font-black animate-pulse"><div className="w-1 h-1 rounded-full bg-rose-600" /> LIVE</span>}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Atmospheric Real-time Reconstruction</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                             <Zap size={14} className="fill-emerald-600" />
                             <span className="text-[10px] font-black uppercase tracking-widest">High Fidelity AI</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-10 py-12 space-y-10 scrollbar-hide">
                        {transcript.length > 0 ? transcript.map((t, i) => (
                            <motion.div 
                                key={i} 
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`flex items-start gap-6 ${t.speaker === 'Doctor' ? 'justify-start' : 'justify-end'}`}
                            >
                                {t.speaker === 'Doctor' && (
                                    <div className="w-12 h-12 rounded-[1.25rem] bg-blue-600 flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-xl shadow-blue-600/20 border-2 border-white">
                                        DR
                                    </div>
                                )}
                                
                                <div className={`max-w-[70%] space-y-2 ${t.speaker === 'Doctor' ? '' : 'flex flex-col items-end'}`}>
                                    <div className="flex items-center gap-3 px-2">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${t.speaker === 'Doctor' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                            {t.speaker}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold opacity-40 font-mono">
                                            {(() => {
                                                try {
                                                    const date = t.timestamp ? new Date(t.timestamp) : new Date();
                                                    return isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                } catch {
                                                    return '--:--:--';
                                                }
                                            })()}
                                        </span>
                                    </div>

                                    <div className={`p-6 rounded-[2.5rem] text-sm font-bold leading-relaxed border shadow-sm transition-all hover:shadow-lg ${
                                        t.speaker === 'Doctor' 
                                            ? 'bg-slate-50 border-slate-100 text-slate-900 rounded-tl-none' 
                                            : 'bg-slate-900 border-slate-800 text-white rounded-tr-none'
                                    }`}>
                                        {t.text}
                                    </div>
                                </div>

                                {t.speaker !== 'Doctor' && (
                                    <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-xl shadow-emerald-500/20 border-2 border-white">
                                        PT
                                    </div>
                                )}
                            </motion.div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-40">
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ repeat: Infinity, duration: 4 }}
                                    className="w-24 h-24 rounded-[2rem] bg-slate-100 flex items-center justify-center text-slate-300"
                                >
                                    <Volume2 size={48} className="stroke-1" />
                                </motion.div>
                                <div className="text-center space-y-2">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] italic">Acoustic Monitoring Ready</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encounter atmosphere stabilized</p>
                                </div>
                            </div>
                        )}
                        <div ref={transcriptEndRef} />
                    </div>
                </div>

                {/* Sidebar: Diagnostics & Auto-Registration */}
                <div className="xl:col-span-4 space-y-10">
                    <section className="p-10 bg-white border border-slate-200 rounded-[3rem] shadow-xl space-y-10">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest flex items-center gap-3">
                                <TrendingUp size={20} className="text-blue-600" /> Flux Analysis
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400">128-bit Encryption</span>
                        </div>
                        
                        <div className="p-8 rounded-[2rem] bg-slate-900 space-y-8 relative overflow-hidden group">
                             <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                             <div className="flex justify-between items-center relative z-10">
                                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Acoustic Spectrum</span>
                                 <div className="flex items-center gap-2">
                                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                     <span className="text-[9px] font-black text-emerald-500 uppercase">Synchronized</span>
                                 </div>
                             </div>
                             
                             <div className="flex gap-1.5 h-32 items-end relative z-10 px-2">
                                 {[...Array(24)].map((_, i) => (
                                     <motion.div 
                                        key={i}
                                        animate={{ height: isRecording ? [4, 15 + Math.random() * 50, 4] : 4 }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.02 }}
                                        className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                     />
                                 ))}
                             </div>
                             
                             <div className="flex justify-center pt-2 relative z-10">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">Ambient Identity Matrix</p>
                             </div>
                        </div>
                    </section>

                    {isEmergency && (
                        <div className="animate-in slide-in-from-bottom-5 duration-700">
                             <EmergencySidebar 
                                encounterId={id!} 
                                emergencyData={emergencyData} 
                                setEmergencyData={setEmergencyData} 
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Encounter;
