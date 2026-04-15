import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  RotateCcw,
  Clock,
  ArrowRight,
  Bell,
  ChevronRight,
  FileText,
  Pencil,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import Toast from '../components/form/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getInitials } from '../types';
import type { FormStatus } from '../types';
import type { Notification } from '../context/NotificationContext';

interface SkillForm {
  id: string;
  status: FormStatus;
  updated_at: string;
  submitted_at: string | null;
  total_exp: number | null;
  current_project: string | null;
}

const STATUS_CONFIG: Record<
  FormStatus,
  { label: string; badgeClass: string; borderClass: string; icon: React.ElementType; iconClass: string }
> = {
  draft:          { label: 'Draft',          badgeClass: 'bg-gray-100 text-gray-600',        borderClass: 'border-gray-200',   icon: FileText,     iconClass: 'text-gray-400' },
  pending_review: { label: 'Pending Review', badgeClass: 'bg-amber-100 text-amber-700',      borderClass: 'border-amber-200',  icon: Clock,        iconClass: 'text-amber-500' },
  returned:       { label: 'Returned',       badgeClass: 'bg-orange-100 text-orange-700',    borderClass: 'border-orange-200', icon: RotateCcw,    iconClass: 'text-orange-500' },
  approved:       { label: 'Approved',       badgeClass: 'bg-emerald-100 text-emerald-700',  borderClass: 'border-emerald-200', icon: CheckCircle2, iconClass: 'text-emerald-500' },
};

