import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  UploadCloud,
  FileText,
  TrendingUp,
  Gauge,
  Thermometer,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { maintenanceService } from '../services/maintenanceService';
import { AnalysisResponse, HealthResponse } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(maintenanceService.isDemoMode());

  useEffect(() => {
    const unsub = maintenanceService.onModeChange((demo) => {
      setIsDemo(demo);
      loadDashboardData();
    });
    loadDashboardData();
    return unsub;
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load health / model status
      try {
        const healthData = await maintenanceService.getHealth();
        setHealth(healthData);
      } catch (hErr: any) {
        console.warn('Health check warning:', hErr.message);
      }

      // 2. Load active analysis from service
      let current = maintenanceService.getCurrentAnalysis();
      if (!current) {
        // Auto-load demo telemetry for instant exploration
        current = await maintenanceService.loadDemoAnalysis();
      }
      setAnalysis(current);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDemo = async () => {
    setLoading(true);
    try {
      const demoData = await maintenanceService.loadDemoAnalysis();
      setAnalysis(demoData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner label="Connecting to MetroPT-3 ML Engine..." size="lg" />
      </div>
    );
  }

  const summary = analysis?.summary;
  const records = analysis?.records || [];
  const modelMeta = analysis?.model;

  const anomalyCount = summary?.anomaly_count || 0;
  const totalRecords = summary?.records_analyzed || 0;
  const anomalyRate = summary?.anomaly_rate_percent || 0;

  const isAnomalous = anomalyCount > 0;
  const systemStatus = isAnomalous ? 'Warning / Anomalous' : 'Nominal / Healthy';

  // Sensor health summaries
  const latestRow = records[records.length - 1] || {};

  return (
    <div className="space-y-6">
      {/* Header and Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-steel-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-steel-100 tracking-tight">
              AI-Powered Predictive Maintenance
            </h1>
            {isDemo && (
              <Badge variant="warning">
                DEMONSTRATION DATA
              </Badge>
            )}
          </div>
          <p className="text-sm text-steel-400 mt-1 flex items-center gap-2">
            <span>Machine: <strong className="text-steel-200">Metro Train Air Compressor (MetroPT-3)</strong></span>
            <span className="text-steel-600">•</span>
            <span>Sampling: <strong className="text-steel-200">0.1 Hz (10s intervals)</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunDemo}
            className="font-mono text-xs"
          >
            Load Demo Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/upload')}
            className="font-mono text-xs"
          >
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Upload New CSV
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" title="Service Notice">
          {error}
        </Alert>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Machine Status */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-steel-400 uppercase tracking-wider">
              Health Status
            </span>
            {isAnomalous ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-steel-100 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isAnomalous ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              {systemStatus}
            </div>
            <p className="text-xs text-steel-400 mt-1">
              {anomalyCount} alert {anomalyCount === 1 ? 'cluster' : 'clusters'} detected
            </p>
          </div>
        </Card>

        {/* Analyzed Records */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-steel-400 uppercase tracking-wider">
              Telemetry Records
            </span>
            <FileText className="w-4 h-4 text-cyanAccent-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-steel-100 font-mono">
              {totalRecords.toLocaleString()}
            </div>
            <p className="text-xs text-steel-400 mt-1">
              Time range: {summary?.start_time ? summary.start_time.substring(11, 19) : '00:00:00'} →{' '}
              {summary?.end_time ? summary.end_time.substring(11, 19) : '00:00:00'}
            </p>
          </div>
        </Card>

        {/* Anomaly Rate */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-steel-400 uppercase tracking-wider">
              Anomaly Frequency
            </span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-steel-100 font-mono">
              {anomalyRate.toFixed(2)}%
            </div>
            <div className="w-full bg-steel-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full ${isAnomalous ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(100, Math.max(5, anomalyRate))}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Active Model */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-steel-400 uppercase tracking-wider">
              Inference Model
            </span>
            <Cpu className="w-4 h-4 text-steel-400" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-steel-100 font-mono truncate">
              {modelMeta?.name || 'M4_OneClassSVM'}
            </div>
            <p className="text-xs text-steel-400 mt-1 font-mono">
              Threshold: {summary?.threshold !== undefined ? summary.threshold.toFixed(4) : '-17.2312'}
            </p>
          </div>
        </Card>
      </div>

      {/* Sensor Health Quick Indicators */}
      <Card title="Pneumatic Subsystem Indicators" subtitle="Latest recorded physical parameters">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Reservoir (bar)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.Reservoirs !== undefined ? latestRow.Reservoirs.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-emerald-400">Target: 8.2-10.0</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Outlet TP2 (bar)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.TP2 !== undefined ? latestRow.TP2.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">Delivery line</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Panel TP3 (bar)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.TP3 !== undefined ? latestRow.TP3.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">Pneumatic panel</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Separator H1 (bar)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.H1 !== undefined ? latestRow.H1.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">Cyclonic unit</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Purge DV (bar)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.DV_pressure !== undefined ? latestRow.DV_pressure.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">Exhaust valve</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Oil Temp (°C)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.Oil_temperature !== undefined ? latestRow.Oil_temperature.toFixed(1) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">Normal: 50-75°C</span>
          </div>

          <div className="bg-industrial-950 p-3 rounded-lg border border-steel-800">
            <span className="text-[10px] font-mono text-steel-400 uppercase block">Motor (A)</span>
            <div className="text-lg font-bold font-mono text-steel-100 mt-1">
              {latestRow.Motor_current !== undefined ? latestRow.Motor_current.toFixed(2) : '--'}
            </div>
            <span className="text-[10px] text-steel-400">{latestRow.Motor_current > 1.0 ? 'Pumping' : 'Idle'}</span>
          </div>
        </div>
      </Card>

      {/* Main Multi-Sensor Chart */}
      <Card
        title="Multi-Sensor Pressure & Operating Dynamics"
        subtitle="10-second interval telemetry with anomaly markers"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/results')}
            className="text-xs"
          >
            Detailed Sensor Analysis →
          </Button>
        }
      >
        <div className="h-80 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records.slice(-150)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748B"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(t) => (t ? t.substring(11, 16) : '')}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B132B',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey="Reservoirs"
                name="Main Reservoirs (bar)"
                stroke="#00B4D8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="TP2"
                name="Outlet Pressure TP2 (bar)"
                stroke="#FFB703"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Motor_current"
                name="Motor Current (A)"
                stroke="#06D6A0"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Anomaly Timeline & Score Profile */}
      <Card
        title="Anomaly Score Profile & Decision Boundary"
        subtitle={`Decision threshold: ${summary?.threshold !== undefined ? summary.threshold.toFixed(4) : '-17.2312'} (higher score = more anomalous)`}
      >
        <div className="h-60 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={records.slice(-150)}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF476F" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#EF476F" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748B"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(t) => (t ? t.substring(11, 16) : '')}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B132B',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="anomaly_score"
                name="Anomaly Score"
                stroke="#EF476F"
                fillOpacity={1}
                fill="url(#scoreGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Domain Methodology Caveat */}
      <div className="p-4 bg-industrial-900 border border-steel-800 rounded-xl text-xs text-steel-400 space-y-1">
        <h4 className="font-semibold text-steel-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyanAccent-400" />
          Technical & Methodological Note: MetroPT-3 Anomaly Detection
        </h4>
        <p>
          The MetroPT-3 compressor dataset contains sparse maintenance-log reference episodes rather than pointwise verified fault labels.
          Flagged anomalous points represent statistical divergence from normal operational baseline cycles (One-Class SVM kernel hypersphere).
          They indicate operating states requiring technician verification, not certified automatic mechanical failure diagnoses.
        </p>
      </div>
    </div>
  );
};
