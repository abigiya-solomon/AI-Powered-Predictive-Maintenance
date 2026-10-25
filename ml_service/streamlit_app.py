"""Standalone Streamlit ML exploration interface for MetroPT-3 compressor anomaly detection.

Reuses the shared inference engine, feature engineering, and artifact manager directly.
"""
import os
import sys
import io
import pandas as pd
import numpy as np
import streamlit as st

# Add ml_service to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from services.inference_engine import get_model_manager
from services.csv_validation import validate_csv_content, EXPECTED_RAW_SENSORS
from services.gemini_payload import generate_gemini_flash_payload

st.set_page_config(
    page_title="MetroPT-3 ML Exploration Interface",
    page_icon="🚇",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🚇 MetroPT-3 Compressor Machine Health Exploration")
st.markdown(
    "Standalone technical workbench for inspecting sensor telemetry, evaluating the trained "
    "**One-Class SVM** anomaly detector, and analyzing pneumatic failure signatures."
)

manager = get_model_manager()

# Sidebar: Model and System Info
with st.sidebar:
    st.header("⚙️ Model Status")
    if manager.is_loaded:
        st.success(f"Model: {manager.metadata.get('best_model_name', 'Loaded')}")
        st.info(f"Category: {manager.metadata.get('model_category', 'Kernel Boundary')}")
        st.metric("Alert Threshold", f"{manager.engine.threshold:.4f}")
        st.metric("Features Count", len(manager.engine.feature_names))
    else:
        st.error("Model artifacts not loaded!")
        if manager.error_message:
            st.caption(manager.error_message)

    st.markdown("---")
    st.markdown("### ⚠️ Methodological Note")
    st.caption(
        "Labels in MetroPT-3 are sparse maintenance log event intervals, not verified "
        "pointwise ground truth. Predictions are unsupervised statistical anomaly flags, "
        "not confirmed mechanical failure diagnoses."
    )

# Tabs
tab1, tab2, tab3 = st.tabs(["📊 Telemetry Analysis", "🏆 Model Benchmark", "🤖 Assistant Payload"])

with tab1:
    st.subheader("1. Telemetry Upload & Scoring")

    col_up1, col_up2 = st.columns([3, 1])
    with col_up1:
        uploaded_file = st.file_uploader(
            "Upload MetroPT-3 compatible CSV file",
            type=["csv"],
            help="Expected raw columns include timestamp, TP2, TP3, H1, DV_pressure, Reservoirs, Oil_temperature, Motor_current, etc."
        )

    with col_up2:
        st.write("")
        st.write("")
        use_sample = st.button("📁 Load Sample Telemetry", use_container_width=True)

    file_bytes = None
    filename = "telemetry.csv"

    if uploaded_file is not None:
        file_bytes = uploaded_file.getvalue()
        filename = uploaded_file.name
    elif use_sample:
        sample_path = os.path.join(os.path.dirname(current_dir), "data", "sample_metropt3_telemetry.csv")
        if os.path.exists(sample_path):
            with open(sample_path, "rb") as f:
                file_bytes = f.read()
            filename = "sample_metropt3_telemetry.csv"
            st.info("Loaded 1,000-row sample telemetry dataset.")
        else:
            st.error("Sample file not found on disk.")

    if file_bytes is not None and manager.is_loaded:
        is_valid, err_msg, df_clean, val_meta = validate_csv_content(file_bytes, filename=filename)

        if not is_valid:
            st.error(f"Validation failed: {err_msg}")
        else:
            st.success(f"Validated CSV successfully: {len(df_clean):,} records.")
            if val_meta.get("warnings"):
                for w in val_meta["warnings"]:
                    st.warning(w)

            with st.spinner("Executing feature engineering and anomaly inference..."):
                df_scored = manager.engine.transform_and_score(df_clean)

            # Summary Metrics
            anomaly_count = int(df_scored["is_anomaly"].sum())
            total_records = len(df_scored)
            anomaly_rate = (anomaly_count / total_records) * 100.0

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Records Scored", f"{total_records:,}")
            m2.metric("Anomaly Records", f"{anomaly_count:,}")
            m3.metric("Anomaly Rate", f"{anomaly_rate:.2f}%")
            m4.metric("Max Anomaly Score", f"{df_scored['anomaly_score'].max():.4f}")

            # Visualizations
            st.markdown("### 📈 Time-Series Sensor Trends & Anomaly Flags")
            ts_col = manager.engine.timestamp_col

            # Time series chart
            chart_df = df_scored[[ts_col, 'Reservoirs', 'TP2', 'TP3', 'Motor_current', 'Oil_temperature', 'anomaly_score']].copy()
            chart_df = chart_df.set_index(ts_col)

            st.line_chart(chart_df[['Reservoirs', 'TP2', 'TP3']])
            st.line_chart(chart_df[['Motor_current', 'Oil_temperature']])

            # Anomaly Score vs Threshold
            st.markdown("### 🎯 Anomaly Score Profile")
            st.line_chart(chart_df['anomaly_score'])
            st.caption(f"Configured alert threshold: {manager.engine.threshold:.4f}")

            # Scored Records Table
            st.markdown("### 📋 Scored Records Preview")
            show_only_anomalies = st.checkbox("Show only flagged anomalous records", value=False)
            display_df = df_scored[df_scored['is_anomaly'] == 1] if show_only_anomalies else df_scored
            st.dataframe(display_df.head(200), use_container_width=True)

            # Download Button
            csv_buf = io.StringIO()
            df_scored.to_csv(csv_buf, index=False)
            st.download_button(
                label="📥 Download Full Scored CSV",
                data=csv_buf.getvalue(),
                file_name=f"scored_{filename}",
                mime="text/csv"
            )

with tab2:
    st.subheader("2. Multi-Model Benchmark Comparison (7 Architectures)")
    st.markdown(
        "Results from Section J of `final_final_final_insa.ipynb` evaluated across chronological splits."
    )
    leaderboard = manager.metadata.get("benchmark_leaderboard", [])
    if leaderboard:
        bench_df = pd.DataFrame(leaderboard)
        st.dataframe(
            bench_df[[
                "model_name", "category", "pr_auc", "roc_auc", "f1_score",
                "precision", "recall", "fpr", "false_alarm_clusters_per_week",
                "train_time_s", "inf_time_s", "is_selected"
            ]],
            use_container_width=True
        )

        st.markdown("### Winner Selection Rationale")
        st.markdown(
            f"**Selected Model:** `{manager.metadata.get('best_model_name')}`\n\n"
            f"- **Criterion:** {manager.metadata.get('selection_criterion')}\n"
            f"- **Validation PR-AUC:** `{manager.metadata.get('validation_pr_auc_weak_labels')}`\n"
            f"- **Holdout Test PR-AUC:** `{manager.metadata.get('test_metrics', {}).get('PR_AUC')}`"
        )
    else:
        st.info("Benchmark leaderboard not found in metadata.")

with tab3:
    st.subheader("3. AI Maintenance Assistant Payload (Gemini Flash Schema)")
    st.markdown(
        "Structured JSON telemetry summary prepared for rolling stock maintenance engineers "
        "according to the schema and Gemini integration cells in `final_final_final_insa.ipynb`."
    )
    if 'df_scored' in locals() and df_scored is not None:
        payload = generate_gemini_flash_payload(df_scored)
        st.json(payload)
    else:
        st.info("Score telemetry in Tab 1 to generate live Gemini Flash context.")
