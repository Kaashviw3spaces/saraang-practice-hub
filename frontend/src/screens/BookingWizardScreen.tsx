import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Animated,
  Easing,
  Image,
} from 'react-native';
import { api, SessionType, Instrument, SlotAvailability } from '../api/client';
import { useStore } from '../store/useStore';
import { SessionCard } from '../components/SessionCard';
import { InstrumentGrid } from '../components/InstrumentGrid';
import { AcousticRejectionModal } from '../components/AcousticRejectionModal';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { LightningSvg } from '../components/LightningSvg';
import Svg, { Rect, Line, Circle } from 'react-native-svg';

const getSessionBandTag = (name: string) => {
  const n = (name || '').toUpperCase();
  if (n.includes('SESSION A')) {
    return {
      label: 'AC/DC // CUSTOM TUBE STACK',
      serial: 'SN-0826-A',
      watermark: require('../../assets/band6.jpg'),
    };
  }
  if (n.includes('SESSION B')) {
    return {
      label: 'THE BEATLES // ABBEY ROAD',
      serial: 'SN-1969-B',
      watermark: require('../../assets/sebs_clean.png'),
    };
  }
  if (n.includes('JAM SESSION')) {
    return {
      label: 'ARENA ROCK // LIVE ENSEMBLE',
      serial: 'SN-9021-JAM',
      watermark: require('../../assets/band4.avif'),
    };
  }
  if (n.includes('RECORDING')) {
    return {
      label: 'METALLICA // RIDE THE LIGHTNING',
      serial: 'SN-1984-REC',
      watermark: require('../../assets/band3.jpg'),
    };
  }
  return {
    label: 'BACKSTAGE // SETLIST LOUNGE',
    serial: 'SN-2026-MTG',
    watermark: require('../../assets/band2.jpg'),
  };
};

interface FreqColorMeta {
  bg: string;
  border: string;
  text: string;
}

const getFreqColor = (band?: string): FreqColorMeta => {
  const b = (band || '').toUpperCase();
  if (b.includes('LOW-MID') || b.includes('MID-LOW')) {
    return {
      bg: '#B83232',
      border: '#B83232',
      text: '#121212',
    };
  }
  if (b.includes('LOW') || b.includes('SUB') || b.includes('BASS')) {
    return {
      bg: '#B83232',
      border: '#B83232',
      text: '#121212',
    };
  }
  if (b.includes('HI') || b.includes('TREBLE')) {
    return {
      bg: '#B83232',
      border: '#B83232',
      text: '#121212',
    };
  }
  return {
    bg: '#B83232',
    border: '#B83232',
    text: '#121212',
  };
};

interface BookingWizardScreenProps {
  onBookingSuccess: () => void;
}

