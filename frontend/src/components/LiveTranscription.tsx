import React, { useEffect, useRef } from 'react';

const LiveTranscription = ({ transcript }: { transcript: string[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-4 font-serif text-xl leading-relaxed text-slate-300">
      {transcript.length > 0 ? transcript.map((line, i) => (
        <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
          <span className="text-indigo-400 font-bold mr-2">Conversation:</span>
          {line}
        </div>
      )) : (
        <div className="h-full flex items-center justify-center text-slate-600 italic">
          Conversation will appear here in real-time...
        </div>
      )}
    </div>
  );
};

export default LiveTranscription;
