import requests
import json

print("=== Probing Live Endpoints ===")

# 1. Frontend
try:
    rf = requests.get("http://127.0.0.1:5173/", timeout=5)
    print(f"[Frontend 5173]: {rf.status_code} OK (HTML bytes: {len(rf.content)})")
except Exception as e:
    print(f"[Frontend 5173]: FAILED - {e}")

# 2. Flask Health
try:
    rh = requests.get("http://127.0.0.1:5000/api/health", timeout=5)
    hjson = rh.json()
    print(f"[Health 5000]: {rh.status_code} OK - Service: {hjson.get('service')} | Model: {hjson.get('model_info', {}).get('name')}")
except Exception as e:
    print(f"[Health 5000]: FAILED - {e}")

# 3. Benchmark Leaderboard
try:
    rb = requests.get("http://127.0.0.1:5000/api/benchmark", timeout=5)
    bdata = rb.json()
    print(f"[Benchmark 5000]: {rb.status_code} OK - Winner: {bdata.get('selected_model')} | {len(bdata.get('benchmark_leaderboard', []))} models compared")
except Exception as e:
    print(f"[Benchmark 5000]: FAILED - {e}")

# 4. Assistant Context
try:
    rc = requests.get("http://127.0.0.1:5000/api/assistant/context", timeout=5)
    cdata = rc.json()
    print(f"[Assistant Context]: {rc.status_code} OK - Machine: {cdata.get('payload', {}).get('machine_type')} | Gemini Ready: {cdata.get('gemini_ready')}")
except Exception as e:
    print(f"[Assistant Context]: FAILED - {e}")

# 5. Assistant Chat
try:
    rchat = requests.post("http://127.0.0.1:5000/api/assistant/chat", json={"question": "What is the compressor status?"}, timeout=10)
    chatdata = rchat.json()
    print(f"[Assistant Chat]: {rchat.status_code} OK - Model: {chatdata.get('data', {}).get('model')} | Configured: {chatdata.get('data', {}).get('configured')}")
except Exception as e:
    print(f"[Assistant Chat]: FAILED - {e}")

# 6. Upload & Analyze
try:
    with open("D:/insa_final_project/data/sample_metropt3_telemetry.csv", "rb") as f:
        ra = requests.post("http://127.0.0.1:5000/api/analyze?page=1&per_page=10", files={"file": f}, timeout=15)
    adata = ra.json()
    summary = adata.get("summary", {})
    print(f"[Analyze CSV]: {ra.status_code} OK - Records: {summary.get('records_analyzed')} | Anomaly Count: {summary.get('anomaly_count')} ({summary.get('anomaly_rate_percent')}%)")
except Exception as e:
    print(f"[Analyze CSV]: FAILED - {e}")

print("=== End Probe ===")
