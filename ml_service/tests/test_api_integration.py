"""End-to-end integration tests for Flask REST API endpoints."""
import os
import sys
import io
import json
import pytest

ml_service_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root_dir = os.path.dirname(ml_service_dir)
sys.path.insert(0, ml_service_dir)

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def sample_csv_bytes():
    sample_path = os.path.join(root_dir, "data", "sample_metropt3_telemetry.csv")
    with open(sample_path, "rb") as f:
        return f.read()


def test_full_analysis_workflow(client, sample_csv_bytes):
    """Test full upload -> analyze -> context -> download workflow."""
    # 1. Upload CSV to /api/analyze
    data = {
        "file": (io.BytesIO(sample_csv_bytes), "sample_telemetry.csv")
    }
    response = client.post(
        "/api/analyze?page=1&per_page=50",
        data=data,
        content_type="multipart/form-data"
    )

    assert response.status_code == 200
    res_json = response.get_json()
    assert res_json["success"] is True
    assert "analysis_id" in res_json
    assert res_json["machine_type"] == "Metro Train Air Compressor"
    assert res_json["model"]["name"] == "M4_OneClassSVM"

    summary = res_json["summary"]
    assert summary["records_analyzed"] == 1000
    assert summary["anomaly_count"] > 0
    assert summary["anomaly_rate_percent"] > 0.0
    assert len(res_json["records"]) == 50

    analysis_id = res_json["analysis_id"]

    # 2. Test /api/download/<analysis_id>
    dl_resp = client.get(f"/api/download/{analysis_id}")
    assert dl_resp.status_code == 200
    assert dl_resp.mimetype == "text/csv"
    assert b"anomaly_score" in dl_resp.data
    assert b"is_anomaly" in dl_resp.data

    # 3. Test /api/assistant/context
    ctx_resp = client.post("/api/assistant/context", json={"analysis_id": analysis_id})
    assert ctx_resp.status_code == 200
    ctx_json = ctx_resp.get_json()
    assert ctx_json["success"] is True
    assert "payload" in ctx_json
    payload = ctx_json["payload"]
    assert payload["machine_type"].startswith("Metro-Train Air Compressor")
    assert "sensor_telemetry" in payload
    assert "operating_context" in payload

    # 4. Test /api/assistant/chat
    chat_resp = client.post("/api/assistant/chat", json={
        "analysis_id": analysis_id,
        "question": "Which sensors contributed to the latest anomaly?"
    })
    assert chat_resp.status_code == 200
    chat_json = chat_resp.get_json()
    assert chat_json["success"] is True
    assert "data" in chat_json
    assert "reply" in chat_json["data"] or "simulated_response" in chat_json["data"]


def test_assistant_context_fallback(client):
    """Test /api/assistant/context without active analysis_id falls back to sample."""
    resp = client.get("/api/assistant/context")
    assert resp.status_code == 200
    res_json = resp.get_json()
    assert res_json["success"] is True
    assert "payload" in res_json
    assert res_json["payload"]["machine_type"].startswith("Metro-Train Air Compressor")


def test_benchmark_endpoint(client):
    """Test /api/benchmark returns 7-model comparison metadata."""
    resp = client.get("/api/benchmark")
    assert resp.status_code == 200
    res_json = resp.get_json()
    assert res_json["success"] is True
    assert res_json["selected_model"] == "M4_OneClassSVM"
    assert len(res_json["benchmark_leaderboard"]) >= 7
