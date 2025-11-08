import React, { useMemo } from 'react';
import { User } from '../types';
import { LogOut, LayoutDashboard, Upload, MessageSquare } from 'lucide-react';

export type View = 'dashboard' | 'upload' | 'chat';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  activeView: View;
  onNavigate: (view: View) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, activeView, onNavigate }) => {
  const userInitials = useMemo(() => {
    return currentUser.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [currentUser.name]);

  const NavItem = ({ view, label, icon }: { view: View, label: string, icon: React.ReactNode }) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
          isActive
            ? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/40'
            : 'text-slate-200 hover:text-white hover:bg-white/10'
        }`}
      >
        {icon}
        <span className="ml-2">{label}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-slate-950/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300/80">FinSight</p>
              <h1 className="text-2xl font-semibold text-white">Balance Sheet Assurance</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-3">
              <NavItem view="dashboard" label="Dashboard" icon={<LayoutDashboard size={18} />} />
              <NavItem view="upload" label="Data Ingestion" icon={<Upload size={18} />} />
              <NavItem view="chat" label="AI Assistant" icon={<MessageSquare size={18} />} />
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <p className="text-sm font-semibold text-white">{currentUser.name}</p>
              <p className="text-xs text-slate-300 uppercase tracking-wide">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-semibold text-white">
              {userInitials}
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-200 rounded-full hover:bg-white/10 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
