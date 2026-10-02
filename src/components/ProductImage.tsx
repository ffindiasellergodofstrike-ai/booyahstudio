import React, { useState } from 'react';
import { Code2, FileCode, LayoutTemplate, Wrench, GraduationCap, ShieldCheck, Terminal, Cpu } from 'lucide-react';
import { Product } from '../types';

interface ProductImageProps {
  product: Product;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const ProductImage: React.FC<ProductImageProps> = ({ product, className = '', size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const getCategoryTheme = (category: string) => {
    const cat = (category || '').toLowerCase();
    switch (cat) {
      case 'php-scripts':
      case 'scripts':
        return {
          gradient: 'from-blue-900 via-indigo-950 to-slate-900',
          accent: 'text-blue-400',
          badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          icon: Code2,
          lang: 'PHP 8.3 & Laravel',
          codeLine1: '$gateway = new PaymentManager();',
          codeLine2: '$tenant = Tenant::identifyDomain($req);',
          codeLine3: 'return Response::json(["status" => 200]);',
        };
      case 'source-code':
        return {
          gradient: 'from-sky-950 via-slate-900 to-indigo-950',
          accent: 'text-sky-400',
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          icon: FileCode,
          lang: 'TypeScript & React 19',
          codeLine1: 'const { socket, send } = useWebSocket();',
          codeLine2: 'await orchestrateNodes(workflow.steps);',
          codeLine3: 'export default memo(ChatEngineProvider);',
        };
      case 'templates':
        return {
          gradient: 'from-indigo-950 via-purple-950 to-slate-900',
          accent: 'text-indigo-400',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          icon: LayoutTemplate,
          lang: 'Tailwind CSS v4 & React',
          codeLine1: '<div className="grid grid-cols-12 gap-6">',
          codeLine2: '  <MetricChart dataset={analytics.mrr} />',
          codeLine3: '  <DataTable columns={tableHeaders} />',
        };
      case 'tools':
        return {
          gradient: 'from-emerald-950 via-slate-900 to-teal-950',
          accent: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: Wrench,
          lang: 'Node CLI & Rust Engine',
          codeLine1: '$ npx booyah-studio-optimize --watch --all',
          codeLine2: '[OK] Compressed 240 SVGs (-68.4% savings)',
          codeLine3: '[OK] TypeScript declaration map emitted.',
        };
      case 'courses':
        return {
          gradient: 'from-amber-950 via-slate-900 to-stone-900',
          accent: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: GraduationCap,
          lang: '4K Masterclass & Lab Repo',
          codeLine1: 'Lesson 42: Zero-Downtime Blue/Green Deploy',
          codeLine2: 'Lab: Broken Object Level Auth (BOLA)',
          codeLine3: 'Certificate of Mastery Included',
        };
      default:
        return {
          gradient: 'from-slate-900 via-slate-950 to-slate-900',
          accent: 'text-blue-400',
          badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          icon: Cpu,
          lang: 'Digital Product',
          codeLine1: 'Production Ready Source Code',
          codeLine2: 'Instant Secure Download',
          codeLine3: 'Lifetime Free Updates',
        };
    }
  };

  const theme = getCategoryTheme(product.category);
  const Icon = theme.icon;

  if (product.image && !imgError) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200/80 shadow-xs bg-slate-900 ${className}`}>
        <img
          src={product.image}
          alt={product.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden select-none bg-gradient-to-br ${theme.gradient} text-white flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-slate-800 shadow-inner group-hover:border-blue-500/50 transition-all duration-300 ${className}`}
    >
      {/* Background Matrix & Subtle Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />

      {/* Glow Effect */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500" />

      {/* Top Bar: Category Pill & Version */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border backdrop-blur-md ${theme.badgeBg}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {product.categoryLabel}
        </span>
        {product.version && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
            <Terminal className="w-3 h-3 text-slate-500" />
            {product.version}
          </span>
        )}
      </div>

      {/* Center Simulated Code / UI Snippet */}
      <div className="relative z-10 my-auto py-2">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 backdrop-blur-sm shadow-md font-mono text-[11px] sm:text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500/70" />
              <span className="w-2 h-2 rounded-full bg-amber-500/70" />
              <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
            </div>
            <span className="text-slate-400 truncate max-w-[150px]">{theme.lang}</span>
          </div>
          <div className="space-y-1 text-slate-300">
            <p className="truncate text-slate-300">{theme.codeLine1}</p>
            <p className={`truncate font-semibold ${theme.accent}`}>{theme.codeLine2}</p>
            <p className="truncate text-slate-400">{theme.codeLine3}</p>
          </div>
        </div>
      </div>

      {/* Bottom Row: Trust Tags */}
      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] sm:text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Verified Source
        </span>
        <span className="text-slate-400">{product.fileSize || 'Instant .ZIP'}</span>
      </div>
    </div>
  );
};
