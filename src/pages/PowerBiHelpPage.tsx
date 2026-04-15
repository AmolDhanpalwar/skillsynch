import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Download,
  Database,
  RefreshCw,
  Cloud,
  ChevronRight,
  CheckCircle2,
  Info,
  ArrowLeft,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';

const STEPS = [
  {
    number: 1,
    icon: Download,
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-500',
    title: 'Export Excel from SkillSync',
    description: 'Navigate to the TMG Dashboard, click "Export to Excel" and choose your date range and status filter. The export generates a styled .xlsx file with two sheets.',
    details: [
      'Sheet 1 — "Skill Data": full employee profile, all languages/frameworks with self and manager ratings, certifications, and upskilling plans',
      'Sheet 2 — "Submission Tracker": form status, submission dates, days pending, and reminder counts',
      'Headers are formatted in navy (#1A3C5E) with auto-sized columns and a frozen first row for easy scrolling',
    ],
    tip: 'For automated refresh, save the file to a fixed OneDrive or SharePoint path that never changes.',
  },
  {
    number: 2,
    icon: Database,
    iconBg: 'bg-accent-50',
    iconColor: 'text-accent-500',
    title: 'Load Data in Power BI Desktop',
    description: 'Open Power BI Desktop, then use the Get Data dialog to connect to the exported Excel file.',
    details: [
      'In Power BI Desktop, click Home → Get Data → Excel Workbook',
      'Browse to your exported SkillSync .xlsx file and click Open',
      'In the Navigator pane, tick both "Skill Data" and "Submission Tracker" sheets',
      'Click Transform Data to open the Power Query Editor if you need to clean or reshape the data',
      'Click Load (or Close & Apply after transformations) to import both tables',
    ],
    tip: null,
  },
  {
    number: 3,
    icon: RefreshCw,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Build Your Reports',
    description: 'With both tables loaded, you can build rich visuals. The two tables can be related on Employee Name or Email.',
    details: [
      'Suggested visuals: Donut chart for status breakdown, Bar chart for top skills by manager rating, Matrix for self vs. manager ratings per skill',
      'Use conditional formatting on "Days Pending" to apply traffic-light colours (green < 3, amber 3–7, red > 7)',
      'Create a slicer on "Form Status" to filter all visuals on the page simultaneously',
      'The "Language Self-Ratings" and "Language Mgr Ratings" columns are semicolon-delimited — split them in Power Query for row-level analysis',
    ],
    tip: 'Use DAX measures like AVERAGE([Days Pending]) and COUNTROWS(FILTER(...)) for summary KPIs.',
  },
  {
    number: 4,
    icon: Cloud,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Publish & Schedule Auto-Refresh',
    description: 'Publish your report to Power BI Service so stakeholders can access it in a browser without installing Power BI Desktop.',
    details: [
      'In Power BI Desktop, click Home → Publish and select your target workspace',
      'In Power BI Service, open the dataset Settings and locate the Scheduled Refresh section',
      'Enable scheduled refresh and set the frequency to Daily (recommended: 07:00 AM before the business day starts)',
      'If your Excel file is on OneDrive for Business or SharePoint, Power BI will refresh it automatically without needing a gateway',
      'If the file is on a local drive, install and configure an On-premises Data Gateway for automated refresh to work',
    ],
    tip: 'Fix the file path by saving the Excel to OneDrive → SkillSync → Exports → skillsync-export.xlsx and always overwrite the same file when re-exporting.',
  },
];

const TIPS = [
  {
    icon: Cloud,
    title: 'OneDrive / SharePoint auto-refresh',
    body: 'Store your exported Excel at a fixed path on OneDrive for Business (e.g. /SkillSync/Exports/skillsync-export.xlsx). Power BI Service will automatically detect changes on its refresh schedule.',
  },
  {
    icon: RefreshCw,
    title: 'Overwrite, don\'t rename',
    body: 'Always overwrite the same file when re-exporting from SkillSync. If you save with a new date in the filename, Power BI loses the connection and refresh will fail.',
  },
  {
    icon: Database,
    title: 'Row-level security in Power BI',
    body: 'Consider applying Power BI Row-Level Security (RLS) so managers only see their team\'s data when viewing the published report.',
  },
];

export default function PowerBiHelpPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-body text-gray-400 hover:text-primary-500 transition-colors mb-4"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center">
              <HelpCircle size={20} className="text-primary-500" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl text-gray-900">Power BI Integration Guide</h1>
              <p className="text-sm text-gray-500 font-body">
                Connect SkillSync Excel exports to Power BI for live, shareable dashboards.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5 flex gap-3">
          <Info size={16} className="text-primary-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold font-heading text-primary-700 mb-1">Prerequisites</p>
            <p className="text-sm text-primary-600 font-body leading-relaxed">
              You need <strong>Power BI Desktop</strong> (free download from microsoft.com/powerbi) and a SkillSync Excel export. A Power BI Pro licence is required for publishing and scheduled refresh in Power BI Service.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === STEPS.length - 1;
            return (
              <div key={step.number} className="relative">
                {!isLast && (
                  <div className="absolute left-[19px] top-[56px] w-0.5 h-[calc(100%-16px)] bg-gray-100 z-0" />
                )}
                <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden z-10">
                  <div className="flex items-start gap-4 p-5 pb-4">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className={`w-10 h-10 rounded-2xl ${step.iconBg} flex items-center justify-center`}>
                        <Icon size={18} className={step.iconColor} />
                      </div>
                      <span className="text-[10px] font-bold font-heading text-gray-300">
                        STEP {step.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-heading font-bold text-base text-gray-900 mb-1.5 leading-tight">
                        {step.title}
                      </h2>
                      <p className="text-sm text-gray-600 font-body leading-relaxed mb-4">
                        {step.description}
                      </p>
                      <ul className="space-y-2">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-600 font-body leading-snug">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {step.tip && (
                    <div className="mx-5 mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 flex gap-2.5">
                      <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 font-body leading-relaxed">
                        <strong>Tip:</strong> {step.tip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="font-heading font-bold text-base text-gray-900 mb-4">Best Practices</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIPS.map((tip) => {
              const Icon = tip.icon;
              return (
                <div key={tip.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                    <Icon size={15} className="text-gray-500" />
                  </div>
                  <p className="font-heading font-semibold text-sm text-gray-800 mb-1.5">{tip.title}</p>
                  <p className="text-xs text-gray-500 font-body leading-relaxed">{tip.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
              <ChevronRight size={15} className="text-primary-500" />
            </div>
            <h2 className="font-heading font-bold text-base text-gray-900">Quick Start Checklist</h2>
          </div>
          <div className="space-y-2.5">
            {[
              'Export Excel from TMG Dashboard (date range: all time, status: all)',
              'Save to OneDrive: /SkillSync/Exports/skillsync-export.xlsx (overwrite if exists)',
              'Open Power BI Desktop → Get Data → Excel → select the file',
              'Load both "Skill Data" and "Submission Tracker" sheets',
              'Build visuals and publish to your Power BI workspace',
              'In Power BI Service, schedule daily refresh at 07:00 AM',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-400">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-600 font-body leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
