"""Production-grade inference engine for MetroPT-3 compressor anomaly detection.

Implements the exact inference pipeline and model scoring dispatch from Section L of final_final_final_insa.ipynb.
"""
from typing import Dict, Any, List, Optional, Tuple
import os
import json
import logging
import joblib
import numpy as np
import pandas as pd

from .feature_engineering import engineer_physics_features, ENGINEERED_FEATURE_NAMES

logger = logging.getLogger(__name__)


def score_anomaly_model(model_name: str, model_obj: Any, X_scaled: np.ndarray, batch_size: int = 4096) -> np.ndarray:
    """Score scaled rows with the same score direction used during benchmarking.

    In every case, larger scores mean "more anomalous".
    """
    X_arr = np.asarray(X_scaled, dtype=np.float32)
    if X_arr.ndim != 2:
        raise ValueError(f"Expected a 2-D feature matrix, received shape {X_arr.shape}.")

    if model_name == 'M1_RobustDistance':
        median = np.asarray(model_obj['median'])
        mad = np.asarray(model_obj['mad'])
        return np.mean(np.abs(X_arr - median) / mad, axis=1)

    if model_name == 'M2_PCAReconstruction':
        reconstructed = model_obj.inverse_transform(model_obj.transform(X_arr))
        return np.mean(np.square(X_arr - reconstructed), axis=1)

    if model_name in ('M3_IsolationForest', 'M4_OneClassSVM', 'M6_LocalOutlierFactor'):
        # score_samples returns signed distance (more negative = more abnormal), so negate it
        return -np.asarray(model_obj.score_samples(X_arr))

    if model_name == 'M5_EllipticEnvelope':
        return np.asarray(model_obj.mahalanobis(X_arr))

    if model_name == 'M7_DeepAutoencoder':
        if hasattr(model_obj, 'predict'):
            return np.mean(np.square(X_arr - model_obj.predict(X_arr)), axis=1)
        try:
            import torch
        except ImportError as exc:
            raise RuntimeError("PyTorch is required to score the deep autoencoder.") from exc

        if not isinstance(model_obj, torch.nn.Module):
            raise TypeError(f"Unexpected autoencoder object: {type(model_obj).__name__}")

        model_obj.eval()
        try:
            device = next(model_obj.parameters()).device
        except StopIteration:
            device = torch.device('cpu')

        score_chunks = []
        with torch.no_grad():
            for start in range(0, len(X_arr), batch_size):
                tensor = torch.as_tensor(X_arr[start:start + batch_size], dtype=torch.float32, device=device)
                reconstruction = model_obj(tensor)
                score_chunks.append(torch.mean((reconstruction - tensor) ** 2, dim=1).detach().cpu().numpy())
        return np.concatenate(score_chunks) if score_chunks else np.array([], dtype=float)

    raise ValueError(f"No scoring implementation registered for model '{model_name}'.")


class MetroPTPredictiveMaintenanceEngine:
    """CSV inference engine using the benchmark winner and training feature pipeline."""

    def __init__(
        self,
        scaler: Any,
        model_name: str,
        model_obj: Any,
        feature_names: List[str],
        threshold: float,
        raw_feature_names: List[str],
        timestamp_col: str = 'timestamp'
    ):
        self.scaler = scaler
        self.model_name = model_name
        self.model = model_obj
        self.feature_names = list(feature_names)
        self.raw_feature_names = list(raw_feature_names)
        self.threshold = float(threshold)
        self.timestamp_col = timestamp_col

    def validate_schema(self, df: pd.DataFrame) -> bool:
        if not isinstance(df, pd.DataFrame) or df.empty:
            raise ValueError("Input telemetry must be a non-empty pandas DataFrame.")
        if self.timestamp_col not in df.columns:
            raise ValueError(
                f"Input CSV must contain timestamp column '{self.timestamp_col}' so rows can be ordered for rolling features."
            )
        missing = [c for c in self.raw_feature_names if c not in df.columns]
        if missing:
            raise ValueError(
                f"Input CSV does not match the training schema. Missing raw feature columns: {missing}"
            )
        return True

    def transform_and_score(self, df_input: pd.DataFrame) -> pd.DataFrame:
        """Run complete causal feature engineering, scaling, and anomaly scoring."""
        self.validate_schema(df_input)
        df_proc = df_input.copy()

        df_proc[self.timestamp_col] = pd.to_datetime(df_proc[self.timestamp_col], errors='coerce')
        if df_proc[self.timestamp_col].isna().any():
            bad_count = int(df_proc[self.timestamp_col].isna().sum())
            raise ValueError(f"Found {bad_count} invalid timestamps in input CSV.")

        # Sort chronologically to preserve causality for rolling windows
        df_proc = df_proc.sort_values(self.timestamp_col).reset_index(drop=True)

        # Shared feature engineering
        df_proc = engineer_physics_features(df_proc, self.timestamp_col)
        missing_features = [c for c in self.feature_names if c not in df_proc.columns]
        if missing_features:
            raise ValueError(f"Feature engineering did not produce expected columns: {missing_features}")

        X_frame = df_proc[self.feature_names].replace([np.inf, -np.inf], np.nan)
        if X_frame.isna().any().any():
            bad_cols = X_frame.columns[X_frame.isna().any()].tolist()
            raise ValueError(
                f"Input feature matrix contains missing or infinite values in {bad_cols}."
            )

        X_scaled = self.scaler.transform(X_frame.to_numpy(dtype=np.float32))
        scores = score_anomaly_model(self.model_name, self.model, X_scaled)

        if len(scores) != len(df_proc):
            raise RuntimeError("Scoring returned a different number of values than input rows.")

        df_proc['anomaly_score'] = scores.astype('float64')
        df_proc['is_anomaly'] = (scores >= self.threshold).astype('uint8')
        df_proc['model_name'] = self.model_name
        df_proc['threshold_applied'] = self.threshold

        return df_proc

    # Convenient alias
    score_dataframe = transform_and_score


