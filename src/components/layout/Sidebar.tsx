import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Bell, 
  FileText, 
  User, 
  Settings, 
  Briefcase,
  ShieldCheck,
  Globe,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ isOpen, onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Government Links', path: '/government-links', icon: Globe },
    { label: 'Applications', path: '/applications', icon: FileText },
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const username = user?.username ?? 'user';
  const initial = username.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Top Header / Logo Section */}
        <div>
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base tracking-tight block leading-tight">
                  SarkariJob
                </span>
                <span className="text-[10px] font-medium text-slate-400 block">
                  SSC & RRB Tracker
                </span>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={onCloseMobile}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 lg:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) => `
                    flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile Card at Bottom */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div 
            onClick={() => {
              onCloseMobile();
              navigate('/profile');
            }}
            className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center border border-slate-300">
                  {initial}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white" title="Active Logged In" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors font-mono">
                  @{username}
                </p>
                <div className="flex items-center text-[11px] text-slate-500 space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span className="truncate">{user?.email || 'Logged In'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              title="Log Out"
              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
