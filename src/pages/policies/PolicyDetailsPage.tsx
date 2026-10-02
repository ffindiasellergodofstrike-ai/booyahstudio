import React, { useEffect } from 'react';
import { ShieldCheck, Clock, FileText, ChevronRight, BookOpen } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  policyData,
  POLICY_REDIRECTS,
  SUPPORTED_POLICY_SLUGS,
  type SupportedPolicySlug,
} from '../../data/policyData';

interface PolicyDetailsPageProps {
  slug: string;
}

export const PolicyDetailsPage: React.FC<PolicyDetailsPageProps> = ({ slug }) => {
  const { navigate } = useApp();

  // Automatic client-side redirection for retired policy URLs
  useEffect(() => {
    const targetSlug = POLICY_REDIRECTS[slug];
    if (targetSlug) {
      navigate(`/policies/${targetSlug}`);
    }
  }, [slug, navigate]);

  const activeSlug = (POLICY_REDIRECTS[slug] || slug) as SupportedPolicySlug;
  const policy = policyData[activeSlug];

  useEffect(() => {
    if (policy) {
      document.title = `${policy.title} | BOOYAH STUDIO`;
    }
  }, [policy]);

  if (!policy) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Policy Not Found</h1>
        <p className="text-slate-600 text-sm">
          The policy you are searching for does not exist or has been consolidated.
        </p>
        <button
          onClick={() => navigate('/policies/terms')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md"
        >
          View Terms & Conditions
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">
          Home
        </button>
        <span className="text-slate-300">/</span>
        <button onClick={() => navigate('/policies/terms')} className="hover:text-blue-600 transition-colors">
          Policies
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 font-semibold truncate">{policy.title}</span>
      </div>

      {/* Top Category Header */}
      <div className="mt-2 mb-6 pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Store Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {policy.title}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-3xl leading-relaxed">
            {policy.subtitle}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Effective / Last Updated: {policy.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Quick Summary Highlights */}
      {policy.quickSummary && policy.quickSummary.length > 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-slate-50/50 border border-blue-100/70 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm mb-4">
            <FileText className="w-4.5 h-4.5 text-blue-600" />
            <span className="uppercase tracking-wider">Policy Highlights</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-slate-700">
            {policy.quickSummary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-snug">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0 animate-pulse" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Sidebar: All Policies & In-Page Sections */}
        <aside className="lg:col-span-3 space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {/* Policy Switcher */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xxs font-black uppercase tracking-widest text-slate-500 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Policies</span>
            </div>
            <nav className="space-y-1" aria-label="All Policies">
              {SUPPORTED_POLICY_SLUGS.map((slugKey) => {
                const item = policyData[slugKey];
                const isActive = slugKey === activeSlug;
                return (
                  <button
                    key={slugKey}
                    onClick={() => navigate(`/policies/${slugKey}`)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section Navigation for Current Policy */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <p className="text-xxs font-black uppercase tracking-widest text-slate-500 mb-2">
              On This Page
            </p>
            <nav aria-label="Policy sections" className="space-y-1">
              {policy.sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="block text-xs font-medium text-slate-500 hover:text-blue-600 py-1.5 transition-colors pl-2 border-l-2 border-slate-200 hover:border-blue-600"
                >
                  {sec.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Body: Full Policy Articles */}
        <main className="lg:col-span-9 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm space-y-10">
          {policy.sections.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className="scroll-mt-28 space-y-3 pb-8 border-b border-slate-100 last:border-b-0 last:pb-0"
            >
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {sec.title}
              </h2>
              <div className="text-sm sm:text-base text-slate-600 leading-7 font-normal whitespace-pre-line break-words">
                {sec.content}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};
