"""API response dictionaries and schemas for the ML Flask Service."""
from typing import Dict, Any, List, Optional


def health_response_schema(
    status: str,
    model_loaded: bool,
    metadata: Dict[str, Any],
    error: Optional[str] = None
) -> Dict[str, Any]:
    return {
        "status": status,
        "service": "MetroPT-3 Predictive Maintenance ML API",
        "version": "1.0.0",
        "model_loaded": model_loaded,
        "error": error,
        "model_info": {
            "name": metadata.get("best_model_name"),
            "category": metadata.get("model_category"),
            "alert_threshold": metadata.get("alert_threshold"),
            "score_direction": metadata.get("score_direction"),
            "selection_criterion": metadata.get("selection_criterion"),
            "validation_pr_auc": metadata.get("validation_pr_auc_weak_labels"),
            "features_count": len(metadata.get("feature_columns", [])),
        },
        "disclaimer": "Anomaly scores are exploratory metrics derived from weak event labels and do not constitute confirmed mechanical failure diagnoses."
    }


def analyze_response_schema(
    analysis_id: str,
    machine_type: str,
    model_meta: Dict[str, Any],
    summary: Dict[str, Any],
    records: List[Dict[str, Any]],
    warnings: List[str],
    total_records: int,
    page: int = 1,
    per_page: int = 200,
    download_url: Optional[str] = None
) -> Dict[str, Any]:
    return {
        "success": True,
        "analysis_id": analysis_id,
        "machine_type": machine_type,
        "model": {
            "name": model_meta.get("best_model_name"),
            "category": model_meta.get("model_category"),
            "threshold": model_meta.get("alert_threshold"),
            "score_direction": model_meta.get("score_direction")
        },
        "summary": summary,
        "pagination": {
            "total_records": total_records,
            "returned_records": len(records),
            "page": page,
            "per_page": per_page,
            "total_pages": (total_records + per_page - 1) // per_page if per_page > 0 else 1
        },
        "records": records,
        "warnings": warnings,
        "download_url": download_url
    }
