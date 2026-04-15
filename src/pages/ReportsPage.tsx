import AppShell from '../components/layout/AppShell';
import { BarChart2, TrendingUp, Users, Award } from 'lucide-react';

export default function ReportsPage() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 font-body mt-1">Organisation-wide skill insights and workforce analytics.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees', value: '284', icon: Users, color: 'text-primary-500', bg: 'bg-primary-50' },
            { label: 'Forms Approved', value: '142', icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Avg. Skill Score', value: '3.2', icon: TrendingUp, color: 'text-accent-600', bg: 'bg-accent-50' },
            { label: 'Reports Generated', value: '18', icon: BarChart2, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon size={18} className={s.color} />
              </div>
              <p className="font-heading font-bold text-2xl text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-body mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-8 flex flex-col items-center justify-center text-center min-h-64">
          <BarChart2 size={40} className="text-gray-200 mb-4" />
          <p className="font-heading font-semibold text-gray-400">Detailed reports coming soon</p>
          <p className="text-sm text-gray-400 font-body mt-1">Charts and export features will appear here.</p>
        </div>
      </div>
    </AppShell>
  );
}