class ModelManager:
    """Manages loading, status inspection, and execution of model artifacts."""

    def __init__(self, artifacts_dir: Optional[str] = None):
        if artifacts_dir is None:
            # Default to ../metropt_model_artifacts relative to this file
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            artifacts_dir = os.path.join(base_dir, "metropt_model_artifacts")
        self.artifacts_dir = artifacts_dir
        self.scaler = None
        self.model = None
        self.metadata: Dict[str, Any] = {}
        self.engine: Optional[MetroPTPredictiveMaintenanceEngine] = None
        self.is_loaded: bool = False
        self.error_message: Optional[str] = None
        self.load_artifacts()

    def load_artifacts(self) -> bool:
        """Attempt to load saved artifacts from disk."""
        meta_path = os.path.join(self.artifacts_dir, "pipeline_metadata.json")
        scaler_path = os.path.join(self.artifacts_dir, "robust_scaler.joblib")
        model_path = os.path.join(self.artifacts_dir, "selected_anomaly_model.joblib")

        # 1. Metadata check
        if not os.path.exists(meta_path):
            self.is_loaded = False
            self.error_message = f"Missing pipeline metadata file at: {meta_path}"
            logger.warning(self.error_message)
            return False

        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
        except Exception as exc:
            self.is_loaded = False
            self.error_message = f"Failed to parse metadata JSON: {exc}"
            logger.error(self.error_message)
            return False

        # 2. Check binary artifacts
        missing_binaries = []
        if not os.path.exists(scaler_path):
            missing_binaries.append("robust_scaler.joblib")
        if not os.path.exists(model_path):
            missing_binaries.append("selected_anomaly_model.joblib")

        if missing_binaries:
            self.is_loaded = False
            self.error_message = (
                f"Missing model artifact binaries in {self.artifacts_dir}: {missing_binaries}. "
                "Please run python ml_service/scripts/train_baseline_artifacts.py or place the saved "
                "artifacts into the metropt_model_artifacts folder."
            )
            logger.warning(self.error_message)
            return False

        # 3. Load joblib binaries
        try:
            self.scaler = joblib.load(scaler_path)
            self.model = joblib.load(model_path)
        except Exception as exc:
            self.is_loaded = False
            self.error_message = f"Failed to load joblib artifacts: {exc}"
            logger.error(self.error_message)
            return False

        # 4. Initialize engine
        try:
            best_model_name = self.metadata.get("best_model_name", "M4_OneClassSVM")
            threshold = float(self.metadata.get("alert_threshold", -72.229472))
            feature_cols = self.metadata.get("feature_columns", [])
            raw_cols = self.metadata.get("raw_feature_columns", [])
            ts_col = self.metadata.get("required_timestamp_column", "timestamp")

            self.engine = MetroPTPredictiveMaintenanceEngine(
                scaler=self.scaler,
                model_name=best_model_name,
                model_obj=self.model,
                feature_names=feature_cols,
                threshold=threshold,
                raw_feature_names=raw_cols,
                timestamp_col=ts_col
            )
            self.is_loaded = True
            self.error_message = None
            logger.info(f"Successfully loaded model '{best_model_name}' and initialized inference engine.")
            return True
        except Exception as exc:
            self.is_loaded = False
            self.error_message = f"Failed to instantiate inference engine: {exc}"
            logger.error(self.error_message)
            return False

    def get_status(self) -> Dict[str, Any]:
        """Return full status and model metadata for /api/health."""
        return {
            "is_loaded": self.is_loaded,
            "error_message": self.error_message,
            "artifacts_dir": self.artifacts_dir,
            "model_name": self.metadata.get("best_model_name"),
            "model_category": self.metadata.get("model_category"),
            "alert_threshold": self.metadata.get("alert_threshold"),
            "selection_criterion": self.metadata.get("selection_criterion"),
            "score_direction": self.metadata.get("score_direction"),
            "features_count": len(self.metadata.get("feature_columns", [])),
            "benchmark_available": bool(self.metadata.get("benchmark_leaderboard")),
            "important_caveat": self.metadata.get("important_caveat")
        }


# Singleton model manager instance
_model_manager_instance: Optional[ModelManager] = None


def get_model_manager(artifacts_dir: Optional[str] = None) -> ModelManager:
    global _model_manager_instance
    if _model_manager_instance is None:
        _model_manager_instance = ModelManager(artifacts_dir)
    return _model_manager_instance
