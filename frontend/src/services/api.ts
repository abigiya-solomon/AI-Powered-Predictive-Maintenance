import axios from 'axios';
import {
  HealthResponse,
  AnalysisResponse,
  BenchmarkResponse,
  GeminiContextPayload,
  AssistantChatResponse
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: {
    'Accept': 'application/json',
  },
});

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await apiClient.get<HealthResponse>('/api/health');
    return res.data;
  },

  async getBenchmark(): Promise<BenchmarkResponse> {
    const res = await apiClient.get<BenchmarkResponse>('/api/benchmark');
    return res.data;
  },

  async analyzeCsv(
    file: File,
    page: number = 1,
    perPage: number = 200,
    includeAll: boolean = false
  ): Promise<AnalysisResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<AnalysisResponse>(
      `/api/analyze?page=${page}&per_page=${perPage}&include_all=${includeAll}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  async getAssistantContext(
    analysisId: string,
    incidentTimestamp?: string
  ): Promise<{ success: boolean; payload: GeminiContextPayload }> {
    const res = await apiClient.post('/api/assistant/context', {
      analysis_id: analysisId,
      incident_timestamp: incidentTimestamp,
    });
    return res.data;
  },

  async sendAssistantMessage(
    payload?: GeminiContextPayload,
    question?: string,
    analysisId?: string
  ): Promise<AssistantChatResponse> {
    const res = await apiClient.post<AssistantChatResponse>('/api/assistant/chat', {
      payload,
      question,
      analysis_id: analysisId,
    });
    return res.data;
  },

  getDownloadUrl(analysisId: string): string {
    return `${BASE_URL}/api/download/${analysisId}`;
  },

  getSampleDataUrl(): string {
    return `${BASE_URL}/api/sample`;
  }
};
