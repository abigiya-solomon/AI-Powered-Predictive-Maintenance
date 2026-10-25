import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-steel-800/80 bg-industrial-950 py-6 text-xs text-steel-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyanAccent-400" />
          <span>
            MetroPT-3 Rolling Stock Air Compressor Benchmark · Anomaly Detection System
          </span>
        </div>

        <div className="flex items-center gap-6 font-mono text-[11px] text-steel-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400/80" />
            Unsupervised One-Class SVM · Cadence: 0.1 Hz (10s)
          </span>
          <span className="text-steel-600">|</span>
          <span>Not certified for commercial failure signoff</span>
        </div>
      </div>
    </footer>
  );
};
