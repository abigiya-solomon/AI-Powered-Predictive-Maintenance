import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Download,
  Info,
  RefreshCw,
  Play
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { maintenanceService } from '../services/maintenanceService';
import { AnalysisResponse, ValidationResult } from '../types';
import { SAMPLE_METROPT3_CSV } from '../utils/sampleData';

const REQUIRED_SENSORS = [
  'TP2',
  'TP3',
  'H1',
  'DV_pressure',
  'Reservoirs',
  'Oil_temperature',
  'Motor_current',
  'COMP',
  'DV_eletric',
  'Towers',
  'MPG',
  'LPS',
  'Pressure_switch',
  'Oil_level',
  'Caudal_impulses',
];

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setError(null);
    setAnalysisResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Invalid file format. Please upload a comma-separated values (.csv) file.');
      return;
    }

    setSelectedFile(file);

    // Read first few lines for client-side quick validation and preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setError('CSV file appears empty or lacks data rows.');
          return;
        }

        const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        // Clean unnamed index column if present
        const headers = rawHeaders.filter((h) => h !== 'Unnamed: 0');

        const hasTimestamp = headers.some((h) =>
          ['timestamp', 'time', 'datetime', 'Timestamp'].includes(h)
        );

        const missing = REQUIRED_SENSORS.filter((s) => !headers.includes(s));
        const warnings: string[] = [];

        if (rawHeaders.includes('Unnamed: 0')) {
          warnings.push("Ignored redundant index column 'Unnamed: 0'.");
        }

        if (!hasTimestamp) {
          warnings.push("Missing required 'timestamp' column for chronological ordering.");
        }

        const previewRows: Record<string, any>[] = [];
        for (let i = 1; i < Math.min(6, lines.length); i++) {
          const vals = lines[i].split(',').map((v) => v.trim());
          const rowObj: Record<string, any> = {};
          rawHeaders.forEach((h, idx) => {
            rowObj[h] = vals[idx];
          });
          previewRows.push(rowObj);
        }

        const isValid = hasTimestamp && missing.length === 0;

        setValidation({
          isValid,
          filename: file.name,
          fileSizeBytes: file.size,
          columnsDetected: headers,
          missingColumns: missing,
          warnings,
          rowCount: lines.length - 1,
          previewRows,
        });
      } catch (err: any) {
        setError(`Failed to parse CSV preview: ${err.message}`);
      }
    };
    reader.readAsText(file.slice(0, 50000)); // Read first 50KB for preview
  };

  const handleUseSampleTelemetry = () => {
    setError(null);
    setAnalysisResult(null);
    const sampleBlob = new Blob([SAMPLE_METROPT3_CSV], { type: 'text/csv' });
    const sampleFile = new File([sampleBlob], 'sample_metropt3_telemetry.csv', {
      type: 'text/csv',
    });
    processSelectedFile(sampleFile);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await maintenanceService.analyzeCsv(selectedFile);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Inspect backend status and file schema.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidation(null);
    setAnalysisResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-steel-100 tracking-tight">
          Telemetry Upload & Anomaly Analysis
        </h1>
        <p className="text-sm text-steel-400 mt-1">
          Upload historical compressor sensor readings in CSV format to run feature engineering and
          detect anomalous operating regimes using the trained One-Class SVM model.
        </p>
      </div>

      {error && (
        <Alert type="error" title="Validation or Analysis Error">
          {error}
        </Alert>
      )}

      {/* Upload Dropzone */}
      <Card>
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              dragOver
                ? 'border-cyanAccent-500 bg-industrial-800/80'
                : 'border-steel-700 hover:border-steel-500 bg-industrial-950/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-industrial-800 rounded-full border border-steel-700 text-cyanAccent-400">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-steel-100">
                  Drag and drop compressor telemetry CSV here
                </h3>
                <p className="text-xs text-steel-400 mt-1 font-mono">
                  Expects MetroPT-3 sensor schema (TP2, TP3, H1, DV_pressure, Reservoirs, etc.)
                </p>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-mono"
                >
                  Browse Files
                </Button>
                <span className="text-xs text-steel-500 font-mono">or</span>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleUseSampleTelemetry}
                  className="font-mono text-cyanAccent-400 border-cyanAccent-500/40 hover:bg-cyanAccent-500/10"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Load Sample Telemetry
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-industrial-950 rounded-xl border border-steel-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-industrial-800 rounded-lg text-cyanAccent-400 border border-steel-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-steel-100 font-mono">
                  {selectedFile.name}
                </div>
                <div className="text-xs text-steel-400 font-mono mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB · {validation?.rowCount || 'Estimating'} rows
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                <XCircle className="w-4 h-4 mr-1 text-steel-400" />
                Remove File
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartAnalysis}
                isLoading={analyzing}
                disabled={validation !== null && !validation.isValid}
                className="font-mono"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Start Analysis
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Schema Verification Results */}
      {validation && (
        <Card
          title="Schema Verification & Pre-flight Inspection"
          subtitle={
            validation.isValid
              ? 'All required raw sensor columns and timestamps verified.'
              : 'Schema discrepancies detected.'
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {validation.isValid ? (
                <Badge variant="healthy">
                  <CheckCircle className="w-3.5 h-3.5" /> SCHEMA COMPLIANT
                </Badge>
              ) : (
                <Badge variant="critical">
                  <XCircle className="w-3.5 h-3.5" /> INCOMPLETE SCHEMA
                </Badge>
              )}
              <span className="text-xs font-mono text-steel-400">
                {validation.columnsDetected.length} columns detected
              </span>
            </div>

            {/* Missing columns alert */}
            {validation.missingColumns.length > 0 && (
              <Alert type="error" title="Missing Required Sensor Columns">
                The input CSV does not contain these required features:{' '}
                <strong className="font-mono">{validation.missingColumns.join(', ')}</strong>.
                Missing sensor columns cannot be silently filled with dummy values.
              </Alert>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <Alert type="warning" title="Data Notice">
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Sensor Columns Checklist */}
            <div>
              <span className="text-xs font-mono text-steel-400 uppercase tracking-wider block mb-2">
                Sensor Verification Matrix:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REQUIRED_SENSORS.map((s) => {
                  const isPresent = validation.columnsDetected.includes(s);
                  return (
                    <span
                      key={s}
                      className={`px-2 py-1 rounded text-[11px] font-mono border ${
                        isPresent
                          ? 'bg-industrial-800 text-steel-300 border-steel-700'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {isPresent ? '✓' : '✗'} {s}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Preview Table */}
            {validation.previewRows.length > 0 && (
              <div>
                <span className="text-xs font-mono text-steel-400 uppercase tracking-wider block mb-2">
                  First Rows Preview (First 5 records):
                </span>
                <div className="overflow-x-auto border border-steel-800 rounded-lg">
                  <table className="w-full text-xs font-mono text-left text-steel-300">
                    <thead className="bg-industrial-950 text-steel-400 border-b border-steel-800 uppercase text-[10px]">
                      <tr>
                        {Object.keys(validation.previewRows[0]).slice(0, 8).map((k) => (
                          <th key={k} className="px-3 py-2">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-800">
                      {validation.previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-industrial-800/40">
                          {Object.values(row).slice(0, 8).map((val, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 truncate max-w-[120px]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Analysis Complete Banner */}
      {analysisResult && (
        <Card className="border-cyanAccent-500/60 bg-gradient-to-r from-industrial-900 to-industrial-850">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-steel-100">
                  Analysis Successfully Completed
                </h3>
              </div>
              <p className="text-xs text-steel-300 mt-1 font-mono">
                Scored {analysisResult.summary.records_analyzed.toLocaleString()} records with{' '}
                <strong className="text-cyanAccent-400">{analysisResult.model.name}</strong>. Flagged{' '}
                <strong className="text-amber-400">{analysisResult.summary.anomaly_count}</strong> anomaly alerts (
                {analysisResult.summary.anomaly_rate_percent}%).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={maintenanceService.getDownloadUrl(analysisResult.analysis_id)}
                download
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-steel-800 hover:bg-steel-700 text-steel-200 border border-steel-700"
              >
                <Download className="w-4 h-4 text-cyanAccent-400" />
                Download Scored CSV
              </a>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/results')}
                className="font-mono text-xs"
              >
                Explore Results
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
