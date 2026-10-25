import {
  HealthResponse,
  AnalysisResponse,
  BenchmarkResponse,
  GeminiContextPayload,
  AssistantChatResponse,
  TelemetryRecord
} from '../types';

export function generateMockTelemetry(count: number = 250): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  const baseTime = new Date('2020-06-01T00:00:00Z').getTime();

  let reservoirs = 9.8;
  let oilTemp = 61.5;
  let isPumping = false;
  const threshold = -17.2312;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime + i * 10000).toISOString().replace('T', ' ').substring(0, 19);
    const isLeak = i >= Math.floor(count * 0.75) && i <= Math.floor(count * 0.90);

    if (reservoirs <= 8.3) isPumping = true;
    else if (reservoirs >= 9.9) isPumping = false;

    let motorCurrent = 0.02;
    let tp2 = 1.3;
    let tp3 = reservoirs - 0.05;
    let h1 = reservoirs - 0.02;
    let dvPressure = -0.02;

    if (isPumping) {
      motorCurrent = 4.2 + 0.3 * Math.sin(i * 0.1);
      tp2 = 9.2 + 0.4 * Math.sin(i * 0.2);
      oilTemp = Math.min(74.0, oilTemp + 0.05);
      reservoirs = Math.min(10.1, reservoirs + 0.04);
    } else {
      oilTemp = Math.max(56.0, oilTemp - 0.03);
      const decay = isLeak ? 0.08 : 0.005;
      reservoirs = Math.max(7.2, reservoirs - decay);
      if (isLeak) {
        dvPressure = 2.1 + 0.2 * Math.sin(i * 0.3);
        tp2 = 2.8 + 0.3 * Math.cos(i * 0.2);
        tp3 = reservoirs - 0.35;
      }
    }

    const dRes = isPumping ? 0.04 : (isLeak ? -0.08 : -0.005);
    const leakScore = !isPumping ? Math.max(0, -dRes) : 0;

    // Synthetic anomaly score
    let anomalyScore = -17.4 + 0.05 * Math.sin(i * 0.1);
    if (isLeak) {
      anomalyScore = -15.8 + 0.5 * Math.sin(i * 0.2); // Crossing -17.23 threshold
    }
    const isAnomaly = anomalyScore >= threshold ? 1 : 0;

    records.push({
      timestamp,
      TP2: Number(tp2.toFixed(3)),
      TP3: Number(tp3.toFixed(3)),
      H1: Number(h1.toFixed(3)),
      DV_pressure: Number(dvPressure.toFixed(3)),
      Reservoirs: Number(reservoirs.toFixed(3)),
      Oil_temperature: Number(oilTemp.toFixed(2)),
      Motor_current: Number(motorCurrent.toFixed(3)),
      COMP: isPumping ? 1 : 0,
      DV_eletric: isPumping ? 1 : 0,
      Towers: (i % 40 < 20) ? 1 : 0,
      MPG: 1,
      LPS: 0,
      Pressure_switch: 0,
      Oil_level: 1,
      Caudal_impulses: 1,
      delta_TP2_TP3: Number((tp2 - tp3).toFixed(3)),
      delta_TP3_Reservoirs: Number((tp3 - reservoirs).toFixed(3)),
      delta_H1_TP2: Number((h1 - tp2).toFixed(3)),
      is_pumping: isPumping ? 1 : 0,
      TP2_roll_std: isPumping ? 0.25 : 0.02,
      DV_pressure_roll_std: isLeak ? 0.18 : 0.01,
      Oil_temp_roll_mean: Number(oilTemp.toFixed(2)),
      d_Reservoirs_dt: Number(dRes.toFixed(4)),
      d_TP2_dt: 0.01,
      leak_signature_score: Number(leakScore.toFixed(4)),
      anomaly_score: Number(anomalyScore.toFixed(4)),
      is_anomaly: isAnomaly,
      threshold_applied: threshold
    });
  }

  return records;
}

