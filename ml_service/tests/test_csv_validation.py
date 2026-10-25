"""Unit tests for CSV validation service."""
import os
import sys
import pytest

ml_service_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ml_service_dir)

from services.csv_validation import validate_csv_content, EXPECTED_RAW_SENSORS


def test_empty_file_fails():
    is_valid, msg, df, meta = validate_csv_content(b"")
    assert not is_valid
    assert "empty" in msg.lower()


def test_missing_timestamp_fails():
    csv_bytes = b"TP2,TP3,H1\n1.0,2.0,3.0\n"
    is_valid, msg, df, meta = validate_csv_content(csv_bytes)
    assert not is_valid
    assert "timestamp" in msg.lower()


def test_missing_sensor_columns_fails():
    csv_bytes = b"timestamp,TP2,TP3\n2020-06-01 00:00:00,1.0,2.0\n"
    is_valid, msg, df, meta = validate_csv_content(csv_bytes)
    assert not is_valid
    assert "missing required raw sensor columns" in msg.lower()


def test_invalid_timestamp_parsing_fails():
    headers = ["timestamp"] + EXPECTED_RAW_SENSORS
    header_line = ",".join(headers) + "\n"
    row_line = "not-a-date," + ",".join(["1.0"] * len(EXPECTED_RAW_SENSORS)) + "\n"
    csv_bytes = (header_line + row_line).encode("utf-8")

    is_valid, msg, df, meta = validate_csv_content(csv_bytes)
    assert not is_valid
    assert "unparseable" in msg.lower()


def test_unnamed_column_dropped_and_valid():
    headers = ["Unnamed: 0", "timestamp"] + EXPECTED_RAW_SENSORS
    header_line = ",".join(headers) + "\n"
    row_line = "0,2020-06-01 00:00:00," + ",".join(["2.5"] * len(EXPECTED_RAW_SENSORS)) + "\n"
    csv_bytes = (header_line + row_line).encode("utf-8")

    is_valid, msg, df, meta = validate_csv_content(csv_bytes)
    assert is_valid
    assert "Unnamed: 0" not in df.columns
    assert len(meta["warnings"]) > 0
    assert df.shape[0] == 1
