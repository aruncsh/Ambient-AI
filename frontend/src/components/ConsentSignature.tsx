import React, { useRef } from 'react';

const ConsentSignature = ({ onSign }: { onSign: () => void }) => {
  const padRef = useRef<HTMLCanvasElement>(null);

  const clear = () => {
    const ctx = padRef.current?.getContext('2d');
    if (ctx && padRef.current) ctx.clearRect(0, 0, padRef.current.width, padRef.current.height);
  };

  return (
    <div className="space-y-6">
       <h4 className="font-bold text-slate-800">Patient / Guardian Signature</h4>
       <div className="relative w-full h-48 bg-slate-50 border-2 border-slate-200 rounded-3xl overflow-hidden cursor-crosshair">
          <canvas ref={padRef} className="w-full h-full" />
          <div className="absolute bottom-4 right-4 flex gap-2">
             <button onClick={clear} className="px-4 py-2 bg-white text-slate-500 text-xs font-bold rounded-xl border border-slate-200">Clear</button>
             <button onClick={onSign} className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg">Confirm Signature</button>
          </div>
       </div>
       <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">Sign inside the box to authorize capture</p>
    </div>
  );
};

export default ConsentSignature;