export const BookingWizardScreen: React.FC<BookingWizardScreenProps> = ({ onBookingSuccess }) => {
  const {
    wizard,
    setWizardStep,
    selectSession,
    setPracticeMode,
    setMeetingContext,
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

  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const ticketFade = useRef(new Animated.Value(0)).current;
  const ticketScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    stepFade.setValue(0.3);
    stepSlide.setValue(10);
    Animated.parallel([
      Animated.timing(stepFade, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(stepSlide, {
        toValue: 0,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [wizard.selectedSession?.id]);

  useEffect(() => {
    Animated.spring(dropdownAnim, {
      toValue: isSlotDropdownOpen ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: false,
    }).start();
  }, [isSlotDropdownOpen, dropdownAnim]);

  useEffect(() => {
    if (successBooking) {
      ticketFade.setValue(0);
      ticketScale.setValue(0.92);
      Animated.parallel([
        Animated.timing(ticketFade, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(ticketScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [successBooking, ticketFade, ticketScale]);

  // Load catalogues and auto-select initial room
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
        if (!wizard.selectedSession && st.length > 0) {
          selectSession(st[0]);
        }
      } catch (err) {
        console.error('Failed to load booking catalogues:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (sessionTypes.length > 0 && !wizard.selectedSession) {
      selectSession(sessionTypes[0]);
    }
  }, [sessionTypes, wizard.selectedSession, selectSession]);

  // Debounced Acoustic AI Check
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
    if (wizard.selectedSession) {
      const timer = setTimeout(() => {
        runAcousticCheck();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [wizard.selectedSession?.id, wizard.instruments, wizard.practiceMode, runAcousticCheck]);

  // Fetch live hour-wise slots availability for operating hours (6:00 AM - 11:00 PM)
  useEffect(() => {
    if (wizard.selectedSession) {
      let isMounted = true;
      const fetchSlots = async () => {
        try {
          setLoadingSlots(true);
          const data = await api.getSessionSlots(wizard.selectedSession!.id, wizard.bookingDate);
          if (isMounted) {
            const returnedSlots = data.slots || [];
            setSlots(returnedSlots);

            const isSolo = wizard.practiceMode.toUpperCase() === 'SOLO PRACTICE';
            const isSessionA = (wizard.selectedSession?.name || '').toUpperCase().includes('SESSION A');
            const isFullBandA = isSessionA && wizard.practiceMode.toUpperCase() === 'FULL BAND REHEARSAL';
            const isSlotValid = (s: SlotAvailability) => {
              if (!s.is_available) return false;
              if (isSolo && (s.current_participants || 0) > 0) return false;
              if (isFullBandA && (s.current_participants || 0) > 0) return false;
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
    const isSessionA = sNameUpper.includes('SESSION A');
    const isFullBandA = isSessionA && wizard.practiceMode.toUpperCase() === 'FULL BAND REHEARSAL';
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
        'Solo practice requires an empty room. This slot is already in use. Please select an empty slot or choose Collaborative Practice.'
      );
      return;
    }

    if (isFullBandA && selectedSlot && ((selectedSlot.current_participants || 0) > 0 || !selectedSlot.is_available)) {
      Alert.alert(
        'Full Band Rehearsal Exclusivity',
        'Full band rehearsal reserves the entire room. This slot is already occupied. Please select an empty available slot.'
      );
      return;
    }

    if (isRecording && selectedSlot && (selectedSlot.current_participants || 0) > 0) {
      Alert.alert(
        'Recording Studio Isolation',
        'Recording sessions require complete room isolation. Please select an empty available slot.'
      );
      return;
    }

    if (isFullBandA) {
      if (!wizard.participantCount || wizard.participantCount < 1) {
        Alert.alert(
          'Participants Required',
          'Please enter the number of band members participating in this rehearsal (1 to 11).'
        );
        return;
      }
      if (wizard.participantCount > 11) {
        Alert.alert(
          'Participant Limit Exceeded',
          `Full Band Rehearsal limit is 11 musicians. You entered ${wizard.participantCount}.`
        );
        return;
      }
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

    if (!isMeeting && !isFullBandA && selectedInstrumentsList.length === 0) {
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
    // For Full Band Rehearsal: Manually entered participant count (up to 11).
    // For Session A / B (Solo / Collab): 1 per booking.
    const maxAllowedLimit = isFullBandA ? 11 : wizard.selectedSession.participant_limit;
    const peoplePlaying = isMeeting
      ? Math.max(1, Math.min(wizard.selectedSession.participant_limit, wizard.participantCount || 2))
      : isFullBandA
      ? Math.max(1, Math.min(11, wizard.participantCount || 4))
      : isJamSession
      ? Math.min(8, Math.max(1, totalInstrumentsSelected))
      : isRecording
      ? (isRecordingSolo ? 1 : Math.min(4, Math.max(1, totalInstrumentsSelected)))
      : 1;

    if (peoplePlaying > maxAllowedLimit) {
      Alert.alert(
        'Participant Limit Exceeded',
        `The number of people playing (${peoplePlaying}) exceeds the participant limit of ${maxAllowedLimit} for ${wizard.selectedSession.name}.`
      );
      return;
    }

    // Auto-Room Assignment: room_id is omitted so backend dynamically assigns the optimal available room
    const meetingCtx = wizard.meetingContext.trim();
    const finalPracticeMode = isMeeting
      ? (meetingCtx || 'General Discussion')
      : isFullBandA
      ? 'Full Band Rehearsal'
      : wizard.practiceMode;

    const payload = {
      user_id: currentUser.id,
      session_type_id: wizard.selectedSession.id,
      booking_date: wizard.bookingDate,
      start_time: wizard.startTime,
      end_time: formattedEndTime,
      practice_mode: finalPracticeMode,
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
          : isMeeting
          ? `Booking Confirmed! Your ${res.session_name} slot is locked in (${res.start_time}-${res.end_time}).`
          : isFullBandA
          ? `Booking Confirmed! Your ${res.session_name} Full Band Rehearsal is locked in (${res.start_time}-${res.end_time}). Private room reserved.`
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
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>LOADING ROOM SPECIFICATIONS...</Text>
      </View>
    );
  }

  // Success View: Minimalist Pass matching MY REHEARSALS
  if (successBooking) {
    const isRecordingSuccess = (successBooking.session_name || '').toUpperCase().includes('RECORDING');
    const isMeetingSuccess = (successBooking.session_name || '').toUpperCase().includes('MEETING');

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Animated.View
          style={[
            styles.ticketCard,
            {
              opacity: ticketFade,
              transform: [{ scale: ticketScale }],
            },
          ]}
        >
          <RockTextureOverlay pattern="mesh" opacity={0.06} />

          {/* Header Row matching BookingsListScreen cardHeader */}
          <View style={styles.ticketHeaderRow}>
            <Text style={styles.bookingId}>PASS #{successBooking.id}</Text>
            <View style={styles.ticketBadge}>
              <LightningSvg color="#FFFFFF" size={10} style={{ marginRight: 4 }} />
              <Text style={styles.ticketBadgeText}>★ ALL ACCESS PASS</Text>
            </View>
          </View>

          <Text style={styles.ticketTitle}>{successBooking.session_name.toUpperCase()}</Text>
          <Text style={styles.ticketSession}>
            {isRecordingSuccess
              ? `Booking Confirmed! Studio recording session locked in.`
              : isMeetingSuccess
              ? `Booking Confirmed! Meeting session locked in.`
              : (successBooking.practice_mode || '').toUpperCase().includes('FULL BAND')
              ? `Booking Confirmed! Full Band Rehearsal locked in.`
              : `Booking Confirmed! Rehearsal slot locked in.`}
          </Text>

          <View style={styles.ticketGrid}>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>ROOM // SESSION:</Text>
              <Text style={styles.ticketVal}>{successBooking.session_name}</Text>
            </View>
            {successBooking.practice_mode ? (
              <View style={styles.ticketField}>
                <Text style={styles.ticketLabel}>
                  {isMeetingSuccess ? 'CONTEXT:' : 'MODE:'}
                </Text>
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
              <Text style={styles.ticketLabel}>
                {isMeetingSuccess ? 'PARTICIPANTS:' : 'PEOPLE PLAYING:'}
              </Text>
              <Text style={styles.ticketVal}>
                {successBooking.participant_count} {successBooking.participant_count === 1 ? 'Person' : 'People'}
              </Text>
            </View>
          </View>

          <Text style={styles.pushNote}>
            Automatic session reminders active at 45m and 60m marks.
          </Text>

          <AnimatedPressable
            style={styles.doneBtn}
            onPress={() => {
              setSuccessBooking(null);
              resetWizard();
              onBookingSuccess();
            }}
            scaleTo={0.97}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <LightningSvg color="#0D0D10" size={13} style={{ marginRight: 6 }} />
              <Text style={styles.doneBtnText}>VIEW MY BOOKINGS →</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header matching MY REHEARSALS */}
      <View style={styles.headerBox}>
        <Text style={styles.headerSubtitle}>LOCK IN TIME</Text>
        <Text style={styles.headerTitle}>
          {wizard.selectedSession?.name?.toUpperCase().includes('RECORDING')
            ? 'RECORDING STUDIO BOOKING'
            : 'REHEARSAL ROOM BOOKING'}
        </Text>
      </View>

      {/* Room Selector Pills (Instant Room Switcher replacing 01 // ROOM page) */}
      <View style={styles.roomSelectorRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roomSelectorScroll}
        >
          {sessionTypes.map((session) => {
            const isSelected = wizard.selectedSession?.id === session.id;
            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.roomPill, isSelected && styles.roomPillSelected]}
                onPress={() => selectSession(session)}
                activeOpacity={0.8}
              >
                {isSelected && (
                  <View style={styles.roomPillDot} />
                )}
                <Text
                  style={[styles.roomPillText, isSelected && styles.roomPillTextSelected]}
                >
                  {session.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ========================================================= */}
      {/* BOOKING CONFIGURATION & STRICT INSTRUMENT FILTERING        */}
      {/* ========================================================= */}
      {wizard.selectedSession && (() => {
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
        const effectiveParticipantLimit = isFullBandA ? 11 : participantLimit;

        // Jam Session & Session B: Collaborative Practice only
        // Session A: Solo Practice, Collaborative Practice, or Full Band Rehearsal
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
            return ['Solo Practice', 'Collaborative Practice', 'Full Band Rehearsal'];
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

        const sessionBandMeta = getSessionBandTag(wizard.selectedSession.name);

        return (
          <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepSlide }] }}>
            {/* Selected Session Concert Ticket Stub (Matching BOOK SLOT Ticket Design) */}
            <View style={styles.selectedTicketCard}>
              {/* Semi-circular Ticket Punch Notches on Perforation Ends */}
              <View style={[styles.selectedPunchNotch, styles.selectedNotchTopLeft]} />
              <View style={[styles.selectedPunchNotch, styles.selectedNotchBottomLeft]} />

              {/* Left Perforated Tear-off Stub */}
              <View style={styles.selectedLeftTearStub}>
                <View style={styles.selectedBarcodeWrap}>
                  <Svg width="22" height="70" viewBox="0 0 22 75">
                    <Rect x="0" y="0" width="3" height="75" fill="#000000" />
                    <Rect x="4" y="0" width="1" height="75" fill="#000000" />
                    <Rect x="6" y="0" width="2" height="75" fill="#000000" />
                    <Rect x="9" y="0" width="1" height="75" fill="#000000" />
                    <Rect x="12" y="0" width="2" height="75" fill="#000000" />
                    <Rect x="15" y="0" width="1" height="75" fill="#000000" />
                    <Rect x="17" y="0" width="3" height="75" fill="#000000" />
                    <Rect x="21" y="0" width="1" height="75" fill="#000000" />
                  </Svg>
                </View>
                <Text style={styles.selectedStubPassText}>PASS</Text>
              </View>

              {/* Perforated Dashed Tear Line */}
              <View style={styles.selectedPerforationLine} />

              {/* Main Ticket Surface (Warm Aged Zine Paper) */}
              <View style={styles.selectedTicketMain}>
                {/* High-Contrast Halftone Band Silhouette on Right */}
                {sessionBandMeta.watermark && (
                  <View style={styles.selectedBandPhotoCutoutWrap}>
                    <Image
                      source={sessionBandMeta.watermark}
                      style={[
                        styles.selectedBandSilhouettePhoto,
                        Platform.select({
                          web: {
                            filter: 'grayscale(100%) contrast(290%) brightness(1.03)',
                            mixBlendMode: 'multiply',
                          } as any,
                        }),
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Slanted Gritty Grainy Rubber Stamp Watermark: "APPROVED" */}
                <View style={styles.approvedWatermarkBox} pointerEvents="none">
                  <View style={styles.approvedStampFrameOuter}>
                    <View style={styles.approvedStampFrameInner}>
                      <Text style={styles.approvedStampWord}>APPROVED</Text>
                    </View>
                  </View>
                  {/* Gritty Erosion Scratches & Stray Ink Speckles */}
                  <Svg width="215" height="52" viewBox="0 0 215 52" style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <Line x1="12" y1="14" x2="85" y2="14" stroke="#DDD7C9" strokeWidth="1.2" strokeDasharray="3, 8, 2, 6" />
                    <Line x1="50" y1="27" x2="200" y2="27" stroke="#DDD7C9" strokeWidth="1.4" strokeDasharray="4, 12, 1, 9, 3" />
                    <Line x1="18" y1="39" x2="155" y2="39" stroke="#DDD7C9" strokeWidth="1.1" strokeDasharray="2, 10, 3, 7" />
                    <Line x1="95" y1="18" x2="205" y2="18" stroke="#DDD7C9" strokeWidth="1.1" strokeDasharray="5, 14, 2, 8" />
                    <Circle cx="8" cy="8" r="0.8" fill="#8B1E22" />
                    <Circle cx="206" cy="12" r="0.9" fill="#8B1E22" />
                    <Circle cx="5" cy="32" r="0.7" fill="#8B1E22" />
                    <Circle cx="208" cy="42" r="0.8" fill="#8B1E22" />
                    <Circle cx="108" cy="4" r="0.6" fill="#8B1E22" />
                    <Circle cx="165" cy="48" r="0.7" fill="#8B1E22" />
                    <Circle cx="24" cy="46" r="0.9" fill="#8B1E22" />
                  </Svg>
                </View>

                {/* Ticket Header & Metadata */}
                <View style={styles.selectedTicketHeader}>
                  <View style={styles.rackLiveDotRow}>
                    <View style={styles.rackLiveDot} />
                    <Text style={styles.pillLabel}>SELECTED SOUND ROOM:</Text>
                  </View>
                  <Text style={styles.selectedSessionTitle}>
                    {wizard.selectedSession.name.toUpperCase()}
                  </Text>
                  <Text style={styles.rackSessionMeta}>
                    CAPACITY // UP TO {effectiveParticipantLimit} MUSICIANS
                  </Text>
                </View>

                {/* Diagonally Stamped Rubber Badge: AMPS WARMED (Acid-Lime) */}
                <View style={styles.selectedRubberStampBox}>
                  <Text style={styles.selectedStampText}>
                    ⚡ AMPS WARMED
                  </Text>
                </View>
              </View>

              {/* Tactile Cardstock / Paper Texture Overlay */}
              <RockTextureOverlay pattern="paperGrain" opacity={0.35} style={styles.paperTextureOverlay} />
            </View>

            {/* Practice Mode Selection */}
            {practiceModes.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  {isRecordingSession ? 'RECORDING MODE:' : 'PRACTICE MODE:'}
                </Text>
                <View style={styles.modeRow}>
                  {practiceModes.map((mode) => {
                    const isSelected = wizard.practiceMode.toLowerCase() === mode.toLowerCase();
                    return (
                      <AnimatedPressable
                        key={mode}
                        style={[styles.modeBtn, isSelected && styles.modeBtnSelected]}
                        onPress={() => setPracticeMode(mode)}
                        scaleTo={0.96}
                      >
                        <View style={styles.modeBtnContent}>
                          {isSelected && (
                            <View style={styles.modeBtnDot} />
                          )}
                          <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextSelected]}>
                            {mode.toUpperCase()}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 2C: Filtered Instrument Selection */}
            {isMeetingSession ? (
              <View style={styles.meetingConfigBox}>
                <View style={styles.policyCard}>
                  <RockTextureOverlay pattern="mesh" opacity={0.06} />
                  <Text style={styles.policyTitle}>📋 MEETING SESSION</Text>
                  <Text style={styles.policyText}>
                    Private room for club meetings, setlists, and production planning. No instruments required.
                  </Text>
                </View>

                {/* Meeting Context Input */}
                <View style={styles.meetingContextCard}>
                  <RockTextureOverlay pattern="mesh" opacity={0.06} />
                  <Text style={styles.fieldLabel}>MEETING CONTEXT / AGENDA (TYPE IT):</Text>
                  <TextInput
                    style={styles.meetingContextInput}
                    value={wizard.meetingContext}
                    onChangeText={setMeetingContext}
                    placeholder="e.g. Setlist curation, tour planning, album launch..."
                    placeholderTextColor="#666666"
                    maxLength={150}
                  />
                  <Text style={styles.meetingContextHelper}>
                    Type meeting purpose or topic. This will be displayed on your pass as CONTEXT.
                  </Text>
                </View>
              </View>
            ) : isFullBandA ? (
              <View style={styles.formGroup}>
                <View style={styles.policyCard}>
                  <RockTextureOverlay pattern="mesh" opacity={0.06} />
                  <Text style={styles.policyTitle}>🥁 FULL BAND REHEARSAL</Text>
                  <Text style={styles.policyText}>
                    Private, locked room reserved exclusively for your band. No outside bookings allowed.
                  </Text>
                </View>
              </View>
            ) : isJamSession ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>ONE USER BOOKS FOR ALL:</Text>

                <View style={styles.policyCard}>
                  <RockTextureOverlay pattern="mesh" opacity={0.06} />
                  <Text style={styles.policyTitle}>🥁 JAM SESSION</Text>
                  <Text style={styles.policyText}>
                    One user books gear for the entire group. Room is locked exclusively for your jam.
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

                {/* Display all instruments with quantity steppers in horizontal carousel */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={262}
                  contentContainerStyle={styles.horizontalCarouselContent}
                >
                  {allowedInstruments.map((inst) => {
                    const qty = wizard.instruments[inst.id] || 0;
                    const isSelected = qty > 0;
                    const canAdd = totalJamInstruments < 8;
                    const freqColor = getFreqColor(inst.frequency_band);

                    return (
                      <View
                        key={inst.id}
                        style={[styles.jamInstrumentCard, isSelected && styles.jamInstrumentCardSelected]}
                      >
                        <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.03} />
                        <View style={styles.jamInstrumentHeader}>
                          <Text style={[styles.jamInstrumentName, isSelected && styles.jamInstrumentNameSelected]}>
                            {inst.name.toUpperCase()}
                          </Text>
                          {isSelected && (
                            <View style={styles.selectedCheckBadge}>
                              <Text style={styles.selectedCheckText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.bandTagRow}>
                          <View style={[styles.bandTagPill, { borderColor: freqColor.border, backgroundColor: freqColor.bg }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor.text }]}>
                              {inst.frequency_band?.toUpperCase() || 'MID'} FREQ
                            </Text>
                          </View>
                          <Text style={styles.soloCategoryText}>{inst.category?.toUpperCase() || 'GEAR'}</Text>
                        </View>

                        <View style={styles.jamStepperRow}>
                          <AnimatedPressable
                            style={[styles.jamStepBtn, qty === 0 && styles.jamStepBtnDisabled]}
                            disabled={qty === 0}
                            onPress={() => setInstrumentQuantity(inst.id, Math.max(0, qty - 1))}
                            scaleTo={0.88}
                          >
                            <Text style={[styles.jamStepBtnText, qty === 0 && styles.jamStepBtnTextDisabled]}>−</Text>
                          </AnimatedPressable>

                          <View style={[styles.jamQtyBox, isSelected && styles.jamQtyBoxSelected]}>
                            <Text style={[styles.jamQtyText, isSelected && styles.jamQtyTextSelected]}>{qty}</Text>
                          </View>

                          <AnimatedPressable
                            style={[styles.jamStepBtn, !canAdd && styles.jamStepBtnDisabled]}
                            disabled={!canAdd}
                            onPress={() => {
                              if (canAdd) {
                                setInstrumentQuantity(inst.id, qty + 1);
                              } else {
                                Alert.alert('Constraint Limit', 'Constraint For Jam Session Max: 8 musicians/instruments.');
                              }
                            }}
                            scaleTo={0.88}
                          >
                            <Text style={[styles.jamStepBtnText, !canAdd && styles.jamStepBtnTextDisabled]}>+</Text>
                          </AnimatedPressable>
                        </View>

                        {isSelected && (
                          <View style={styles.selectedStatusStrip}>
                            <Text style={styles.selectedStatusStripText}>● {qty} IN RIG</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : isRecordingGroup ? (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>ONE USER BOOKS FOR ALL:</Text>

                <View style={styles.policyCard}>
                  <RockTextureOverlay pattern="mesh" opacity={0.06} />
                  <Text style={styles.policyTitle}>🎙️ GROUP RECORDING</Text>
                  <Text style={styles.policyText}>
                    Private room booking for multi-instrument recording. One user books for all.
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

                {/* Display all instruments with quantity steppers in horizontal carousel */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={262}
                  contentContainerStyle={styles.horizontalCarouselContent}
                >
                  {allowedInstruments.map((inst) => {
                    const qty = wizard.instruments[inst.id] || 0;
                    const isSelected = qty > 0;
                    const canAdd = totalRecordingInstruments < 4;
                    const freqColor = getFreqColor(inst.frequency_band);

                    return (
                      <View
                        key={inst.id}
                        style={[styles.jamInstrumentCard, isSelected && styles.jamInstrumentCardSelected]}
                      >
                        <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.03} />
                        <View style={styles.jamInstrumentHeader}>
                          <Text style={[styles.jamInstrumentName, isSelected && styles.jamInstrumentNameSelected]}>
                            {inst.name.toUpperCase()}
                          </Text>
                          {isSelected && (
                            <View style={styles.selectedCheckBadge}>
                              <Text style={styles.selectedCheckText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.bandTagRow}>
                          <View style={[styles.bandTagPill, { borderColor: freqColor.border, backgroundColor: freqColor.bg }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor.text }]}>
                              {inst.frequency_band?.toUpperCase() || 'MID'} FREQ
                            </Text>
                          </View>
                          <Text style={styles.soloCategoryText}>{inst.category?.toUpperCase() || 'GEAR'}</Text>
                        </View>

                        <View style={styles.jamStepperRow}>
                          <AnimatedPressable
                            style={[styles.jamStepBtn, qty === 0 && styles.jamStepBtnDisabled]}
                            disabled={qty === 0}
                            onPress={() => setInstrumentQuantity(inst.id, Math.max(0, qty - 1))}
                            scaleTo={0.88}
                          >
                            <Text style={[styles.jamStepBtnText, qty === 0 && styles.jamStepBtnTextDisabled]}>−</Text>
                          </AnimatedPressable>

                          <View style={[styles.jamQtyBox, isSelected && styles.jamQtyBoxSelected]}>
                            <Text style={[styles.jamQtyText, isSelected && styles.jamQtyTextSelected]}>{qty}</Text>
                          </View>

                          <AnimatedPressable
                            style={[styles.jamStepBtn, !canAdd && styles.jamStepBtnDisabled]}
                            disabled={!canAdd}
                            onPress={() => {
                              if (canAdd) {
                                setInstrumentQuantity(inst.id, qty + 1);
                              } else {
                                Alert.alert('Constraint Limit', 'Constraint For Recording Session Max: 4 musicians/instruments.');
                              }
                            }}
                            scaleTo={0.88}
                          >
                            <Text style={[styles.jamStepBtnText, !canAdd && styles.jamStepBtnTextDisabled]}>+</Text>
                          </AnimatedPressable>
                        </View>

                        {isSelected && (
                          <View style={styles.selectedStatusStrip}>
                            <Text style={styles.selectedStatusStripText}>● {qty} IN RIG</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>YOUR INSTRUMENT:</Text>

                {isRecordingSolo && (
                  <View style={styles.policyCard}>
                    <RockTextureOverlay pattern="mesh" opacity={0.06} />
                    <Text style={styles.policyTitle}>🎙️ SOLO RECORDING</Text>
                    <Text style={styles.policyText}>
                      Private room booking for one musician with complete isolation. Select your instrument below.
                    </Text>
                  </View>
                )}

                {isSessionA && isSoloPractice && (
                  <View style={styles.policyCard}>
                    <RockTextureOverlay pattern="mesh" opacity={0.06} />
                    <Text style={styles.policyTitle}>🎸 SOLO PRACTICE (SESSION A)</Text>
                    <Text style={styles.policyText}>
                      Private room reserved exclusively for solo drums or electric guitar.
                    </Text>
                  </View>
                )}

                {isSessionA && !isSoloPractice && (
                  <View style={styles.policyCard}>
                    <RockTextureOverlay pattern="mesh" opacity={0.06} />
                    <Text style={styles.policyTitle}>⚡ COLLABORATIVE PRACTICE (SESSION A)</Text>
                    <Text style={styles.policyText}>
                      Shared session for electric guitar and drums.
                    </Text>
                  </View>
                )}

                {isSessionB && (
                  <View style={styles.policyCard}>
                    <RockTextureOverlay pattern="mesh" opacity={0.06} />
                    <Text style={styles.policyTitle}>🎻 COLLABORATIVE PRACTICE (SESSION B)</Text>
                    <Text style={styles.policyText}>
                      Shared acoustic and low-gain session. Drums and electric guitar are prohibited.
                    </Text>
                  </View>
                )}

                {/* Single-select per user in horizontal carousel */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={242}
                  contentContainerStyle={styles.horizontalCarouselContent}
                >
                  {allowedInstruments.map((inst) => {
                    const isSelected = (wizard.instruments[inst.id] || 0) === 1;
                    const freqColor = getFreqColor(inst.frequency_band);
                    return (
                      <AnimatedPressable
                        key={inst.id}
                        style={[styles.soloInstrumentCard, isSelected && styles.soloInstrumentCardSelected]}
                        scaleTo={0.96}
                        onPress={() => {
                          // Select exactly this ONE instrument for this user
                          allowedInstruments.forEach((other) => {
                            setInstrumentQuantity(other.id, other.id === inst.id ? 1 : 0);
                          });
                        }}
                      >
                        <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.03} />
                        <View style={styles.soloCardHeader}>
                          <Text style={[styles.soloInstrumentName, isSelected && styles.soloInstrumentNameSelected]}>
                            {inst.name.toUpperCase()}
                          </Text>
                          {isSelected ? (
                            <View style={styles.selectedCheckBadge}>
                              <Text style={styles.selectedCheckText}>✓</Text>
                            </View>
                          ) : (
                            <View style={styles.unselectedRadioCircle} />
                          )}
                        </View>
                        <View style={styles.bandTagRow}>
                          <View style={[styles.bandTagPill, { borderColor: freqColor.border, backgroundColor: freqColor.bg }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor.text }]}>
                              {inst.frequency_band?.toUpperCase() || 'MID'} FREQ
                            </Text>
                          </View>
                          <Text style={styles.soloCategoryText}>{inst.category?.toUpperCase() || 'GEAR'}</Text>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedStatusStrip}>
                            <Text style={styles.selectedStatusStripText}>● RIG ARMED</Text>
                          </View>
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Minimalist Acoustic Warning (No Decibel Meter) */}
            {(() => {
              const activeWarnings = (wizard.acousticPreview?.warnings || []).filter(
                (w) => !w.toLowerCase().includes('recording lockdown active in live studio')
              );
              if (activeWarnings.length === 0) return null;
              return (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ {activeWarnings[0]}</Text>
                </View>
              );
            })()}

            {/* Date, Time Slot & Dynamic Participants in Slot */}
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const tomorrowDate = new Date();
              tomorrowDate.setDate(tomorrowDate.getDate() + 1);
              const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

              const selectedSlot = slots.find((s) => s.start_time === wizard.startTime);
              const maxCapacity = selectedSlot?.max_participants || effectiveParticipantLimit;
              const existingParticipants = selectedSlot?.current_participants || 0;
              const isSlotFull = existingParticipants >= maxCapacity;
              const isSlotSoloBlocked = isSoloPractice && existingParticipants > 0;
              const isJamOccupied = isJamSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isRecordingOccupied = isRecordingSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isMeetingOccupied = isMeetingSession && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isFullBandOccupied = isFullBandA && (existingParticipants > 0 || !selectedSlot?.is_available);
              const isReserved = !selectedSlot?.is_available || isSlotFull || isSlotSoloBlocked || isJamOccupied || isRecordingOccupied || isMeetingOccupied || isFullBandOccupied;
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
                      <AnimatedPressable
                        style={[styles.quickDateBtn, wizard.bookingDate === todayStr && styles.quickDateBtnTodaySelected]}
                        onPress={() => setBookingDateTime(todayStr, wizard.startTime, 60)}
                        scaleTo={0.96}
                        containerStyle={{ flex: 1 }}
                      >
                        <View style={styles.quickDateInner}>
                          <LightningSvg
                            color={wizard.bookingDate === todayStr ? '#F87171' : '#8A8A96'}
                            size={11}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[styles.quickDateBtnText, wizard.bookingDate === todayStr && styles.quickDateBtnTextSelected]}>
                            TODAY
                          </Text>
                        </View>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={[styles.quickDateBtn, wizard.bookingDate === tomorrowStr && styles.quickDateBtnTomorrowSelected]}
                        onPress={() => setBookingDateTime(tomorrowStr, wizard.startTime, 60)}
                        scaleTo={0.96}
                        containerStyle={{ flex: 1 }}
                      >
                        <View style={styles.quickDateInner}>
                          <LightningSvg
                            color={wizard.bookingDate === tomorrowStr ? '#F87171' : '#8A8A96'}
                            size={11}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[styles.quickDateBtnText, wizard.bookingDate === tomorrowStr && styles.quickDateBtnTomorrowTextSelected]}>
                            TOMORROW
                          </Text>
                        </View>
                      </AnimatedPressable>
                    </View>
                  </View>

                  {/* Minimalist 1-Hour Time Slot Dropdown */}
                  <View style={styles.formGroup}>
                    <View style={styles.timeDropdownHeader}>
                      <Text style={styles.fieldLabel}>TIME SLOT (1-HOUR SESSIONS):</Text>
                      {loadingSlots && (
                        <View style={styles.loadingSlotsRow}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
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
                                      : 'STATUS: AVAILABLE'}
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
                              <Animated.Text
                                style={[
                                  styles.dropdownChevron,
                                  {
                                    transform: [
                                      {
                                        rotate: dropdownAnim.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: ['0deg', '180deg'],
                                        }),
                                      },
                                    ],
                                  },
                                ]}
                              >
                                ▼
                              </Animated.Text>
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
                            <Animated.View
                              style={[
                                styles.dropdownMenu,
                                {
                                  maxHeight: dropdownAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 240],
                                  }),
                                  opacity: dropdownAnim.interpolate({
                                    inputRange: [0, 0.2, 1],
                                    outputRange: [0, 0.4, 1],
                                  }),
                                },
                              ]}
                            >
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
                                    const isSlotFullBandBlocked = isFullBandA && ((slot.current_participants || 0) > 0 || !slot.is_available);
                                    const isBlocked = !slot.is_available || isSlotSoloBlocked || isSlotJamOccupied || isSlotRecOccupied || isSlotMeetingOccupied || isSlotFullBandBlocked;

                                    const badgeText = (() => {
                                      if (isSlotSoloBlocked) return 'COLLAB ACTIVE (NO SOLO)';
                                      if (isSlotFullBandBlocked) return 'OCCUPIED (EMPTY ROOM REQ)';
                                      if (isSlotJamOccupied) return 'RESERVED (JAM)';
                                      if (isSlotRecOccupied) return 'RESERVED (RECORDING)';
                                      if (isSlotMeetingOccupied) return 'RESERVED';
                                      if (!slot.is_available) {
                                        if (activeSession?.toUpperCase().includes('FULL BAND') || slot.status?.toUpperCase().includes('FULL BAND')) return 'RESERVED (FULL BAND)';
                                        if (activeSession?.toUpperCase().includes('JAM') || slot.status?.toUpperCase().includes('JAM')) return 'RESERVED (JAM)';
                                        if (activeSession?.toUpperCase().includes('RECORDING') || slot.status?.toUpperCase().includes('RECORDING')) return 'RESERVED (RECORDING)';
                                        if (activeSession) return `RESERVED (${activeSession.toUpperCase()})`;
                                        if (slot.status?.includes('Reserved')) return slot.status.toUpperCase();
                                        if (slot.status?.includes('Full')) return 'FULL';
                                        return slot.status?.toUpperCase() || 'RESERVED';
                                      }
                                      if (isSelected) return '✓ SELECTED';
                                      if (isFullBandA) return 'AVAILABLE (EMPTY ROOM)';
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
                                          if (isSlotFullBandBlocked || (isFullBandA && ((slot.current_participants || 0) > 0 || !slot.is_available))) {
                                            Alert.alert(
                                              'Full Band Rehearsal Exclusivity',
                                              'Full band rehearsal reserves the entire room. This slot is already occupied. Please select an empty available slot.'
                                            );
                                            return;
                                          }
                                          if (isSlotJamOccupied || (isJamSession && !slot.is_available)) {
                                            Alert.alert(
                                              'Jam Session Reserved',
                                              'This slot is already reserved for a private jam session. Please select an empty slot.'
                                            );
                                            return;
                                          }
                                          if (isSlotRecOccupied || (isRecordingSession && (!slot.is_available || (slot.current_participants || 0) > 0))) {
                                            Alert.alert(
                                              'Recording Studio Isolation',
                                              'Recording sessions require complete room isolation. Please select an empty available slot.'
                                            );
                                            return;
                                          }
                                          if (isSlotMeetingOccupied || (isMeetingSession && (!slot.is_available || (slot.current_participants || 0) > 0))) {
                                            Alert.alert(
                                              'Meeting Room Occupied',
                                              'Meeting sessions require a private room. Please select an empty available slot.'
                                            );
                                            return;
                                          }
                                          if (!slot.is_available) {
                                            if (activeSession?.toUpperCase().includes('FULL BAND') || slot.status?.toUpperCase().includes('FULL BAND')) {
                                              Alert.alert(
                                                'Full Band Rehearsal Reserved',
                                                `The ${slot.label} slot is reserved for Full Band Rehearsal. It is an exclusive reservation and cannot be joined.`
                                              );
                                              return;
                                            }
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
                                                : '○ AVAILABLE'}
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
                            </Animated.View>
                          )}
                        </View>
                      );
                    })()}

                    <Text style={styles.timeSlotHelper}>
                      Operating hours: 6:00 AM – 11:00 PM daily
                    </Text>
                  </View>

                  {/* Dynamic People Playing (Participants in Slot) */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>
                      {isMeetingSession
                        ? 'PEOPLE IN MEETING (PARTICIPANTS IN SLOT):'
                        : isFullBandA
                        ? 'BAND MEMBERS (PARTICIPANTS IN SLOT):'
                        : 'PEOPLE PLAYING (PARTICIPANTS IN SLOT):'}
                    </Text>

                    {isMeetingSession || isFullBandA ? (
                      <View style={[styles.autoPeopleBox, isReserved && styles.autoPeopleBoxReserved]}>
                        <View style={styles.meetingInputRow}>
                          <View style={styles.meetingInputCol}>
                            <Text style={[styles.autoPeopleVal, isReserved && styles.autoPeopleValReserved]}>
                              {isReserved
                                ? 'RESERVED (SLOT OCCUPIED)'
                                : isFullBandA
                                ? `${wizard.participantCount || 0} ${wizard.participantCount === 1 ? 'MEMBER' : 'MEMBERS'} IN BAND`
                                : `${wizard.participantCount || 0} ${wizard.participantCount === 1 ? 'PERSON' : 'PEOPLE'} ATTENDING`}
                            </Text>
                            {isReserved && (
                              <Text style={styles.autoPeopleSub}>
                                {isFullBandA
                                  ? '⚠️ Slot already has active musicians or is reserved.'
                                  : '⚠️ Slot is already booked for another session.'}
                              </Text>
                            )}
                          </View>

                          {!isReserved && (
                            <View style={styles.meetingSmallInputWrap}>
                              <TextInput
                                style={styles.meetingSmallInput}
                                value={wizard.participantCount ? String(wizard.participantCount) : ''}
                                onChangeText={(text) => {
                                  const digits = text.replace(/[^0-9]/g, '');
                                  if (digits === '') {
                                    setParticipantCount(0);
                                  } else {
                                    const val = parseInt(digits, 10);
                                    setParticipantCount(Math.min(effectiveParticipantLimit, Math.max(1, val)));
                                  }
                                }}
                                placeholder={isFullBandA ? "6" : "5"}
                                placeholderTextColor="#666666"
                                keyboardType="number-pad"
                                maxLength={2}
                              />
                              <Text style={styles.meetingInputLimitTag}>/ {effectiveParticipantLimit} MAX</Text>
                            </View>
                          )}
                        </View>
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
                        {(() => {
                          // Only show subtitle in People Playing for Session A and Session B
                          if ((!isSessionA && !isSessionB) || isFullBandA) {
                            return null;
                          }

                          if (isSoloPractice) {
                            const soloSub = isSlotSoloBlocked
                              ? '⚠️ Slot already in use. Solo practice requires an empty room.'
                              : 'Private room reserved exclusively for you.';
                            return <Text style={styles.autoPeopleSub}>{soloSub}</Text>;
                          }

                          if (isReserved) {
                            return <Text style={styles.autoPeopleSub}>Slot is at full capacity.</Text>;
                          }

                          const statusText = existingParticipants === 0
                            ? 'Slot is currently empty.'
                            : `${existingParticipants} active ${existingParticipants === 1 ? 'musician' : 'musicians'}${selectedSlot?.instruments_summary?.length ? ` (${selectedSlot.instruments_summary.join(', ')})` : ''} in slot.`;
                          return <Text style={styles.autoPeopleSub}>{statusText}</Text>;
                        })()}
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}

          {/* Confirm Reservation Button */}
          <AnimatedPressable
            style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
            onPress={handleConfirmReservation}
            disabled={isSubmitting}
            scaleTo={0.98}
          >
            {isSubmitting ? (
              <ActivityIndicator color="rgba(176, 218, 48, 0.75)" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <LightningSvg color="rgba(176, 218, 48, 0.75)" size={14} style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>
                  {isRecordingSession
                    ? 'CONFIRM RECORDING RESERVATION'
                    : isFullBandA
                    ? 'CONFIRM FULL BAND RESERVATION'
                    : 'CONFIRM RESERVATION'}
                </Text>
              </View>
            )}
          </AnimatedPressable>
        </Animated.View>
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
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  horizontalCarouselContent: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  centerBox: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#EFECE6',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
    marginTop: 12,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* HEADER (MATCHING MY REHEARSALS)                           */
  /* ========================================================= */
  headerBox: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#27272A',
    paddingBottom: 14,
  },
  headerSubtitle: {
    color: 'rgba(176, 218, 48, 0.80)',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
    marginBottom: 4,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  headerTitle: {
    color: '#EFECE6',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },

  /* ========================================================= */
  /* ROOM SELECTOR ROW (IN-PLACE ROOM SWITCHER)                */
  /* ========================================================= */
  roomSelectorRow: {
    marginBottom: 16,
  },
  roomSelectorScroll: {
    paddingRight: 16,
    gap: 8,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#333338',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  roomPillSelected: {
    backgroundColor: '#1E1E24',
    borderColor: '#A1A1AA',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px rgba(255, 255, 255, 0.25)',
      },
      default: {},
    }),
  },
  roomPillDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  roomPillText: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  roomPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* ========================================================= */
  /* SELECTED SOUND ROOM TICKET (MATCHING BOOK SLOT TICKET)   */
  /* ========================================================= */
  selectedTicketCard: {
    backgroundColor: '#DDD7C9',
    borderWidth: 2.2,
    borderColor: '#000000',
    borderRadius: 2,
    marginBottom: 22,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.85,
    shadowRadius: 0,
    elevation: 4,
  },
  selectedLeftTearStub: {
    width: 44,
    backgroundColor: '#D2CCBE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  selectedBarcodeWrap: {
    transform: [{ rotate: '90deg' }],
    marginVertical: 10,
  },
  selectedStubPassText: {
    color: '#524C44',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  selectedPerforationLine: {
    width: 0,
    borderRightWidth: 2,
    borderRightColor: '#000000',
    borderStyle: 'dashed',
  },
  selectedPunchNotch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0A0A0C',
    zIndex: 10,
    borderWidth: 1.8,
    borderColor: '#000000',
  },
  selectedNotchTopLeft: {
    top: -7,
    left: 37,
  },
  selectedNotchBottomLeft: {
    bottom: -7,
    left: 37,
  },
  selectedTicketMain: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
    backgroundColor: '#DDD7C9',
    justifyContent: 'center',
  },
  selectedBandPhotoCutoutWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '36%',
    overflow: 'hidden',
    borderLeftWidth: 1.5,
    borderLeftColor: '#000000',
    backgroundColor: '#DDD7C9',
  },
  selectedBandSilhouettePhoto: {
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  approvedWatermarkBox: {
    position: 'absolute',
    left: '35%',
    top: 42,
    width: 215,
    zIndex: 1,
    opacity: 0.35,
    transform: [{ rotate: '-13deg' }],
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        mixBlendMode: 'multiply',
      } as any,
      default: {},
    }),
  },
  approvedStampFrameOuter: {
    borderWidth: 2.6,
    borderColor: '#8B1E22',
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 2.5,
  },
  approvedStampFrameInner: {
    borderWidth: 1.4,
    borderColor: '#8B1E22',
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvedStampWord: {
    color: '#8B1E22',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 6.5,
    lineHeight: 30,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  selectedTicketHeader: {
    maxWidth: '62%',
    zIndex: 2,
  },
  rackLiveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rackLiveDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 999,
    backgroundColor: '#000000',
    marginRight: 6,
  },
  pillLabel: {
    color: '#524C44',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  selectedSessionTitle: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.8,
    lineHeight: 28,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  rackSessionMeta: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  paperTextureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  selectedRubberStampBox: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 5,
    backgroundColor: '#B0DA30',
    borderColor: '#121212',
    transform: [{ rotate: '-8deg' }],
  },
  selectedStampText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#121212',
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* FORMS & PRACTICE MODES                                    */
  /* ========================================================= */
  formGroup: {
    marginBottom: 28,
  },
  fieldLabel: {
    color: '#C8C4BC',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  modeBtn: {
    backgroundColor: '#16161B',
    borderWidth: 1.5,
    borderColor: '#282830',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  modeBtnSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#2C1418',
  },
  modeBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeBtnDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    marginRight: 7,
  },
  modeBtnText: {
    color: '#8A8A96',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  modeBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  policyCard: {
    backgroundColor: '#141418',
    borderTopWidth: 1.2,
    borderTopColor: '#EAE6DC',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35)',
      },
      default: {},
    }),
  },
  policyTitle: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  policyText: {
    color: '#FAF6EE',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  warningBox: {
    backgroundColor: '#240C10',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#F87171',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* JAM & GROUP RECORDING COUNTER BANNERS                     */
  /* ========================================================= */
  jamCounterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  jamCounterLeft: {
    flex: 1,
  },
  jamCounterLabel: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  jamCounterValue: {
    color: '#F6F2EB',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", sans-serif',
      default: 'sans-serif',
    }),
  },
  jamCounterBadge: {
    backgroundColor: '#240C10',
    borderWidth: 1,
    borderColor: '#7D1D22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  jamCounterBadgeFull: {
    backgroundColor: '#350E14',
    borderColor: '#EF4444',
  },
  jamCounterBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* INSTRUMENT CARDS (JAM, GROUP & SOLO)                      */
  /* ========================================================= */
  jamInstrumentCard: {
    width: 240,
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 14,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  jamInstrumentCardSelected: {
    backgroundColor: '#181820',
    borderColor: '#7D1D22',
  },
  jamInstrumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 2,
  },
  jamInstrumentName: {
    color: '#F6F2EB',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", sans-serif',
      default: 'sans-serif',
    }),
  },
  jamInstrumentNameSelected: {
    color: '#FFFFFF',
  },
  bandTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    zIndex: 2,
  },
  bandTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#B83232',
    borderColor: '#B83232',
  },
  bandTagPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#121212',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  soloCategoryText: {
    color: '#9E9891',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  selectedCheckBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#240C10',
    borderWidth: 1,
    borderColor: '#7D1D22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '900',
  },
  unselectedRadioCircle: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#4A4A5A',
  },
  selectedStatusStrip: {
    backgroundColor: '#240C10',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#7D1D22',
    zIndex: 2,
  },
  selectedStatusStripText: {
    color: '#F87171',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* Stepper controls */
  jamStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0D10',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: '#261C20',
    zIndex: 2,
  },
  jamStepBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#15151A',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#261C20',
  },
  jamStepBtnDisabled: {
    opacity: 0.3,
  },
  jamStepBtnText: {
    color: '#F6F2EB',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  jamStepBtnTextDisabled: {
    color: '#555566',
  },
  jamQtyBox: {
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#16161B',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#282830',
  },
  jamQtyBoxSelected: {
    backgroundColor: '#2C1418',
    borderColor: '#EF4444',
  },
  jamQtyText: {
    color: '#8A8A96',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  jamQtyTextSelected: {
    color: '#F87171',
    fontWeight: '900',
  },

  /* Solo instrument cards */
  soloInstrumentCard: {
    width: 240,
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 14,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  soloInstrumentCardSelected: {
    backgroundColor: '#2C1418',
    borderColor: '#EF4444',
  },
  soloCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 2,
  },
  soloInstrumentName: {
    color: '#F6F2EB',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", sans-serif',
      default: 'sans-serif',
    }),
  },
  soloInstrumentNameSelected: {
    color: '#FFFFFF',
  },

  /* ========================================================= */
  /* DATE & TIME SLOT DROPDOWN                                 */
  /* ========================================================= */
  textInput: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F6F2EB',
    fontSize: 12.5,
    letterSpacing: 0.8,
    fontWeight: '800',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  quickDateRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: '#16161B',
    borderWidth: 1.5,
    borderColor: '#282830',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDateBtnTodaySelected: {
    borderColor: '#EF4444',
    backgroundColor: '#2C1418',
  },
  quickDateBtnTomorrowSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#2C1418',
  },
  quickDateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDateBtnText: {
    color: '#8A8A96',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  quickDateBtnTextSelected: {
    color: '#F87171',
    fontWeight: '900',
  },
  quickDateBtnTomorrowTextSelected: {
    color: '#F87171',
    fontWeight: '900',
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
    color: '#F87171',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#7D1D22',
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
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownValueText: {
    color: '#F6F2EB',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownPlaceholderText: {
    color: '#71717A',
    fontStyle: 'italic',
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownChevron: {
    color: '#EFECE6',
    fontSize: 10,
    marginLeft: 4,
  },
  dropdownMenu: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#261C20',
  },
  dropdownItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dropdownItemSelected: {
    backgroundColor: '#2C1418',
  },
  dropdownItemReserved: {
    backgroundColor: '#0D0D10',
    opacity: 0.45,
  },
  dropdownItemText: {
    color: '#F6F2EB',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownItemTextSelected: {
    color: '#F87171',
    fontWeight: '900',
  },
  dropdownItemTextReserved: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  dropdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dropdownBadgeAvailable: {
    backgroundColor: '#1E1E26',
    borderColor: '#FFFFFF',
  },
  dropdownBadgeSelected: {
    backgroundColor: '#350E14',
    borderColor: '#EF4444',
  },
  dropdownBadgeReserved: {
    backgroundColor: '#0D0D10',
    borderColor: '#261C20',
  },
  dropdownBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownBadgeTextAvailable: {
    color: '#FFFFFF',
  },
  dropdownBadgeTextSelected: {
    color: '#FFFFFF',
  },
  dropdownBadgeTextReserved: {
    color: '#71717A',
  },
  dropdownEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    color: '#8A8FA0',
    fontSize: 11,
    fontStyle: 'italic',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  timeSlotHelper: {
    color: '#9E9891',
    fontSize: 10,
    marginTop: 6,
    letterSpacing: 0.5,
    lineHeight: 14,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  activeSlotCallout: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  activeSlotCalloutTitle: {
    color: '#F87171',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  activeSlotCalloutText: {
    color: '#F6F2EB',
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  dropdownSlotInstruments: {
    color: '#9E9891',
    fontSize: 9.5,
    marginTop: 3,
    fontWeight: '700',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  slotActiveSessionRow: {
    marginTop: 2,
  },
  slotActiveSessionText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  slotActiveSessionTextActive: {
    color: '#FFFFFF',
  },
  slotActiveSessionTextOpen: {
    color: '#FFFFFF',
  },

  /* ========================================================= */
  /* DYNAMIC PEOPLE IN ROOM TELEMETRY BOX                      */
  /* ========================================================= */
  autoPeopleBox: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  autoPeopleBoxReserved: {
    backgroundColor: '#240C10',
    borderColor: '#7D1D22',
  },
  autoPeopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPeopleVal: {
    color: '#F6F2EB',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  autoPeopleValReserved: {
    color: '#F87171',
  },
  autoTag: {
    backgroundColor: '#1E1E26',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  autoTagText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  autoTagReserved: {
    backgroundColor: '#350E14',
    borderColor: '#EF4444',
  },
  autoTagTextReserved: {
    color: '#F87171',
  },
  autoPeopleSub: {
    color: '#9E9891',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* MEETING SESSION CONFIG                                    */
  /* ========================================================= */
  meetingConfigBox: {
    gap: 12,
    marginBottom: 26,
  },
  meetingContextCard: {
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.42)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.75), 0 3px 10px rgba(0, 0, 0, 0.45)',
      },
      default: {},
    }),
  },
  meetingContextInput: {
    backgroundColor: '#0A0A0E',
    borderWidth: 1,
    borderColor: '#383842',
    borderRadius: 6,
    color: '#FAF6EE',
    fontSize: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 8,
    fontWeight: '700',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  meetingContextHelper: {
    color: '#9E9891',
    fontSize: 10,
    marginTop: 6,
    fontStyle: 'italic',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  meetingInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  meetingInputCol: {
    flex: 1,
  },
  meetingSmallInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingSmallInput: {
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    borderColor: '#261C20',
    borderRadius: 6,
    color: '#F6F2EB',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    width: 60,
    height: 38,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  meetingInputLimitTag: {
    color: '#8A8580',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },

  /* ========================================================= */
  /* CONFIRM RESERVATION BUTTON (LOCK IN TIME FADED GREEN)     */
  /* ========================================================= */
  confirmBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(176, 218, 48, 0.50)',
    backgroundColor: 'rgba(176, 218, 48, 0.05)',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 18,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
    borderColor: 'rgba(176, 218, 48, 0.25)',
    backgroundColor: 'rgba(176, 218, 48, 0.03)',
  },
  confirmBtnText: {
    color: '#F6F2EB',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* ========================================================= */
  /* SUCCESS PASS                                              */
  /* ========================================================= */
  ticketCard: {
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  bookingId: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#240C10',
    borderWidth: 1,
    borderColor: '#7D1D22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ticketBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  ticketTitle: {
    color: '#F6F2EB',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  ticketSession: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 14,
  },
  ticketGrid: {
    width: '100%',
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    borderColor: '#261C20',
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
  },
  ticketField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketLabel: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ticketVal: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '700',
  },
  pushNote: {
    color: '#9E9891',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 14,
  },
  doneBtn: {
    borderWidth: 1.5,
    borderColor: '#10B981',
    backgroundColor: '#0E2416',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#F6F2EB',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
