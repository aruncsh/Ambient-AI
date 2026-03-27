import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, ChevronDown, RotateCcw } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const GeneralAIChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hello! I'm your AI assistant. I can help with medical questions, drug information, clinical guidelines, or anything else. Ask me anything — completely free!"
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
                content: 'Connection error. Please ensure the backend server is running.'
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
            content: "Chat cleared! Ask me anything — medical or otherwise."
        }]);
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <motion.button
                id="ai-chat-toggle"
                onClick={() => setIsOpen(v => !v)}
                className={`fixed bottom-8 right-8 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                    isOpen
                    ? 'bg-zinc-800 border border-zinc-700'
                    : 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.5)]'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="AI Assistant"
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <ChevronDown size={22} className="text-white" />
                        </motion.div>
                    ) : (
                        <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                            <Sparkles size={22} className="text-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zinc-950 animate-pulse" />
                )}
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="ai-chat-panel"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-28 right-8 z-50 w-[380px] h-[520px] bg-zinc-950/95 backdrop-blur-3xl border border-zinc-800/80 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/60">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                                    <Bot size={16} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">AI Assistant</p>
                                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Free · Local AI</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={clearChat} className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all" title="Clear chat">
                                    <RotateCcw size={13} className="text-zinc-400" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all" title="Close">
                                    <X size={13} className="text-zinc-400" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === 'user'
                                            ? 'bg-indigo-600/80 text-white rounded-tr-sm'
                                            : 'bg-zinc-800/80 text-zinc-200 rounded-tl-sm'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-zinc-800/80 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center">
                                            {[0, 1, 2].map(i => (
                                                <motion.div
                                                    key={i}
                                                    className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                                                    animate={{ y: [0, -4, 0] }}
                                                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-5 py-4 border-t border-zinc-800/60">
                            <div className="flex items-end gap-3 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-all">
                                <textarea
                                    ref={inputRef}
                                    id="ai-chat-input"
                                    rows={1}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 resize-none outline-none leading-relaxed max-h-28 scrollbar-hide"
                                />
                                <button
                                    id="ai-chat-send"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || isLoading}
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all flex-shrink-0"
                                >
                                    <Send size={14} className="text-white" />
                                </button>
                            </div>
                            <p className="text-[9px] text-zinc-600 text-center mt-2 font-medium">Enter to send · Shift+Enter for newline</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default GeneralAIChat;
