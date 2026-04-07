import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, ChevronDown, RotateCcw, ShieldCheck, Brain, MessageSquare } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const GeneralAIChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Welcome to the Nexus Intelligence Layer. I can assist with clinical guidelines, pharmacological cross-referencing, or diagnostic protocols. How may I facilitate your workflow today?"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        try {
            const resp = await fetch('/api/v1/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await resp.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'No response.' }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Network latency detected. Please ensure the clinical backend is accessible.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            content: "Context buffer cleared. Awaiting new clinical inquiry."
        }]);
    };

    return (
        <>
            {/* Professional Floating Toggle */}
            <motion.button
                id="ai-chat-toggle"
                onClick={() => setIsOpen(v => !v)}
                className={`fixed bottom-10 right-10 z-50 w-20 h-20 rounded-[2rem] flex flex-col items-center justify-center shadow-2xl transition-all ${
                    isOpen
                    ? 'bg-slate-900 border border-slate-800'
                    : 'bg-blue-600 shadow-xl shadow-blue-600/30 border border-blue-500 hover:bg-blue-700'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <ChevronDown size={28} className="text-white" />
                        </motion.div>
                    ) : (
                        <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                            <Sparkles size={28} className="text-white mb-1" />
                            <span className="text-[8px] font-black text-white uppercase tracking-widest leading-none">Pulse</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {!isOpen && (
                    <span className="absolute top-4 right-4 w-3 h-3 rounded-full bg-emerald-500 border-2 border-blue-600 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                )}
            </motion.button>

            {/* Premium Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="ai-chat-panel"
                        initial={{ opacity: 0, scale: 0.98, y: 30, x: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 30, x: 20 }}
                        className="fixed bottom-36 right-10 z-50 w-[420px] h-[640px] bg-white rounded-[3.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
                    >
                        {/* High-Fidelity Header */}
                        <div className="flex items-center justify-between px-10 py-8 border-b border-slate-50 bg-slate-50/30 relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full translate-x-12 -translate-y-12" />
                            <div className="flex items-center gap-4 relative">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center">
                                    <Brain size={24} className="text-white" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">AI Pulse <span className="text-blue-600 font-black">Nexus</span></p>
                                    <p className="text-[9px] text-emerald-500 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                        <ShieldCheck size={10} /> Secure Clinical Stream
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 relative">
                                <button onClick={clearChat} className="p-2.5 rounded-xl bg-white border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                    <RotateCcw size={16} />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2.5 rounded-xl bg-white border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Professional Dialogue History */}
                        <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 scrollbar-hide bg-white">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] p-6 rounded-[2rem] text-sm font-bold leading-relaxed shadow-sm ${
                                            msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-slate-50 border border-slate-100 text-slate-900 rounded-tl-none italic'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-blue-100' : 'text-blue-600'}`}>
                                                    {msg.role === 'user' ? 'Authorized Inquirer' : 'Nexus Intelligence'}
                                                </span>
                                            </div>
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                        <div className="bg-slate-50 p-6 rounded-[2rem] rounded-tl-none border border-slate-50 flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-blue-600 rounded-full animate-bounce [animation-delay:0s]" />
                                            <div className="w-1.5 h-6 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                                            <div className="w-1.5 h-6 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* High-Contrast Input Interface */}
                        <div className="p-10 border-t border-slate-50 bg-slate-50/20">
                            <div className="flex items-end gap-4 bg-white border border-slate-200 rounded-[2.5rem] p-6 focus-within:border-blue-600/40 focus-within:shadow-xl transition-all shadow-sm group">
                                <textarea
                                    ref={inputRef}
                                    id="ai-chat-input"
                                    rows={1}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter clinical inquiry..."
                                    className="flex-1 bg-transparent text-lg font-black italic text-slate-900 placeholder:text-slate-200 resize-none outline-none leading-relaxed max-h-40 scrollbar-hide uppercase tracking-tighter"
                                />
                                <button
                                    id="ai-chat-send"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || isLoading}
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-900 hover:bg-blue-600 disabled:opacity-20 disabled:scale-95 transition-all flex-shrink-0 shadow-lg shadow-slate-900/10"
                                >
                                    <Send size={20} className="text-white fill-current translate-x-0.5 -translate-y-0.5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between mt-6 px-4">
                                <div className="flex items-center gap-2 opacity-30">
                                    <ShieldCheck size={12} className="text-slate-400" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">HIPAA Protected</span>
                                </div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Shift + Enter for logic break</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default GeneralAIChat;
