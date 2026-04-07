import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    Video, PhoneOff, MessageSquare, 
    User, Activity, Shield,
    Clock, Brain, Info, Share2, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { consultService } from '../services/consultService';

const Teleconsult = () => {
    const { id, token: urlToken } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const token = urlToken || query.get('token');

    const [consult, setConsult] = useState<any>(null);
    const [participantInfo, setParticipantInfo] = useState<any>(null);
    const [appointment, setAppointment] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(0);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const initializeConsult = async () => {
            try {
                if (token) {
                    const data = await consultService.validateToken(token);
                    if (data.consult) {
                        setConsult(data.consult);
                        setParticipantInfo(data.info);
                        const localId = data.consult.additional_info?.appointment_id || data.consult.additional_info?.local_appointment_id;
                        if (localId) {
                            try {
                                const appt = await api.getAppointment(localId);
                                setAppointment(appt);
                            } catch (e) {}
                        }
                        
                        // Initial summary fetch
                        try {
                            const summaryData = await consultService.getSummary(token);
                            setSummary(summaryData);
                        } catch (e) {}

                        // Notify backend that we are starting/joining
                        if (data.consult.id && data.info?.role && data.info?.id) {
                             await consultService.startConsult(data.consult.id, data.info.role, data.info.id);
                        }
                    }
                } else if (id && id !== 'undefined') {
                    const appt = await api.getAppointment(id);
                    setAppointment(appt);
                }
                setLoading(false);
            } catch (err) {
                console.error("Consult initialization failed", err);
                setLoading(false);
            }
        };

        initializeConsult();
        
        // Polling for summary updates (SOAP notes being generated in background)
        let summaryPoller: any;
        if (token) {
             summaryPoller = setInterval(async () => {
                 try {
                     const summaryData = await consultService.getSummary(token);
                     setSummary(summaryData);
                 } catch (e) {}
             }, 15000); 
        }

        const timer = setInterval(() => setTime(prev => prev + 1), 1000);
        return () => {
            clearInterval(timer);
            if (summaryPoller) clearInterval(summaryPoller);
        };
    }, [id, token]);

    const getConsultUrl = () => {
        if (token) {
            // Priority 1: External microservice direct token link
            return `https://services-api.a2zhealth.in/consult/${token}`;
        }
        
        // Priority 2: Link returned from microservice during creation
        const link = appointment?.teleconsult_link || consult?.additional_info?.consult_link;
        if (link) {
            // Generalize checks for known providers
            if (link.includes('opentok') || link.includes('tokbox') || link.includes('jit.si') || link.includes('a2zhealth.in')) {
                const extId = consult?.additional_info?.external_id || consult?.id;
                if (extId && !link.includes('/consult/')) return `https://services-api.a2zhealth.in/consult/${extId}`;
                return link;
            }
            if (link.startsWith('/consult/')) {
                return `https://services-api.a2zhealth.in${link}`;
            }
            return link;
        }

        // Priority 3: Fallback to ID-based microservice link
        const consultId = consult?.id || appointment?.additional_info?.external_id;
        if (consultId) {
            return `https://services-api.a2zhealth.in/consult/${consultId}`;
        }

        return null;
    };

    const handleShare = () => {
        const urlId = consult?.id || appointment?.additional_info?.external_id || id;
        const shareUrl = `${window.location.origin}/consult/${urlId}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const consultUrl = getConsultUrl();

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndCall = async () => {
        if (window.confirm("End this clinical teleconsultation? Final SOAP note will be generated.")) {
            if (consult?.id && participantInfo) {
                await consultService.endConsult(consult.id, participantInfo.role, participantInfo.id, "Session terminated by provider.");
            }
            if (appointment?.id) {
                await api.updateAppointment(appointment.id, 'completed');
            }
            navigate('/scheduling');
        }
    };

    if (loading) return (
        <div className="h-[80vh] flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="font-black text-slate-400 uppercase tracking-[.3em] animate-pulse">Initializing Secure Clinical Uplink...</div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <Video size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Tele-Health Hub</h1>
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Shield size={10} /> Clinical Grade Encryption
                            </span>
                        </div>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1 italic flex items-center gap-2">
                            Patient: <span className="text-slate-900">{consult?.additional_info?.name || appointment?.patient_name || "Anonymous Patient"}</span>
                            {summary?.["1_profile"] && (
                                <>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-500">{summary["1_profile"].gender}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-500">{summary["1_profile"].dob ? `${new Date().getFullYear() - new Date(summary["1_profile"].dob).getFullYear()}Y` : ""}</span>
                                </>
                            )}
                            <span className="text-slate-300">|</span>
                            Status: <span className="text-emerald-600">{consult?.status || "Live Video Linked"}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button 
                        onClick={handleShare}
                        className={`h-14 px-6 rounded-2xl border transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${copied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
                    >
                        {copied ? <Check size={16} /> : <Share2 size={16} />} 
                        {copied ? 'Copied Link' : 'Share Session'}
                    </button>
                    <div className="text-right border-r border-slate-100 pr-6">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Timer</div>
                        <div className="text-xl font-black text-slate-900 tabular-nums">{formatDuration(time)}</div>
                    </div>
                    <button 
                        onClick={handleEndCall}
                        className="h-14 px-8 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm uppercase tracking-tighter transition-all flex items-center gap-3 shadow-lg shadow-rose-500/20"
                    >
                        <PhoneOff size={20} /> Terminate
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
                <div className="col-span-12 lg:col-span-8 bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden relative group">
                    {consultUrl ? (
                         <iframe 
                            src={consultUrl}
                            className="w-full h-full border-none"
                            allow="camera; microphone; display-capture; fullscreen; autoplay"
                         />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                             <div className="text-center space-y-4">
                                <Activity className="text-blue-600 mx-auto animate-pulse" size={48} />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Awaiting Microservice Uplink...</p>
                             </div>
                        </div>
                    )}
                </div>

                <aside className="col-span-12 lg:col-span-4 space-y-8 flex flex-col min-h-0">
                    <div className="flex-1 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2 uppercase tracking-widest">
                                <Brain size={16} className="text-blue-600" /> Ambient Clinical Intel
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Live Sync</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                            <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100/50 relative overflow-hidden group hover:bg-blue-50 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Info size={40} className="text-blue-600" />
                                </div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Diagnostic Context</p>
                                <p className="text-sm font-bold text-slate-800 leading-relaxed italic">
                                    {summary?.["3_health"]?.["chief_complaint"] || appointment?.reason || "Awaiting live clinical findings..."}
                                </p>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Activity size={12} className="text-rose-500" /> Vital Statistics
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100/50">
                                         <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Heart Rate</div>
                                         <div className="text-lg font-black text-slate-800 tracking-tighter">
                                             {summary?.["2_vital"]?.heart_rate?.value || "--"}<span className="text-[10px] ml-1">BPM</span>
                                         </div>
                                     </div>
                                     <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100/50">
                                         <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Blood Pressure</div>
                                         <div className="text-lg font-black text-slate-800 tracking-tighter">
                                             {summary?.["2_vital"]?.blood_pressure?.value || "--/--"}<span className="text-[10px] ml-1">SYS/DIA</span>
                                         </div>
                                     </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={12} /> Clinical Points
                                </h4>
                                <div className="space-y-4">
                                    {summary?.["3_health"]?.history_of_present_illness ? (
                                        <div className="flex gap-4 items-start">
                                            <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Live</div>
                                            <p className="text-xs font-bold text-slate-600 leading-tight">Patient describing: {summary["3_health"].history_of_present_illness.substring(0, 80)}...</p>
                                        </div>
                                    ) : (
                                        appointment?.additional_info?.participants ? (
                                            appointment.additional_info.participants.map((p: any, i: number) => (
                                                <div key={i} className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                                    <div className="flex justify-between items-center">
                                                        <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{p.role}</div>
                                                        <div className="text-[9px] font-bold text-slate-400">ID: {p.id}</div>
                                                    </div>
                                                    <div className="text-[10px] font-medium text-slate-600 truncate">Token: {p.token}</div>
                                                </div>
                                            ))
                                        ) : (
                                            [
                                                { time: '02:15', text: 'Chief complaint documented' },
                                                { time: '05:40', text: 'HPI discussed' },
                                            ].map((event, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{event.time}</div>
                                                    <p className="text-xs font-bold text-slate-600 leading-tight">{event.text}</p>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                             <button className="w-full h-16 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-[.2em] hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-3 shadow-sm">
                                <MessageSquare size={16} /> Clinical Collaboration
                             </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full translate-x-12 -translate-y-12" />
                        <div className="flex items-center gap-3 mb-4">
                            <Activity size={20} className="text-blue-500" />
                            <h4 className="text-xs font-black uppercase tracking-[.2em]">Real-time SOAP</h4>
                        </div>
                        <p className="text-slate-400 font-medium text-[10px] leading-relaxed uppercase tracking-widest">
                            Ambient AI is distilling the encounter into structured documentation in real-time.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Teleconsult;
