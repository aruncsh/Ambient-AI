import React, { useRef } from 'react';
import { ShieldCheck, Info, RotateCcw, PenTool } from 'lucide-react';

const ConsentSignature = ({ onSign }: { onSign: () => void }) => {
  const padRef = useRef<HTMLCanvasElement>(null);

  const clear = () => {
    const ctx = padRef.current?.getContext('2d');
    if (ctx && padRef.current) ctx.clearRect(0, 0, padRef.current.width, padRef.current.height);
  };

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-end mb-4">
          <div className="space-y-1">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity Verification</h4>
             <p className="text-xl font-black text-slate-900 italic tracking-tighter uppercase">Authorized Signature</p>
          </div>
          <div className="h-8 px-4 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-2 font-black text-[8px] uppercase tracking-widest shadow-sm">
             <ShieldCheck size={12} /> Legal Attestation
          </div>
       </div>

       <div className="relative w-full h-56 bg-slate-50 border border-slate-200 rounded-[2.5rem] overflow-hidden cursor-crosshair shadow-inner group">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
             <PenTool size={120} className="text-slate-300 -rotate-12" />
          </div>
          <canvas ref={padRef} className="w-full h-full relative z-10" />
          
          <div className="absolute bottom-6 right-6 flex gap-3 z-20">
             <button 
                onClick={clear} 
                className="h-10 px-6 bg-white text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2"
             >
                <RotateCcw size={14} /> Clear
             </button>
             <button 
                onClick={onSign} 
                className="h-10 px-8 bg-slate-900 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-slate-900/10 transition-all flex items-center gap-2"
             >
                <ShieldCheck size={14} /> Protocol Confirm
             </button>
          </div>
       </div>
       
       <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-50">
          <Info size={14} className="text-blue-600/30" />
          <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.25em]">Signature is encrypted and time-stamped in the clinical nexus</p>
       </div>
    </div>
  );
};

export default ConsentSignature;
