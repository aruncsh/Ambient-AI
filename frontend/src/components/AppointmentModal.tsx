import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, ShieldCheck, Mic, Search } from 'lucide-react';
import { api } from '../lib/api';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: string;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ isOpen, onClose, onSuccess, initialType = 'In-person' }) => {
  const [newAppt, setNewAppt] = useState({
    patient_name: '',
    patient_id: '',
    clinician_id: '',
    clinician_name: '',
    start_time: '',
    reason: '',
    type: initialType
  });

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [showPatientList, setShowPatientList] = useState(false);
  const [showDoctorList, setShowDoctorList] = useState(false);
  const patientListRef = useRef<HTMLDivElement>(null);
  const doctorListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patientListRef.current && !patientListRef.current.contains(event.target as Node)) {
        setShowPatientList(false);
      }
      if (doctorListRef.current && !doctorListRef.current.contains(event.target as Node)) {
        setShowDoctorList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pData, dData] = await Promise.all([
          api.getPatients(),
          api.getDoctors()
        ]);
        setPatients(Array.isArray(pData) ? pData : []);
        setDoctors(Array.isArray(dData) ? dData : []);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch patients/doctors", err);
        setLoading(false);
      }
    };
    if (isOpen) fetchData();
  }, [isOpen]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p._id.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    (d.specialization && d.specialization.toLowerCase().includes(doctorSearch.toLowerCase()))
  );

  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    // @ts-ignore
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript.toLowerCase();
      console.log("Voice Command:", text);

      // Simple Natural Language Processing
      if (text.includes("patient") || text.includes("name")) {
        const name = text.split(/patient|name|is/).pop()?.trim();
        if (name) setNewAppt(prev => ({ ...prev, patient_name: name }));
      }
      if (text.includes("reason") || text.includes("for")) {
        const reason = text.split(/reason|for|complaint/).pop()?.trim();
        if (reason) setNewAppt(prev => ({ ...prev, reason: reason }));
      }
      if (text.includes("virtual") || text.includes("video") || text.includes("remote")) {
        setNewAppt(prev => ({ ...prev, type: "Virtual" }));
      }
      if (text.includes("person") || text.includes("physical")) {
        setNewAppt(prev => ({ ...prev, type: "In-person" }));
      }
      if (text.includes("urgent") || text.includes("emergency")) {
        setNewAppt(prev => ({ ...prev, type: "Urgent" }));
      }
    };

    recognition.start();
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const start = new Date(newAppt.start_time);
      const end = new Date(start.getTime() + 45 * 60000);
      const payload = {
        ...newAppt,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled'
      };
      await api.createAppointment(payload);
      onSuccess();
      onClose();
      setNewAppt({ 
        patient_name: '', 
        patient_id: '', 
        clinician_id: '',
        clinician_name: '',
        start_time: '', 
        reason: '', 
        type: initialType 
      });
    } catch (err) {
      console.error("Failed to book appointment", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="bg-white rounded-[4rem] w-full max-w-2xl p-16 shadow-2xl border border-slate-200 relative overflow-hidden text-slate-900"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
            <div className="flex justify-between items-center mb-12 relative z-10">
              <div className="space-y-1">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Book Encounter</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Scheduling Request</p>
              </div>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={startVoiceInput}
                  className={`w-14 h-14 rounded-2xl transition-all flex items-center justify-center border ${isListening ? 'bg-rose-500 text-white animate-pulse border-rose-500 shadow-lg shadow-rose-500/20' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                  title="Voice Assistant"
                >
                  <Mic size={24} />
                </button>
                <button onClick={onClose} className="w-14 h-14 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center text-slate-400 hover:text-slate-900 border border-slate-100">
                  <X size={28} />
                </button>
              </div>
            </div>

            <form onSubmit={handleBook} className="space-y-10">
              <div className="grid grid-cols-2 gap-8 relative">
                <div className="space-y-3 relative" ref={patientListRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Clinical Identity</label>
                  <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-6 gap-4 shadow-inner relative group focus-within:border-blue-600/30 transition-all">
                    <Users className="text-blue-600" size={20} />
                    <input 
                      required
                      placeholder="Search Patient..."
                      className="flex-1 bg-transparent border-none text-slate-900 font-bold text-lg outline-none placeholder:text-slate-200"
                      value={newAppt.patient_name || patientSearch}
                      onFocus={() => {
                        setShowPatientList(true);
                        setShowDoctorList(false);
                      }}
                      onChange={e => {
                        setPatientSearch(e.target.value);
                        setNewAppt({...newAppt, patient_name: '', patient_id: ''});
                        setShowPatientList(true);
                      }}
                    />
                    <Search size={16} className="text-slate-300" />
                  </div>
                  {showPatientList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl max-h-60 overflow-y-auto p-2 space-y-1">
                      {filteredPatients.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No patients found</div>
                      ) : (
                        filteredPatients.map(p => (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => {
                              setNewAppt({...newAppt, patient_id: p._id, patient_name: p.name});
                              setPatientSearch(p.name);
                              setShowPatientList(false);
                            }}
                            className="w-full p-4 text-left rounded-2xl hover:bg-blue-50 transition-all group"
                          >
                            <div className="font-black text-slate-900 uppercase italic tracking-tighter text-sm group-hover:text-blue-600">{p.name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p._id}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 relative" ref={doctorListRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Clinician</label>
                  <div className="h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-6 gap-4 shadow-inner relative group focus-within:border-blue-600/30 transition-all">
                    <ShieldCheck className="text-blue-600" size={20} />
                    <input 
                      required
                      placeholder="Search Doctor..."
                      className="flex-1 bg-transparent border-none text-slate-900 font-bold text-lg outline-none placeholder:text-slate-200"
                      value={newAppt.clinician_name || doctorSearch}
                      onFocus={() => {
                        setShowDoctorList(true);
                        setShowPatientList(false);
                      }}
                      onChange={e => {
                        setDoctorSearch(e.target.value);
                        setNewAppt({...newAppt, clinician_id: '', clinician_name: ''});
                        setShowDoctorList(true);
                      }}
                    />
                    <Search size={16} className="text-slate-300" />
                  </div>
                  {showDoctorList && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-3xl shadow-2xl max-h-60 overflow-y-auto p-2 space-y-1">
                      {filteredDoctors.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No clinicians found</div>
                      ) : (
                        filteredDoctors.map(d => (
                          <button
                            key={d._id}
                            type="button"
                            onClick={() => {
                              setNewAppt({...newAppt, clinician_id: d._id, clinician_name: d.name});
                              setDoctorSearch(d.name);
                              setShowDoctorList(false);
                            }}
                            className="w-full p-4 text-left rounded-2xl hover:bg-blue-50 transition-all group"
                          >
                            <div className="font-black text-slate-900 uppercase italic tracking-tighter text-sm group-hover:text-blue-600">{d.name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{d.specialization || 'Clinical Staff'}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consult Type</label>
                  <select 
                    className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 outline-none text-slate-900 font-bold text-lg shadow-inner appearance-none"
                    value={newAppt.type}
                    onChange={e => setNewAppt({...newAppt, type: e.target.value})}
                  >
                    <option value="In-person">In-person</option>
                    <option value="Virtual">Virtual</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proposed Sync Time</label>
                  <input 
                    required
                    type="datetime-local"
                    className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 outline-none text-slate-900 font-bold text-lg shadow-inner"
                    value={newAppt.start_time}
                    onChange={e => setNewAppt({...newAppt, start_time: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visit Justification</label>
                 <input 
                   className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 outline-none text-slate-900 font-bold text-lg shadow-inner placeholder:text-slate-200"
                   placeholder="Chief Complaint / Reason..."
                   value={newAppt.reason}
                   onChange={e => setNewAppt({...newAppt, reason: e.target.value})}
                 />
              </div>

              <button type="submit" className="w-full h-20 rounded-[2.5rem] bg-slate-900 hover:bg-blue-600 text-white font-black text-2xl uppercase tracking-tighter shadow-2xl shadow-slate-900/10 transition-all flex items-center justify-center gap-4">
                <ShieldCheck size={28} /> Authorized Booking
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AppointmentModal;
