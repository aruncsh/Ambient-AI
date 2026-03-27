import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Mic, Brain, ShieldCheck, 
    Heart, Waves, Zap, Activity, StopCircle, Play, FileText,
    TrendingUp, TrendingDown, AlertCircle, Sparkles
} from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer';
import ClinicalAssistant from '../components/ClinicalAssistant';
import GeneralAIChat from '../components/GeneralAIChat';

const Sparkline: React.FC<{ data: any[], color: string }> = ({ data, color }) => {
    if (!data || data.length < 2) return <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />;
    
    const min = Math.min(...data.map(d => d.value));
    const max = Math.max(...data.map(d => d.value));
    const range = max - min || 1;
    const width = 100;
    const height = 30;
    
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
};

const Encounter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [transcript, setTranscript] = useState<any[]>([]);
    const [insights, setInsights] = useState<any[]>([]);
    const [vitals, setVitals] = useState<any>(null);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [emotions, setEmotions] = useState<any[]>([]);
    const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualText, setManualText] = useState("");
    const [consentObtained, setConsentObtained] = useState(false);
    const [liveSoap, setLiveSoap] = useState<any>({
        subjective: "",
        objective: "",
        assessment: "",
        plan: ""
    });
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [transcript]);

    useEffect(() => {
        const fetchEncounter = async () => {
            if (!id) return;
            try {
                const resp = await fetch(`/api/v1/encounters/${id}`);
                const data = await resp.json();
                setConsentObtained(data.consent_obtained);
                if (data.transcript) {
                    setTranscript(data.transcript.map((t: any) => ({
                        ...t,
                        time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    })));
                }
                if (data.vitals) setVitals(data.vitals);
                if (data.emotions) setEmotions(data.emotions);
            } catch (err) {
                console.error("Failed to fetch encounter history:", err);
            }
        };
        fetchEncounter();
    }, [id]);

    const startEncounter = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: !privacyMode 
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
            
            // Connect WebSocket
            const socket = new WebSocket(`ws://${window.location.hostname}:8001/ws/${id}`);
            socketRef.current = socket;
            
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.error) {
                    alert(data.error);
                    stopEncounter();
                    return;
                }
                
                if (data.transcript) {
                    setTranscript(prev => [...prev, {
                        speaker: data.speaker,
                        text: data.transcript,
                        timestamp: data.timestamp,
                        time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
                
                if (data.soap_update && data.soap_update.section !== "none") {
                    setLiveSoap((prev: any) => ({
                        ...prev,
                        [data.soap_update.section]: data.soap_update.cleaned_text
                    }));
                }

                if (data.vitals) setVitals(data.vitals);
                if (data.emotions && data.emotions.length > 0) {
                    // Filter out duplicates and keep it clean
                    setEmotions(prev => {
                        const newEmos = [...prev];
                        data.emotions.forEach((e: any) => {
                            if (!newEmos.find(existing => existing.timestamp === e.timestamp)) {
                                newEmos.push(e);
                            }
                        });
                        return newEmos.slice(-10);
                    });
                }
                if (data.nlp_insights) {
                    setInsights(prev => [...prev, ...data.nlp_insights]);
                }
            };

            const getSupportedMimeType = () => {
                const types = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/ogg;codecs=opus',
                    'audio/mp4',
                    'audio/aac'
                ];
                for (const t of types) {
                    if (MediaRecorder.isTypeSupported(t)) return t;
                }
                return null;
            };

            const mimeType = getSupportedMimeType();
            console.log("Attempting MediaRecorder with MimeType:", mimeType);
            
            if (stream.getAudioTracks().length === 0) {
                throw new Error("No audio tracks found in stream. Please check your microphone.");
            }

            // ISOLATE AUDIO TRACK FOR AI PROCESSING
            const audioStream = new MediaStream([stream.getAudioTracks()[0]]);

            let mediaRecorder: MediaRecorder;
            try {
                mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
            } catch (e) {
                console.warn("MediaRecorder constructor failed with mimeType, falling back to default:", e);
                mediaRecorder = new MediaRecorder(audioStream);
            }
            
            mediaRecorderRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        socket.send(JSON.stringify({ type: 'audio', data: base64 }));
                    };
                    reader.readAsDataURL(e.data);
                    audioChunksRef.current.push(e.data);
                }
            };

            // Start recording in 10s slices
            const startRecording = () => {
                try {
                    console.log("Track state:", audioStream.getAudioTracks()[0]?.readyState);
                    if (mediaRecorder.state === "inactive" && audioStream.active) {
                        mediaRecorder.start(10000);
                        setIsActive(true);
                        console.log("MediaRecorder started successfully with timeslice");
                    }
                } catch (startErr: any) {
                    console.error("MediaRecorder.start(10000) failed:", startErr);
                    try {
                        if (mediaRecorder.state === "inactive") {
                            mediaRecorder.start();
                            setIsActive(true);
                            console.log("MediaRecorder started successfully (no timeslice)");
                        }
                    } catch (lastErr: any) {
                        console.error("Critical: All MediaRecorder.start() attempts failed:", lastErr);
                        throw lastErr;
                    }
                }
            };

            // Small delay to ensure stream stabilization
            setTimeout(startRecording, 500);

        } catch (err: any) {
            console.error("Critical: Could not initialize ambient capture:", err);
            alert(`Ambient Capture Error: ${err.message || 'Mic access required'}`);
            setIsActive(false);
        }
    };

    useEffect(() => {
        let interval: any;
        if (isActive && !privacyMode) {
            interval = setInterval(() => {
                if (videoRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoRef.current.videoWidth || 640;
                    canvas.height = videoRef.current.videoHeight || 480;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                        socketRef.current.send(JSON.stringify({ 
                            type: 'video', 
                            data: dataUrl.split(',')[1] 
                        }));
                    }
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isActive, privacyMode]);

    const stopEncounter = async () => {
        setIsActive(false); 
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        setIsGeneratingSoap(true);

        // Wait a brief moment to ensure the final ondataavailable event fires and websocket completes sending
        setTimeout(async () => {
            if (socketRef.current) socketRef.current.close();
            
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }

            try {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');

                await fetch(`/api/v1/encounters/${id}/stop`, {
                    method: 'POST',
                    body: formData
                });
            } catch (err) {
                console.error("Stop encounter error:", err);
            } finally {
                setIsGeneratingSoap(false);
                navigate(`/review/${id}`);
            }
        }, 1500);
    };

    const handleManualSubmit = async () => {
        if (!manualText.trim()) return;
        setIsGeneratingSoap(true);
        try {
            const resp = await fetch('/api/v1/summary/text-to-soap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: manualText, patient_id: id || "Anonymous" })
            });
            const data = await resp.json();
            if (data && data.encounter_id) {
                navigate(`/review/${data.encounter_id}`);
            }
        } catch (err) {
            console.error("Manual SOAP generation failed:", err);
        } finally {
            setIsGeneratingSoap(false);
        }
    };

    const dominantEmotion = emotions.length > 0 
        ? emotions[emotions.length - 1].emotion 
        : "Neutral";

    return (
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 space-y-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                        <ShieldCheck size={14} /> {consentObtained ? 'Consent Verified' : 'Consent Pending'}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Ambient Hub</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    {isGeneratingSoap ? (
                        <div className="flex items-center gap-3 h-14 px-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold text-white">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                            Processing Final Summary…
                        </div>
                    ) : !isActive ? (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setShowManualInput(!showManualInput)}
                                className={`btn h-14 px-8 rounded-full border transition-all font-bold flex items-center gap-2 ${
                                    showManualInput 
                                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' 
                                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                                }`}
                            >
                                <FileText size={18} /> {showManualInput ? 'Live Capture' : 'Manual Entry'}
                            </button>
                            <button 
                                onClick={startEncounter} 
                                className="btn btn-primary h-14 px-12 text-base rounded-full"
                            >
                                <Play size={18} fill="currentColor" /> Start Live Encounter
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="h-10 px-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Streaming
                            </div>
                            <button onClick={stopEncounter} className="btn btn-danger h-14 px-12 text-base rounded-full">
                                <StopCircle size={18} /> End & Summarize
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-12 gap-10">
                <div className="col-span-12 lg:col-span-7 space-y-8">
                    <div className="glass-card aspect-video border-none bg-zinc-950/20 p-0 overflow-hidden relative group">
                        {!isActive ? (
                            showManualInput ? (
                                <div className="absolute inset-0 p-8 flex flex-col space-y-6 bg-zinc-950/40">
                                    <textarea 
                                        value={manualText}
                                        onChange={(e) => setManualText(e.target.value)}
                                        placeholder="Paste transcript here for instant SOAP generation..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-8 text-white text-lg leading-relaxed focus:border-indigo-500/50 focus:ring-0 transition-all font-medium resize-none"
                                    />
                                    <button 
                                        onClick={handleManualSubmit}
                                        disabled={!manualText.trim() || isGeneratingSoap}
                                        className="btn btn-primary h-16 rounded-full w-full gap-3 text-lg"
                                    >
                                        <Zap size={20} fill="currentColor" /> Convert to Note
                                    </button>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                                    <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                        <Waves size={48} className="text-zinc-700" />
                                    </div>
                                    <p className="text-sm font-medium text-zinc-500">Waiting for encounter start...</p>
                                </div>
                            )
                        ) : privacyMode ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-xl z-20">
                                <ShieldCheck size={64} className="text-indigo-500/20 mb-4" />
                                <p className="text-white font-bold tracking-widest uppercase text-xs">Privacy Shield Active</p>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        )}
                        
                        {isActive && (
                            <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none">
                                <div className="flex flex-col gap-2">
                                    <div className="bg-zinc-950/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[10px] font-bold tracking-widest text-white uppercase">RECOGNIZING: {dominantEmotion}</span>
                                    </div>
                                </div>
                                <button onClick={() => setPrivacyMode(!privacyMode)} className="pointer-events-auto bg-zinc-950/50 backdrop-blur-md h-10 w-10 rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-all">
                                    <ShieldCheck size={18} className={privacyMode ? "text-indigo-400" : "text-zinc-500"} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { label: "Heart Rate", key: "heart_rate", icon: Heart, color: "#f43f5e", unit: "bpm" },
                            { label: "BP", key: "blood_pressure", icon: Activity, color: "#10b981", unit: "sys/dia" },
                            { label: "SpO2", key: "oxygen_saturation", icon: Zap, color: "#6366f1", unit: "%" }
                        ].map((v) => (
                            <div key={v.key} className="glass-card p-6 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <v.icon size={18} style={{ color: v.color }} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">{v.label}</div>
                                            <div className="text-2xl font-bold text-white tabular-nums">
                                                {vitals?.[v.key]?.value || "--"}
                                                <span className="text-xs font-normal text-zinc-500 ml-1">{v.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {vitals?.[v.key]?.trend?.length > 1 && (
                                        <div className="h-8 w-16">
                                            <Sparkline data={vitals[v.key].trend} color={v.color} />
                                        </div>
                                    )}
                                </div>
                                {vitals?.[v.key]?.value && !isNaN(parseFloat(vitals[v.key].value)) && (
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-zinc-600">
                                        {vitals?.[v.key]?.trend?.[vitals[v.key].trend.length - 1]?.value > vitals?.[v.key]?.trend?.[vitals[v.key].trend.length - 2]?.value 
                                            ? <TrendingUp size={12} className="text-emerald-500" />
                                            : <TrendingDown size={12} className="text-rose-500" />
                                        }
                                        {v.label} Trend
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-5 flex flex-col gap-8">
                    <ClinicalAssistant transcript={transcript} isActive={isActive} insights={insights} />

                    <div className="glass-card bg-zinc-950/40 border-indigo-500/10 h-[300px] flex flex-col">
                        <div className="p-4 border-b border-white/5 flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-400" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Note Preview</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                            {Object.entries(liveSoap).map(([section, text]: [string, any]) => (
                                text && (
                                    <div key={section} className="space-y-1">
                                        <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500/50">{section}</div>
                                        <div className="text-xs text-zinc-300 bg-white/5 p-2 rounded-lg border border-white/5 whitespace-pre-wrap">
                                            {text}
                                        </div>
                                    </div>
                                )
                            ))}
                            {!Object.values(liveSoap).some(v => v) && (
                                <div className="h-full flex flex-col items-center justify-center opacity-20">
                                    <FileText size={24} />
                                    <p className="text-[10px] font-bold mt-2">BUILDING NOTE...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card flex-1 bg-zinc-950/40 p-0 flex flex-col overflow-hidden border-indigo-500/10">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ambient Dialogue</h4>
                            <div className="w-1/3"><AudioVisualizer isActive={isActive} /></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                            <AnimatePresence initial={false}>
                                {transcript.length === 0 && (
                                    <div key="empty-transcript" className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-4">
                                        <Mic size={32} className="opacity-20" />
                                        <p className="text-xs font-medium italic">Begin speaking to start transcription...</p>
                                    </div>
                                )}
                                {transcript.map((t, i) => (
                                    <motion.div 
                                        key={`msg-${t.timestamp || i}`} 
                                        initial={{ opacity: 0, y: 10 }} 
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex flex-col ${t.speaker === 'Clinician' ? 'items-start' : 'items-end'}`}
                                    >
                                        <div className={`max-w-[90%] p-4 rounded-2xl relative group transition-all ${
                                            t.speaker === 'Clinician' 
                                            ? 'bg-indigo-500/5 border border-indigo-500/10 rounded-tl-none' 
                                            : 'bg-emerald-500/5 border border-emerald-500/10 rounded-tr-none'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${
                                                    t.speaker === 'Clinician' ? 'text-indigo-400' : 'text-emerald-400'
                                                }`}>
                                                    {t.speaker}
                                                </span>
                                                <span className="text-[8px] font-medium text-zinc-600 tabular-nums">{t.time}</span>
                                            </div>
                                            <p className="text-[13px] text-zinc-300 leading-relaxed font-medium">
                                                {t.text}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={transcriptEndRef} />
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            <GeneralAIChat />
        </div>
    );
};

export default Encounter;
