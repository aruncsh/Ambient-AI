import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    LayoutDashboard, 
    Calendar, 
    Receipt, 
    History as HistoryIcon, 
    ClipboardSignature, 
    User,
    Sparkles
} from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Scheduling', path: '/scheduling', icon: Calendar },
    { name: 'Billing', path: '/billing', icon: Receipt },
    { name: 'History', path: '/history', icon: HistoryIcon },
    { name: 'Consent', path: '/consent', icon: ClipboardSignature },
    { name: 'Personnel', path: '/users', icon: User },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/50 backdrop-blur-md border-b border-white/5">
      <div className="max-w-[1800px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles size={20} className="text-white fill-current" />
            </div>
            <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white leading-tight">Ambient</span>
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest leading-none">Scribe AI</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`relative px-5 py-2 transition-colors duration-200 text-sm font-medium ${
                    isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <item.icon size={16} className={isActive ? 'text-indigo-500' : 'text-zinc-600'} />
                    {item.name}
                  </div>
                  {isActive && (
                    <motion.div 
                        layoutId="nav-bg"
                        className="absolute inset-0 bg-white/5 rounded-xl -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 group cursor-pointer pl-6 border-l border-white/5">
                <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-white leading-none">Alexander, MD</div>
                    <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight mt-1">Neurology</div>
                </div>
                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-zinc-900 flex items-center justify-center transition-all group-hover:border-indigo-500/50">
                    <User size={18} className="text-zinc-500" />
                </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
