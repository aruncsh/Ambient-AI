import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Receipt, DollarSign, Clock, User, Plus, 
    CheckCircle2, CreditCard, ArrowUpRight, TrendingUp, Download, Loader2
} from 'lucide-react';
import { api } from '../lib/api';

interface InvoiceType {
  id?: string;
  patient_id: string;
  patient_name?: string;
  amount: number;
  status: 'pending' | 'paid' | 'void';
  due_date: string;
  created_at: string;
}

const Billing = () => {
  const [invoices, setInvoices] = useState<InvoiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const totalOutstanding = invoices
    .filter(inv => inv.status === 'pending')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const revenueMTD = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const activeClaims = invoices.filter(inv => inv.status === 'pending').length;

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateInvoiceStatus(id, newStatus);
      fetchInvoices();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  return (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16 space-y-12"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-white/5 pb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">
             <Receipt size={14} /> Revenue Management
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">Billing & Finance</h1>
          <p className="text-zinc-500 text-base max-w-xl font-medium">Streamline clinical billing and insurance claims through automated CPT/ICD-10 coding fusion.</p>
        </div>
        
        <button 
          onClick={() => {}} // Could trigger generateClaim simulation
          className="btn btn-primary px-10 h-14 rounded-full shadow-indigo-500/20 flex items-center gap-2"
        >
          <Plus size={20} /> Generate New Claim
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {[
            { label: 'Total Outstanding', val: `₹${totalOutstanding.toLocaleString()}`, icon: DollarSign, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/10' },
            { label: 'Revenue (MTD)', val: `₹${revenueMTD.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/10' },
            { label: 'Active Claims', val: activeClaims.toString(), icon: CreditCard, color: 'text-indigo-400', bg: 'bg-indigo-500/5 border-indigo-500/10' }
        ].map((stat, i) => (
            <div key={i} className={`glass-card p-10 ${stat.bg}`}>
                <div className="flex justify-between items-start mb-6">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
                    <stat.icon size={20} className={stat.color} />
                </div>
                <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                    {stat.val}
                    <span className="text-[10px] font-medium text-zinc-600">Dynamic analysis</span>
                </div>
            </div>
        ))}
      </div>

      <div className="glass-card p-0 overflow-hidden border-white/5 bg-zinc-950/20">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Financial Statements</h3>
             <button className="p-3 bg-zinc-950 text-zinc-400 hover:text-white border border-white/5 rounded-2xl transition-all">
                <Download size={18} />
             </button>
        </div>

        <div className="divide-y divide-white/5">
           {loading ? (
             <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
           ) : invoices.length === 0 ? (
             <div className="p-20 text-center text-zinc-500 font-medium">No invoices found.</div>
           ) : invoices.map((inv, idx) => (
             <motion.div 
               key={inv.id || idx}
               initial={{ opacity: 0, y: 5 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.05 }}
               className="grid grid-cols-12 gap-0 px-8 py-8 items-center hover:bg-white/[0.02] cursor-pointer transition-colors group"
             >
                <div className="col-span-4 flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 transition-colors">
                      <Receipt size={24} />
                   </div>
                   <div>
                      <span className="font-bold text-white text-lg tracking-tight block">{inv.patient_name || inv.patient_id}</span>
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">INV-#{inv.id ? String(inv.id).slice(-6).toUpperCase() : 'NEW'}</span>
                   </div>
                </div>
                <div className="col-span-3 text-center">
                   <div className="text-xl font-bold text-white">₹{Number(inv.amount).toFixed(2)}</div>
                   <div className="text-[10px] text-zinc-600 font-bold uppercase">{new Date(inv.created_at).toLocaleDateString()}</div>
                </div>
                <div className="col-span-3 text-center">
                   <button 
                    onClick={() => handleUpdateStatus(inv.id!, inv.status === 'paid' ? 'pending' : 'paid')}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                   >
                      {inv.status}
                   </button>
                </div>
                <div className="col-span-2 flex justify-end">
                    <button className="btn bg-zinc-900 border-none px-6 text-indigo-400 hover:text-white hover:bg-indigo-600/20">
                        Details <ArrowUpRight size={14} className="ml-2" />
                    </button>
                </div>
             </motion.div>
           ))}
        </div>
      </div>
    </motion.div>
  );
};

export default Billing;
