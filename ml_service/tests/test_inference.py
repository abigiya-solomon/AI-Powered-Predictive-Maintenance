"""Unit tests for inference engine, feature engineering, and Gemini payload generator."""
import os
import sys
import pytest
import pandas as pd
import numpy as np

ml_service_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ml_service_dir)

from services.feature_engineering import engineer_physics_features, ENGINEERED_FEATURE_NAMES
from services.inference_engine import get_model_manager
from services.gemini_payload import generate_gemini_flash_payload


@pytest.fixture
def sample_csv_path():
    root_dir = os.path.dirname(ml_service_dir)
    return os.path.join(root_dir, "data", "sample_metropt3_telemetry.csv")


def test_feature_engineering_adds_all_columns(sample_csv_path):
    """Test that all 10 engineered features are computed without data leakage."""
    df = pd.read_csv(sample_csv_path).head(100)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df_feat = engineer_physics_features(df, 'timestamp')

    for col in ENGINEERED_FEATURE_NAMES:
        assert col in df_feat.columns
    assert df_feat['delta_TP2_TP3'].isna().sum() == 0
    assert df_feat['leak_signature_score'].min() >= 0.0


def test_inference_pipeline_execution(sample_csv_path):
    """Test full inference pipeline with loaded model manager."""
    manager = get_model_manager()
    assert manager.is_loaded
    assert manager.engine is not None

    df_raw = pd.read_csv(sample_csv_path).head(150)
    scored_df = manager.engine.transform_and_score(df_raw)

    assert "anomaly_score" in scored_df.columns
    assert "is_anomaly" in scored_df.columns
    assert "threshold_applied" in scored_df.columns
    assert len(scored_df) == 150
    assert scored_df["anomaly_score"].dtype == np.float64
    assert set(scored_df["is_anomaly"].unique()).issubset({0, 1})


def test_gemini_payload_generation(sample_csv_path):
    """Test that the Gemini Flash payload contains correct telemetry keys and context."""
    manager = get_model_manager()
    df_raw = pd.read_csv(sample_csv_path).head(200)
    scored_df = manager.engine.transform_and_score(df_raw)

    payload = generate_gemini_flash_payload(scored_df)
    assert payload["machine_type"].startswith("Metro-Train Air Compressor")
    assert "timestamp" in payload
    assert "model_metadata" in payload
    assert payload["model_metadata"]["model_name"] == "M4_OneClassSVM"
    assert "sensor_telemetry" in payload
    assert "operating_context" in payload
    assert "recommended_checks" in payload
    assert isinstance(payload["recommended_checks"], list)
