import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { api, SessionType, Instrument, SlotAvailability } from '../api/client';
import { useStore } from '../store/useStore';
import { SessionCard } from '../components/SessionCard';
import { InstrumentGrid } from '../components/InstrumentGrid';
import { AcousticRejectionModal } from '../components/AcousticRejectionModal';

interface BookingWizardScreenProps {
  onBookingSuccess: () => void;
}

export const BookingWizardScreen: React.FC<BookingWizardScreenProps> = ({ onBookingSuccess }) => {
  const {
    wizard,
    setWizardStep,
    selectSession,
    setPracticeMode,
    setBookingDateTime,
    setParticipantCount,
    setInstrumentQuantity,
    setAcousticPreview,
    setIsCheckingAcoustics,
    openRejectionModal,
    closeRejectionModal,
    resetWizard,
    currentUser,
    showNotification,
  } = useStore();

  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBooking, setSuccessBooking] = useState<any>(null);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSlotDropdownOpen, setIsSlotDropdownOpen] = useState(false);

  // Load catalogues
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [st, inst] = await Promise.all([
          api.getSessionTypes(),
          api.getInstruments(),
        ]);
        setSessionTypes(st);
        setInstruments(inst);
      } catch (err) {
        console.error('Failed to load booking catalogues:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Debounced Acoustic AI Check during Step 2B
  const runAcousticCheck = useCallback(async () => {
    if (!wizard.selectedSession) return;

    const selectedInstrumentsList = Object.entries(wizard.instruments).map(([id, qty]) => ({
      instrument_id: parseInt(id, 10),
      quantity: qty,
    }));

    try {
      setIsCheckingAcoustics(true);
      const res = await api.checkAcoustics({
        session_type_id: wizard.selectedSession.id,
        practice_mode: wizard.practiceMode,
        instruments: selectedInstrumentsList,
      });
      setAcousticPreview(res);
    } catch (err) {
      console.error('Acoustic dry-run failed:', err);
    } finally {
      setIsCheckingAcoustics(false);
    }
  }, [wizard.selectedSession, wizard.instruments, wizard.practiceMode]);

  useEffect(() => {
    if (wizard.step === 2) {
      const timer = setTimeout(() => {
        runAcousticCheck();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [wizard.step, wizard.instruments, wizard.practiceMode, runAcousticCheck]);

  // Fetch live hour-wise slots availability for operating hours (6:00 AM - 11:00 PM)
  useEffect(() => {
    if (wizard.step === 2 && wizard.selectedSession) {
      let isMounted = true;
      const fetchSlots = async () => {
        try {
          setLoadingSlots(true);
          const data = await api.getSessionSlots(wizard.selectedSession!.id, wizard.bookingDate);
          if (isMounted) {
            const returnedSlots = data.slots || [];
            setSlots(returnedSlots);

            const isSolo = wizard.practiceMode.toUpperCase() === 'SOLO PRACTICE';
            const isSlotValid = (s: SlotAvailability) => {
              if (!s.is_available) return false;
              if (isSolo && (s.current_participants || 0) > 0) return false;
              return (s.current_participants || 0) < (s.max_participants || 8);
            };

            // Auto-select first valid available slot if current slot is empty or invalid
            const currentSlot = returnedSlots.find((s) => s.start_time === wizard.startTime);
            if (!currentSlot || !isSlotValid(currentSlot)) {
              const firstAvail = returnedSlots.find(isSlotValid);
              if (firstAvail) {
                setBookingDateTime(wizard.bookingDate, firstAvail.start_time, 60);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load slots availability:', err);
        } finally {
          if (isMounted) setLoadingSlots(false);
        }
      };
      fetchSlots();
      return () => {
        isMounted = false;
      };
    }
  }, [wizard.step, wizard.selectedSession?.id, wizard.bookingDate, wizard.practiceMode]);

  // Step 2D: Submission & Auto-Room Assignment Handling
  const handleConfirmReservation = async () => {
    if (!wizard.selectedSession) return;

    const sNameUpper = (wizard.selectedSession.name || '').toUpperCase();
    const isRecording = sNameUpper.includes('RECORDING');
    const isMeeting = sNameUpper.includes('MEETING');
    const isJamSession = sNameUpper.includes('JAM');
    const isSolo = wizard.practiceMode.toUpperCase() === 'SOLO PRACTICE';
    const isRecordingSolo = isRecording && wizard.practiceMode.toUpperCase().includes('SOLO');
    const isRecordingGroup = isRecording && wizard.practiceMode.toUpperCase().includes('GROUP');

    // Validate operating hours (6:00 AM to 11:00 PM)
    const startHour = parseInt(wizard.startTime.split(':')[0], 10);
    if (isNaN(startHour) || startHour < 6 || startHour >= 23) {
      Alert.alert(
        'Operating Hours Notice',
        isRecording
          ? 'Recording sessions are only available between 6:00 AM and 11:00 PM (06:00 to 23:00). Please select an available slot.'
          : 'Rehearsals are only available between 6:00 AM and 11:00 PM (06:00 to 23:00). Please select an available slot.'
      );
      return;
    }

    // Validate that slot is not already reserved by another session or full
    const selectedSlot = slots.find((s) => s.start_time === wizard.startTime);
    if (selectedSlot && !selectedSlot.is_available) {
      Alert.alert(
        'Slot Unavailable',
        `The ${selectedSlot.label} slot is ${selectedSlot.status}. Please select an available slot.`
      );
      return;
    }

    if (isSolo && selectedSlot && (selectedSlot.current_participants || 0) > 0) {
      Alert.alert(
        'Solo Practice Notice',
        'Solo practice requires an empty room with no other musicians. This slot already has active musicians playing collaborative practice. Please select an empty slot or choose Collaborative Practice.'
      );
      return;
    }

    if (isRecording && selectedSlot && (selectedSlot.current_participants || 0) > 0) {
      Alert.alert(
        'Recording Studio Isolation',
        'Recording sessions require complete studio isolation and cannot share a slot with any other session or musicians. Please select an available open slot.'
      );
      return;
    }

    // 1-Hour slot rule: 60 minutes
    const endHour = startHour + 1;
    const formattedEndTime = `${String(endHour).padStart(2, '0')}:00:00`;

    const selectedInstrumentsList = Object.entries(wizard.instruments)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        instrument_id: parseInt(id, 10),
        quantity: qty,
      }));

    const totalInstrumentsSelected = Object.values(wizard.instruments).reduce((sum, q) => sum + q, 0);

    if (!isMeeting && selectedInstrumentsList.length === 0) {
      Alert.alert(
        'Instrument Selection Required',
        isJamSession
          ? 'Please select the instruments being used for your jam session.'
          : isRecording
          ? 'Please select the instrument(s) to record.'
          : 'Please select your instrument before confirming reservation.'
      );
      return;
    }

    if (isJamSession && totalInstrumentsSelected > 8) {
      Alert.alert(
        'Constraint Exceeded',
        `Constraint For Jam Session Max: 8. You have selected ${totalInstrumentsSelected} instruments. Please reduce to 8 or fewer.`
      );
      return;
    }

    if (isRecordingSolo && totalInstrumentsSelected !== 1) {
      Alert.alert(
        'Solo Recording Constraint',
        `Solo Recording requires selecting exactly 1 instrument. Currently selected: ${totalInstrumentsSelected}.`
      );
      return;
    }

    if (isRecordingGroup && totalInstrumentsSelected > 4) {
      Alert.alert(
        'Constraint Exceeded',
        `Constraint For Recording Session Max: 4. You have selected ${totalInstrumentsSelected} instruments. Please reduce to 4 or fewer.`
      );
      return;
    }

    // For Jam Session: One user selects all instruments and books for everyone (up to 8).
    // For Recording Session: Solo = 1, Group = total instruments selected (up to 4, one user books for all).
    // For Meeting: Manually updated participant count (up to 10).
    // For Session A / B: 1 per booking.
    const peoplePlaying = isMeeting
      ? Math.max(1, Math.min(wizard.selectedSession.participant_limit, wizard.participantCount || 2))
      : isJamSession
      ? Math.min(8, Math.max(1, totalInstrumentsSelected))
      : isRecording
      ? (isRecordingSolo ? 1 : Math.min(4, Math.max(1, totalInstrumentsSelected)))
      : 1;

    if (peoplePlaying > wizard.selectedSession.participant_limit) {
      Alert.alert(
        'Participant Limit Exceeded',
        `The number of people playing based on selected instruments (${peoplePlaying}) exceeds the participant limit of ${wizard.selectedSession.participant_limit} for ${wizard.selectedSession.name}. Please remove ${peoplePlaying - wizard.selectedSession.participant_limit} instrument(s).`
      );
      return;
    }

    // Auto-Room Assignment: room_id is omitted so backend dynamically assigns the optimal available room
    const payload = {
      user_id: currentUser.id,
      session_type_id: wizard.selectedSession.id,
      booking_date: wizard.bookingDate,
      start_time: wizard.startTime,
      end_time: formattedEndTime,
      practice_mode: wizard.practiceMode,
      participant_count: peoplePlaying,
      instruments: selectedInstrumentsList,
    };

    setIsSubmitting(true);
    try {
      const res = await api.createBooking(payload);
      setSuccessBooking(res);
      showNotification({
        title: 'BOOKING CONFIRMED',
        message: isRecording
          ? `Booking Confirmed! Your ${res.session_name} studio recording slot is locked in (${res.start_time}-${res.end_time}).`
          : `Booking Confirmed! Your ${res.session_name} rehearsal slot is locked in (${res.start_time}-${res.end_time}).`,
        type: 'success',
      });
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 400 && detail) {
        // Step 2D Requirement: Parse ai_acoustics.reason and display clear rejection modal
        if (typeof detail === 'object' && detail.ai_acoustics?.reason) {
          openRejectionModal(detail.ai_acoustics.reason, detail.ai_acoustics);
        } else if (typeof detail === 'object' && detail.message) {
          openRejectionModal(detail.message, detail);
        } else if (typeof detail === 'string') {
          // Concurrency overlap or Daily Limit 3/day violation
          Alert.alert('Booking Notice', detail);
        } else {
          Alert.alert('Booking Error', detail.message || 'Booking request could not be confirmed.');
        }
      } else {
        Alert.alert('Error', err.response?.data?.detail || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#e8c872" />
        <Text style={styles.loadingText}>LOADING STAGE SPECIFICATIONS...</Text>
      </View>
    );
  }

  // Success Ticket View
  if (successBooking) {
    const isRecordingSuccess = (successBooking.session_name || '').toUpperCase().includes('RECORDING');
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.ticketCard}>
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>RESERVATION CONFIRMED</Text>
          </View>
          <Text style={styles.ticketTitle}>PASS #{successBooking.id}</Text>
          <Text style={styles.ticketSession}>
            {isRecordingSuccess
              ? `Booking Confirmed! Your ${successBooking.session_name} studio recording slot is locked in.`
              : `Booking Confirmed! Your ${successBooking.session_name} rehearsal slot is locked in.`}
          </Text>

          <View style={styles.ticketGrid}>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>SESSION:</Text>
              <Text style={styles.ticketVal}>{successBooking.session_name}</Text>
            </View>
            {successBooking.practice_mode ? (
              <View style={styles.ticketField}>
                <Text style={styles.ticketLabel}>PRACTICE MODE:</Text>
                <Text style={styles.ticketVal}>{successBooking.practice_mode}</Text>
              </View>
            ) : null}
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>DATE:</Text>
              <Text style={styles.ticketVal}>{successBooking.booking_date}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>WINDOW:</Text>
              <Text style={styles.ticketVal}>{successBooking.start_time} - {successBooking.end_time}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>PEOPLE PLAYING:</Text>
              <Text style={styles.ticketVal}>
                {successBooking.participant_count} {successBooking.participant_count === 1 ? 'PERSON' : 'PEOPLE'}
              </Text>
            </View>
          </View>

          <View style={styles.ticketDivider} />

          <Text style={styles.pushNote}>
            🔔 Automatic FCM session reminders active at 45m and 60m marks.
          </Text>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              setSuccessBooking(null);
              resetWizard();
              onBookingSuccess();
            }}
          >
            <Text style={styles.doneBtnText}>VIEW MY BOOKINGS →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Step Indicator Header */}
      <View style={styles.stepHeader}>
        <Text style={styles.stepSubtitle}>
          {wizard.step === 1 ? 'STEP 01 // SELECT SESSION TYPE' : 'STEP 02 // SETUP INSTRUMENTS & TIME'}
        </Text>
        <Text style={styles.stepTitle}>
          {wizard.selectedSession?.name?.toUpperCase().includes('RECORDING')
            ? 'BOOK RECORDING STUDIO SLOT'
            : 'BOOK REHEARSAL SLOT'}
        </Text>
        <Text style={styles.stepDesc}>
          {wizard.selectedSession?.name?.toUpperCase().includes('RECORDING')
            ? 'CHECK YOUR SETUP, SELECT SLOT, AND LOCK IN YOUR ISOLATED STUDIO RECORDING WINDOW.'
            : 'CHECK YOUR SETUP, SELECT SLOT, AND LOCK IN YOUR REHEARSAL WINDOW WITH AUTOMATED CONFLICT CHECKS.'}
        </Text>
      </View>

      {/* ========================================================= */}
      {/* STEP 2A: SESSION SELECTION                                 */}
      {/* ========================================================= */}
      {wizard.step === 1 && (
        <View>
          {sessionTypes.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              stageNumber={`0${index + 1}`}
              isSelected={wizard.selectedSession?.id === session.id}
              onBookSlot={() => selectSession(session)}
            />
          ))}
        </View>
      )}

      {/* ========================================================= */}
      {/* STEP 2B & 2C: CONFIGURATION & STRICT INSTRUMENT FILTERING */}
      {/* ========================================================= */}
      {wizard.step === 2 && wizard.selectedSession && (() => {
        const sessionNameUpper = (wizard.selectedSession?.name || '').toUpperCase();
        const isMeetingSession = sessionNameUpper.includes('MEETING');
        const isSessionA = sessionNameUpper.includes('SESSION A');
        const isSessionB = sessionNameUpper.includes('SESSION B');
        const isJamSession = sessionNameUpper.includes('JAM');
        const isRecordingSession = sessionNameUpper.includes('RECORDING');
        const isFullBandA = isSessionA && wizard.practiceMode.toUpperCase() === 'FULL BAND REHEARSAL';
        const isRecordingSolo = isRecordingSession && wizard.practiceMode.toUpperCase().includes('SOLO');
        const isRecordingGroup = isRecordingSession && wizard.practiceMode.toUpperCase().includes('GROUP');
        const isSoloPractice = (wizard.practiceMode.toUpperCase() === 'SOLO PRACTICE') || isRecordingSolo;
        const participantLimit = wizard.selectedSession.participant_limit;

        // Jam Session & Session B: Collaborative Practice only
        // Session A: Solo Practice or Collaborative Practice
        // Recording Session: Solo Recording or Group Recording (strictly no rehearsal!)
        const practiceModes = (() => {
          if (isMeetingSession) return [];
          if (isRecordingSession) {
            return ['Solo Recording', 'Group Recording'];
          }
          if (isSessionB) {
            return ['Collaborative Practice'];
          }
          if (isSessionA) {
            return ['Solo Practice', 'Collaborative Practice'];
          }
          return ['Collaborative Practice'];
        })();

        const totalInstrumentsCount = Object.values(wizard.instruments).reduce((sum, q) => sum + q, 0);
        const totalJamInstruments = totalInstrumentsCount;
        const totalRecordingInstruments = totalInstrumentsCount;

        // autoPeoplePlaying (For meeting session: manually updated by user instead of auto-fetching)
        const autoPeoplePlaying = isMeetingSession
          ? (wizard.participantCount || 2)
          : isJamSession
          ? Math.min(8, Math.max(1, totalJamInstruments))
          : isRecordingGroup
          ? Math.min(4, Math.max(1, totalRecordingInstruments))
          : 1;

        // Primary instruments allowed for this session:
        // Session A: ONLY Electric Guitar or Drums ("For session A only, remove the display of other instruments except electric guitar and drums in this section.")
        // Session B: Session B instruments only (no Drums, no Electric Guitar)
        // Jam Session & Recording Session: Display ALL instruments ("Again any instrument can be chosen here.")
        const allowedInstruments = instruments.filter((inst) => {
          const n = inst.name.toLowerCase();
          const isDrumsOrEG = n.includes('drum') || n.includes('electric guitar');
          if (isSessionA) return isDrumsOrEG;
          if (isSessionB) return !isDrumsOrEG;
          return true;
        });

        return (
          <View>
            {/* Selected Session Pill */}
            <View style={styles.selectedSessionPill}>
              <View>
                <Text style={styles.pillLabel}>SELECTED SESSION:</Text>
                <Text style={styles.pillValue}>{wizard.selectedSession.name}</Text>
              </View>
              <TouchableOpacity style={styles.changeBtn} onPress={() => setWizardStep(1)}>
                <Text style={styles.changeBtnText}>CHANGE</Text>
              </TouchableOpacity>
            </View>

            {/* Automated Acoustic Calibration / Studio Isolation Banner */}
            <View style={styles.autoAssignBanner}>
              <Text style={styles.autoAssignTitle}>
                {isRecordingSession ? '🎙️ STUDIO ISOLATION & LOCKDOWN' : '⚡ AUTOMATED ACOUSTIC CALIBRATION'}
              </Text>
              <Text style={styles.autoAssignText}>
                {isRecordingSession
                  ? 'Your studio recording session has complete room isolation. No other sessions or musicians are permitted in this slot.'
                  : 'Your rehearsal session is dynamically acoustic-calibrated and scheduled based on your session mode and instrumentation.'}
              </Text>
            </View>

            {/* Step 2B: Practice Mode Selection */}
            {practiceModes.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  {isRecordingSession ? 'RECORDING MODE (STEP 2B):' : 'PRACTICE MODE (STEP 2B):'}
                </Text>
                <View style={styles.modeRow}>
                  {practiceModes.map((mode) => {
                    const isSelected = wizard.practiceMode.toLowerCase() === mode.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.modeBtn, isSelected && styles.modeBtnSelected]}
                        onPress={() => setPracticeMode(mode)}
                      >
                        <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextSelected]}>
                          {mode.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 2C: Filtered Instrument Selection */}
            {isMeetingSession ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>MEETING PARTICIPANTS (MANUAL ENTRY):</Text>
                <View style={styles.policyCard}>
                  <Text style={styles.policyTitle}>📋 MEETING SESSION</Text>
                  <Text style={styles.policyText}>
                    Standard reservation for music club meetings, setlists, and planning. No musical instruments required. Set the number of people attending manually.
                  </Text>
                </View>

                {/* Meeting Manual Stepper Banner */}
                <View style={styles.jamCounterBanner}>
                  <View style={styles.jamCounterLeft}>
                    <Text style={styles.jamCounterLabel}>PEOPLE IN MEETING (MANUAL):</Text>
                    <Text style={styles.jamCounterValue}>
                      {wizard.participantCount} / {participantLimit} MAX
                    </Text>
                  </View>
                  <View style={styles.jamStepperRow}>
                    <TouchableOpacity
                      style={[styles.jamStepBtn, wizard.participantCount <= 1 && styles.jamStepBtnDisabled]}
                      disabled={wizard.participantCount <= 1}
                      onPress={() => setParticipantCount(Math.max(1, wizard.participantCount - 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.jamStepBtnText, wizard.participantCount <= 1 && styles.jamStepBtnTextDisabled]}>−</Text>
                    </TouchableOpacity>

                    <View style={[styles.jamQtyBox, styles.jamQtyBoxSelected]}>
                      <Text style={[styles.jamQtyText, styles.jamQtyTextSelected]}>{wizard.participantCount}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.jamStepBtn, wizard.participantCount >= participantLimit && styles.jamStepBtnDisabled]}
                      disabled={wizard.participantCount >= participantLimit}
                      onPress={() => setParticipantCount(Math.min(participantLimit, wizard.participantCount + 1))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.jamStepBtnText, wizard.participantCount >= participantLimit && styles.jamStepBtnTextDisabled]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Count Selectors */}
                <View style={styles.quickDateRow}>
                  {[1, 2, 4, 6, 8, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.quickDateBtn, wizard.participantCount === num && styles.quickDateBtnSelected]}
                      onPress={() => setParticipantCount(num)}
                    >
                      <Text style={[styles.quickDateBtnText, wizard.participantCount === num && styles.quickDateBtnTextSelected]}>
                        {num} {num === 1 ? 'PERSON' : 'PEOPLE'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : isJamSession ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  ALL INSTRUMENTS FOR JAM SESSION (ONE USER BOOKS FOR ALL):
                </Text>

                <View style={styles.policyCard}>
                  <Text style={styles.policyTitle}>🥁 JAM SESSION RESERVATION</Text>
                  <Text style={styles.policyText}>
                    One user selects all the instruments being used for the jam session, and books everything for everyone. Constraint: Maximum 8 musicians. Once booked, this slot is reserved exclusively for your session.
                  </Text>
                </View>

                {/* Jam Session Total Instruments Counter Banner */}
                <View style={styles.jamCounterBanner}>
                  <View style={styles.jamCounterLeft}>
                    <Text style={styles.jamCounterLabel}>PEOPLE PLAYING / INSTRUMENTS:</Text>
                    <Text style={styles.jamCounterValue}>
                      {totalJamInstruments} / 8 MAX
                    </Text>
                  </View>
                  <View style={[styles.jamCounterBadge, totalJamInstruments === 8 && styles.jamCounterBadgeFull]}>
                    <Text style={styles.jamCounterBadgeText}>
                      {totalJamInstruments === 0
                        ? 'SELECT INSTRUMENTS'
                        : totalJamInstruments === 8
                        ? 'MAX 8 REACHED'
                        : `${8 - totalJamInstruments} SPOTS REMAINING`}
                    </Text>
                  </View>
                </View>

                {/* Display all instruments with quantity steppers */}
                <View style={styles.jamListContainer}>
                  {allowedInstruments.map((inst) => {
                    const qty = wizard.instruments[inst.id] || 0;
                    const isSelected = qty > 0;
                    const canAdd = totalJamInstruments < 8;

                    return (
                      <View
                        key={inst.id}
                        style={[styles.jamInstrumentCard, isSelected && styles.jamInstrumentCardSelected]}
                      >
                        <View style={styles.jamInstrumentInfo}>
                          <Text style={[styles.jamInstrumentName, isSelected && styles.jamInstrumentNameSelected]}>
                            {inst.name}
                          </Text>
                          <Text style={styles.jamInstrumentCategory}>
                            {inst.category || 'Instrument'} • Band: {inst.frequency_band || 'Mid'}
                          </Text>
                        </View>

                        <View style={styles.jamStepperRow}>
                          <TouchableOpacity
                            style={[styles.jamStepBtn, qty === 0 && styles.jamStepBtnDisabled]}
                            disabled={qty === 0}
                            onPress={() => setInstrumentQuantity(inst.id, Math.max(0, qty - 1))}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.jamStepBtnText, qty === 0 && styles.jamStepBtnTextDisabled]}>−</Text>
                          </TouchableOpacity>

                          <View style={[styles.jamQtyBox, isSelected && styles.jamQtyBoxSelected]}>
                            <Text style={[styles.jamQtyText, isSelected && styles.jamQtyTextSelected]}>{qty}</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.jamStepBtn, !canAdd && styles.jamStepBtnDisabled]}
                            disabled={!canAdd}
                            onPress={() => {
                              if (canAdd) {
                                setInstrumentQuantity(inst.id, qty + 1);
                              } else {
                                Alert.alert('Constraint Limit', 'Constraint For Jam Session Max: 8 musicians/instruments.');
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.jamStepBtnText, !canAdd && styles.jamStepBtnTextDisabled]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : isRecordingGroup ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  INSTRUMENTS FOR GROUP RECORDING (ONE USER BOOKS FOR ALL):
                </Text>

                <View style={styles.policyCard}>
                  <Text style={styles.policyTitle}>🎙️ GROUP RECORDING RESERVATION</Text>
                  <Text style={styles.policyText}>
                    Record you and multiple instruments playing together. One single user books everything for everyone they want to record with by selecting multiple instruments. Constraint: Maximum 4 musicians. Any instrument can be chosen. Slot is completely isolated.
                  </Text>
                </View>

                {/* Group Recording Counter Banner */}
                <View style={styles.jamCounterBanner}>
                  <View style={styles.jamCounterLeft}>
                    <Text style={styles.jamCounterLabel}>RECORDING MUSICIANS / INSTRUMENTS:</Text>
                    <Text style={styles.jamCounterValue}>
                      {totalRecordingInstruments} / 4 MAX
                    </Text>
                  </View>
                  <View style={[styles.jamCounterBadge, totalRecordingInstruments === 4 && styles.jamCounterBadgeFull]}>
                    <Text style={styles.jamCounterBadgeText}>
                      {totalRecordingInstruments === 0
                        ? 'SELECT INSTRUMENTS'
                        : totalRecordingInstruments === 4
                        ? 'MAX 4 REACHED'
                        : `${4 - totalRecordingInstruments} SPOTS REMAINING`}
                    </Text>
                  </View>
                </View>

                {/* Display all instruments with quantity steppers */}
                <View style={styles.jamListContainer}>
                  {allowedInstruments.map((inst) => {
                    const qty = wizard.instruments[inst.id] || 0;
                    const isSelected = qty > 0;
                    const canAdd = totalRecordingInstruments < 4;

                    return (
                      <View
                        key={inst.id}
                        style={[styles.jamInstrumentCard, isSelected && styles.jamInstrumentCardSelected]}
                      >
                        <View style={styles.jamInstrumentInfo}>
                          <Text style={[styles.jamInstrumentName, isSelected && styles.jamInstrumentNameSelected]}>
                            {inst.name}
                          </Text>
                          <Text style={styles.jamInstrumentCategory}>
                            {inst.category || 'Instrument'} • Band: {inst.frequency_band || 'Mid'}
                          </Text>
                        </View>

                        <View style={styles.jamStepperRow}>
                          <TouchableOpacity
                            style={[styles.jamStepBtn, qty === 0 && styles.jamStepBtnDisabled]}
                            disabled={qty === 0}
                            onPress={() => setInstrumentQuantity(inst.id, Math.max(0, qty - 1))}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.jamStepBtnText, qty === 0 && styles.jamStepBtnTextDisabled]}>−</Text>
                          </TouchableOpacity>

                          <View style={[styles.jamQtyBox, isSelected && styles.jamQtyBoxSelected]}>
                            <Text style={[styles.jamQtyText, isSelected && styles.jamQtyTextSelected]}>{qty}</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.jamStepBtn, !canAdd && styles.jamStepBtnDisabled]}
                            disabled={!canAdd}
                            onPress={() => {
                              if (canAdd) {
                                setInstrumentQuantity(inst.id, qty + 1);
                              } else {
                                Alert.alert('Constraint Limit', 'Constraint For Recording Session Max: 4 musicians/instruments.');
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.jamStepBtnText, !canAdd && styles.jamStepBtnTextDisabled]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  {isRecordingSolo
                    ? 'YOUR INSTRUMENT TO RECORD (SOLO RECORDING - STUDIO ISOLATION):'
                    : isSoloPractice
                    ? 'YOUR INSTRUMENT (SOLO PRACTICE - PRIVATE ROOM):'
                    : 'YOUR INSTRUMENT (COLLABORATIVE PRACTICE):'}
                </Text>

                {isRecordingSolo && (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>🎙️ SOLO RECORDING</Text>
                    <Text style={styles.policyText}>
                      Record your solo instrument with complete studio room isolation. Select exactly one instrument. Any instrument can be chosen.
                    </Text>
                  </View>
                )}

                {isSessionA && isSoloPractice && (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>🎸 SESSION A SOLO PRACTICE</Text>
                    <Text style={styles.policyText}>
                      Solo practice: practice drums or electric guitar with no one else in the room. The slot is reserved exclusively for you.
                    </Text>
                  </View>
                )}

                {isSessionA && !isSoloPractice && (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>⚡ SESSION A COLLABORATIVE PRACTICE</Text>
                    <Text style={styles.policyText}>
                      Collaborative practice: practice with other electric guitarists or drummers in Session A (max {participantLimit} in slot).
                    </Text>
                  </View>
                )}

                {isSessionB && (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>🎻 SESSION B COLLABORATIVE PRACTICE</Text>
                    <Text style={styles.policyText}>
                      Collaborative practice: play with other Session B musicians (max {participantLimit} in slot). Solo practice removed as it can be done in hostel rooms. Drums and electric guitar are prohibited.
                    </Text>
                  </View>
                )}

                {/* Single-select per user */}
                <View style={styles.soloPickerContainer}>
                  {allowedInstruments.map((inst) => {
                    const isSelected = (wizard.instruments[inst.id] || 0) === 1;
                    return (
                      <TouchableOpacity
                        key={inst.id}
                        style={[styles.soloInstrumentCard, isSelected && styles.soloInstrumentCardSelected]}
                        activeOpacity={0.8}
                        onPress={() => {
                          // Select exactly this ONE instrument for this user
                          allowedInstruments.forEach((other) => {
                            setInstrumentQuantity(other.id, other.id === inst.id ? 1 : 0);
                          });
                        }}
                      >
                        <View style={styles.soloRadioRow}>
                          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                          <View style={styles.soloTextCol}>
                            <Text style={[styles.soloInstrumentName, isSelected && styles.soloInstrumentNameSelected]}>
                              {inst.name}
                            </Text>
                            <Text style={styles.soloInstrumentCategory}>
                              {inst.category || 'Instrument'} • Band: {inst.frequency_band || 'Mid'}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>SELECTED</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Minimalist Acoustic Warning (No Decibel Meter) */}
            {wizard.acousticPreview?.warnings && wizard.acousticPreview.warnings.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>⚠️ {wizard.acousticPreview.warnings[0]}</Text>
              </View>
            )}

            {/* Date, Time Slot & Dynamic Participants in Slot */}
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const tomorrowDate = new Date();
              tomorrowDate.setDate(tomorrowDate.getDate() + 1);
              const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

              const selectedSlot = slots.find((s) => s.start_time === wizard.startTime);
              const maxCapacity = selectedSlot?.max_participants || participantLimit;
              const existingParticipants = selectedSlot?.current_participants || 0;
              const isSlotFull = existingParticipants >= maxCapacity;
              const isSlotSoloBlocked = isSoloPractice && existingParticipants > 0;
              const isJamOccupied = isJamSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isRecordingOccupied = isRecordingSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isMeetingOccupied = isMeetingSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isReserved = !selectedSlot?.is_available || isSlotFull || isSlotSoloBlocked || isJamOccupied || isRecordingOccupied || isMeetingOccupied;
              const nextTotalParticipants = Math.min(maxCapacity, existingParticipants + 1);

              return (
                <View>
                  {/* Date Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={wizard.bookingDate}
                      onChangeText={(val) => setBookingDateTime(val, wizard.startTime, 60)}
                      placeholder="2026-11-04"
                      placeholderTextColor="#666666"
                    />
                    <View style={styles.quickDateRow}>
                      <TouchableOpacity
                        style={[styles.quickDateBtn, wizard.bookingDate === todayStr && styles.quickDateBtnSelected]}
                        onPress={() => setBookingDateTime(todayStr, wizard.startTime, 60)}
                      >
                        <Text style={[styles.quickDateBtnText, wizard.bookingDate === todayStr && styles.quickDateBtnTextSelected]}>
                          TODAY
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickDateBtn, wizard.bookingDate === tomorrowStr && styles.quickDateBtnSelected]}
                        onPress={() => setBookingDateTime(tomorrowStr, wizard.startTime, 60)}
                      >
                        <Text style={[styles.quickDateBtnText, wizard.bookingDate === tomorrowStr && styles.quickDateBtnTextSelected]}>
                          TOMORROW
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Minimalist 1-Hour Time Slot Dropdown */}
                  <View style={styles.formGroup}>
                    <View style={styles.timeDropdownHeader}>
                      <Text style={styles.fieldLabel}>TIME SLOT (1-HOUR SESSIONS):</Text>
                      {loadingSlots && (
                        <View style={styles.loadingSlotsRow}>
                          <ActivityIndicator size="small" color="#e8c872" />
                          <Text style={styles.loadingSlotsText}>REFRESHING...</Text>
                        </View>
                      )}
                    </View>

                    {(() => {
                      const selectedSlot = slots.find((s) => s.start_time === wizard.startTime);

                      return (
                        <View style={styles.dropdownContainer}>
                          <TouchableOpacity
                            style={[
                              styles.dropdownTrigger,
                              isSlotDropdownOpen && styles.dropdownTriggerOpen,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setIsSlotDropdownOpen((prev) => !prev)}
                          >
                            <View style={styles.dropdownLeft}>
                              <Text style={styles.dropdownTimeIcon}>🕒</Text>
                              <View style={styles.dropdownTriggerTextCol}>
                                <Text
                                  style={[
                                    styles.dropdownValueText,
                                    !selectedSlot && styles.dropdownPlaceholderText,
                                  ]}
                                >
                                  {selectedSlot ? selectedSlot.label : 'Select an available 1-hour slot...'}
                                </Text>
                                {selectedSlot && (
                                  <Text style={styles.dropdownActiveSessionSub}>
                                    {selectedSlot.active_session_name || selectedSlot.booked_session_name
                                      ? `ACTIVE SESSION: ${(selectedSlot.active_session_name || selectedSlot.booked_session_name)!.toUpperCase()}`
                                      : 'STATUS: OPEN / AVAILABLE'}
                                  </Text>
                                )}
                              </View>
                            </View>

                            <View style={styles.dropdownRight}>
                              {selectedSlot && (
                                <View
                                  style={[
                                    styles.dropdownBadge,
                                    !selectedSlot.is_available
                                      ? styles.dropdownBadgeReserved
                                      : styles.dropdownBadgeSelected,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.dropdownBadgeText,
                                      !selectedSlot.is_available
                                        ? styles.dropdownBadgeTextReserved
                                        : styles.dropdownBadgeTextSelected,
                                    ]}
                                  >
                                    {!selectedSlot.is_available ? 'RESERVED' : '✓ SELECTED'}
                                  </Text>
                                </View>
                              )}
                              <Text style={styles.dropdownChevron}>
                                {isSlotDropdownOpen ? '▲' : '▼'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* Active Slot Callout: Displays currently playing musicians/instruments */}
                          {selectedSlot && selectedSlot.instruments_summary && selectedSlot.instruments_summary.length > 0 && (
                            <View style={styles.activeSlotCallout}>
                              <Text style={styles.activeSlotCalloutTitle}>
                                👥 CURRENTLY PLAYING IN THIS SLOT ({selectedSlot.current_participants}/{selectedSlot.max_participants || participantLimit}):
                              </Text>
                              <Text style={styles.activeSlotCalloutText}>
                                {selectedSlot.instruments_summary.join(' • ')}
                              </Text>
                            </View>
                          )}

                          {isSlotDropdownOpen && (
                            <View style={styles.dropdownMenu}>
                              <ScrollView
                                style={styles.dropdownScroll}
                                nestedScrollEnabled={true}
                                showsVerticalScrollIndicator={true}
                              >
                                {slots.length === 0 ? (
                                  <View style={styles.dropdownEmpty}>
                                    <Text style={styles.dropdownEmptyText}>
                                      No slots available for this date.
                                    </Text>
                                  </View>
                                ) : (
                                  slots.map((slot) => {
                                    const activeSession = slot.active_session_name || slot.booked_session_name;
                                    const isSelected = wizard.startTime === slot.start_time;
                                    const isSlotSoloBlocked = isSoloPractice && (slot.current_participants || 0) > 0;
                                    const isSlotJamOccupied = isJamSession && ((slot.current_participants || 0) > 0 || !slot.is_available);
                                    const isSlotRecOccupied = isRecordingSession && ((slot.current_participants || 0) > 0 || !slot.is_available);
                                    const isSlotMeetingOccupied = isMeetingSession && ((slot.current_participants || 0) > 0 || !slot.is_available);
                                    const isBlocked = !slot.is_available || isSlotSoloBlocked || isSlotJamOccupied || isSlotRecOccupied || isSlotMeetingOccupied;

                                    const badgeText = (() => {
                                      if (isSlotSoloBlocked) return 'COLLAB ACTIVE (NO SOLO)';
                                      if (isSlotJamOccupied) return 'RESERVED (JAM)';
                                      if (isSlotRecOccupied) return 'RESERVED (RECORDING)';
                                      if (isSlotMeetingOccupied) return 'RESERVED';
                                      if (!slot.is_available) {
                                        if (activeSession?.toUpperCase().includes('JAM') || slot.status?.toUpperCase().includes('JAM')) return 'RESERVED (JAM)';
                                        if (activeSession?.toUpperCase().includes('RECORDING') || slot.status?.toUpperCase().includes('RECORDING')) return 'RESERVED (RECORDING)';
                                        if (activeSession) return `RESERVED (${activeSession.toUpperCase()})`;
                                        if (slot.status?.includes('Reserved')) return slot.status.toUpperCase();
                                        if (slot.status?.includes('Full')) return 'FULL';
                                        return slot.status?.toUpperCase() || 'RESERVED';
                                      }
                                      if (isSelected) return '✓ SELECTED';
                                      if (isJamSession) return 'AVAILABLE';
                                      if (isRecordingSession) return 'AVAILABLE';
                                      if (isMeetingSession) return 'AVAILABLE';
                                      if ((slot.current_participants || 0) > 0) return `${slot.current_participants}/${slot.max_participants || participantLimit} JOINABLE`;
                                      return 'AVAILABLE';
                                    })();

                                    return (
                                      <TouchableOpacity
                                        key={slot.start_time}
                                        style={[
                                          styles.dropdownItem,
                                          isSelected && styles.dropdownItemSelected,
                                          isBlocked && styles.dropdownItemReserved,
                                        ]}
                                        activeOpacity={isBlocked ? 0.9 : 0.6}
                                        onPress={() => {
                                          if (isSlotSoloBlocked) {
                                            Alert.alert(
                                              'Solo Practice Exclusivity',
                                              'Solo practice requires an empty room. This slot already has collaborative musicians.'
                                            );
                                            return;
                                          }
                                          if (isSlotJamOccupied || (isJamSession && !slot.is_available)) {
                                            Alert.alert(
                                              'Jam Session Reserved',
                                              'If a Jam session is going on in a slot by User A, User B cannot select that slot; they need to select a different one.'
                                            );
                                            return;
                                          }
                                          if (isSlotRecOccupied || (isRecordingSession && (!slot.is_available || (slot.current_participants || 0) > 0))) {
                                            Alert.alert(
                                              'Recording Studio Isolation',
                                              'Recording sessions require complete studio isolation and cannot share a slot with any other session or musicians. Please select an available open slot.'
                                            );
                                            return;
                                          }
                                          if (isSlotMeetingOccupied || (isMeetingSession && (!slot.is_available || (slot.current_participants || 0) > 0))) {
                                            Alert.alert(
                                              'Meeting Room Occupied',
                                              'This slot already has active bookings. Meeting sessions require an empty room reservation. Please select an available slot.'
                                            );
                                            return;
                                          }
                                          if (!slot.is_available) {
                                            if (activeSession?.toUpperCase().includes('JAM') || slot.status?.toUpperCase().includes('JAM')) {
                                              Alert.alert(
                                                'Jam Session Reserved',
                                                `The ${slot.label} slot is reserved by a Jam Session. While in ${wizard.selectedSession?.name || 'this session'}'s collaborative practice, you cannot book a slot that Jam Session has reserved. If a slot is reserved by a Jam Session, it only belongs to it.`
                                              );
                                              return;
                                            }
                                            if (activeSession?.toUpperCase().includes('RECORDING') || slot.status?.toUpperCase().includes('RECORDING')) {
                                              Alert.alert(
                                                'Recording Session Reserved',
                                                `The ${slot.label} slot is reserved by a Recording Session with complete studio isolation. No other session can book or join this slot.`
                                              );
                                              return;
                                            }
                                            Alert.alert(
                                              'Slot Unavailable',
                                              `The ${slot.label} slot is ${slot.status}. Please select an available slot.`
                                            );
                                            return;
                                          }
                                          setBookingDateTime(wizard.bookingDate, slot.start_time, 60);
                                          setIsSlotDropdownOpen(false);
                                        }}
                                      >
                                        <View style={styles.dropdownItemLeft}>
                                          <Text
                                            style={[
                                              styles.dropdownItemText,
                                              isSelected && styles.dropdownItemTextSelected,
                                              isBlocked && styles.dropdownItemTextReserved,
                                            ]}
                                          >
                                            {slot.label}
                                          </Text>

                                          {/* Active Sessions be it any should be displayed on the TIME SLOT (1-HOUR SESSIONS) */}
                                          <View style={styles.slotActiveSessionRow}>
                                            <Text
                                              style={[
                                                styles.slotActiveSessionText,
                                                activeSession ? styles.slotActiveSessionTextActive : styles.slotActiveSessionTextOpen,
                                              ]}
                                            >
                                              {activeSession
                                                ? `● ACTIVE: ${activeSession.toUpperCase()}`
                                                : '○ AVAILABLE (OPEN)'}
                                            </Text>
                                          </View>

                                          {slot.instruments_summary && slot.instruments_summary.length > 0 && (
                                            <Text style={styles.dropdownSlotInstruments}>
                                              🎷 {slot.instruments_summary.join(', ')} ({slot.current_participants}/{slot.max_participants || participantLimit})
                                            </Text>
                                          )}
                                        </View>

                                        <View
                                          style={[
                                            styles.dropdownBadge,
                                            isBlocked
                                              ? styles.dropdownBadgeReserved
                                              : isSelected
                                              ? styles.dropdownBadgeSelected
                                              : styles.dropdownBadgeAvailable,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.dropdownBadgeText,
                                              isBlocked
                                                ? styles.dropdownBadgeTextReserved
                                                : isSelected
                                                ? styles.dropdownBadgeTextSelected
                                                : styles.dropdownBadgeTextAvailable,
                                            ]}
                                          >
                                            {badgeText}
                                          </Text>
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })
                                )}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <Text style={styles.timeSlotHelper}>
                      Operating hours: 6:00 AM – 11:00 PM daily • 1-hour sessions (re-book to extend or vacate immediately)
                    </Text>
                  </View>

                  {/* Dynamic People Playing (Participants in Slot) */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>
                      {isMeetingSession ? 'PEOPLE IN MEETING (PARTICIPANTS IN SLOT - MANUAL ENTRY):' : 'PEOPLE PLAYING (PARTICIPANTS IN SLOT):'}
                    </Text>

                    {isMeetingSession ? (
                      <View style={[styles.autoPeopleBox, isReserved && styles.autoPeopleBoxReserved]}>
                        <View style={styles.meetingAutoBoxRow}>
                          <View style={styles.meetingAutoBoxLeft}>
                            <Text style={[styles.autoPeopleVal, isReserved && styles.autoPeopleValReserved]}>
                              {isReserved
                                ? 'RESERVED (SLOT OCCUPIED)'
                                : `${wizard.participantCount} ${wizard.participantCount === 1 ? 'PERSON' : 'PEOPLE'} (MANUAL ENTRY)`}
                            </Text>
                            <Text style={styles.autoPeopleSub}>
                              {isReserved
                                ? '⚠️ This slot is already booked for another session. Please select an available slot.'
                                : `Meeting participants updated manually • ${wizard.participantCount}/${participantLimit} capacity`}
                            </Text>
                          </View>

                          {!isReserved && (
                            <View style={styles.jamStepperRow}>
                              <TouchableOpacity
                                style={[styles.jamStepBtn, wizard.participantCount <= 1 && styles.jamStepBtnDisabled]}
                                disabled={wizard.participantCount <= 1}
                                onPress={() => setParticipantCount(Math.max(1, wizard.participantCount - 1))}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.jamStepBtnText, wizard.participantCount <= 1 && styles.jamStepBtnTextDisabled]}>−</Text>
                              </TouchableOpacity>

                              <View style={[styles.jamQtyBox, styles.jamQtyBoxSelected]}>
                                <Text style={[styles.jamQtyText, styles.jamQtyTextSelected]}>{wizard.participantCount}</Text>
                              </View>

                              <TouchableOpacity
                                style={[styles.jamStepBtn, wizard.participantCount >= participantLimit && styles.jamStepBtnDisabled]}
                                disabled={wizard.participantCount >= participantLimit}
                                onPress={() => setParticipantCount(Math.min(participantLimit, wizard.participantCount + 1))}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.jamStepBtnText, wizard.participantCount >= participantLimit && styles.jamStepBtnTextDisabled]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {!isReserved && (
                          <View style={[styles.quickDateRow, { marginTop: 12 }]}>
                            {[1, 2, 4, 6, 8, 10].map((num) => (
                              <TouchableOpacity
                                key={num}
                                style={[styles.quickDateBtn, wizard.participantCount === num && styles.quickDateBtnSelected]}
                                onPress={() => setParticipantCount(num)}
                              >
                                <Text style={[styles.quickDateBtnText, wizard.participantCount === num && styles.quickDateBtnTextSelected]}>
                                  {num} {num === 1 ? 'PERSON' : 'PEOPLE'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={[styles.autoPeopleBox, isReserved && styles.autoPeopleBoxReserved]}>
                        <View style={styles.autoPeopleRow}>
                          <Text style={[styles.autoPeopleVal, isReserved && styles.autoPeopleValReserved]}>
                            {isRecordingSolo
                              ? (isReserved
                                  ? 'RESERVED (SLOT OCCUPIED)'
                                  : '1 MUSICIAN (SOLO RECORDING)')
                              : isRecordingGroup
                              ? (isReserved
                                  ? 'RESERVED (SLOT OCCUPIED)'
                                  : `${totalRecordingInstruments} MUSICIANS (${totalRecordingInstruments}/4 INSTRUMENTS TO RECORD)`)
                              : isSoloPractice
                              ? '1 PERSON (SOLO)'
                              : isJamSession
                              ? (isReserved
                                  ? 'RESERVED (JAM SESSION ALREADY BOOKED)'
                                  : `${totalJamInstruments} MUSICIANS (${totalJamInstruments}/8 INSTRUMENTS)`)
                              : isReserved
                              ? (selectedSlot?.booked_session_name?.toUpperCase().includes('JAM') || selectedSlot?.status?.toUpperCase().includes('JAM')
                                  ? 'RESERVED (JAM SESSION)'
                                  : selectedSlot?.booked_session_name?.toUpperCase().includes('RECORDING') || selectedSlot?.status?.toUpperCase().includes('RECORDING')
                                  ? 'RESERVED (RECORDING SESSION)'
                                  : `${existingParticipants}/${maxCapacity} FULL (RESERVED)`)
                              : existingParticipants === 0
                              ? `0 IN SLOT (+1 YOU → 1/${maxCapacity})`
                              : `${existingParticipants} IN SLOT (+1 YOU → ${nextTotalParticipants}/${maxCapacity})`}
                          </Text>
                          <View style={[styles.autoTag, isReserved && styles.autoTagReserved]}>
                            <Text style={[styles.autoTagText, isReserved && styles.autoTagTextReserved]}>
                              {isReserved
                                ? (selectedSlot?.booked_session_name?.toUpperCase().includes('JAM') || selectedSlot?.status?.toUpperCase().includes('JAM') || isJamSession
                                    ? 'JAM RESERVED'
                                    : selectedSlot?.booked_session_name?.toUpperCase().includes('RECORDING') || selectedSlot?.status?.toUpperCase().includes('RECORDING') || isRecordingSession
                                    ? 'RECORDING RESERVED'
                                    : 'RESERVED')
                                : isRecordingSolo
                                ? 'SOLO RECORDING'
                                : isRecordingGroup
                                ? `${totalRecordingInstruments}/4 RECORDING`
                                : isSoloPractice
                                ? 'SOLO'
                                : isJamSession
                                ? `${totalJamInstruments}/8 JAM PLAYERS`
                                : `${existingParticipants}/${maxCapacity} ACTIVE`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.autoPeopleSub}>
                          {isRecordingSolo
                            ? (isReserved
                                ? '⚠️ Slot is already booked. Recording sessions require complete studio isolation.'
                                : 'Complete studio room isolation for your solo recording. No other session or musicians can enter.')
                            : isRecordingGroup
                            ? (isReserved
                                ? '⚠️ Slot is already booked. Recording sessions require complete studio isolation.'
                                : `One user booking for all ${totalRecordingInstruments} recording musician(s) (Constraint Max: 4). Complete studio isolation.`)
                            : isSoloPractice
                            ? (isSlotSoloBlocked
                                ? '⚠️ Slot already has active musicians. Solo practice requires an empty room.'
                                : '0 existing musicians in slot • Private room for you alone (no other players allowed)')
                            : isJamSession
                            ? (isReserved
                                ? '⚠️ A Jam session is already booked in this slot by another user. User B cannot select this slot; please select a different one.'
                                : `One user booking for all ${totalJamInstruments} musician(s) in this Jam Session (Constraint Max: 8). This slot will be reserved exclusively for your session.`)
                            : isReserved
                            ? (selectedSlot?.booked_session_name?.toUpperCase().includes('JAM') || selectedSlot?.status?.toUpperCase().includes('JAM')
                                ? '⚠️ This slot is reserved by a Jam Session and only belongs to it. Not available for Session A or B collaborative practice.'
                                : selectedSlot?.booked_session_name?.toUpperCase().includes('RECORDING') || selectedSlot?.status?.toUpperCase().includes('RECORDING')
                                ? '⚠️ This slot is reserved by a Recording Session with complete studio isolation.'
                                : `Maximum capacity reached (${existingParticipants}/${maxCapacity}). This slot is reserved.`)
                            : existingParticipants === 0
                            ? `No musicians currently in this slot. You will be participant 1 of ${maxCapacity}.`
                            : `${existingParticipants} existing ${existingParticipants === 1 ? 'musician' : 'musicians'} (${selectedSlot?.instruments_summary?.join(', ') || 'playing'}) • Adding your booking makes it ${nextTotalParticipants}/${maxCapacity}`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}

          {/* Confirm Reservation Button */}
          <TouchableOpacity
            style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleConfirmReservation}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <Text style={styles.confirmBtnText}>
                {isRecordingSession ? 'CONFIRM RECORDING RESERVATION →' : 'CONFIRM RESERVATION →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        );
      })()}

      {/* Acoustic Rejection Modal (Step 2C) */}
      <AcousticRejectionModal
        visible={wizard.rejectionModal.isOpen}
        reason={wizard.rejectionModal.reason}
        details={wizard.rejectionModal.details}
        onClose={closeRejectionModal}
        onAdjustInstruments={closeRejectionModal}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 12,
  },
  stepHeader: {
    marginBottom: 20,
  },
  stepSubtitle: {
    color: '#e05a47',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stepTitle: {
    color: '#f4ede4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  stepDesc: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
  },
  selectedSessionPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#e8c872',
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
  },
  pillLabel: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pillValue: {
    color: '#e8c872',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  changeBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  changeBtnText: {
    color: '#f4ede4',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  fieldLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  modeBtn: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  modeBtnSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1f1b13',
  },
  modeBtnText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modeBtnTextSelected: {
    color: '#e8c872',
  },
  policyCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
  },
  policyTitle: {
    color: '#e8c872',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  policyText: {
    color: '#cccccc',
    fontSize: 12,
    lineHeight: 18,
  },
  soloPickerRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  soloPill: {
    flex: 1,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  soloPillSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1f1b13',
  },
  soloPillText: {
    color: '#cccccc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 4,
  },
  soloPillTextSelected: {
    color: '#e8c872',
  },
  soloPillSub: {
    color: '#666666',
    fontSize: 10,
  },
  warningBox: {
    backgroundColor: '#1f1a10',
    borderWidth: 1,
    borderColor: '#3d321b',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  warningText: {
    color: '#e8c872',
    fontSize: 11,
    lineHeight: 16,
  },
  aiPreviewBox: {
    backgroundColor: '#161512',
    borderWidth: 1,
    borderColor: '#3d321b',
    borderRadius: 6,
    padding: 14,
    marginBottom: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTitle: {
    color: '#e8c872',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statItem: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
  },
  statVal: {
    color: '#f4ede4',
    fontWeight: '800',
  },
  statSafe: {
    color: '#52b79a',
  },
  statDanger: {
    color: '#e05a47',
  },
  previewWarn: {
    color: '#e8c872',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  previewFail: {
    color: '#e05a47',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '700',
    lineHeight: 14,
  },
  previewPlaceholder: {
    color: '#777777',
    fontSize: 11,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f4ede4',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  autoPeopleBox: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    minHeight: 40,
  },
  autoPeopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPeopleVal: {
    color: '#e8c872',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  autoTag: {
    backgroundColor: '#241e12',
    borderWidth: 1,
    borderColor: '#e8c872',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  autoTagText: {
    color: '#e8c872',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  autoPeopleSub: {
    color: '#777777',
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },
  autoPeopleBoxReserved: {
    backgroundColor: '#1b1212',
    borderColor: '#4d2020',
  },
  autoPeopleValReserved: {
    color: '#e05a47',
  },
  autoTagReserved: {
    backgroundColor: '#2b1212',
    borderColor: '#4d2020',
  },
  autoTagTextReserved: {
    color: '#e05a47',
  },
  durationRow: {
    flexDirection: 'row',
  },
  durationBtn: {
    flex: 1,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 6,
  },
  durationBtnSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1f1b13',
  },
  durationBtnText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  durationBtnTextSelected: {
    color: '#e8c872',
  },
  confirmBtn: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#555555',
  },
  confirmBtnText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  ticketCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#3ddc97',
    borderRadius: 8,
    padding: 22,
    alignItems: 'center',
  },
  ticketBadge: {
    backgroundColor: '#0f241e',
    borderWidth: 1,
    borderColor: '#255e4e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  autoAssignBanner: {
    backgroundColor: '#161512',
    borderWidth: 1,
    borderColor: '#3d321b',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  autoAssignTitle: {
    color: '#e8c872',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  autoAssignText: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 16,
  },
  soloPickerContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  soloInstrumentCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  soloInstrumentCardSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1c1913',
  },
  soloRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#e8c872',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e8c872',
  },
  soloTextCol: {
    flex: 1,
  },
  soloInstrumentName: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '800',
  },
  soloInstrumentNameSelected: {
    color: '#e8c872',
  },
  soloInstrumentCategory: {
    color: '#777777',
    fontSize: 10,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: '#2b2313',
    borderWidth: 1,
    borderColor: '#e8c872',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  selectedBadgeText: {
    color: '#e8c872',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  ticketBadgeText: {
    color: '#52b79a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  ticketTitle: {
    color: '#f4ede4',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  ticketSession: {
    color: '#e8c872',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  ticketGrid: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 14,
    marginBottom: 18,
  },
  ticketField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ticketVal: {
    color: '#f4ede4',
    fontSize: 11,
    fontWeight: '700',
  },
  ticketDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#262626',
    marginBottom: 14,
  },
  pushNote: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  doneBtn: {
    backgroundColor: '#f7f4ea',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  quickDateRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 4,
    paddingVertical: 5,
    alignItems: 'center',
  },
  quickDateBtnSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#262013',
  },
  quickDateBtnText: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quickDateBtnTextSelected: {
    color: '#e8c872',
  },
  timeDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingSlotsText: {
    color: '#e8c872',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dropdownTriggerOpen: {
    borderColor: '#e8c872',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dropdownTimeIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  dropdownTriggerTextCol: {
    flex: 1,
  },
  dropdownActiveSessionSub: {
    color: '#e8c872',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.8,
  },
  dropdownValueText: {
    color: '#f4ede4',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dropdownPlaceholderText: {
    color: '#666666',
    fontStyle: 'italic',
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownChevron: {
    color: '#888888',
    fontSize: 10,
    marginLeft: 4,
  },
  dropdownMenu: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#e8c872',
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  dropdownItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dropdownItemSelected: {
    backgroundColor: '#241e13',
  },
  dropdownItemReserved: {
    backgroundColor: '#171212',
    opacity: 0.65,
  },
  dropdownItemText: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dropdownItemTextSelected: {
    color: '#e8c872',
    fontWeight: '900',
  },
  dropdownItemTextReserved: {
    color: '#775555',
    textDecorationLine: 'line-through',
  },
  dropdownBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  dropdownBadgeAvailable: {
    backgroundColor: '#0e241b',
    borderWidth: 1,
    borderColor: '#1d4d3a',
  },
  dropdownBadgeSelected: {
    backgroundColor: '#382b14',
    borderWidth: 1,
    borderColor: '#e8c872',
  },
  dropdownBadgeReserved: {
    backgroundColor: '#2b1212',
    borderWidth: 1,
    borderColor: '#4d2020',
  },
  dropdownBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  dropdownBadgeTextAvailable: {
    color: '#52b79a',
  },
  dropdownBadgeTextSelected: {
    color: '#e8c872',
  },
  dropdownBadgeTextReserved: {
    color: '#e05a47',
  },
  dropdownEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    color: '#888888',
    fontSize: 11,
    fontStyle: 'italic',
  },
  timeSlotHelper: {
    color: '#777777',
    fontSize: 10,
    marginTop: 6,
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  activeSlotCallout: {
    backgroundColor: '#1b1710',
    borderWidth: 1,
    borderColor: '#3d321b',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  activeSlotCalloutTitle: {
    color: '#e8c872',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  activeSlotCalloutText: {
    color: '#cccccc',
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownSlotInstruments: {
    color: '#e8c872',
    fontSize: 9,
    marginTop: 3,
    fontWeight: '700',
  },
  slotActiveSessionRow: {
    marginTop: 2,
  },
  slotActiveSessionText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  slotActiveSessionTextActive: {
    color: '#e8c872',
  },
  slotActiveSessionTextOpen: {
    color: '#52b79a',
  },
  jamCounterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#181510',
    borderWidth: 1,
    borderColor: '#3d3319',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  jamCounterLeft: {
    flex: 1,
  },
  jamCounterLabel: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  jamCounterValue: {
    color: '#e8c872',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  jamCounterBadge: {
    backgroundColor: '#262013',
    borderWidth: 1,
    borderColor: '#5e4e20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  jamCounterBadgeFull: {
    backgroundColor: '#3d1f1f',
    borderColor: '#803333',
  },
  jamCounterBadgeText: {
    color: '#e8c872',
    fontSize: 10,
    fontWeight: '800',
  },
  jamListContainer: {
    marginBottom: 14,
  },
  jamInstrumentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  jamInstrumentCardSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1a1811',
  },
  jamInstrumentInfo: {
    flex: 1,
    marginRight: 10,
  },
  jamInstrumentName: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '700',
  },
  jamInstrumentNameSelected: {
    color: '#ffffff',
  },
  jamInstrumentCategory: {
    color: '#777777',
    fontSize: 11,
    marginTop: 2,
  },
  jamStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jamStepBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#222222',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  jamStepBtnDisabled: {
    opacity: 0.35,
    borderColor: '#1f1f1f',
    backgroundColor: '#181818',
  },
  jamStepBtnText: {
    color: '#e8c872',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  jamStepBtnTextDisabled: {
    color: '#555555',
  },
  jamQtyBox: {
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    paddingHorizontal: 4,
  },
  jamQtyBoxSelected: {
    backgroundColor: '#2a2312',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e8c872',
  },
  jamQtyText: {
    color: '#777777',
    fontSize: 14,
    fontWeight: '700',
  },
  jamQtyTextSelected: {
    color: '#e8c872',
    fontWeight: '800',
  },
  meetingAutoBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  meetingAutoBoxLeft: {
    flex: 1,
    minWidth: 160,
  },
});
