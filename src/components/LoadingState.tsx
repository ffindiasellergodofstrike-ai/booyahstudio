import React from 'react';

export const LoadingState: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse flex flex-col"
        >
          <div className="h-48 bg-slate-200 w-full" />
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-5 bg-slate-200 rounded w-4/5" />
              <div className="h-3.5 bg-slate-200 rounded w-full" />
              <div className="h-3.5 bg-slate-200 rounded w-2/3" />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="h-6 bg-slate-200 rounded w-1/4" />
              <div className="h-9 bg-slate-200 rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
