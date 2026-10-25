import { api } from './api';
import { mockApi } from './mockApi';
import {
  HealthResponse,
  AnalysisResponse,
  BenchmarkResponse,
  GeminiContextPayload,
  AssistantChatResponse
} from '../types';

const ENV_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

function formatServiceError(err: any, context: string): string {
  if (err.response?.data?.error) {
    return `${context}: ${err.response.data.error}`;
  }
  if (err.response?.status === 500) {
    return `${context}: Request returned status 500. The Flask ML service is either not running on port 5000 or encountered an unhandled exception. Start the service with 'python ml_service/app.py' or toggle DEMO MODE.`;
  }
  if (err.response?.status === 503) {
    return `${context}: ML Service unavailable (503). Ensure Flask is running or switch to DEMO MODE.`;
  }
  if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
    return `${context}: Connection refused to http://localhost:5000. Start the Flask service or toggle DEMO MODE.`;
  }
  return `${context}: ${err.message || 'Unknown network error'}`;
}

class MaintenanceService {
  private demoMode: boolean;
  private currentAnalysis: AnalysisResponse | null = null;
  private listeners: Array<(demo: boolean) => void> = [];

  constructor() {
    const saved = localStorage.getItem('metropt_demo_mode');
    this.demoMode = saved !== null ? saved === 'true' : ENV_DEMO_MODE;
  }

  public isDemoMode(): boolean {
    return this.demoMode;
  }

  public setDemoMode(value: boolean) {
    this.demoMode = value;
    localStorage.setItem('metropt_demo_mode', String(value));
    this.listeners.forEach(fn => fn(value));
  }

  public onModeChange(fn: (demo: boolean) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  public getCurrentAnalysis(): AnalysisResponse | null {
    if (this.currentAnalysis) return this.currentAnalysis;
    const cached = sessionStorage.getItem('metropt_current_analysis');
    if (cached) {
      try {
        this.currentAnalysis = JSON.parse(cached);
        return this.currentAnalysis;
      } catch {
        return null;
      }
    }
    return null;
  }

  public setCurrentAnalysis(analysis: AnalysisResponse) {
    this.currentAnalysis = analysis;
    try {
      sessionStorage.setItem('metropt_current_analysis', JSON.stringify(analysis));
    } catch {
      // Storage quota safety
    }
  }

  // --- API Gateways ---

  async getHealth(): Promise<HealthResponse> {
    if (this.demoMode) {
      return mockApi.getHealth();
    }
    try {
      return await api.getHealth();
    } catch (err: any) {
      throw new Error(formatServiceError(err, 'Health check'));
    }
  }

  async getBenchmark(): Promise<BenchmarkResponse> {
    if (this.demoMode) {
      return mockApi.getBenchmark();
    }
    try {
      return await api.getBenchmark();
    } catch (err: any) {
      throw new Error(formatServiceError(err, 'Model benchmark'));
    }
  }

  async analyzeCsv(file: File): Promise<AnalysisResponse> {
    if (this.demoMode) {
      const res = await mockApi.analyzeCsv(file);
      this.setCurrentAnalysis(res);
      return res;
    }
    try {
      const res = await api.analyzeCsv(file, 1, 300, true);
      this.setCurrentAnalysis(res);
      return res;
    } catch (err: any) {
      throw new Error(formatServiceError(err, 'Telemetry analysis'));
    }
  }

  async loadDemoAnalysis(): Promise<AnalysisResponse> {
    const res = await mockApi.analyzeCsv();
    this.setCurrentAnalysis(res);
    return res;
  }

  async getAssistantContext(analysisId?: string, incidentTimestamp?: string): Promise<{ success: boolean; payload: GeminiContextPayload }> {
    if (this.demoMode) {
      return mockApi.getAssistantContext();
    }
    if (!analysisId && this.currentAnalysis) {
      analysisId = this.currentAnalysis.analysis_id;
    }
    if (!analysisId) {
      // If in live mode but no analysis is cached yet, generate demo context to prevent breaking UI
      return mockApi.getAssistantContext();
    }
    try {
      return await api.getAssistantContext(analysisId, incidentTimestamp);
    } catch (err: any) {
      throw new Error(formatServiceError(err, 'Assistant telemetry context'));
    }
  }

  async sendAssistantMessage(
    payload?: GeminiContextPayload,
    question?: string,
    analysisId?: string
  ): Promise<AssistantChatResponse> {
    if (this.demoMode) {
      return mockApi.sendAssistantMessage(payload, question);
    }
    if (!analysisId && this.currentAnalysis) {
      analysisId = this.currentAnalysis.analysis_id;
    }
    try {
      return await api.sendAssistantMessage(payload, question, analysisId);
    } catch (err: any) {
      throw new Error(formatServiceError(err, 'Assistant conversation'));
    }
  }

  getDownloadUrl(analysisId?: string): string {
    const id = analysisId || this.currentAnalysis?.analysis_id;
    if (!id) return '#';
    return api.getDownloadUrl(id);
  }
}

export const maintenanceService = new MaintenanceService();
