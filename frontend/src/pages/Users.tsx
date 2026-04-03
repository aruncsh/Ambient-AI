import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Users as UsersIcon, Stethoscope, Mail, Phone, Calendar, MapPin, Hash, Briefcase, Plus, Activity, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const Users = () => {
  const [activeTab, setActiveTab] = useState<'patients' | 'doctors'>('patients');
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [patientForm, setPatientForm] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'Other',
    blood_group: '',
    address: ''
  });

  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    license_number: '',
    experience_years: 0,
    department: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [patientsData, doctorsData] = await Promise.all([
        api.getPatients(),
        api.getDoctors()
      ]);
      setPatients(patientsData);
      setDoctors(doctorsData);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPatient(patientForm);
      setPatientForm({ name: '', email: '', phone: '', date_of_birth: '', gender: 'Other', blood_group: '', address: '' });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      alert("Failed to add patient");
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDoctor(doctorForm);
      setDoctorForm({ name: '', email: '', phone: '', specialization: '', license_number: '', experience_years: 0, department: '' });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      alert("Failed to add doctor");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-white/5 pb-10">
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
                <UsersIcon size={14} /> Master Registry
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white">Personnel</h1>
            <p className="text-zinc-500 text-base max-w-xl font-medium">Manage clinical staff and patient records within the secure Ambient ecosystem.</p>
        </div>
        <button 
           onClick={() => setShowAddForm(!showAddForm)}
           className={`btn h-14 px-10 rounded-full flex items-center gap-3 transition-all font-bold ${showAddForm ? 'bg-white/10 text-white' : 'btn-primary shadow-indigo-500/20'}`}
        >
          {showAddForm ? 'Cancel Registration' : (activeTab === 'patients' ? <><UserPlus size={20} /> Register Patient</> : <><Stethoscope size={20} /> Register Doctor</>)}
        </button>
      </header>

      <div className="flex gap-4 p-1 bg-white/5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('patients')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'patients' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Patients
        </button>
        <button 
          onClick={() => setActiveTab('doctors')}
          className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'doctors' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Doctors
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-10 bg-zinc-950/40 border-indigo-500/20 max-w-4xl mx-auto"
          >
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
               {activeTab === 'patients' ? <UserPlus className="text-indigo-500" /> : <Stethoscope className="text-indigo-500" />}
               New {activeTab === 'patients' ? 'Patient' : 'Doctor'} Enrollment
            </h3>
            
            <form onSubmit={activeTab === 'patients' ? handleAddPatient : handleAddDoctor} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {activeTab === 'patients' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="John Doe"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={patientForm.name}
                      onChange={(e) => setPatientForm({...patientForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="john@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={patientForm.email}
                      onChange={(e) => setPatientForm({...patientForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="+91 ..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={patientForm.phone}
                      onChange={(e) => setPatientForm({...patientForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Date of Birth</label>
                    <input 
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={patientForm.date_of_birth}
                      onChange={(e) => setPatientForm({...patientForm, date_of_birth: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Gender</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all appearance-none"
                      value={patientForm.gender}
                      onChange={(e) => setPatientForm({...patientForm, gender: e.target.value})}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                   <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Blood Group</label>
                    <input 
                      type="text" 
                      placeholder="O+, A-, etc."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={patientForm.blood_group}
                      onChange={(e) => setPatientForm({...patientForm, blood_group: e.target.value})}
                    />
                  </div>
                   <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Residential Address</label>
                    <textarea 
                      placeholder="123 Clinical Way..."
                      className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all min-h-[120px]"
                      value={patientForm.address}
                      onChange={(e) => setPatientForm({...patientForm, address: e.target.value})}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm({...doctorForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Medical Email</label>
                    <input 
                      type="email" 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({...doctorForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Specialization</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={doctorForm.specialization}
                      onChange={(e) => setDoctorForm({...doctorForm, specialization: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">License Number</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl h-14 px-6 text-white outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                      value={doctorForm.license_number}
                      onChange={(e) => setDoctorForm({...doctorForm, license_number: e.target.value})}
                    />
                  </div>
                </>
              )}
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary h-14 px-12 rounded-full font-bold shadow-indigo-500/40">
                  Authorize & Finalize
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            {loading ? (
               <div className="flex flex-col items-center justify-center p-20 gap-4 text-zinc-500">
                  <RefreshCw className="animate-spin text-indigo-500" size={40} />
                  <p className="font-bold tracking-widest uppercase text-[10px]">Synchronizing Secure Registry</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(activeTab === 'patients' ? patients : doctors).length === 0 ? (
                  <div className="col-span-full p-20 text-center glass-card border-white/5">
                    <p className="text-zinc-500 font-medium italic">No {activeTab} found in the encrypted registry.</p>
                  </div>
                ) : (
                  (activeTab === 'patients' ? patients : doctors).map((user, i) => (
                    <motion.div 
                      key={user.id || user._id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-8 bg-white/5 border-white/5 hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                          {activeTab === 'patients' ? <UsersIcon size={24} /> : <Stethoscope size={24} />}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full">
                          {activeTab === 'patients' ? 'Patient' : 'Staff'}
                        </div>
                      </div>
                      <h4 className="text-2xl font-bold text-white mb-2">{user.name}</h4>
                      <p className="text-zinc-500 text-sm font-medium mb-6">
                         {activeTab === 'doctors' ? user.specialization || 'Clinical Practitioner' : user.date_of_birth ? `Born ${new Date(user.date_of_birth).toLocaleDateString()}` : 'No date of birth'}
                      </p>
                      
                      <div className="space-y-3 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-3 text-zinc-400 text-xs">
                          <Mail size={14} className="text-indigo-400" />
                          <span>{user.email || 'No email registered'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400 text-xs">
                          <Phone size={14} className="text-indigo-400" />
                          <span>{user.phone || 'No phone registered'}</span>
                        </div>
                        {activeTab === 'doctors' && (
                           <div className="flex items-center gap-3 text-zinc-400 text-xs">
                             <Briefcase size={14} className="text-indigo-400" />
                             <span>{user.department || 'General Ward'}</span>
                           </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Users;
