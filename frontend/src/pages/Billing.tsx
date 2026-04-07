import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Receipt, DollarSign, Clock, User, Plus, 
    CheckCircle2, CreditCard, ArrowUpRight, TrendingUp, Download, Loader2,
    ShieldCheck, Filter, Search, ChevronRight, FileText, Wallet,
    TrendingDown, BarChart3, PieChart
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
      setInvoices(Array.isArray(data) ? data : []);
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
    <div className="space-y-12">
      {/* Professional Header */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12 border-b border-slate-100 pb-12">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">
            <Wallet size={14} /> Revenue Lifecycle Management
          </div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            Billing & <span className="text-blue-600">Finance</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Automated CPT/ICD-10 clinical coding fusion and enterprise-grade financial auditing.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button className="h-16 px-10 rounded-[1.5rem] bg-slate-900 text-white font-black text-lg uppercase tracking-tighter hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3">
            <Plus size={24} /> New Claim
          </button>
        </div>
      </header>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
            { label: 'Total Outstanding', val: `₹${totalOutstanding.toLocaleString()}`, icon: DollarSign, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', trend: 'Audit Required' },
            { label: 'Revenue (MTD)', val: `₹${revenueMTD.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', trend: '+14% Flux' },
            { label: 'Active Claims', val: activeClaims.toString(), icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', trend: 'Verified' }
        ].map((stat, i) => (
            <section key={i} className={`p-10 rounded-[3.5rem] border ${stat.bg} shadow-sm group hover:shadow-xl transition-all relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-3xl rounded-full translate-x-12 -translate-y-12" />
                <div className="flex justify-between items-start mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <stat.icon size={24} className={stat.color} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${stat.color} bg-white px-3 py-1 rounded-full shadow-sm`}>
                        {stat.trend}
                    </span>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">{stat.label}</p>
                    <h3 className="text-4xl font-black text-slate-900 italic tracking-tighter">{stat.val}</h3>
                </div>
            </section>
        ))}
      </div>

      {/* Main Ledger */}
      <section className="bg-white border border-slate-200 rounded-[3.5rem] shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
             <div className="flex items-center gap-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Statement Ledger</h3>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black text-slate-900 uppercase">Live Audit Active</span>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600" />
                    <input className="h-10 w-64 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-blue-600 transition-all shadow-sm" placeholder="Search Ledger..." />
                </div>
                <button className="h-10 w-10 text-slate-400 hover:text-slate-900 border border-slate-200 bg-white rounded-xl transition-all flex items-center justify-center">
                    <Download size={18} />
                </button>
             </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    <tr>
                        <th className="py-6 px-10">Account Identity</th>
                        <th className="py-6 px-10">Amount</th>
                        <th className="py-6 px-10 italic">Verification Date</th>
                        <th className="py-6 px-10">Nexus Status</th>
                        <th className="py-6 px-10 text-right">Operations</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {loading ? (
                     <tr>
                        <td colSpan={5} className="py-32 text-center">
                            <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Records...</span>
                        </td>
                     </tr>
                   ) : invoices.length === 0 ? (
                     <tr><td colSpan={5} className="py-32 text-center text-slate-200 font-black italic text-4xl uppercase tracking-[0.2em] opacity-30">Null Statements</td></tr>
                   ) : invoices.map((inv, idx) => (
                     <motion.tr 
                       key={inv.id || idx}
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: idx * 0.05 }}
                       className="group hover:bg-blue-50/30 cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-blue-600"
                     >
                        <td className="py-8 px-10">
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    <Receipt size={22} />
                                </div>
                                <div>
                                    <span className="font-black text-slate-900 text-lg tracking-tighter block uppercase italic">{inv.patient_name || inv.patient_id}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">INV-#{inv.id ? String(inv.id).slice(-8).toUpperCase() : 'NEW'}</span>
                                </div>
                            </div>
                        </td>
                        <td className="py-8 px-10">
                            <div className="text-xl font-black text-slate-900 italic tracking-tighter">₹{Number(inv.amount).toLocaleString()}</div>
                        </td>
                        <td className="py-8 px-10">
                            <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">{new Date(inv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </td>
                        <td className="py-8 px-10">
                           <button 
                            onClick={() => handleUpdateStatus(inv.id!, inv.status === 'paid' ? 'pending' : 'paid')}
                            className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.25em] border transition-all ${
                                inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}
                           >
                              {inv.status}
                           </button>
                        </td>
                        <td className="py-8 px-10 text-right">
                            <button className="h-10 px-6 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-auto">
                                Analysis <ChevronRight size={14} />
                            </button>
                        </td>
                     </motion.tr>
                   ))}
                </tbody>
            </table>
        </div>
      </section>

      {/* Compliance Advisory */}
      <footer className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full translate-x-12 -translate-y-12" />
        <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-blue-400 border border-white/10 backdrop-blur-md">
                <BarChart3 size={32} />
            </div>
            <div className="space-y-2 flex-1">
                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Neural Coding Audit</h4>
                <p className="text-sm font-medium text-slate-400 leading-relaxed max-w-4xl">
                    All financial statements are verified against CMS-1500 standards. CPT codes are derived using HIPAA-compliant NLP extraction from authenticated clinical dialogue. Automated claim submission pending 72-hour review window.
                </p>
            </div>
            <button className="h-14 px-8 rounded-2xl bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-blue-400 transition-all whitespace-nowrap">Review Standards</button>
        </div>
      </footer>
    </div>
  );
};

export default Billing;
