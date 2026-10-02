import React from 'react';
import { ShieldCheck, Clock, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { policyData } from '../../data/policyData';

interface PolicyDetailsPageProps {
  slug: string;
}

export const PolicyDetailsPage: React.FC<PolicyDetailsPageProps> = ({ slug }) => {
  const { navigate } = useApp();
  const policy = policyData[slug];

  if (!policy) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Policy Not Found</h1>
        <p className="text-slate-600 text-sm">
          The legal guidelines you are searching for do not exist or have been moved.
        </p>
        <button
          onClick={() => navigate('/policies')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
        >
          Return to Legal Center
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Main Page Title Header */}
      <div className="mt-4 mb-8 pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>BOOYAH STUDIO Store Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{policy.title}</h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-3xl leading-relaxed">{policy.subtitle}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Effective/Last Updated: {policy.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Quick Summary Bento */}
      {policy.quickSummary && policy.quickSummary.length > 0 && (
        <div className="mb-10 p-6 rounded-3xl bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-slate-50/50 border border-blue-100/70 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm mb-4">
            <FileText className="w-4.5 h-4.5 text-blue-600" />
            <span className="uppercase tracking-wider">Policy Highlights</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-700">
            {policy.quickSummary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-snug">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0 animate-pulse" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Sidebar Navigation - Flat */}
        <div className="hidden lg:block lg:col-span-3 sticky top-28">
          <p className="text-xxs font-black uppercase tracking-widest text-slate-400 mb-3">Sections</p>
          <nav className="space-y-1">
            {policy.sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="block text-xs font-semibold text-slate-500 hover:text-blue-600 py-2 transition-all truncate border-l border-slate-100 hover:border-blue-500 pl-3 -ml-px"
              >
                {sec.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Content Body - Flat Editorial Layout */}
        <div className="lg:col-span-9 space-y-12">
          {policy.sections.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className="scroll-mt-28 space-y-4"
            >
              <div className="border-b border-slate-200/80 pb-3">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  {sec.title}
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {sec.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
