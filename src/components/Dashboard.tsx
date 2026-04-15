import {
  TrendingUp,
  Users,
  BookOpen,
  Award,
  ArrowUpRight,
  Zap,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const stats = [
  {
    label: 'Active Learners',
    value: '284',
    change: '+12%',
    positive: true,
    icon: Users,
    color: 'bg-primary-50 text-primary-500',
    iconBg: 'bg-primary-100',
  },
  {
    label: 'Skills Tracked',
    value: '1,438',
    change: '+8%',
    positive: true,
    icon: TrendingUp,
    color: 'bg-accent-50 text-accent-600',
    iconBg: 'bg-accent-100',
  },
  {
    label: 'Courses Completed',
    value: '673',
    change: '+24%',
    positive: true,
    icon: BookOpen,
    color: 'bg-emerald-50 text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  {
    label: 'Certifications',
    value: '92',
    change: '+5%',
    positive: true,
    icon: Award,
    color: 'bg-amber-50 text-amber-600',
    iconBg: 'bg-amber-100',
  },
];

const recentActivities = [
  { user: 'Alex Chen', action: 'completed', item: 'React Advanced Patterns', time: '2h ago', type: 'course' },
  { user: 'Maria Santos', action: 'earned', item: 'AWS Solutions Architect', time: '4h ago', type: 'cert' },
  { user: 'David Kim', action: 'started', item: 'Python for Data Science', time: '6h ago', type: 'course' },
  { user: 'Priya Patel', action: 'completed', item: 'Leadership Fundamentals', time: '1d ago', type: 'course' },
  { user: 'Tom Walker', action: 'earned', item: 'Scrum Master Cert.', time: '1d ago', type: 'cert' },
];

const learningPaths = [
  { name: 'Frontend Engineering', progress: 68, members: 42, color: 'bg-accent-500' },
  { name: 'Data Science & ML', progress: 45, members: 31, color: 'bg-primary-400' },
  { name: 'DevOps & Cloud', progress: 82, members: 28, color: 'bg-emerald-500' },
  { name: 'Product Management', progress: 37, members: 19, color: 'bg-amber-500' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-primary-500 to-primary-400 rounded-2xl p-6 md:p-8 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-40 h-40 bg-accent-500/20 rounded-full translate-y-1/2" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-accent-300" />
            <span className="text-accent-200 text-sm font-medium font-heading tracking-wide uppercase">
              Good morning
            </span>
          </div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2">
            Welcome back, Jordan!
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-lg font-body">
            Your team has logged <span className="text-accent-300 font-semibold">142 learning hours</span> this week.
            Three members are close to completing their certification paths.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <button className="bg-accent-500 hover:bg-accent-400 text-white text-sm font-semibold font-heading px-4 py-2 rounded-lg transition-colors">
              View Team Progress
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold font-heading px-4 py-2 rounded-lg transition-colors border border-white/20">
              Assign Learning Path
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                <stat.icon size={18} className={stat.color.split(' ')[1]} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold font-heading ${stat.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                <ArrowUpRight size={12} />
                {stat.change}
              </span>
            </div>
            <p className="font-heading font-bold text-2xl text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 font-body mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-heading font-semibold text-base text-gray-900">Learning Paths Overview</h2>
            <button className="text-xs text-accent-600 font-semibold font-heading hover:underline">View all</button>
          </div>
          <div className="p-6 space-y-5">
            {learningPaths.map((path) => (
              <div key={path.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 font-body">{path.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-body flex items-center gap-1">
                      <Users size={11} />
                      {path.members}
                    </span>
                    <span className="text-sm font-bold text-gray-800 font-heading w-10 text-right">{path.progress}%</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${path.color}`}
                    style={{ width: `${path.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-heading font-semibold text-base text-gray-900">Recent Activity</h2>
            <button className="text-xs text-accent-600 font-semibold font-heading hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-bglight transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${activity.type === 'cert' ? 'bg-amber-100 text-amber-600' : 'bg-primary-100 text-primary-500'}`}>
                  {activity.type === 'cert' ? <Award size={12} /> : <CheckCircle2 size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 font-body leading-snug">
                    <span className="font-semibold">{activity.user}</span>
                    {' '}{activity.action}{' '}
                    <span className="text-primary-500 font-medium">{activity.item}</span>
                  </p>
                  <p className="text-xs text-gray-400 font-body flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
