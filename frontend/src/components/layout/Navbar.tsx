import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  UploadCloud,
  BarChart3,
  Award,
  Bot,
  Zap,
  Radio,
  Server
} from 'lucide-react';
import { maintenanceService } from '../../services/maintenanceService';

export const Navbar: React.FC = () => {
  const [isDemo, setIsDemo] = useState(maintenanceService.isDemoMode());

  useEffect(() => {
    return maintenanceService.onModeChange((demo) => {
      setIsDemo(demo);
    });
  }, []);

  const handleToggleMode = () => {
    maintenanceService.setDemoMode(!isDemo);
  };

  const navItems = [
    { to: '/', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { to: '/upload', label: 'Upload & Analysis', icon: <UploadCloud className="w-4 h-4" /> },
    { to: '/results', label: 'Sensor Results', icon: <BarChart3 className="w-4 h-4" /> },
    { to: '/benchmark', label: 'Model Benchmark', icon: <Award className="w-4 h-4" /> },
    { to: '/assistant', label: 'AI Assistant', icon: <Bot className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-industrial-950/90 backdrop-blur-md border-b border-steel-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-industrial-800 border border-steel-700/60 rounded-lg text-cyanAccent-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-steel-100 uppercase">
                MetroPT-3 AI
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-industrial-800 text-steel-400 border border-steel-700 font-mono">
                APU Compressor
              </span>
            </div>
            <p className="text-[11px] text-steel-400 font-mono">
              Predictive Maintenance & Machine Health
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-industrial-800 text-cyanAccent-400 border border-steel-700/80 shadow-sm'
                    : 'text-steel-400 hover:text-steel-200 hover:bg-industrial-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Environment / Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMode}
            title={isDemo ? 'Switch to live Flask REST API' : 'Switch to offline demo mode'}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border transition-all ${
              isDemo
                ? 'bg-amber-950/80 border-amber-600/70 text-amber-300 hover:bg-amber-900/60'
                : 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/60'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
              }`}
            />
            <span>{isDemo ? 'DEMO MODE' : 'LIVE API'}</span>
            <span className="text-[10px] opacity-60 underline ml-1">
              {isDemo ? '(toggle to live)' : '(toggle to demo)'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