const NOTIF_ICON_CONFIG: Record<string, { icon: React.ElementType; iconClass: string }> = {
  form_submitted: { icon: ClipboardList, iconClass: 'text-sky-500 bg-sky-50' },
  form_approved:  { icon: CheckCircle2,  iconClass: 'text-emerald-500 bg-emerald-50' },
  form_returned:  { icon: RotateCcw,     iconClass: 'text-red-500 bg-red-50' },
  reminder:       { icon: Clock,         iconClass: 'text-amber-500 bg-amber-50' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calcCompletion(form: SkillForm | null): number {
  if (!form) return 0;
  let score = 20;
  if (form.total_exp !== null) score += 30;
  if (form.current_project) score += 30;
  if (form.status === 'pending_review' || form.status === 'approved') score += 20;
  return Math.min(score, 100);
}

function calcSteps(form: SkillForm | null) {
  return [
    { label: 'Profile Info', done: !!(form?.total_exp !== null && form?.total_exp !== undefined) },
    { label: 'Skills',       done: !!(form?.current_project) },
    { label: 'Submitted',    done: form?.status === 'pending_review' || form?.status === 'approved' },
  ];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, markRead } = useNotifications();

  const [form, setForm] = useState<SkillForm | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const state = location.state as { toast?: string } | null;
    if (state?.toast) {
      setToastMsg(state.toast);
      setToastVisible(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'employee') {
      setLoadingForm(false);
      return;
    }
    async function load() {
      const { data } = await supabase
        .from('skill_forms')
        .select('id, status, updated_at, submitted_at, total_exp, current_project')
        .eq('employee_id', user!.id)
        .maybeSingle();
      setForm(data as SkillForm | null);
      setLoadingForm(false);
    }
    load();
  }, [user]);

  const initials = user ? getInitials(user.full_name || user.email) : '??';
  const recentNotifs = notifications.slice(0, 3);
  const completion = calcCompletion(form);
  const statusCfg = form ? STATUS_CONFIG[form.status] : null;
  const isEmployee = user?.role === 'employee';

  async function handleNotifClick(n: Notification) {
    if (!n.is_read) await markRead(n.id);
    navigate('/form');
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="relative bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 md:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center ring-2 ring-white/30 shrink-0">
              <span className="text-white text-lg font-bold font-heading">{initials}</span>
            </div>
            <div>
              <p className="text-white/70 text-sm font-body">{greeting}</p>
              <h1 className="text-white font-heading font-bold text-2xl leading-tight">
                {user?.full_name || user?.email}
              </h1>
              <p className="text-white/60 text-xs font-body mt-0.5">
                {user?.designation || 'Employee'}
                {user?.grade ? ` · ${user.grade}` : ''}
              </p>
            </div>
          </div>
        </div>

        {isEmployee ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                    <ClipboardList size={15} className="text-primary-500" />
                  </div>
                  <h2 className="font-heading font-bold text-base text-gray-900">My Skill Profile</h2>
                </div>
                {statusCfg && (
                  <span className={`flex items-center gap-1.5 text-xs font-semibold font-heading px-3 py-1.5 rounded-full border ${statusCfg.borderClass} ${statusCfg.badgeClass}`}>
                    <statusCfg.icon size={11} className={statusCfg.iconClass} />
                    {statusCfg.label}
                  </span>
                )}
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {loadingForm ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-full rounded-full" />
                  <div className="flex gap-4 pt-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-18" />
                  </div>
                  <Skeleton className="h-9 w-40 rounded-xl mt-3" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-body">
                      <span className="text-gray-500">Profile Completion</span>
                      <span className={`font-semibold font-heading ${completion === 100 ? 'text-emerald-600' : 'text-primary-500'}`}>
                        {completion}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          completion === 100 ? 'bg-emerald-400' : completion >= 60 ? 'bg-accent-400' : 'bg-primary-300'
                        }`}
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-5 pt-1">
                      {calcSteps(form).map((step) => (
                        <div key={step.label} className="flex items-center gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${step.done ? 'bg-emerald-400' : 'bg-gray-200'}`}>
                            {step.done && (
                              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                                <path d="M1 3.5L2.8 5.5L6 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[11px] font-body ${step.done ? 'text-emerald-600' : 'text-gray-400'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {form && (
                    <p className="text-xs text-gray-400 font-body">
                      Last updated: {formatDate(form.updated_at)}
                      {form.submitted_at ? ` · Submitted: ${formatDate(form.submitted_at)}` : ''}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    {(!form || form.status === 'draft' || form.status === 'returned') ? (
                      <button
                        onClick={() => navigate('/form')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all shadow-sm shadow-primary-200"
                      >
                        <Pencil size={14} />
                        {!form ? 'Start Profile' : form.status === 'returned' ? 'Revise & Resubmit' : 'Continue Profile'}
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/form')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold font-heading hover:bg-gray-50 transition-all"
                      >
                        <FileText size={14} />
                        View Profile
                      </button>
                    )}

                    {form?.status === 'returned' && (
                      <p className="flex items-center gap-1.5 text-xs text-orange-600 font-body">
                        <RotateCcw size={12} />
                        Your form was returned for revision
                      </p>
                    )}
                    {form?.status === 'pending_review' && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600 font-body">
                        <Clock size={12} />
                        Awaiting manager review
                      </p>
                    )}
                    {form?.status === 'approved' && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-body">
                        <CheckCircle2 size={12} />
                        Your profile has been approved
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                <ClipboardList size={15} className="text-primary-500" />
              </div>
              <h2 className="font-heading font-bold text-base text-gray-900">Quick Links</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Inbox',         desc: 'Review team skill forms',          path: '/inbox',         roles: ['manager', 'tmg', 'admin'] },
                { label: 'TMG Dashboard', desc: 'View all employee skill profiles', path: '/tmg-dashboard', roles: ['tmg', 'admin'] },
                { label: 'Form Status',   desc: 'Track submission progress',        path: '/status',        roles: ['tmg', 'admin'] },
                { label: 'Reports',       desc: 'Analytics and skill insights',     path: '/reports',       roles: ['management', 'admin'] },
                { label: 'Users',         desc: 'Manage users and roles',           path: '/admin',         roles: ['admin'] },
                { label: 'Power BI Guide', desc: 'Connect exports to Power BI',    path: '/help/powerbi',  roles: ['tmg', 'management', 'admin'] },
              ].filter((l) => user && l.roles.includes(user.role)).map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-primary-50 hover:border-primary-100 transition-all group text-left"
                >
                  <div>
                    <p className="text-sm font-semibold font-heading text-gray-800 group-hover:text-primary-700">{link.label}</p>
                    <p className="text-xs text-gray-400 font-body mt-0.5">{link.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-primary-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent-50 flex items-center justify-center">
                <Bell size={15} className="text-accent-500" />
              </div>
              <h2 className="font-heading font-bold text-base text-gray-900">Recent Notifications</h2>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold font-heading text-gray-400">
              <ChevronRight size={13} />
            </span>
          </div>

          {recentNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <Bell size={22} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400 font-body">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentNotifs.map((n) => {
                const cfg = NOTIF_ICON_CONFIG[n.type] ?? { icon: Bell, iconClass: 'text-gray-400 bg-gray-100' };
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50/70 transition-colors ${!n.is_read ? 'border-l-2 border-cyan-400' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconClass}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-body leading-snug ${n.is_read ? 'text-gray-400' : 'text-gray-700'}`}>{n.message}</p>
                      <p className="text-[11px] text-gray-400 font-body mt-0.5">{relativeTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-2" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </AppShell>
  );
}
