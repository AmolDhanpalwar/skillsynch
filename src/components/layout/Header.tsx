import { useState } from 'react';
import { Bell, Menu, Search, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getInitials, getRoleLabel } from '../../types';
import NotificationDrawer from '../notifications/NotificationDrawer';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initials = user ? getInitials(user.full_name || user.email) : '?';
  const displayName = user?.full_name || user?.email || '';
  const roleLabel = user ? getRoleLabel(user.role) : '';

  return (
    <>
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 shrink-0 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:text-primary-500 hover:bg-bglight transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 flex-1">
        <div className="hidden sm:flex items-center gap-2 bg-bglight rounded-lg px-3 py-2 max-w-xs w-full">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search skills, members…"
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full font-body"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative p-2 rounded-lg text-gray-500 hover:text-primary-500 hover:bg-bglight transition-colors"
          aria-label="Open notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 ? (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold font-heading flex items-center justify-center px-1 ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
          )}
        </button>

        <div className="flex items-center gap-2.5 group relative">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center ring-2 ring-primary-100 group-hover:ring-accent-300 transition-all cursor-pointer">
            <span className="text-white text-xs font-bold font-heading">{initials}</span>
          </div>
          <div className="hidden md:block cursor-default">
            <p className="text-sm font-semibold text-gray-800 leading-none font-heading">{displayName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
          </div>

          <button
            onClick={signOut}
            className="hidden md:flex items-center gap-1.5 ml-1 text-xs text-gray-400 hover:text-red-500 transition-colors font-body"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>

    <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
