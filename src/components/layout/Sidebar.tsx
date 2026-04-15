import {
  LayoutDashboard,
  Inbox,
  Users,
  BarChart2,
  Star,
  X,
  LogOut,
  TrendingUp,
  ClipboardList,
  Activity,
  HelpCircle,
  Settings,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../../context/AuthContext';
import { getInitials, getRoleLabel } from '../../types';
import type { UserRole } from '../../types';

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',      path: '/dashboard',     roles: ['employee', 'manager', 'tmg', 'management', 'admin'] },
  { icon: ClipboardList,   label: 'My Skill Form',  path: '/form',          roles: ['employee'] },
  { icon: Inbox,           label: 'Inbox',           path: '/inbox',         roles: ['manager', 'tmg', 'admin'] },
  { icon: TrendingUp,      label: 'TMG Dashboard',  path: '/tmg-dashboard', roles: ['tmg', 'admin'] },
  { icon: Activity,        label: 'Form Status',    path: '/status',        roles: ['tmg', 'admin'] },
  { icon: BarChart2,       label: 'Reports',         path: '/reports',       roles: ['management', 'admin'] },
  { icon: Star,            label: 'Skills Matrix',  path: '/tmg-dashboard', roles: ['manager', 'tmg', 'management', 'admin'] },
  { icon: Users,           label: 'Users',           path: '/admin',         roles: ['admin'] },
  { icon: Settings,        label: 'Settings',        path: '/settings',      roles: ['tmg', 'admin'] },
  { icon: HelpCircle,      label: 'Power BI Guide', path: '/help/powerbi',  roles: ['tmg', 'management', 'admin'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role ?? 'employee';

  const uniqueKeys = new Set<string>();
  const visibleItems = navItems.filter((item) => {
    if (!item.roles.includes(role)) return false;
    const key = `${item.label}:${item.path}`;
    if (uniqueKeys.has(key)) return false;
    uniqueKeys.add(key);
    return true;
  });

  function handleNav(path: string) {
    navigate(path);
    onClose();
  }

  const initials = user ? getInitials(user.full_name || user.email) : '?';
  const displayName = user?.full_name || user?.email || '';
  const roleLabel = user ? getRoleLabel(user.role) : '';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          w-60 bg-primary-500 transition-transform duration-300 ease-in-out
          md:translate-x-0 md:static md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Logo showSubtitle />
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li key={item.label}>
                  <button
                    onClick={() => handleNav(item.path)}
                    className={`sidebar-link w-full text-left ${active ? 'active' : ''}`}
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold font-heading">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-white/50 truncate">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="sidebar-link w-full text-left text-white/60 hover:text-red-300"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
