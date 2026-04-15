import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
  Clock,
  Info,
  Check,
} from 'lucide-react';
import { useNotifications, type Notification } from '../../context/NotificationContext';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; iconClass: string; label: string }> = {
  form_submitted: { icon: ClipboardList, iconClass: 'text-sky-500 bg-sky-50',     label: 'Form Submitted' },
  form_approved:  { icon: CheckCircle2, iconClass: 'text-emerald-500 bg-emerald-50', label: 'Approved' },
  form_returned:  { icon: RotateCcw,    iconClass: 'text-red-500 bg-red-50',      label: 'Returned' },
  reminder:       { icon: Clock,        iconClass: 'text-amber-500 bg-amber-50',  label: 'Reminder' },
};

function NotificationItem({
  notification,
  onAction,
}: {
  notification: Notification;
  onAction: (n: Notification) => void;
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? {
    icon: Info,
    iconClass: 'text-gray-500 bg-gray-100',
    label: 'Notification',
  };
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => onAction(notification)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/80
        ${!notification.is_read
          ? 'border-l-2 border-cyan-400 bg-cyan-50/30'
          : 'border-l-2 border-transparent'
        }`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconClass}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[11px] font-heading font-semibold uppercase tracking-wide ${notification.is_read ? 'text-gray-400' : 'text-gray-500'}`}>
            {cfg.label}
          </p>
          <span className="text-[10px] font-body text-gray-400 shrink-0 mt-0.5">
            {relativeTime(notification.created_at)}
          </span>
        </div>
        <p className={`text-sm font-body leading-snug mt-0.5 ${notification.is_read ? 'text-gray-400' : 'text-gray-700'}`}>
          {notification.message}
        </p>
      </div>
      {!notification.is_read && (
        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-2" />
      )}
    </button>
  );
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  async function handleAction(n: Notification) {
    if (!n.is_read) await markRead(n.id);
    if (n.form_id) {
      if (n.type === 'form_submitted') {
        navigate(`/inbox/review/${n.form_id}`);
      } else {
        navigate('/form');
      }
    }
    onClose();
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl shadow-black/10
          flex flex-col transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
              <Bell size={15} className="text-primary-500" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-gray-900 text-base leading-none">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-[11px] text-gray-400 font-body mt-0.5">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Bell size={22} className="text-gray-300" />
              </div>
              <p className="font-heading font-semibold text-gray-600 text-sm mb-1">All caught up</p>
              <p className="text-xs text-gray-400 font-body">
                You have no notifications yet. They will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onAction={handleAction} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-300 font-body text-center">
            Showing last 50 notifications
          </p>
        </div>
      </aside>
    </>
  );
}
