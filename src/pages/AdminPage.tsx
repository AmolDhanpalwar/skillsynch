import AppShell from '../components/layout/AppShell';
import { Users, Shield, Database, Settings, ChevronRight } from 'lucide-react';

const adminSections = [
  {
    icon: Users,
    title: 'User Management',
    description: 'Create, edit, and deactivate user accounts. Assign roles and managers.',
    color: 'bg-primary-50 text-primary-500',
  },
  {
    icon: Shield,
    title: 'Roles & Permissions',
    description: 'Configure role-based access controls and permission sets.',
    color: 'bg-accent-50 text-accent-600',
  },
  {
    icon: Database,
    title: 'Data & Exports',
    description: 'Export skill data, audit logs, and generate compliance reports.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Settings,
    title: 'System Settings',
    description: 'Configure application preferences, email templates, and integrations.',
    color: 'bg-amber-50 text-amber-600',
  },
];

export default function AdminPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 font-body mt-1">System configuration and user management.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {adminSections.map((section) => (
            <button
              key={section.title}
              className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md hover:border-gray-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl ${section.color} flex items-center justify-center mb-4`}>
                  <section.icon size={20} />
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              <p className="font-heading font-semibold text-gray-900 text-sm">{section.title}</p>
              <p className="text-xs text-gray-500 font-body mt-1 leading-relaxed">{section.description}</p>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
