import { ExternalLink, Shield, Building2, Globe } from 'lucide-react';

export function GovernmentLinksPage() {
  const portals = [
    {
      id: 'ssc',
      name: 'Staff Selection Commission (SSC)',
      shortName: 'SSC',
      description: 'Official portal for Staff Selection Commission recruitments, notifications, online applications, admit cards, and results across all India government departments.',
      url: 'https://ssc.gov.in/',
      badge: 'Official Central Portal',
      bgColor: 'bg-blue-50/50',
      borderColor: 'border-blue-100',
      accentColor: 'text-blue-600',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'appsc',
      name: 'Andhra Pradesh Public Service Commission (APPSC)',
      shortName: 'APPSC',
      description: 'Official application and recruitment portal for Andhra Pradesh Public Service Commission notifications, Group-I, Group-II, Gazetted and Non-Gazetted posts.',
      url: 'https://applications-psc.ap.gov.in/',
      badge: 'Official State Portal',
      bgColor: 'bg-emerald-50/50',
      borderColor: 'border-emerald-100',
      accentColor: 'text-emerald-600',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      id: 'rrb',
      name: 'Railway Recruitment Boards (RRB)',
      shortName: 'RRB',
      description: 'Official centralized application portal for Indian Railways recruitment examinations (NTPC, Group D, ALP, Technicians, Paramedical, and Junior Engineer posts).',
      url: 'https://www.rrbapply.gov.in/#/auth/home',
      badge: 'Official Railways Portal',
      bgColor: 'bg-amber-50/50',
      borderColor: 'border-amber-100',
      accentColor: 'text-amber-600',
      btnColor: 'bg-amber-600 hover:bg-amber-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Government Recruitment Portals
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Direct access to official government recruitment portals and application systems
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center space-x-2 text-xs text-slate-600">
          <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            SarkariJob indexes official government notifications. All application submissions and document verification must be performed on the official portals listed below.
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {portals.map((portal) => (
          <div
            key={portal.id}
            className={`bg-white rounded-xl border ${portal.borderColor} p-6 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${portal.bgColor} ${portal.accentColor} border-current/20`}>
                  {portal.badge}
                </span>
                <Building2 className={`w-5 h-5 ${portal.accentColor}`} />
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                {portal.name}
              </h2>

              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                {portal.description}
              </p>
            </div>

            <div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 font-medium font-mono truncate max-w-[150px]">
                  {new URL(portal.url).hostname}
                </div>

                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${portal.btnColor} shadow-xs`}
                >
                  <span>Official Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
