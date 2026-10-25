"""Unit tests for Flask health and benchmark endpoints."""
import os
import sys
import pytest

# Add ml_service to path
ml_service_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ml_service_dir)

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    """Test GET /api/health returns 200 with model information."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert "model_info" in data
    assert data["model_info"]["name"] == "M4_OneClassSVM"
    assert data["model_info"]["features_count"] == 25


def test_benchmark_endpoint(client):
    """Test GET /api/benchmark returns 7-model leaderboard."""
    response = client.get("/api/benchmark")
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["selected_model"] == "M4_OneClassSVM"
    leaderboard = data["benchmark_leaderboard"]
    assert len(leaderboard) == 7
    model_ids = [m["model_id"] for m in leaderboard]
    assert "M4_OneClassSVM" in model_ids
    assert "M7_DeepAutoencoder" in model_ids
    assert "M3_IsolationForest" in model_ids
