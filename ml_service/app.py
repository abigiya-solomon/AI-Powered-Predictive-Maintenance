"""Flask REST API connecting React frontend to MetroPT-3 ML inference pipeline.

Thin API layer: validates requests, calls shared inference engine, returns structured JSON.
"""
from typing import Dict, Any, Optional
import os
import io
import uuid
import logging
from datetime import datetime
from dotenv import load_dotenv
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS

load_dotenv()

from services.csv_validation import validate_csv_content, EXPECTED_RAW_SENSORS
from services.inference_engine import get_model_manager
from services.gemini_payload import (
    generate_gemini_flash_payload,
    call_gemini_flash_if_configured,
    safe_float
)
from schemas.responses import health_response_schema, analyze_response_schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS
allowed_origins_env = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
CORS(app, origins=allowed_origins, supports_credentials=True)

# In-memory session store for recent analysis results (to enable full CSV downloads)
# Evicts older analyses if more than 20 items stored
ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}
MAX_CACHE_ITEMS = 20


def get_cached_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    return ANALYSIS_CACHE.get(analysis_id)


def store_cached_analysis(analysis_id: str, data: Dict[str, Any]):
    if len(ANALYSIS_CACHE) >= MAX_CACHE_ITEMS:
        oldest_key = next(iter(ANALYSIS_CACHE))
        ANALYSIS_CACHE.pop(oldest_key, None)
    ANALYSIS_CACHE[analysis_id] = data


@app.route("/api/health", methods=["GET"])
def health_check():
    """Service status and model metadata."""
    manager = get_model_manager()
    status_info = manager.get_status()

    is_healthy = manager.is_loaded
    http_status = 200 if is_healthy else 503

    resp = health_response_schema(
        status="healthy" if is_healthy else "degraded",
        model_loaded=manager.is_loaded,
        metadata=manager.metadata,
        error=manager.error_message
    )
    return jsonify(resp), http_status


@app.route("/api/benchmark", methods=["GET"])
def get_benchmark():
    """Retrieve the 7-model benchmark leaderboard and evaluation metrics."""
    manager = get_model_manager()
    leaderboard = manager.metadata.get("benchmark_leaderboard", [])
    test_metrics = manager.metadata.get("test_metrics", {})
    selected_model = manager.metadata.get("best_model_name", "M4_OneClassSVM")

    return jsonify({
        "success": True,
        "selected_model": selected_model,
        "selection_criterion": manager.metadata.get("selection_criterion"),
        "alert_threshold": manager.metadata.get("alert_threshold"),
        "test_metrics": test_metrics,
        "benchmark_leaderboard": leaderboard,
        "caveat": manager.metadata.get("important_caveat")
    })


@app.route("/api/sample", methods=["GET"])
def get_sample_data():
    """Serve a sample MetroPT-3 CSV for 1-click test in the UI."""
    sample_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample_metropt3_telemetry.csv")
    if not os.path.exists(sample_path):
        return jsonify({"success": False, "error": "Sample dataset file not found."}), 404

    return send_file(
        sample_path,
        mimetype="text/csv",
        as_attachment=True,
        download_name="sample_metropt3_telemetry.csv"
    )


@app.route("/api/analyze", methods=["POST"])
def analyze_telemetry():
    """Analyze uploaded CSV file containing MetroPT-3 compressor telemetry."""
    manager = get_model_manager()
    if not manager.is_loaded or manager.engine is None:
        return jsonify({
            "success": False,
            "error": "ML model is not loaded.",
            "details": manager.error_message
        }), 503

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file part in multipart request. Please provide 'file' parameter."
        }), 400

    uploaded_file = request.files["file"]
    if uploaded_file.filename == "":
        return jsonify({
            "success": False,
            "error": "No selected file."
        }), 400

    filename = uploaded_file.filename
    try:
        file_bytes = uploaded_file.read()
    except Exception as exc:
        return jsonify({
            "success": False,
            "error": f"Failed to read uploaded file: {str(exc)}"
        }), 400

    # 1. Validate CSV schema & data hygiene
    is_valid, err_msg, df_clean, val_meta = validate_csv_content(
        file_bytes=file_bytes,
        filename=filename,
        timestamp_col=manager.metadata.get("required_timestamp_column", "timestamp")
    )
    if not is_valid or df_clean is None:
        return jsonify({
            "success": False,
            "error": err_msg or "CSV validation failed.",
            "metadata": val_meta
        }), 422

    # 2. Run inference pipeline
    try:
        df_scored = manager.engine.transform_and_score(df_clean)
    except Exception as exc:
        logger.error(f"Inference error: {exc}", exc_info=True)
        return jsonify({
            "success": False,
            "error": f"Error during model scoring: {str(exc)}"
        }), 500

    # 3. Compute summary statistics
    analysis_id = str(uuid.uuid4())
    total_records = len(df_scored)
    anomaly_count = int(df_scored["is_anomaly"].sum())
    anomaly_rate = float((anomaly_count / total_records) * 100.0) if total_records > 0 else 0.0

    scores = df_scored["anomaly_score"].to_numpy()
    min_score = float(np.min(scores)) if len(scores) > 0 else 0.0
    max_score = float(np.max(scores)) if len(scores) > 0 else 0.0
    mean_score = float(np.mean(scores)) if len(scores) > 0 else 0.0

    ts_col = manager.engine.timestamp_col
    summary = {
        "records_analyzed": total_records,
        "anomaly_count": anomaly_count,
        "anomaly_rate_percent": round(anomaly_rate, 2),
        "score_min": round(min_score, 4),
        "score_max": round(max_score, 4),
        "score_mean": round(mean_score, 4),
        "threshold": manager.engine.threshold,
        "start_time": str(df_scored[ts_col].min()),
        "end_time": str(df_scored[ts_col].max()),
        "sampling_count": total_records
    }

    # Store scored dataframe in cache for full download
    store_cached_analysis(analysis_id, {
        "df_scored": df_scored,
        "filename": filename,
        "summary": summary,
        "timestamp_col": ts_col,
        "created_at": datetime.now().isoformat()
    })

    # 4. Pagination / Record limits
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 200))
    include_all = request.args.get("include_all", "false").lower() == "true"

    if include_all or per_page <= 0:
        records_slice = df_scored
    else:
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        records_slice = df_scored.iloc[start_idx:end_idx]

    # Convert timestamps to string format for JSON serialization
    records_dict = records_slice.copy()
    records_dict[ts_col] = records_dict[ts_col].astype(str)
    records_list = records_dict.to_dict(orient="records")

    warnings = list(val_meta.get("warnings", []))
    warnings.append("Anomaly detection flags statistical divergence from training baseline; not confirmed mechanical failure.")

    download_url = f"/api/download/{analysis_id}"

    resp = analyze_response_schema(
        analysis_id=analysis_id,
        machine_type="Metro Train Air Compressor",
        model_meta=manager.metadata,
        summary=summary,
        records=records_list,
        warnings=warnings,
        total_records=total_records,
        page=page,
        per_page=per_page,
        download_url=download_url
    )
    return jsonify(resp), 200


