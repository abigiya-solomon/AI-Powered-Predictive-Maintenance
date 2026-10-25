"""Structured telemetry payload generator for Gemini Flash AI Maintenance Assistant.

Replicates the exact payload structure and prompt engineering defined in
Sections M, P, and the Gemini evaluation cells of final_final_final_insa.ipynb.
"""
from typing import Dict, Any, Optional
import os
import json
import logging
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = (
    "You are a careful predictive-maintenance assistant analyzing metro-train air-compressor telemetry. "
    "Use only information supported by the supplied JSON payload. "
    "Do not invent sensor readings or claim a component has failed without evidence. "
    "An anomaly score is not a confirmed diagnosis. "
    "Clearly distinguish observed facts from possible explanations. "
    "Recommend safe verification by a qualified technician. "
    "Do not claim to predict remaining useful life."
)


def safe_float(value: Any) -> Optional[float]:
    """Convert value to float, ensuring JSON-compliance (no NaN or Inf)."""
    try:
        numeric = float(value)
        return numeric if np.isfinite(numeric) else None
    except (TypeError, ValueError):
        return None


def generate_gemini_flash_payload(
    df_scored: pd.DataFrame,
    incident_timestamp: Optional[str] = None,
    timestamp_col: str = 'timestamp'
) -> Dict[str, Any]:
    """Create a JSON-safe summary of scored compressor telemetry.

    If incident_timestamp is provided, locates that row. Otherwise, picks
    the record with the highest anomaly score.
    """
    if df_scored is None or df_scored.empty:
        raise ValueError("Cannot create a Gemini payload from an empty scored dataframe.")

    if incident_timestamp is not None:
        target = pd.to_datetime(incident_timestamp, errors='coerce')
        times = pd.to_datetime(df_scored[timestamp_col], errors='coerce')
        matches = df_scored.loc[times == target]
        if matches.empty:
            raise ValueError(f"No scored row was found at incident timestamp {incident_timestamp!r}.")
        row = matches.iloc[0]
    else:
        row = df_scored.sort_values(by='anomaly_score', ascending=False).iloc[0]

    model_name = str(row.get('model_name', 'M4_OneClassSVM'))
    threshold_val = safe_float(row.get('threshold_applied', -72.229472))

    payload = {
        "machine_type": "Metro-Train Air Compressor (MetroPT-3 dataset domain)",
        "timestamp": str(row[timestamp_col]),
        "model_metadata": {
            "model_name": model_name,
            "threshold": threshold_val,
            "score": safe_float(row['anomaly_score']),
            "anomaly_detected": bool(row.get('is_anomaly', 0) == 1),
            "evaluation_caveat": "Anomaly score is not a confirmed failure diagnosis."
        },
        "sensor_telemetry": {
            "TP2_compressor_pressure": safe_float(row.get('TP2')),
            "TP3_panel_pressure": safe_float(row.get('TP3')),
            "H1_cyclonic_separator_pressure": safe_float(row.get('H1')),
            "DV_pressure": safe_float(row.get('DV_pressure')),
            "Reservoir_pressure": safe_float(row.get('Reservoirs')),
            "Motor_current": safe_float(row.get('Motor_current')),
            "Oil_temperature": safe_float(row.get('Oil_temperature')),
            "Differential_TP2_TP3": safe_float(row.get('delta_TP2_TP3')),
            "Reservoir_decay_rate_per_sample": safe_float(row.get('d_Reservoirs_dt'))
        },
        "operating_context": {
            "compressor_pumping": bool(row['Motor_current'] > 1.0) if pd.notna(row.get('Motor_current')) else None,
            "abnormal_decay_while_idle": bool(row.get('leak_signature_score', 0) > 0.05) if pd.notna(row.get('leak_signature_score')) else None
        },
        "recommended_checks": [
            "Review the pressure and operating-state trends around this timestamp.",
            "Inspect relevant valves, couplings, and seals if the alert persists.",
            "Confirm any suspected fault with maintenance logs and a qualified technician."
        ],
        "uncertainty_note": (
            "This system flags statistical anomalies in MetroPT-3-like compressor telemetry. "
            "It is not a confirmed diagnosis, and documented event labels are sparse."
        )
    }
    return payload


