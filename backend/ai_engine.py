"""
Saraang App - AI Acoustic & Frequency Compatibility Engine

This module implements the acoustic and frequency mathematics required before
confirming room reservations, ensuring music club rooms do not exceed decibel
thresholds and preventing frequency collisions between loud instruments.
"""

from typing import List, Dict, Any, Optional
import math
from pydantic import BaseModel, Field


class InstrumentAcousticProfile(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    base_decibels: int
    frequency_band: Optional[str] = "Mid"
    quantity: int = 1


class RoomAcousticProfile(BaseModel):
    id: int
    name: str
    max_decibel_threshold: int
    echo_factor: float = 1.0


class SessionTypeRules(BaseModel):
    id: int
    name: str
    participant_limit: int
    is_strict_lockdown: bool = False


class AcousticEvaluation(BaseModel):
    compatible: bool
    total_decibels: float
    effective_decibels: float
    max_allowed_decibels: float
    echo_factor: float
    is_strict_lockdown: bool
    frequency_band_distribution: Dict[str, int]
    frequency_collisions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    rejection_reasons: List[str] = Field(default_factory=list)


def add_decibels(db1: float, db2: float) -> float:
    """
    Logarithmically adds two sound pressure levels:
    10 * log10( 10^(db1 / 10) + 10^(db2 / 10) )
    Asserts: 60dB + 60dB = 63.0dB
    """
    linear = (10.0 ** (db1 / 10.0)) + (10.0 ** (db2 / 10.0))
    return round(10.0 * math.log10(linear), 1)


def calculate_logarithmic_decibels(instruments: List[InstrumentAcousticProfile]) -> float:
    """
    Computes total acoustic sound pressure level using logarithmic summation:
    L_total = 10 * log10( sum( quantity_i * 10^(L_i / 10) ) )
    """
    if not instruments:
        return 35.0  # Baseline ambient room noise in dB

    linear_sum = 0.0
    for inst in instruments:
        qty = max(1, inst.quantity)
        linear_sum += qty * (10.0 ** (inst.base_decibels / 10.0))

    if linear_sum <= 0:
        return 35.0

    total_db = 10.0 * math.log10(linear_sum)
    return round(total_db, 1)


def evaluate_frequency_collisions(instruments: List[InstrumentAcousticProfile]) -> Dict[str, Any]:
    """
    Detects acoustic frequency band collisions.
    Overlapping high-energy instruments in the same band (especially Low or Low-Mid)
    cause muddiness, phase cancellation, and acoustic distortion.
    """
    band_distribution: Dict[str, int] = {}
    band_instruments: Dict[str, List[str]] = {}

    for inst in instruments:
        band = (inst.frequency_band or "Mid").strip()
        band_distribution[band] = band_distribution.get(band, 0) + inst.quantity
        if band not in band_instruments:
            band_instruments[band] = []
        band_instruments[band].append(f"{inst.name} ({inst.base_decibels}dB x{inst.quantity})")

    collisions: List[str] = []
    warnings: List[str] = []

    # Check for severe Low-end collision (Bass / Sub-Bass)
    low_count = band_distribution.get("Low", 0) + band_distribution.get("Sub-Bass", 0)
    if low_count >= 2:
        names = ", ".join(band_instruments.get("Low", []) + band_instruments.get("Sub-Bass", []))
        collisions.append(
            f"Low-frequency clash detected ({low_count} low-end sources: {names}). "
            "High risk of bass boom and structural resonance."
        )

    # Check for crowded Mid frequencies
    mid_count = band_distribution.get("Mid", 0) + band_distribution.get("Low-Mid", 0)
    if mid_count >= 4:
        warnings.append(
            f"High mid-range congestion ({mid_count} instruments). Masking and intelligibility loss likely."
        )

    return {
        "band_distribution": band_distribution,
        "collisions": collisions,
        "warnings": warnings,
    }


def evaluate_acoustic_compatibility(
    room: RoomAcousticProfile,
    instruments: List[InstrumentAcousticProfile],
    session_type: SessionTypeRules,
) -> AcousticEvaluation:
    """
    Evaluates whether the requested instruments and session can safely proceed
    within the target room's acoustic limits.
    """
    rejection_reasons: List[str] = []
    warnings: List[str] = []

    # 1. Logarithmic Decibel Summation
    raw_decibels = calculate_logarithmic_decibels(instruments)

    # 2. Room Echo Factor Calculation (Acoustic Power Gain: L + 10*log10(echo_factor))
    echo_factor = max(0.01, room.echo_factor)
    effective_decibels = round(raw_decibels + 10.0 * math.log10(echo_factor), 1)

    # 3. Lockdown Rules (e.g. Recording Session requires stricter headroom)
    max_threshold = float(room.max_decibel_threshold)
    if session_type.is_strict_lockdown:
        # Enforce a 10dB safety buffer during recording lockdown in standard/booth rooms to prevent bleed.
        # Designated live rooms (Studio A) are purpose-built and acoustically treated for high-SPL live tracking.
        if "live room" in room.name.lower() or "studio a" in room.name.lower():
            warnings.append("Recording lockdown active in Live Studio: room treated for high-SPL instrument tracking.")
        else:
            max_threshold = max(50.0, max_threshold - 10.0)
            warnings.append("Strict lockdown active: room max decibel threshold reduced by 10dB safety headroom.")

    # 4. Decibel Threshold Check
    if effective_decibels > max_threshold:
        rejection_reasons.append(
            f"Effective acoustic noise ({effective_decibels} dB) exceeds the "
            f"safe room threshold ({max_threshold} dB) for '{room.name}'."
        )

    # 5. Frequency Collision Checks
    freq_result = evaluate_frequency_collisions(instruments)
    collisions = freq_result["collisions"]
    warnings.extend(freq_result["warnings"])

    # Strict lockdown cannot tolerate severe low-end clashes
    if session_type.is_strict_lockdown and collisions:
        # In designated Live Room (Studio A), multi-instrument tracking is permitted
        if "live room" in room.name.lower() or "studio a" in room.name.lower():
            warnings.append(f"Acoustic notice: Multi-instrument tracking with low-end balance: {'; '.join(collisions)}")
        else:
            rejection_reasons.append(
                f"Strict lockdown session rejects frequency clashes: {'; '.join(collisions)}"
            )

    compatible = len(rejection_reasons) == 0

    return AcousticEvaluation(
        compatible=compatible,
        total_decibels=raw_decibels,
        effective_decibels=effective_decibels,
        max_allowed_decibels=max_threshold,
        echo_factor=echo_factor,
        is_strict_lockdown=session_type.is_strict_lockdown,
        frequency_band_distribution=freq_result["band_distribution"],
        frequency_collisions=collisions,
        warnings=warnings,
        rejection_reasons=rejection_reasons,
    )
