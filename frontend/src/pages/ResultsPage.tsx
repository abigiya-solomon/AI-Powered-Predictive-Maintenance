import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Thermometer,
  Zap,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight
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
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { maintenanceService } from '../services/maintenanceService';
import { TelemetryRecord } from '../types';

export const ResultsPage: React.FC = () => {
  const analysis = maintenanceService.getCurrentAnalysis();
  const records: TelemetryRecord[] = useMemo(() => analysis?.records || [], [analysis]);
  const summary = analysis?.summary;
  const threshold = summary?.threshold ?? -17.2312;

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'anomalies' | 'normal'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 20;

  // Filtered rows for the table
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter === 'anomalies' && r.is_anomaly !== 1) return false;
      if (statusFilter === 'normal' && r.is_anomaly === 1) return false;
      if (searchTerm && !r.timestamp.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [records, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  if (!analysis) {
    return (
      <div className="py-20 text-center space-y-4">
        <Activity className="w-12 h-12 text-steel-500 mx-auto" />
        <h2 className="text-xl font-bold text-steel-200">No Analysis Telemetry Loaded</h2>
        <p className="text-sm text-steel-400 max-w-md mx-auto">
          Please upload a compressor telemetry CSV file or run the sample dataset to inspect scored results.
        </p>
        <Button variant="primary" onClick={() => (window.location.href = '/upload')}>
          Go to Upload Page
        </Button>
      </div>
    );
  }

  // Pressure differential scatter dataset
  const scatterData = records.slice(-200).map((r) => ({
    timestamp: r.timestamp,
    tp2: r.TP2,
    reservoirs: r.Reservoirs,
    motorCurrent: r.Motor_current,
    anomaly: r.is_anomaly === 1 ? 'Anomaly' : 'Normal',
    score: r.anomaly_score,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-steel-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-steel-100 tracking-tight">
            Detailed Sensor Trends & Anomaly Scoring
          </h1>
          <p className="text-xs text-steel-400 font-mono mt-1">
            Analysis ID: {analysis.analysis_id} · Model: {analysis.model.name} · Threshold: {threshold.toFixed(4)}
          </p>
        </div>

        <a
          href={maintenanceService.getDownloadUrl(analysis.analysis_id)}
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium bg-steel-800 hover:bg-steel-700 text-steel-100 border border-steel-700 shadow-sm"
        >
          <Download className="w-4 h-4 text-cyanAccent-400" />
          Download Scored Dataset
        </a>
      </div>

      {/* Analytical Caution Alert */}
      <Alert type="warning" title="Interpretation Protocol">
        Statistical anomaly flags indicate multi-sensor divergence from the baseline One-Class SVM
        hypersphere. These are exploratory signals and do not represent confirmed mechanical failure
        diagnoses. Cross-reference flagged timestamps with physical depot maintenance work orders.
      </Alert>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-[11px] font-mono text-steel-400 uppercase">Records Evaluated</span>
          <div className="text-xl font-bold text-steel-100 font-mono mt-1">
            {summary?.records_analyzed.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-mono text-steel-400 uppercase">Flagged Alerts</span>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
            {summary?.anomaly_count.toLocaleString()} ({summary?.anomaly_rate_percent}%)
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-mono text-steel-400 uppercase">Decision Threshold</span>
          <div className="text-xl font-bold text-steel-100 font-mono mt-1">
            {threshold.toFixed(4)}
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-[11px] font-mono text-steel-400 uppercase">Anomaly Score Range</span>
          <div className="text-sm font-bold text-steel-200 font-mono mt-2">
            [{summary?.score_min.toFixed(2)} → {summary?.score_max.toFixed(2)}]
          </div>
        </Card>
      </div>

      {/* Chart 1: Anomaly Score Profile vs Decision Threshold */}
      <Card
        title="Anomaly Score Trajectory vs. Decision Threshold"
        subtitle="Higher score indicates stronger statistical divergence from normal compressor operating manifold"
      >
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records.slice(-250)}>
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
              <ReferenceLine
                y={threshold}
                stroke="#FFB703"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Threshold (${threshold.toFixed(2)})`,
                  fill: '#FFB703',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
              <Line
                type="monotone"
                dataKey="anomaly_score"
                name="Anomaly Score"
                stroke="#EF476F"
                strokeWidth={1.8}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart 2: Pressure Relationships (TP2, TP3, Reservoirs, DV_pressure) */}
      <Card
        title="Pneumatic Pressure Dynamics (TP2, TP3, Reservoirs, DV_pressure)"
        subtitle="Tracking compressor delivery, control panel, main reservoir, and purge line pressures (bar)"
      >
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records.slice(-250)}>
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
                name="Delivery Pressure TP2 (bar)"
                stroke="#F77F00"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="TP3"
                name="Panel Pressure TP3 (bar)"
                stroke="#3A86FF"
                strokeWidth={1.2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="DV_pressure"
                name="Purge Valve DV (bar)"
                stroke="#EF476F"
                strokeWidth={1.2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart 3: Thermal & Electromechanical State */}
      <Card
        title="Electromechanical & Thermal Behavior"
        subtitle="Motor Current (A) and Oil Temperature (°C) correlation"
      >
        <div className="h-64 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records.slice(-250)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748B"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(t) => (t ? t.substring(11, 16) : '')}
              />
              <YAxis
                yAxisId="left"
                stroke="#06D6A0"
                tick={{ fontSize: 10, fill: '#06D6A0' }}
                domain={['auto', 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#FFB703"
                tick={{ fontSize: 10, fill: '#FFB703' }}
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
                yAxisId="left"
                type="monotone"
                dataKey="Motor_current"
                name="Motor Current (A)"
                stroke="#06D6A0"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Oil_temperature"
                name="Oil Temperature (°C)"
                stroke="#FFB703"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Filterable Anomaly Records Table */}
      <Card
        title="Scored Telemetry Log & Anomaly Inspector"
        subtitle={`Showing ${paginatedRecords.length} of ${filteredRecords.length} records`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-steel-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter timestamp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg text-xs bg-industrial-950 border border-steel-700 text-steel-200 focus:outline-none focus:border-cyanAccent-500 font-mono w-44"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e: any) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg text-xs bg-industrial-950 border border-steel-700 text-steel-200 focus:outline-none focus:border-cyanAccent-500 font-mono"
            >
              <option value="all">All Records</option>
              <option value="anomalies">Anomalies Only</option>
              <option value="normal">Normal Only</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto border border-steel-800 rounded-lg mt-3">
          <table className="w-full text-xs font-mono text-left text-steel-300">
            <thead className="bg-industrial-950 text-steel-400 border-b border-steel-800 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Score</th>
                <th className="px-3 py-2.5">Reservoir</th>
                <th className="px-3 py-2.5">TP2</th>
                <th className="px-3 py-2.5">TP3</th>
                <th className="px-3 py-2.5">DV Press</th>
                <th className="px-3 py-2.5">Motor (A)</th>
                <th className="px-3 py-2.5">Oil Temp</th>
                <th className="px-3 py-2.5">Δ(TP2-TP3)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-800">
              {paginatedRecords.map((r, idx) => {
                const isAlert = r.is_anomaly === 1;
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-industrial-800/50 transition-colors ${
                      isAlert ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{r.timestamp}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isAlert ? (
                        <Badge variant="warning">ALERT</Badge>
                      ) : (
                        <Badge variant="healthy">NORMAL</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-bold">
                      <span className={isAlert ? 'text-amber-400' : 'text-steel-300'}>
                        {r.anomaly_score !== undefined ? r.anomaly_score.toFixed(4) : '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.Reservoirs?.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.TP2?.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.TP3?.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.DV_pressure?.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={r.Motor_current > 1.0 ? 'text-emerald-400' : 'text-steel-400'}>
                        {r.Motor_current?.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.Oil_temperature?.toFixed(1)}°C</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.delta_TP2_TP3 !== undefined ? r.delta_TP2_TP3.toFixed(2) : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 text-xs font-mono text-steel-400">
          <div>
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