def format_assistant_prompt(payload: Dict[str, Any], user_question: Optional[str] = None) -> str:
    """Format the engineering prompt for Gemini 3.8 Flash as in final_final_final_insa.ipynb."""
    payload_json = json.dumps(payload, indent=2)

    if user_question and user_question.strip():
        return f"""Analyze this machine-health payload:

{payload_json}

Technician Question:
{user_question.strip()}

Please provide an evidence-based maintenance response adhering to the domain rules:
1. Base the status and interpretation strictly on the model alert and available sensor telemetry.
2. Clearly distinguish observed facts from possible explanations (hypotheses).
3. Recommend safe, prioritized checks for a depot maintenance technician.
4. Note uncertainty and limitations (anomaly score is not a confirmed failure diagnosis).
"""

    return f"""Analyze this machine-health payload:

{payload_json}

Write a concise maintenance report containing:

1. Machine health status: Normal, Warning, or Critical Anomaly.
2. The model alert and its supporting sensor readings.
3. Plausible explanations, clearly labeled as hypotheses.
4. Prioritized checks for a maintenance technician.
5. Uncertainty and limitations.

Base the status on the model alert and available evidence.
Do not invent severity thresholds or diagnose a confirmed failure.
"""


def call_gemini_flash_if_configured(
    payload: Dict[str, Any],
    user_question: Optional[str] = None
) -> Dict[str, Any]:
    """Execute Gemini 3.8 Flash request if GEMINI_API_KEY is configured in the environment.

    Returns structured assistant response with telemetry context.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {
            "configured": False,
            "model": "gemini-3.8-flash",
            "message": "Gemini API key is not configured on the ML service. Telemetry context prepared for inspection.",
            "payload": payload,
            "simulated_response": generate_rule_based_diagnosis(payload, user_question)
        }

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        prompt = format_assistant_prompt(payload, user_question)

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
            )
        )

        return {
            "configured": True,
            "model": "gemini-3.8-flash",
            "message": "Response generated by Gemini 3.8 Flash",
            "reply": response.text,
            "payload": payload
        }
    except Exception as exc:
        logger.error(f"Error calling Gemini API: {exc}")
        return {
            "configured": True,
            "model": "gemini-3.8-flash",
            "error": str(exc),
            "payload": payload,
            "simulated_response": generate_rule_based_diagnosis(payload, user_question)
        }


def generate_rule_based_diagnosis(payload: Dict[str, Any], question: Optional[str] = None) -> str:
    """Deterministic engineering rule-based diagnosis when Gemini is not configured."""
    meta = payload.get("model_metadata", {})
    sensors = payload.get("sensor_telemetry", {})
    context = payload.get("operating_context", {})

    is_anomaly = meta.get("anomaly_detected", False)
    score = meta.get("score")
    threshold = meta.get("threshold")
    pumping = context.get("compressor_pumping", False)
    leak_signature = context.get("abnormal_decay_while_idle", False)

    state_str = "PUMPING (Motor Active)" if pumping else "IDLE / UNLOADED"
    severity = "CRITICAL / ATTENTION" if is_anomaly else "NORMAL"

    tp2 = sensors.get("TP2_compressor_pressure")
    res = sensors.get("Reservoir_pressure")
    delta_p = sensors.get("Differential_TP2_TP3")

    lines = [
        f"### Subsystem Health Status: {severity}",
        f"- **Operating State:** {state_str}",
        f"- **Model Anomaly Score:** {score:.4f} (Threshold: {threshold:.4f})",
        f"- **Alert Status:** {'Active Anomaly Flag' if is_anomaly else 'Within Baseline Parameters'}",
        "",
        "### Telemetry Interpretation:",
        f"- **Compressor Outlet (TP2):** {tp2} bar | **Reservoirs:** {res} bar",
        f"- **Inter-stage Differential (TP2 - TP3):** {delta_p} bar",
    ]

    if leak_signature:
        lines.append("- **Pneumatic Leak Signature:** Elevated pressure decay rate observed while compressor is idle.")
    elif pumping:
        lines.append("- **Pneumatic Charging:** Motor current is elevated, compressor is pressurizing the reservoir network.")
    else:
        lines.append("- **Normal Idle:** Reservoir pressure maintained within standard limits.")

    lines.extend([
        "",
        "### Actionable Depot Inspection Protocols:",
        "1. Check coupling seals and discharge pipe unions for audible acoustic leaks.",
        "2. Verify oil temperature sensor and separator filter differential pressure.",
        "3. Cross-reference this timestamp with depot maintenance work orders.",
        "",
        "> *Note: This assessment is based on statistical anomaly detection on the MetroPT-3 compressor dataset and does not constitute a certified manual inspection.*"
    ])

    return "\n".join(lines)
