# MetroPT-3 Air Compressor Dataset

## Overview
This directory contains sample telemetry and documentation for the MetroPT-3 benchmark dataset published by UCI Machine Learning Repository and Kaggle:
- **Title:** MetroPT: A Dataset for Predictive Maintenance
- **System:** Rolling Stock Air Production Unit (APU) on Metro do Porto trains
- **Sampling Frequency:** 0.1 Hz (1 sample every 10 seconds)
- **Time Span:** February 2020 through September 2020 (~1.51M rows)

## Sensors
- `timestamp`: Date and time (UTC)
- `TP2`: Pressure measured at compressor outlet (bar)
- `TP3`: Pressure measured inside pneumatic control panel (bar)
- `H1`: Pressure measured at cyclonic separator outlet (bar)
- `DV_pressure`: Pressure drop measured across purge valves (bar)
- `Reservoirs`: Pressure measured inside main air reservoir tanks (bar)
- `Oil_temperature`: Temperature of compressor lubricant oil (°C)
- `Motor_current`: Phase electrical current consumed by the compressor motor (A)
- `COMP`: Electrical signal commanding compressor activation (0/1)
- `DV_eletric`: Electrical signal controlling purge valve (0/1)
- `Towers`: Active desiccant air drying column (0/1)
- `MPG`: Main pressure governor status (0/1)
- `LPS`: Low pressure switch alarm status (0/1)
- `Pressure_switch`: Compressor activation pressure switch (0/1)
- `Oil_level`: Oil level sensor (0 = low, 1 = normal)
- `Caudal_impulses`: Airflow pulse count signal (0/1)

## Using the Sample File
`data/sample_metropt3_telemetry.csv` is a 1,000-row slice with normal compressor duty cycles and an induced air leak anomaly episode. You can upload this directly in the web dashboard or Streamlit app to test the inference pipeline immediately.

## Full Dataset
To run with the complete 208 MB dataset, download `Metro.csv` or `MetroPT3(AirCompressor).csv` from Kaggle/UCI and place it in this folder or set `METROPT_CSV_PATH`.
