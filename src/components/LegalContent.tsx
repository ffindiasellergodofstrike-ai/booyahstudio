import React from 'react';
import { ShieldCheck, Clock, FileText } from 'lucide-react';
import { Breadcrumb } from './Breadcrumb';

interface LegalSection {
  id: string;
  title: string;
  content: string | React.ReactNode;
}

interface LegalContentProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
  quickSummary?: string[];
}

export const LegalContent: React.FC<LegalContentProps> = ({
  title,
  subtitle,
  lastUpdated,
  sections,
  quickSummary,
}) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: 'Legal Center', path: '/terms' },
          { label: title },
        ]}
      />

      {/* Header */}
      <div className="mt-4 mb-8 pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official Booyahstudio Policy
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-600 text-base mt-2 max-w-2xl">{subtitle}</p>
          <div className="flex items-center gap-2 text-xs text-slate-600 mt-3 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Last revised: {lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Quick Summary Bento if provided */}
      {quickSummary && quickSummary.length > 0 && (
        <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Summary Key Points</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700">
            {quickSummary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Grid: Sidebar Table of Contents + Body */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Table of Contents Sticky */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-28 p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 px-2">On this page</p>
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="block text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg px-2.5 py-1.5 transition-colors truncate"
              >
                {sec.title}
              </a>
            ))}
          </div>
        </div>

        {/* Content Sections */}
        <div className="lg:col-span-3 space-y-10">
          {sections.map((section, idx) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              </div>
              <div className="text-sm sm:text-base text-slate-600 leading-relaxed space-y-4">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
