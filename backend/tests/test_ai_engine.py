"""
Tests for Saraang AI Acoustic & Frequency Compatibility Engine

Fulfills Directive 5: Asserts that 60dB + 60dB = 63.0dB (logarithmic summation)
and ensures decibels are never added linearly.
"""

import pytest
from ai_engine import (
    add_decibels,
    calculate_logarithmic_decibels,
    evaluate_acoustic_compatibility,
    InstrumentAcousticProfile,
    RoomAcousticProfile,
    SessionTypeRules,
)


def test_acoustic_math_rule_60db_plus_60db():
    """
    CRITICAL GUARDRAIL: Sound pressure levels add logarithmically.
    10 * log10( 10^(60/10) + 10^(60/10) ) = 10 * log10(2,000,000) = 63.0103... dB
    MUST assert 60dB + 60dB == 63.0dB.
    """
    result = add_decibels(60.0, 60.0)
    assert result == 63.0, f"Expected 63.0 dB, got {result} dB. Decibels must not be added linearly!"


def test_acoustic_math_via_instrument_profiles():
    """
    Validates that two 60dB instruments in the instrument list
    sum to 63.0dB.
    """
    inst1 = InstrumentAcousticProfile(id=1, name="Violin", base_decibels=60, quantity=1)
    inst2 = InstrumentAcousticProfile(id=2, name="Flute", base_decibels=60, quantity=1)

    result = calculate_logarithmic_decibels([inst1, inst2])
    assert result == 63.0, f"Expected 63.0 dB for two 60dB instruments, got {result} dB."


def test_never_add_linearly():
    """Confirms 60dB + 60dB is nowhere near 120dB."""
    result = add_decibels(60.0, 60.0)
    assert result != 120.0


def test_empty_instruments_baseline():
    """Empty instrument list defaults to baseline room silence."""
    result = calculate_logarithmic_decibels([])
    assert result == 35.0


def test_acoustic_evaluation_threshold_rejection():
    """Ensures rooms reject sessions that exceed maximum decibel thresholds."""
    quiet_room = RoomAcousticProfile(
        id=1,
        name="Acoustic Booth",
        max_decibel_threshold=75,
        echo_factor=1.0,
    )
    loud_drums = [
        InstrumentAcousticProfile(id=1, name="Drums", base_decibels=110, quantity=1, frequency_band="Low-Mid"),
    ]
    standard_session = SessionTypeRules(id=1, name="Session A", participant_limit=4, is_strict_lockdown=False)

    eval_result = evaluate_acoustic_compatibility(quiet_room, loud_drums, standard_session)
    assert not eval_result.compatible
    assert any("exceeds the safe room threshold" in r for r in eval_result.rejection_reasons)


def test_frequency_collision_and_lockdown():
    """Ensures strict lockdown recording sessions reject low-end clashes."""
    studio = RoomAcousticProfile(id=2, name="Studio A", max_decibel_threshold=120, echo_factor=1.0)
    clashing_instruments = [
        InstrumentAcousticProfile(id=1, name="Drums", base_decibels=95, quantity=1, frequency_band="Low"),
        InstrumentAcousticProfile(id=2, name="Electric Bass", base_decibels=95, quantity=1, frequency_band="Low"),
    ]
    recording_session = SessionTypeRules(id=4, name="Recording Session", participant_limit=3, is_strict_lockdown=True)

    eval_result = evaluate_acoustic_compatibility(studio, clashing_instruments, recording_session)
    assert not eval_result.compatible
    assert len(eval_result.frequency_collisions) > 0
    assert any("Strict lockdown session rejects frequency clashes" in r for r in eval_result.rejection_reasons)