@app.route("/api/download/<analysis_id>", methods=["GET"])
def download_scored_csv(analysis_id: str):
    """Download the full scored CSV for an analysis."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        return jsonify({
            "success": False,
            "error": "Analysis ID not found or expired from session cache."
        }), 404

    df_scored = cached["df_scored"]
    output = io.StringIO()
    df_scored.to_csv(output, index=False)
    output.seek(0)

    filename = f"scored_{cached.get('filename', 'compressor_telemetry.csv')}"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


@app.route("/api/assistant/context", methods=["GET", "POST"])
def assistant_context():
    """Prepare structured JSON telemetry context for Gemini Flash."""
    data = (request.get_json(silent=True) if request.is_json else None) or {}
    analysis_id = data.get("analysis_id") or request.args.get("analysis_id")
    incident_timestamp = data.get("incident_timestamp") or request.args.get("incident_timestamp")

    df_scored = None
    ts_col = "timestamp"

    if analysis_id:
        cached = get_cached_analysis(analysis_id)
        if cached:
            df_scored = cached["df_scored"]
            ts_col = cached["timestamp_col"]

    if df_scored is None:
        if ANALYSIS_CACHE:
            latest_id = list(ANALYSIS_CACHE.keys())[-1]
            cached = ANALYSIS_CACHE[latest_id]
            df_scored = cached["df_scored"]
            ts_col = cached["timestamp_col"]
            analysis_id = latest_id
        else:
            sample_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "sample_metropt3_telemetry.csv"
            )
            if os.path.exists(sample_path):
                engine = get_model_manager().engine
                df_scored = engine.transform_and_score(pd.read_csv(sample_path))
                ts_col = "timestamp"
                analysis_id = "sample_telemetry"

    if df_scored is None:
        return jsonify({
            "success": False,
            "error": "No telemetry dataset available to analyze."
        }), 400

    try:
        payload = generate_gemini_flash_payload(
            df_scored=df_scored,
            incident_timestamp=incident_timestamp,
            timestamp_col=ts_col
        )
        return jsonify({
            "success": True,
            "analysis_id": analysis_id,
            "gemini_ready": bool(os.environ.get("GEMINI_API_KEY")),
            "payload": payload
        }), 200
    except Exception as exc:
        return jsonify({
            "success": False,
            "error": f"Failed to generate assistant payload: {str(exc)}"
        }), 500


@app.route("/api/assistant/chat", methods=["POST"])
def assistant_chat():
    """Chat endpoint for AI maintenance assistant.

    Calls Gemini Flash if configured, or provides engineering rule-based diagnosis.
    """
    data = request.get_json(silent=True) or {}
    analysis_id = data.get("analysis_id")
    question = data.get("question")
    payload = data.get("payload")

    if not payload:
        if analysis_id:
            cached = get_cached_analysis(analysis_id)
            if cached:
                payload = generate_gemini_flash_payload(
                    df_scored=cached["df_scored"],
                    timestamp_col=cached["timestamp_col"]
                )
        if not payload and ANALYSIS_CACHE:
            latest_id = list(ANALYSIS_CACHE.keys())[-1]
            cached = ANALYSIS_CACHE[latest_id]
            payload = generate_gemini_flash_payload(
                df_scored=cached["df_scored"],
                timestamp_col=cached["timestamp_col"]
            )
        if not payload:
            sample_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "sample_metropt3_telemetry.csv"
            )
            if os.path.exists(sample_path):
                engine = get_model_manager().engine
                df_scored = engine.transform_and_score(pd.read_csv(sample_path))
                payload = generate_gemini_flash_payload(df_scored=df_scored, timestamp_col="timestamp")

    if not payload:
        return jsonify({
            "success": False,
            "error": "No telemetry payload or active analysis available."
        }), 400

    result = call_gemini_flash_if_configured(payload, user_question=question)
    return jsonify({
        "success": True,
        "data": result
    }), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logger.info(f"Starting MetroPT-3 ML API on {host}:{port}")
    app.run(host=host, port=port, debug=debug)
