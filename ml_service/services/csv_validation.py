"""CSV Schema and Data Hygiene Validation for MetroPT-3 compressor telemetry.

Enforces strict input validation, prevents treating 'Unnamed: 0' as a sensor,
and ensures complete compatibility with the ML inference pipeline.
"""
from typing import Dict, Any, List, Optional, Tuple
import io
import pandas as pd
import numpy as np

EXPECTED_RAW_SENSORS: List[str] = [
    'TP2',
    'TP3',
    'H1',
    'DV_pressure',
    'Reservoirs',
    'Oil_temperature',
    'Motor_current',
    'COMP',
    'DV_eletric',
    'Towers',
    'MPG',
    'LPS',
    'Pressure_switch',
    'Oil_level',
    'Caudal_impulses',
]

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB safety ceiling for HTTP uploads


def validate_csv_content(
    file_bytes: bytes,
    filename: str = "uploaded.csv",
    timestamp_col: str = "timestamp",
    max_rows: Optional[int] = None
) -> Tuple[bool, Optional[str], Optional[pd.DataFrame], Dict[str, Any]]:
    """Validate uploaded CSV content for MetroPT-3 compatibility.

    Returns:
        (is_valid, error_message, parsed_dataframe, validation_metadata)
    """
    metadata: Dict[str, Any] = {
        "filename": filename,
        "file_size_bytes": len(file_bytes),
        "columns_detected": [],
        "missing_columns": [],
        "warnings": [],
        "rows_count": 0,
        "sample_preview": []
    }

    if len(file_bytes) == 0:
        return False, "The uploaded file is empty (0 bytes).", None, metadata

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        return (
            False,
            f"File size exceeds safety limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
            None,
            metadata
        )

    try:
        # Read with pandas
        df = pd.read_csv(io.BytesIO(file_bytes), nrows=max_rows)
    except Exception as exc:
        return False, f"Failed to parse CSV file: {str(exc)}", None, metadata

    if df.empty:
        return False, "CSV file contains no data rows.", None, metadata

    # Clean redundant index columns (e.g. Unnamed: 0 from pandas exports)
    if 'Unnamed: 0' in df.columns:
        df = df.drop(columns=['Unnamed: 0'])
        metadata["warnings"].append("Ignored redundant index column 'Unnamed: 0'.")

    # Detect timestamp column
    actual_ts_col = None
    for candidate in [timestamp_col, 'timestamp', 'Timestamp', 'time', 'Time', 'datetime', 'Datetime']:
        if candidate in df.columns:
            actual_ts_col = candidate
            break

    if actual_ts_col is None:
        return (
            False,
            f"Missing required timestamp column. Expected '{timestamp_col}', found columns: {list(df.columns)}",
            None,
            metadata
        )

    # Standardize timestamp column name if necessary
    if actual_ts_col != timestamp_col:
        df = df.rename(columns={actual_ts_col: timestamp_col})
        metadata["warnings"].append(f"Renamed timestamp column '{actual_ts_col}' to '{timestamp_col}'.")

    # Validate timestamps can be parsed
    parsed_dates = pd.to_datetime(df[timestamp_col], errors='coerce')
    bad_ts_count = int(parsed_dates.isna().sum())
    if bad_ts_count > 0:
        return (
            False,
            f"Found {bad_ts_count} unparseable timestamps in '{timestamp_col}' column.",
            None,
            metadata
        )

    # Check for missing sensor columns
    detected_cols = list(df.columns)
    metadata["columns_detected"] = detected_cols
    missing = [c for c in EXPECTED_RAW_SENSORS if c not in df.columns]
    metadata["missing_columns"] = missing

    if missing:
        return (
            False,
            f"Input CSV is missing required raw sensor columns: {missing}. Expected schema: {EXPECTED_RAW_SENSORS}",
            None,
            metadata
        )

    # Check for NaN / Inf in sensor columns
    sensor_df = df[EXPECTED_RAW_SENSORS].apply(pd.to_numeric, errors='coerce')
    nan_counts = sensor_df.isna().sum()
    cols_with_nan = nan_counts[nan_counts > 0].to_dict()
    if cols_with_nan:
        return (
            False,
            f"Sensor columns contain non-numeric or missing (NaN) values: {cols_with_nan}. "
            "Please clean or impute missing values before inference.",
            None,
            metadata
        )

    inf_counts = np.isinf(sensor_df.to_numpy()).sum()
    if inf_counts > 0:
        return (
            False,
            f"Sensor columns contain {inf_counts} infinite values.",
            None,
            metadata
        )

    # Record preview rows for UI inspection
    preview_df = df.head(5).copy()
    metadata["sample_preview"] = preview_df.to_dict(orient="records")
    metadata["rows_count"] = len(df)

    return True, None, df, metadata
