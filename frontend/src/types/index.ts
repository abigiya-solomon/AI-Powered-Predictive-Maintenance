export interface TelemetryRecord {
  timestamp: string;
  TP2: number;
  TP3: number;
  H1: number;
  DV_pressure: number;
  Reservoirs: number;
  Oil_temperature: number;
  Motor_current: number;
  COMP?: number;
  DV_eletric?: number;
  Towers?: number;
  MPG?: number;
  LPS?: number;
  Pressure_switch?: number;
  Oil_level?: number;
  Caudal_impulses?: number;
  delta_TP2_TP3?: number;
  delta_TP3_Reservoirs?: number;
  delta_H1_TP2?: number;
  is_pumping?: number;
  TP2_roll_std?: number;
  DV_pressure_roll_std?: number;
  Oil_temp_roll_mean?: number;
  d_Reservoirs_dt?: number;
  d_TP2_dt?: number;
  leak_signature_score?: number;
  anomaly_score?: number;
  is_anomaly?: number;
  threshold_applied?: number;
  [key: string]: any;
}

export interface AnalysisSummary {
  records_analyzed: number;
  anomaly_count: number;
  anomaly_rate_percent: number;
  score_min: number;
  score_max: number;
  score_mean: number;
  threshold: number;
  start_time: string;
  end_time: string;
  sampling_count?: number;
}

export interface ModelMetadata {
  name: string;
  category: string;
  threshold: number;
  score_direction: string;
  selection_criterion?: string;
  validation_pr_auc?: number;
  features_count?: number;
}

export interface AnalysisResponse {
  success: boolean;
  analysis_id: string;
  machine_type: string;
  model: ModelMetadata;
  summary: AnalysisSummary;
  pagination: {
    total_records: number;
    returned_records: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  records: TelemetryRecord[];
  warnings: string[];
  download_url?: string;
}

export interface BenchmarkModel {
  model_id: string;
  model_name: string;
  category: string;
  train_time_s: number;
  inf_time_s: number;
  pr_auc: number;
  roc_auc: number;
  f1_score: number;
  precision: number;
  recall: number;
  fpr: number;
  false_alarm_clusters_per_week: number;
  total_alarms: number;
  is_selected: boolean;
  description: string;
}

export interface BenchmarkResponse {
  success: boolean;
  selected_model: string;
  selection_criterion: string;
  alert_threshold: number;
  test_metrics: {
    ROC_AUC: number;
    PR_AUC: number;
    Precision: number;
    Recall: number;
    F1_Score: number;
    FPR: number;
    Total_Alarms: number;
  };
  benchmark_leaderboard: BenchmarkModel[];
  caveat: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  model_loaded: boolean;
  error?: string | null;
  model_info: {
    name: string;
    category: string;
    alert_threshold: number;
    score_direction: string;
    selection_criterion: string;
    validation_pr_auc: number;
    features_count: number;
  };
  disclaimer: string;
}

export interface GeminiContextPayload {
  machine_type: string;
  timestamp: string;
  model_metadata: {
    model_name: string;
    threshold: number;
    score: number;
    anomaly_detected: boolean;
    evaluation_caveat: string;
  };
  sensor_telemetry: {
    TP2_compressor_pressure: number | null;
    TP3_panel_pressure: number | null;
    H1_cyclonic_separator_pressure: number | null;
    DV_pressure: number | null;
    Reservoir_pressure: number | null;
    Motor_current: number | null;
    Oil_temperature: number | null;
    Differential_TP2_TP3: number | null;
    Reservoir_decay_rate_per_sample: number | null;
  };
  operating_context: {
    compressor_pumping: boolean | null;
    abnormal_decay_while_idle: boolean | null;
  };
  recommended_checks: string[];
  uncertainty_note: string;
}

export interface AssistantChatResponse {
  success: boolean;
  data: {
    configured: boolean;
    message?: string;
    reply?: string;
    simulated_response?: string;
    payload: GeminiContextPayload;
    error?: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  filename: string;
  fileSizeBytes: number;
  columnsDetected: string[];
  missingColumns: string[];
  warnings: string[];
  rowCount: number;
  previewRows: Record<string, any>[];
}