export const mockApi = {
  async getHealth(): Promise<HealthResponse> {
    return {
      status: 'healthy',
      service: 'MetroPT-3 Predictive Maintenance ML API [DEMO MODE]',
      version: '1.0.0-demo',
      model_loaded: true,
      model_info: {
        name: 'M4_OneClassSVM',
        category: 'Kernel Boundary',
        alert_threshold: -17.2312,
        score_direction: 'higher means more anomalous',
        selection_criterion: 'highest validation PR-AUC against sparse event-derived weak labels',
        validation_pr_auc: 0.376424,
        features_count: 25,
      },
      disclaimer: 'DEMO MODE: Anomaly scores are synthetic demonstrator values representing MetroPT-3 compressor telemetry.'
    };
  },

  async getBenchmark(): Promise<BenchmarkResponse> {
    return {
      success: true,
      selected_model: 'M4_OneClassSVM',
      selection_criterion: 'highest validation PR-AUC against sparse event-derived weak labels',
      alert_threshold: -72.229472,
      test_metrics: {
        ROC_AUC: 0.973658,
        PR_AUC: 0.771677,
        Precision: 0.592147,
        Recall: 0.915034,
        F1_Score: 0.719004,
        FPR: 0.018614,
        Total_Alarms: 29263
      },
      benchmark_leaderboard: [
        {
          model_id: 'M4_OneClassSVM',
          model_name: 'One-Class SVM (RBF Kernel)',
          category: 'Kernel Boundary',
          train_time_s: 1.232,
          inf_time_s: 14.192,
          pr_auc: 0.376424,
          roc_auc: 0.971689,
          f1_score: 0.474804,
          precision: 0.312378,
          recall: 0.989108,
          fpr: 0.072645,
          false_alarm_clusters_per_week: 32.467999,
          total_alarms: 34884,
          is_selected: true,
          description: 'Calculates maximum-margin hypersphere enclosing normal operations in RKHS; highly sensitive to nonlinear multi-sensor shifts.'
        },
        {
          model_id: 'M7_DeepAutoencoder',
          model_name: 'Deep Autoencoder',
          category: 'Deep Neural Bottleneck',
          train_time_s: 15.745,
          inf_time_s: 1.636,
          pr_auc: 0.307072,
          roc_auc: 0.965820,
          f1_score: 0.524027,
          precision: 0.356467,
          recall: 0.988835,
          fpr: 0.059562,
          false_alarm_clusters_per_week: 12.198959,
          total_alarms: 30561,
          is_selected: false,
          description: 'Neural compression bottleneck; reconstructs normal cycles well, but exhibits high MSE on novel failure regimes.'
        },
        {
          model_id: 'M3_IsolationForest',
          model_name: 'Isolation Forest',
          category: 'Tree Partitioning',
          train_time_s: 0.536,
          inf_time_s: 1.406,
          pr_auc: 0.155283,
          roc_auc: 0.919827,
          f1_score: 0.104432,
          precision: 0.076387,
          recall: 0.165018,
          fpr: 0.066573,
          false_alarm_clusters_per_week: 27.963768,
          total_alarms: 23800,
          is_selected: false,
          description: 'Axis-aligned random partitioning trees; fast inference, but struggles with continuous correlated pneumatic drift.'
        },
        {
          model_id: 'M5_EllipticEnvelope',
          model_name: 'Elliptic Envelope',
          category: 'Parametric Gaussian Covariance',
          train_time_s: 3.734,
          inf_time_s: 0.186,
          pr_auc: 0.129604,
          roc_auc: 0.892963,
          f1_score: 0.000558,
          precision: 0.000724,
          recall: 0.000454,
          fpr: 0.020906,
          false_alarm_clusters_per_week: 7.507052,
          total_alarms: 6908,
          is_selected: false,
          description: 'Fast robust covariance assuming unimodal Gaussian distribution; degraded by multimodal compressor duty cycles.'
        },
        {
          model_id: 'M1_RobustDistance',
          model_name: 'Robust Median/MAD Distance',
          category: 'Statistical Distance',
          train_time_s: 0.297,
          inf_time_s: 0.044,
          pr_auc: 0.112208,
          roc_auc: 0.882045,
          f1_score: 0.001446,
          precision: 0.002623,
          recall: 0.000998,
          fpr: 0.012668,
          false_alarm_clusters_per_week: 20.644393,
          total_alarms: 4194,
          is_selected: false,
          description: 'Simple univariate deviation normalized by median absolute deviation; misses subtle cross-sensor correlations.'
        },
        {
          model_id: 'M6_LocalOutlierFactor',
          model_name: 'Local Outlier Factor (LOF)',
          category: 'Nearest Neighbor Density',
          train_time_s: 2.176,
          inf_time_s: 28.220,
          pr_auc: 0.088522,
          roc_auc: 0.839777,
          f1_score: 0.125202,
          precision: 0.079457,
          recall: 0.295089,
          fpr: 0.114066,
          false_alarm_clusters_per_week: 52.924715,
          total_alarms: 40915,
          is_selected: false,
          description: 'Density-based k-NN estimator; computationally expensive at inference and noisy on boundary states.'
        },
        {
          model_id: 'M2_PCAReconstruction',
          model_name: 'PCA Reconstruction Error',
          category: 'Subspace Projection',
          train_time_s: 0.052,
          inf_time_s: 0.131,
          pr_auc: 0.074294,
          roc_auc: 0.798303,
          f1_score: 0.004407,
          precision: 0.005403,
          recall: 0.003722,
          fpr: 0.022859,
          false_alarm_clusters_per_week: 40.350404,
          total_alarms: 7589,
          is_selected: false,
          description: 'Linear projection onto dominant variance components; fails to capture the nonlinear dynamics of the air dryer.'
        }
      ],
      caveat: 'Weak-label reference warning: Rows outside documented event windows are not confirmed healthy labels.'
    };
  },

  async analyzeCsv(file?: File): Promise<AnalysisResponse> {
    const mockRecords = generateMockTelemetry(300);
    const anomalies = mockRecords.filter(r => r.is_anomaly === 1);
    const total = mockRecords.length;
    const rate = Number(((anomalies.length / total) * 100).toFixed(2));

    const scores = mockRecords.map(r => r.anomaly_score || 0);

    return {
      success: true,
      analysis_id: 'demo-analysis-' + Date.now(),
      machine_type: 'Metro Train Air Compressor (Demo Data)',
      model: {
        name: 'M4_OneClassSVM',
        category: 'Kernel Boundary',
        threshold: -17.2312,
        score_direction: 'higher means more anomalous',
      },
      summary: {
        records_analyzed: total,
        anomaly_count: anomalies.length,
        anomaly_rate_percent: rate,
        score_min: Number(Math.min(...scores).toFixed(4)),
        score_max: Number(Math.max(...scores).toFixed(4)),
        score_mean: Number((scores.reduce((a, b) => a + b, 0) / total).toFixed(4)),
        threshold: -17.2312,
        start_time: mockRecords[0].timestamp,
        end_time: mockRecords[total - 1].timestamp,
        sampling_count: total
      },
      pagination: {
        total_records: total,
        returned_records: total,
        page: 1,
        per_page: 300,
        total_pages: 1
      },
      records: mockRecords,
      warnings: [
        'Running in DEMO MODE with synthetic representative MetroPT-3 compressor cycles.',
        'Anomaly detection flags statistical divergence from baseline; not confirmed mechanical failure.'
      ]
    };
  },

  async getAssistantContext(): Promise<{ success: boolean; payload: GeminiContextPayload }> {
    const records = generateMockTelemetry(50);
    const topAnomaly = records.find(r => r.is_anomaly === 1) || records[records.length - 1];

    return {
      success: true,
      payload: {
        machine_type: 'Metro-Train Air Compressor (Demo Telemetry)',
        timestamp: topAnomaly.timestamp,
        model_metadata: {
          model_name: 'M4_OneClassSVM',
          threshold: -17.2312,
          score: topAnomaly.anomaly_score || -15.42,
          anomaly_detected: true,
          evaluation_caveat: 'Anomaly score is not a confirmed failure diagnosis.'
        },
        sensor_telemetry: {
          TP2_compressor_pressure: topAnomaly.TP2,
          TP3_panel_pressure: topAnomaly.TP3,
          H1_cyclonic_separator_pressure: topAnomaly.H1,
          DV_pressure: topAnomaly.DV_pressure,
          Reservoir_pressure: topAnomaly.Reservoirs,
          Motor_current: topAnomaly.Motor_current,
          Oil_temperature: topAnomaly.Oil_temperature,
          Differential_TP2_TP3: topAnomaly.delta_TP2_TP3 || -7.8,
          Reservoir_decay_rate_per_sample: topAnomaly.d_Reservoirs_dt || -0.08
        },
        operating_context: {
          compressor_pumping: (topAnomaly.Motor_current > 1.0),
          abnormal_decay_while_idle: true
        },
        recommended_checks: [
          'Review the pressure and operating-state trends around this timestamp.',
          'Inspect relevant valves, couplings, and seals if the alert persists.',
          'Confirm any suspected fault with maintenance logs and a qualified technician.'
        ],
        uncertainty_note: 'This system flags statistical anomalies in MetroPT-3-like compressor telemetry. It is not a confirmed diagnosis.'
      }
    };
  },

  async sendAssistantMessage(
    payload?: GeminiContextPayload,
    question?: string
  ): Promise<AssistantChatResponse> {
    const qLower = (question || '').toLowerCase();
    let reply = '';

    if (qLower.includes('sensor') || qLower.includes('contribute')) {
      reply = `### Contributing Sensor Dynamics (Demo Analysis)
Based on baseline deviation analysis for the flagged alert:
1. **Reservoir Pressure (Reservoirs):** Rapid decay rate of ~0.08 bar/10s observed while the compressor motor is idle.
2. **Purge Discharge Valve (DV_pressure):** Elevated residual pressure (>2.0 bar) indicates potential check-valve bypass or incomplete purge cycle.
3. **Differential Pressure (TP2 - TP3):** Gradient deviation exceeds standard idle threshold.`;
    } else if (qLower.includes('pressure') || qLower.includes('trend')) {
      reply = `### Pressure Gradient Interpretation
- **Compressor Outlet (TP2):** Fluctuates between 1.3 bar (unloaded) and 9.2 bar (loaded).
- **Reservoir Pressure (Reservoirs):** Normally maintained between 8.2 and 10.0 bar. In the flagged region, decay gradient is ~16x higher than normal idle diffusion, pointing to pneumatic circuit loss.`;
    } else if (qLower.includes('inspect') || qLower.includes('depot') || qLower.includes('protocol')) {
      reply = `### Recommended Depot Inspection Protocol
1. **Acoustic Ultrasonic Leak Test:** Inspect coupling joints between compressor delivery manifold and cyclonic separator (H1).
2. **Purge Solenoid (DV_eletric):** Check whether the purge valve is seating completely after desiccant tower regeneration.
3. **Check Valve Inspection:** Verify non-return valve sealing between TP3 and main reservoir tank.`;
    } else {
      reply = `### AI Maintenance Assistant Diagnosis (Demo Mode)
- **Subsystem Status:** Warning / Elevated Statistical Divergence
- **Anomaly Score:** -15.42 (Threshold: -17.23, higher means more anomalous)
- **Operating Context:** Compressor idle with anomalous reservoir pressure decay.
- **Next Step:** Verify mechanical couplings and schedule acoustic inspection at next train depot layover.`;
    }

    return {
      success: true,
      data: {
        configured: false,
        message: 'Demo mode simulated engineering response',
        reply: reply,
        payload: payload || (await mockApi.getAssistantContext()).payload
      }
    };
  }
};
