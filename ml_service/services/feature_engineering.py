"""Feature engineering pipeline for MetroPT-3 compressor anomaly detection.

Replicates the exact causal feature calculations from Section F of final_final_final_insa.ipynb.
"""
from typing import List
import numpy as np
import pandas as pd

ENGINEERED_FEATURE_NAMES: List[str] = [
    'delta_TP2_TP3',
    'delta_TP3_Reservoirs',
    'delta_H1_TP2',
    'is_pumping',
    'TP2_roll_std',
    'DV_pressure_roll_std',
    'Oil_temp_roll_mean',
    'd_Reservoirs_dt',
    'd_TP2_dt',
    'leak_signature_score',
]

ROLL_WINDOW = 30
ROLLING_MIN_PERIODS = 5

REQUIRED_RAW_SENSORS: List[str] = [
    'TP2',
    'TP3',
    'H1',
    'DV_pressure',
    'Reservoirs',
    'Oil_temperature',
    'Motor_current',
]


def engineer_physics_features(df: pd.DataFrame, ts_col: str = 'timestamp') -> pd.DataFrame:
    """Create physics-based and trailing-window features without using future rows.

    The input must already be in chronological order. Training and inference call
    this same function to keep the feature definitions identical.
    """
    df_feat = df.copy()

    missing = [c for c in REQUIRED_RAW_SENSORS if c not in df_feat.columns]
    if missing:
        raise ValueError(f"Cannot engineer features; required sensor columns are missing: {missing}")

    # Differential pressure dynamics
    df_feat['delta_TP2_TP3'] = (df_feat['TP2'] - df_feat['TP3']).astype('float32')
    df_feat['delta_TP3_Reservoirs'] = (df_feat['TP3'] - df_feat['Reservoirs']).astype('float32')
    df_feat['delta_H1_TP2'] = (df_feat['H1'] - df_feat['TP2']).astype('float32')
    df_feat['is_pumping'] = (df_feat['Motor_current'] > 1.0).astype('uint8')

    # 30 samples corresponds to roughly 5 minutes only when cadence is 10 seconds.
    # min_periods=5 and all trailing calculations are replicated exactly at inference.
    df_feat['TP2_roll_std'] = (
        df_feat['TP2'].rolling(window=ROLL_WINDOW, min_periods=ROLLING_MIN_PERIODS)
        .std()
        .fillna(0.0)
        .astype('float32')
    )
    df_feat['DV_pressure_roll_std'] = (
        df_feat['DV_pressure'].rolling(window=ROLL_WINDOW, min_periods=ROLLING_MIN_PERIODS)
        .std()
        .fillna(0.0)
        .astype('float32')
    )
    df_feat['Oil_temp_roll_mean'] = (
        df_feat['Oil_temperature'].rolling(window=ROLL_WINDOW, min_periods=ROLLING_MIN_PERIODS)
        .mean()
        .fillna(df_feat['Oil_temperature'])
        .astype('float32')
    )
    df_feat['d_Reservoirs_dt'] = df_feat['Reservoirs'].diff().fillna(0.0).astype('float32')
    df_feat['d_TP2_dt'] = df_feat['TP2'].diff().fillna(0.0).astype('float32')

    # Rapid reservoir pressure drop while compressor is idle indicates pneumatic leak
    df_feat['leak_signature_score'] = np.where(
        df_feat['is_pumping'] == 0,
        np.maximum(0.0, -df_feat['d_Reservoirs_dt']),
        0.0,
    ).astype('float32')

    return df_feat
