import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, History, Calendar, CreditCard, Settings,
  Brain, Search, Bell, Stethoscope, Menu, X, LogOut, ChevronRight, Video
} from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Patient Registry', path: '/users' },
        { icon: History, label: 'Encounter History', path: '/history' },
        { icon: Calendar, label: 'Schedules', path: '/scheduling' },
        { icon: Video, label: 'Tele-Consult', path: '/teleconsultations' },
        { icon: Settings, label: 'System Config', path: '/settings' },
    ];

    const isActive = (path: string) => {
        if (path === '/' && (location.pathname === '/' || location.pathname === '/dashboard')) return true;
        return location.pathname.startsWith(path) && path !== '/';
    };

    return (
        <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
            {/* Extremely Lean Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 shadow-sm fixed inset-y-0 z-50`}>
                <div className="p-6 border-b border-slate-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
                        <Brain size={20} />
                    </div>
                    {isSidebarOpen && <span className="font-bold text-lg select-none">Ambient AI</span>}
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item, i) => (
                        <Link 
                            key={i}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all text-sm ${isActive(item.path) ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <item.icon size={18} />
                            {isSidebarOpen && <span>{item.label}</span>}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <button 
                        onClick={() => navigate('/settings')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 w-full transition-all`}
                    >
                        <Settings size={18} />
                        {isSidebarOpen && <span>Settings</span>}
                    </button>
                    <button 
                        className={`mt-2 flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm text-rose-500 hover:bg-rose-50 w-full transition-all`}
                    >
                        <LogOut size={18} />
                        {isSidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Viewport */}
            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-400 hover:text-slate-900">
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                             <p className="text-sm font-bold text-slate-900 leading-none">Dr. Alexander Smith</p>
                             <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Status: Online</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                             <Stethoscope size={20} />
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-10 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Shell;
