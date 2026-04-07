import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    UserPlus, Users as UsersIcon, Stethoscope, Mail, Phone, Calendar, 
    MapPin, Hash, Briefcase, Plus, Activity, RefreshCw, Loader2,
    ShieldCheck, Search, Filter, ChevronRight, X, UserCheck, Mic
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const Users = () => {
  const navigate = useNavigate();
  const activeTabRef = useRef<'patients' | 'doctors'>('patients');
  const [activeTab, setActiveTabBase] = useState<'patients' | 'doctors'>('patients');
  const setActiveTab = (tab: 'patients' | 'doctors') => {
    activeTabRef.current = tab;
    setActiveTabBase(tab);
  };
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  
  const [patientForm, setPatientForm] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'Other',
    blood_group: '',
    address: '',
    medical_history: '',
    allergies: '',
    is_active: true
  });

  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    license_number: '',
    experience_years: '' as string | number,
    department: '',
    is_active: true
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [patientsData, doctorsData] = await Promise.all([
        api.getPatients(),
        api.getDoctors()
      ]);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("Users module initialized. Speech API Status:", {
      SpeechRecognition: 'SpeechRecognition' in window,
      webkitSpeechRecognition: 'webkitSpeechRecognition' in window
    });
    fetchData();
  }, []);

  useEffect(() => {
    if (showAddForm && autoStartVoice) {
      // Small delay to ensure the form is rendered and recognition can start
      const timer = setTimeout(() => {
        startVoiceInput();
        setAutoStartVoice(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showAddForm, autoStartVoice]);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const lastExtractionRef = useRef<number>(0);
  const extractionTimerRef = useRef<any>(null);

  const startVoiceInput = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // If we are already listening, the user wants to STOP manually and process the form
    if (isListening) {
      console.log("Voice Assist: Manual stop requested. Text:", transcriptRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    if (isProcessing) {
      console.warn("Voice Assist: Still processing, please wait.");
      return;
    }

    const Win = window as any;
    const Recognition = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    
    if (!Recognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    try {
      console.log("Voice Assist: Starting continuous session...");
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      transcriptRef.current = ''; // Clear previous transcript
      
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true; // Set to true to see live progress if needed
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        console.log("Voice Assist: Listening started. Speak multiple sentences...");
      };

      recognition.onerror = (event: any) => {
        console.error("Voice Assist Error", event.error);
        setIsListening(false);
      };

      recognition.onend = async () => {
        setIsListening(false);
        const finalText = transcriptRef.current.trim();
        
        if (!finalText) {
          console.warn("Voice Assist: No transcript found on stop.");
          return;
        }

        console.log("Voice Assist: Final processing for:", finalText);
        setIsProcessing(true);
        try {
          const data = await api.extractDemographics(finalText);
          
          if (activeTabRef.current === 'patients') {
            setPatientForm(prev => ({
              ...prev,
              name: data.name || prev.name,
              email: data.email || prev.email,
              phone: data.phone || prev.phone,
              blood_group: data.blood_group || prev.blood_group,
              address: data.address || prev.address,
              gender: data.gender || prev.gender,
              medical_history: Array.isArray(data.medical_history) ? data.medical_history.join(', ') : data.medical_history || prev.medical_history,
              allergies: Array.isArray(data.allergies) ? data.allergies.join(', ') : data.allergies || prev.allergies,
              date_of_birth: data.date_of_birth && !data.date_of_birth.includes("Approx") 
                ? data.date_of_birth 
                : data.age 
                  ? `${new Date().getFullYear() - data.age}-01-01`
                  : prev.date_of_birth
            }));
          } else {
            setDoctorForm(prev => ({
              ...prev,
              name: data.name || prev.name,
              email: data.email || prev.email,
              phone: data.phone || prev.phone,
              specialization: data.specialization || prev.specialization,
              department: data.department || prev.department,
              license_number: data.license_number || prev.license_number,
              experience_years: data.experience_years || (data.age ? (data.age - 25 > 0 ? data.age - 25 : 5) : prev.experience_years)
            }));
          }
        } catch (err) {
          console.error("Voice Assist Extraction failed", err);
        } finally {
          setIsProcessing(false);
        }
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        transcriptRef.current = currentTranscript;
        console.log("Voice Assist Live Transcript:", currentTranscript);

        // LIVE EXTRACTION: Ultra-fast 150ms throttle for real-time responsiveness
        if (!extractionTimerRef.current && currentTranscript.length - lastExtractionRef.current > 2) {
          extractionTimerRef.current = setTimeout(async () => {
             try {
                const text = transcriptRef.current;
                // Use fast mode (Rule-based only) for instant live feedback
                const data = await api.extractDemographics(text, true);
                lastExtractionRef.current = text.length;

                // Sync forms live via Ref to avoid stale closures
                if (activeTabRef.current === 'patients') {
                  setPatientForm(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    email: data.email || prev.email,
                    phone: data.phone || prev.phone,
                    blood_group: data.blood_group || prev.blood_group,
                    address: data.address || prev.address,
                    gender: data.gender || prev.gender,
                    medical_history: Array.isArray(data.medical_history) ? data.medical_history.join(', ') : data.medical_history || prev.medical_history,
                    allergies: Array.isArray(data.allergies) ? data.allergies.join(', ') : data.allergies || prev.allergies,
                    date_of_birth: data.date_of_birth && !data.date_of_birth.includes("Approx") ? data.date_of_birth : prev.date_of_birth
                  }));
                } else {
                  setDoctorForm(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    email: data.email || prev.email,
                    phone: data.phone || prev.phone,
                    specialization: data.specialization || prev.specialization,
                    department: data.department || prev.department,
                    license_number: data.license_number || prev.license_number,
                    experience_years: data.experience_years || prev.experience_years
                  }));
                }
             } finally {
                extractionTimerRef.current = null;
             }
          }, 150);
        }
      };

      recognition.start();
    } catch (err) {
      console.error("Voice Assist Startup Error", err);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...patientForm,
        medical_history: patientForm.medical_history.split(',').map(s => s.trim()).filter(Boolean),
        allergies: patientForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
      };
      
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      await api.createPatient(cleanedData);
      setPatientForm({ name: '', email: '', phone: '', date_of_birth: '', gender: 'Other', blood_group: '', address: '', medical_history: '', allergies: '', is_active: true });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to add patient. Please check all fields.");
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedData = {
        ...doctorForm,
        experience_years: parseInt(doctorForm.experience_years.toString()) || 0
      };
      
      const cleanedData = Object.fromEntries(
        Object.entries(formattedData).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      await api.createDoctor(cleanedData);
      setDoctorForm({ name: '', email: '', phone: '', specialization: '', license_number: '', experience_years: '', department: '', is_active: true });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to add doctor. Please ensure a valid email is provided.");
    }
  };
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(
        Object.entries(editForm).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      if (activeTab === 'patients') {
        await api.updatePatient(editingUser.id || editingUser._id, data);
      } else {
        await api.updateDoctor(editingUser.id || editingUser._id, data);
      }
      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to update record.");
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Users</h1>
          <p className="text-slate-500 font-medium tracking-tight">Manage clinical staff and patient records.</p>
        </div>

        <div className="flex gap-3">
          {!showAddForm && (
            <button 
              onClick={() => {
                setShowAddForm(true);
                setAutoStartVoice(true);
              }}
              className="h-12 px-6 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-sm"
            >
              <Mic size={18} /> Voice Assist
            </button>
          )}
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`h-12 px-8 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-md ${showAddForm ? 'bg-slate-100 text-slate-400 hover:bg-slate-200 shadow-none' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-900/10'}`}
          >
            {showAddForm ? <X size={20} /> : activeTab === 'patients' ? <><UserPlus size={20} /> Register Patient</> : <><Stethoscope size={20} /> Register Staff</>}
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-50 p-1.5 rounded-[2rem] border border-slate-100 w-full md:w-fit">
          <button 
            onClick={() => setActiveTab('patients')}
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'patients' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Patients
          </button>
          <button 
            onClick={() => setActiveTab('doctors')}
            className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'doctors' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Clinical Staff
          </button>
        </div>

        <div className="relative w-full md:w-96 group">
          <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'patients' ? 'Patients' : 'Staff'} by name, email, or dept...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-16 bg-white border border-slate-200 rounded-[2rem] pl-16 pr-8 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:border-blue-600/50 focus:ring-4 focus:ring-blue-600/5 transition-all outline-none shadow-sm"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.section 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-slate-200 rounded-[4rem] p-16 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full translate-x-12 -translate-y-12" />
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                 {activeTab === 'patients' ? <UserPlus className="text-blue-600" size={20} /> : <Stethoscope className="text-blue-600" size={20} />}
                 Registration Form
              </h3>
              <button 
                id="voice-assist-btn"
                type="button"
                onClick={(e) => startVoiceInput(e)}
                disabled={isProcessing}
                className={`relative z-[100] flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : isProcessing ? 'bg-amber-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <Mic size={16} />}
                {isListening ? 'Stop & Process' : isProcessing ? 'Processing...' : 'Voice Assist'}
              </button>
            </div>

            {isListening ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-8 bg-blue-50/50 border border-blue-100 rounded-[3rem] shadow-inner flex flex-col gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5 h-8 items-center">
                     <motion.div animate={{ height: [12, 24, 12] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 bg-blue-500 rounded-full" />
                     <motion.div animate={{ height: [8, 32, 8] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }} className="w-1.5 bg-blue-400 rounded-full" />
                     <motion.div animate={{ height: [16, 28, 16] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 bg-blue-600 rounded-full" />
                     <motion.div animate={{ height: [10, 20, 10] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} className="w-1.5 bg-blue-400 rounded-full" />
                     <motion.div animate={{ height: [12, 16, 12] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 bg-blue-500 rounded-full" />
                  </div>
                  <p className="text-blue-600 font-bold text-lg italic tracking-tight truncate flex-1 leading-relaxed">
                    {transcriptRef.current ? `"${transcriptRef.current}"` : "Listening... Tell me the details."}
                  </p>
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] bg-white px-4 py-2 rounded-full shadow-sm border border-blue-50">Deep Neural Capture</span>
                </div>
                {!transcriptRef.current && (
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest pl-1">
                    {activeTab === 'patients' 
                      ? "Try: 'My name is John Doe, born Jan 1st 1990, I have Hypertension and allergic to Ibuprofen...'"
                      : "Try: 'I am Dr. Sarah Smith, Cardio lead with 12 years of experience. License MED9876...'"
                    }
                  </p>
                )}
              </motion.div>
            ) : !isListening && !isProcessing && (
              <div className="mb-8 px-8 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all cursor-pointer" onClick={() => startVoiceInput()}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Mic size={14} />
                  </div>
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Tip: Click Voice Assist to fill this form instantly by speaking.</span>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
            )}
            
            <form onSubmit={activeTab === 'patients' ? handleAddPatient : handleAddDoctor} className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {activeTab === 'patients' ? (
                <>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                    <input type="text" required placeholder="Authenticated Name..." className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" value={patientForm.name} onChange={(e) => setPatientForm({...patientForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Email</label>
                    <input type="email" placeholder="patient@nexus.med..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.email ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.email} onChange={(e) => setPatientForm({...patientForm, email: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Nexus</label>
                    <input type="tel" placeholder="+91..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.phone ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.phone} onChange={(e) => setPatientForm({...patientForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Entry (DOB)</label>
                    <input type="date" className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.date_of_birth ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.date_of_birth} onChange={(e) => setPatientForm({...patientForm, date_of_birth: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Biological Identity</label>
                    <select className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner appearance-none ${patientForm.gender !== 'Other' ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.gender} onChange={(e) => setPatientForm({...patientForm, gender: e.target.value})}>
                      <option value="Male">Male Identification</option>
                      <option value="Female">Female Identification</option>
                      <option value="Other">Non-binary / Other</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hematic Group</label>
                    <input type="text" placeholder="O+, AB-..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.blood_group ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.blood_group} onChange={(e) => setPatientForm({...patientForm, blood_group: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                    <select className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner appearance-none" value={patientForm.is_active ? 'active' : 'inactive'} onChange={(e) => setPatientForm({...patientForm, is_active: e.target.value === 'active'})}>
                      <option value="active">Active Registered</option>
                      <option value="inactive">Suspended / Inactive</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Residence</label>
                    <textarea placeholder="Validated Address..." className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner resize-none" value={patientForm.address} onChange={(e) => setPatientForm({...patientForm, address: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical Background</label>
                    <input type="text" placeholder="Hypertension, Asthma..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.medical_history ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.medical_history} onChange={(e) => setPatientForm({...patientForm, medical_history: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Known Allergies</label>
                    <input type="text" placeholder="Penicillin, Peanuts..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${patientForm.allergies ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={patientForm.allergies} onChange={(e) => setPatientForm({...patientForm, allergies: e.target.value})} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Practitioner Name</label>
                    <input type="text" required placeholder="Dr. Identity..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.name ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.name} onChange={(e) => setDoctorForm({...doctorForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorized Email</label>
                    <input type="email" required placeholder="dr.smith@nexus.med..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.email ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.email} onChange={(e) => setDoctorForm({...doctorForm, email: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Contact</label>
                    <input type="tel" placeholder="+91..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.phone ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.phone} onChange={(e) => setDoctorForm({...doctorForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Core Specialization</label>
                    <input type="text" placeholder="Cardiology, Neuro..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.specialization ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.specialization} onChange={(e) => setDoctorForm({...doctorForm, specialization: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Experience (Years)</label>
                    <input type="number" placeholder="Years of Service..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.experience_years ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.experience_years} onChange={(e) => setDoctorForm({...doctorForm, experience_years: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Neural Department</label>
                    <input type="text" placeholder="Emergency, ICU..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.department ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.department} onChange={(e) => setDoctorForm({...doctorForm, department: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Board License ID</label>
                    <input type="text" placeholder="REGXXXXX..." className={`w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold transition-all shadow-inner ${doctorForm.license_number ? 'border-blue-200 bg-blue-50/20' : 'focus:border-blue-600/50'}`} value={doctorForm.license_number} onChange={(e) => setDoctorForm({...doctorForm, license_number: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                    <select className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner appearance-none" value={doctorForm.is_active ? 'active' : 'inactive'} onChange={(e) => setDoctorForm({...doctorForm, is_active: e.target.value === 'active'})}>
                      <option value="active">Active System Access</option>
                      <option value="inactive">Restricted / Inactive</option>
                    </select>
                  </div>
                </>
              )}
              <div className="md:col-span-2 flex justify-end pt-10">
                <button type="submit" className="h-20 px-16 rounded-[2.5rem] bg-slate-900 text-white text-2xl font-black uppercase tracking-tighter shadow-2xl shadow-slate-900/10 hover:bg-blue-600 transition-all flex items-center gap-4">
                  <ShieldCheck size={28} /> Authorized Entry
                </button>
              </div>
            </form>
          </motion.section>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            {loading ? (
               <div className="py-32 text-center">
                  <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nexus Registry Sync...</span>
               </div>
            ) : (activeTab === 'patients' ? patients : doctors).filter(u => {
                const query = searchQuery.toLowerCase();
                return u.name?.toLowerCase().includes(query) || 
                       u.email?.toLowerCase().includes(query) || 
                       u.phone?.toLowerCase().includes(query) ||
                       (activeTab === 'doctors' && (u.specialization?.toLowerCase().includes(query) || u.department?.toLowerCase().includes(query)));
            }).length === 0 ? (
                <div className="py-32 text-center text-slate-200 font-black italic text-4xl uppercase tracking-[0.2em] opacity-30">Zero Records Found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(activeTab === 'patients' ? patients : doctors).filter(u => {
                    const query = searchQuery.toLowerCase();
                    return u.name?.toLowerCase().includes(query) || 
                           u.email?.toLowerCase().includes(query) || 
                           u.phone?.toLowerCase().includes(query) ||
                           (activeTab === 'doctors' && (u.specialization?.toLowerCase().includes(query) || u.department?.toLowerCase().includes(query)));
                }).map((user, i) => (
                  <motion.div 
                    key={user.id || user._id || i}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white border border-slate-200 rounded-[3.5rem] p-10 hover:shadow-xl hover:shadow-blue-600/5 hover:border-blue-600/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-12 transition-all">
                        {activeTab === 'patients' ? <UsersIcon size={28} /> : <Stethoscope size={28} />}
                      </div>
                      <div className={`h-8 px-4 rounded-full text-[8px] font-black uppercase tracking-[0.2em] flex items-center shadow-inner ${user.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {user.is_active ? 'Active' : 'Inactive'} {activeTab === 'patients' ? 'Patient' : 'Staff'}
                      </div>
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter line-clamp-1">{user.name}</h4>
                    <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest mt-2">
                       {activeTab === 'doctors' ? user.specialization || 'Clinical Lead' : user.date_of_birth ? `Born ${new Date(user.date_of_birth).toLocaleDateString()}` : 'Master Identity'}
                    </p>
                    
                    <div className="space-y-4 mt-8 pt-8 border-t border-slate-50">
                        <div className="flex items-center gap-4 text-slate-500 font-medium text-xs">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-blue-600/30"><Mail size={16} /></div>
                          <span className="truncate">{user.email || 'Restricted Access'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 font-medium text-xs">
                           <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-blue-600/30"><Phone size={16} /></div>
                           <span>{user.phone || 'Null Nexus'}</span>
                        </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (activeTab === 'patients') {
                            if (!user.is_active) {
                                alert("Cannot start session for inactive patient.");
                                return;
                            }
                            navigate('/consent', { state: { patientId: user.id || user._id, patientName: user.name } });
                        } else {
                            setEditingUser(user);
                            setEditForm(user);
                        }
                      }}
                      className={`w-full mt-8 h-12 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white`}
                    >
                        {activeTab === 'patients' ? 'Start Clinical Session' : 'View Staff Profile'} <ChevronRight size={14} className="inline ml-2" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[4rem] p-16 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-12 right-12 w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-4 mb-12">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                   {activeTab === 'patients' ? <UsersIcon size={32} /> : <Stethoscope size={32} />}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Edit {activeTab === 'patients' ? 'Patient' : 'Staff'} Profile</h2>
                  <p className="text-slate-400 font-bold text-sm tracking-tight">Record ID: {editingUser.id || editingUser._id}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input type="tel" value={editForm.phone || ''} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                  <select 
                    value={editForm.is_active ? 'active' : 'inactive'} 
                    onChange={(e) => setEditForm({...editForm, is_active: e.target.value === 'active'})}
                    className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner appearance-none"
                  >
                    <option value="active">Active Status</option>
                    <option value="inactive">Inactive Status</option>
                  </select>
                </div>

                {activeTab === 'doctors' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialization</label>
                      <input type="text" value={editForm.specialization || ''} onChange={(e) => setEditForm({...editForm, specialization: e.target.value})} className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                      <input type="text" value={editForm.department || ''} onChange={(e) => setEditForm({...editForm, department: e.target.value})} className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:border-blue-600/50 transition-all shadow-inner" />
                    </div>
                  </>
                )}

                <div className="md:col-span-2 pt-8 flex gap-4">
                  <button type="submit" className="flex-1 h-20 rounded-[2.5rem] bg-slate-900 text-white text-xl font-black uppercase tracking-tighter hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                    <ShieldCheck size={24} /> Save Changes
                  </button>
                  <button type="button" onClick={() => setEditingUser(null)} className="px-12 h-20 rounded-[2.5rem] bg-slate-100 text-slate-400 text-xl font-black uppercase tracking-tighter hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
