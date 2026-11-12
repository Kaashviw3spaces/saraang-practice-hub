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
import { SoundwaveSvg } from '../components/SoundwaveSvg';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { LightningSvg } from '../components/LightningSvg';
import { EqualizerBars } from '../components/EqualizerBars';

const getFreqColor = (band?: string) => {
  const b = (band || '').toUpperCase();
  if (b.includes('LOW') || b.includes('SUB') || b.includes('BASS')) return '#EF4444';
  if (b.includes('HI') || b.includes('TREBLE')) return '#00E5FF';
  return '#F59E0B';
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
    stepFade.setValue(0.25);
    stepSlide.setValue(14);
    Animated.parallel([
      Animated.timing(stepFade, {
        toValue: 1,
        duration: 220,
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
  }, [wizard.step]);

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
        'Solo practice requires an empty room with no other musicians. This slot already has active musicians playing collaborative practice. Please select an empty slot or choose Collaborative Practice.'
      );
      return;
    }

    if (isFullBandA && selectedSlot && ((selectedSlot.current_participants || 0) > 0 || !selectedSlot.is_available)) {
      Alert.alert(
        'Full Band Rehearsal Exclusivity',
        'Full Band Rehearsal reserves the entire sound room exclusively for your band. This slot already has active musicians or is reserved. Please select an empty available slot.'
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

  // Success Ticket View: VIP Backstage Laminate Pass
  if (successBooking) {
    const isRecordingSuccess = (successBooking.session_name || '').toUpperCase().includes('RECORDING');
    const isMeetingSuccess = (successBooking.session_name || '').toUpperCase().includes('MEETING');
    const sName = (successBooking.session_name || '').toUpperCase();
    const passWatermark = sName.includes('SESSION A')
      ? require('../../assets/band6.jpg')
      : sName.includes('SESSION B')
      ? require('../../assets/band1.jpg')
      : sName.includes('RECORDING')
      ? require('../../assets/band3.jpg')
      : isMeetingSuccess
      ? require('../../assets/band2.jpg')
      : require('../../assets/band4.avif');

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
          {/* Subtle Room Texture */}
          <RockTextureOverlay pattern="mesh" opacity={0.06} />

          {/* Authentic Rock Band Watermark */}
          <Image
            source={passWatermark}
            style={styles.ticketWatermark}
            resizeMode="cover"
          />

          {/* Lanyard Hole / VIP Header Stamp */}
          <View style={styles.ticketLanyardSlot}>
            <View style={styles.ticketHole} />
            <LightningSvg color="#FFFFFF" size={13} style={{ marginRight: 6 }} />
            <Text style={styles.ticketLanyardText}>★ ALL ACCESS BACKSTAGE PASS ★</Text>
          </View>

          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>RESERVATION CONFIRMED</Text>
          </View>

          <Text style={styles.ticketTitle}>PASS #{successBooking.id}</Text>
          <Text style={styles.ticketSession}>
            {isRecordingSuccess
              ? `Booking Confirmed! Your ${successBooking.session_name} studio recording slot is locked in.`
              : isMeetingSuccess
              ? `Booking Confirmed! Your ${successBooking.session_name} slot is locked in.`
              : (successBooking.practice_mode || '').toUpperCase().includes('FULL BAND')
              ? `Booking Confirmed! Your ${successBooking.session_name} Full Band Rehearsal is locked in.`
              : `Booking Confirmed! Your ${successBooking.session_name} rehearsal slot is locked in.`}
          </Text>

          {/* Metallica & Arctic Monkeys dual-channel Soundwave */}
          <View style={styles.ticketSoundwaveWrap}>
            <SoundwaveSvg
              color="#EF4444"
              secondaryColor="#00E5FF"
              height={22}
              variant="metallica"
            />
          </View>

          <View style={styles.ticketGrid}>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>ROOM / SESSION:</Text>
              <Text style={[styles.ticketVal, { color: '#00E5FF' }]}>{successBooking.session_name.toUpperCase()}</Text>
            </View>
            {successBooking.practice_mode ? (
              <View style={styles.ticketField}>
                <Text style={styles.ticketLabel}>
                  {isMeetingSuccess ? 'CONTEXT:' : 'PRACTICE MODE:'}
                </Text>
                <Text style={[styles.ticketVal, { color: '#FFFFFF' }]}>{successBooking.practice_mode.toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>DATE:</Text>
              <Text style={styles.ticketVal}>{successBooking.booking_date}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>TIME WINDOW:</Text>
              <Text style={styles.ticketVal}>{successBooking.start_time} - {successBooking.end_time}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>
                {isMeetingSuccess ? 'PARTICIPANTS:' : 'PEOPLE PLAYING:'}
              </Text>
              <Text style={styles.ticketVal}>
                {successBooking.participant_count} {successBooking.participant_count === 1 ? 'PERSON' : 'PEOPLE'}
              </Text>
            </View>
          </View>

          <View style={styles.ticketPerforatedLine} />

          <Text style={styles.pushNote}>
            🔔 Automatic FCM session reminders active at 45m and 60m marks.
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
              <LightningSvg color="#0D0D10" size={15} style={{ marginRight: 6 }} />
              <Text style={styles.doneBtnText}>VIEW MY BOOKINGS →</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Studio Header Console with Rock Progress Indicators */}
      <View style={styles.heroConsole}>
        <RockTextureOverlay pattern="mesh" opacity={0.06} />

        {/* Dual-step Rock Progress Pills */}
        <View style={styles.progressRow}>
          <TouchableOpacity
            style={[
              styles.progressStepPill,
              wizard.step === 1 ? styles.progressStepPillActive : styles.progressStepPillDone,
            ]}
            onPress={() => setWizardStep(1)}
            activeOpacity={0.8}
          >
            <LightningSvg
              color={wizard.step === 1 ? '#0D0D10' : '#10B981'}
              size={11}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.progressStepText,
                wizard.step === 1 ? styles.progressStepTextActive : styles.progressStepTextDone,
              ]}
            >
              01 // ROOM
            </Text>
          </TouchableOpacity>

          <View style={styles.progressStepDivider} />

          <View
            style={[
              styles.progressStepPill,
              wizard.step === 2 ? styles.progressStepPillActive : styles.progressStepPillPending,
            ]}
          >
            <LightningSvg
              color={wizard.step === 2 ? '#0D0D10' : '#6A6560'}
              size={11}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.progressStepText,
                wizard.step === 2 ? styles.progressStepTextActive : styles.progressStepTextPending,
              ]}
            >
              02 // RIG & TIME
            </Text>
          </View>
        </View>

        {/* Header Title with Soundwave Equalizer */}
        <View style={styles.consoleTitleRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.consoleTitle}>
              {wizard.selectedSession?.name?.toUpperCase().includes('RECORDING')
                ? 'RECORDING STUDIO BOOKING'
                : 'REHEARSAL ROOM BOOKING'}
            </Text>
            <Text style={styles.consoleSubtitle}>
              {wizard.step === 1
                ? 'SELECT A ROOM TO CONFIGURE YOUR SESSION'
                : 'CALIBRATE YOUR RIG, LOCK IN TIME & CONFIRM YOUR SLOT'}
            </Text>
          </View>
          <EqualizerBars active={true} color="#EF4444" size={14} />
        </View>

        {/* Mini soundwave divider */}
        <View style={styles.consoleSoundwaveWrap}>
          <SoundwaveSvg color="#EF4444" secondaryColor="#38BDF8" height={16} variant="metallica" />
        </View>
      </View>

      {/* ========================================================= */}
      {/* STEP 2A: SESSION SELECTION                                 */}
      {/* ========================================================= */}
      {wizard.step === 1 && (
        <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepSlide }] }}>
          <View style={styles.carouselHintBar}>
            <Text style={styles.carouselHintText}>◀ SWIPE ROOMS • TAP CARD TO CONFIGURE ▶</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={326}
            contentContainerStyle={styles.horizontalCarouselContent}
          >
            {sessionTypes.map((session, index) => (
              <SessionCard
                key={session.id}
                session={session}
                roomNumber={`0${index + 1}`}
                isSelected={wizard.selectedSession?.id === session.id}
                onBookSlot={() => selectSession(session)}
              />
            ))}
          </ScrollView>
        </Animated.View>
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

        return (
          <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepSlide }] }}>
            {/* Selected Session Channel Rack Banner */}
            <View style={styles.selectedSessionPill}>
              <RockTextureOverlay pattern="grooves" opacity={0.06} />
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.pillValue}>{wizard.selectedSession.name.toUpperCase()}</Text>
                <Text style={styles.rackSessionMeta}>
                  CAPACITY // UP TO {effectiveParticipantLimit} MUSICIANS
                </Text>
              </View>
              <AnimatedPressable style={styles.changeBtn} onPress={() => setWizardStep(1)} scaleTo={0.95}>
                <Text style={styles.changeBtnText}>CHANGE ↻</Text>
              </AnimatedPressable>
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
                      <AnimatedPressable
                        key={mode}
                        style={[styles.modeBtn, isSelected && styles.modeBtnSelected]}
                        onPress={() => setPracticeMode(mode)}
                        scaleTo={0.96}
                      >
                        <View style={styles.modeBtnContent}>
                          {isSelected && (
                            <LightningSvg color="#FFFFFF" size={11} style={{ marginRight: 6 }} />
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
                  <Text style={styles.policyTitle}>📋 MEETING SESSION</Text>
                  <Text style={styles.policyText}>
                    Standard reservation for music club meetings, setlists, and production planning. No musical instruments required.
                  </Text>
                </View>

                {/* Meeting Context Input */}
                <View style={styles.meetingContextCard}>
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
                  <Text style={styles.policyTitle}>🥁 SESSION A FULL BAND REHEARSAL</Text>
                  <Text style={styles.policyText}>
                    Full Band Rehearsal reserves the entire sound room exclusively for your band (up to 11 musicians). Select date and 1-hour time slot, and manually enter your band's participant count below. No individual instrument selection needed. This is not a collaborative practice—the entire room is private and locked so no outside musicians can join your slot.
                  </Text>
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
                        <RockTextureOverlay pattern="dots" opacity={0.04} />
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
                          <View style={[styles.bandTagPill, { borderColor: freqColor }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor }]}>
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
                        <RockTextureOverlay pattern="dots" opacity={0.04} />
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
                          <View style={[styles.bandTagPill, { borderColor: freqColor }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor }]}>
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
                        <RockTextureOverlay pattern="dots" opacity={0.04} />
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
                          <View style={[styles.bandTagPill, { borderColor: freqColor }]}>
                            <Text style={[styles.bandTagPillText, { color: freqColor }]}>
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
                            color={wizard.bookingDate === todayStr ? '#EF4444' : '#8A8580'}
                            size={11}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[styles.quickDateBtnText, wizard.bookingDate === todayStr && styles.quickDateBtnTextSelected]}>
                            TODAY (LIVE)
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
                            color={wizard.bookingDate === tomorrowStr ? '#38BDF8' : '#8A8580'}
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
                                              'Full Band Rehearsal reserves the entire sound room exclusively for your band. This slot already has active musicians or is reserved. Please select an empty available slot.'
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
                            </Animated.View>
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
                      {isMeetingSession
                        ? 'PEOPLE IN MEETING (PARTICIPANTS IN SLOT - MANUAL ENTRY):'
                        : isFullBandA
                        ? 'BAND MEMBERS (PARTICIPANTS IN SLOT - MANUAL ENTRY):'
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
                            <Text style={styles.autoPeopleSub}>
                              {isReserved
                                ? (isFullBandA
                                    ? '⚠️ This slot already has active musicians or is reserved. Full band rehearsal requires an empty room.'
                                    : '⚠️ This slot is already booked for another session. Please select an available slot.')
                                : isFullBandA
                                ? `Enter number of band members manually (1 to ${effectiveParticipantLimit} max). Room reserved exclusively for your band.`
                                : `Type number of attendees manually (1 to ${participantLimit} max)`}
                            </Text>
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
          <AnimatedPressable
            style={[styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled]}
            onPress={handleConfirmReservation}
            disabled={isSubmitting}
            scaleTo={0.98}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0D0D10" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <LightningSvg color="#0D0D10" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>
                  {isRecordingSession
                    ? 'CONFIRM RECORDING RESERVATION'
                    : isFullBandA
                    ? 'CONFIRM FULL BAND RESERVATION'
                    : 'CONFIRM RESERVATION'}
                </Text>
                <LightningSvg color="#0D0D10" size={16} style={{ marginLeft: 8 }} />
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
    paddingBottom: 48,
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
    padding: 20,
  },
  loadingText: {
    color: '#9E9891',
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },

  /* ========================================================= */
  /* STUDIO HERO CONSOLE & PROGRESS STEPPERS                   */
  /* ========================================================= */
  heroConsole: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#262635',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressStepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  progressStepPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  progressStepPillDone: {
    backgroundColor: '#0F291E',
    borderColor: '#10B981',
  },
  progressStepPillPending: {
    backgroundColor: '#1C1C24',
    borderColor: '#2E2E3E',
  },
  progressStepDivider: {
    width: 24,
    height: 1,
    backgroundColor: '#2E2E3E',
    marginHorizontal: 8,
  },
  progressStepText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  progressStepTextActive: {
    color: '#0D0D10',
  },
  progressStepTextDone: {
    color: '#10B981',
  },
  progressStepTextPending: {
    color: '#6A6560',
  },
  consoleTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  consoleTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  consoleSubtitle: {
    color: '#9E9891',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  consoleSoundwaveWrap: {
    width: '100%',
    marginTop: 4,
  },
  carouselHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#262635',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  carouselHintText: {
    color: '#A0A0A0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  /* ========================================================= */
  /* CHANNEL RACK BANNER & ROOM SPECS                          */
  /* ========================================================= */
  selectedSessionPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderLeftWidth: 3.5,
    borderLeftColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  rackLiveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rackLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  pillLabel: {
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  pillValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  rackSessionMeta: {
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  changeBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  changeBtnText: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* ========================================================= */
  /* FORMS & PRACTICE MODES                                    */
  /* ========================================================= */
  formGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  modeBtn: {
    backgroundColor: '#14141A',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  modeBtnSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#1E1E28',
    borderWidth: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modeBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeBtnText: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modeBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  policyCard: {
    backgroundColor: '#161410',
    borderWidth: 1.5,
    borderColor: '#382D18',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  policyTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  policyText: {
    color: '#E0D6C8',
    fontSize: 11,
    lineHeight: 16,
  },
  warningBox: {
    backgroundColor: '#18130E',
    borderWidth: 1.5,
    borderColor: '#4A3312',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#FDE68A',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },

  /* ========================================================= */
  /* JAM & GROUP RECORDING COUNTER BANNERS                     */
  /* ========================================================= */
  jamCounterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131319',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  jamCounterLeft: {
    flex: 1,
  },
  jamCounterLabel: {
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  jamCounterValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  jamCounterBadge: {
    backgroundColor: '#1E1628',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D2A54',
  },
  jamCounterBadgeFull: {
    backgroundColor: '#261218',
    borderColor: '#EF4444',
  },
  jamCounterBadgeText: {
    color: '#C084FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* ========================================================= */
  /* INSTRUMENT CARDS (JAM, GROUP & SOLO)                      */
  /* ========================================================= */
  jamInstrumentCard: {
    width: 250,
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#252538',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  jamInstrumentCardSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#1A1A24',
    borderWidth: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  jamInstrumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jamInstrumentName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
    letterSpacing: 0.5,
  },
  jamInstrumentNameSelected: {
    color: '#FFFFFF',
  },
  bandTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bandTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#0E0E14',
  },
  bandTagPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  soloCategoryText: {
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  selectedCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  unselectedRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#4A4A5A',
  },
  selectedStatusStrip: {
    backgroundColor: '#1C1926',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#383850',
  },
  selectedStatusStripText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Stepper controls */
  jamStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0D12',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#242436',
  },
  jamStepBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#1E1E2A',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333348',
  },
  jamStepBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#141418',
    borderColor: '#202026',
  },
  jamStepBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  jamStepBtnTextDisabled: {
    color: '#555566',
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
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  jamQtyText: {
    color: '#8A8FA0',
    fontSize: 14,
    fontWeight: '800',
  },
  jamQtyTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* Solo instrument cards */
  soloInstrumentCard: {
    width: 240,
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#252538',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  soloInstrumentCardSelected: {
    borderColor: '#EF4444',
    backgroundColor: '#1A1A24',
    borderWidth: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  soloCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  soloInstrumentName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
    marginRight: 6,
    letterSpacing: 0.5,
  },
  soloInstrumentNameSelected: {
    color: '#FFFFFF',
  },

  /* ========================================================= */
  /* DATE & TIME SLOT DROPDOWN                                 */
  /* ========================================================= */
  textInput: {
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.6,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  quickDateRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#242436',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDateBtnTodaySelected: {
    borderColor: '#EF4444',
    backgroundColor: '#1D1216',
    borderWidth: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  quickDateBtnTomorrowSelected: {
    borderColor: '#38BDF8',
    backgroundColor: '#101724',
    borderWidth: 2,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  quickDateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDateBtnText: {
    color: '#8A8FA0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quickDateBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  quickDateBtnTomorrowTextSelected: {
    color: '#38BDF8',
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
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#38BDF8',
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
    color: '#8A8FA0',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  dropdownValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dropdownPlaceholderText: {
    color: '#6A6560',
    fontStyle: 'italic',
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownChevron: {
    color: '#8A8FA0',
    fontSize: 10,
    marginLeft: 4,
  },
  dropdownMenu: {
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#2E3548',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#20202C',
  },
  dropdownItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dropdownItemSelected: {
    backgroundColor: '#1E1418',
  },
  dropdownItemReserved: {
    backgroundColor: '#0F0F12',
    opacity: 0.55,
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dropdownItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dropdownItemTextReserved: {
    color: '#6A6560',
    textDecorationLine: 'line-through',
  },
  dropdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  dropdownBadgeAvailable: {
    backgroundColor: '#0F261C',
    borderColor: '#10B981',
  },
  dropdownBadgeSelected: {
    backgroundColor: '#261217',
    borderColor: '#EF4444',
  },
  dropdownBadgeReserved: {
    backgroundColor: '#181822',
    borderColor: '#2E2E40',
  },
  dropdownBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dropdownBadgeTextAvailable: {
    color: '#10B981',
  },
  dropdownBadgeTextSelected: {
    color: '#EF4444',
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
    fontSize: 12,
    fontStyle: 'italic',
  },
  timeSlotHelper: {
    color: '#8A8FA0',
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.4,
    lineHeight: 15,
  },
  activeSlotCallout: {
    backgroundColor: '#101420',
    borderWidth: 1,
    borderColor: '#1E2B40',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  activeSlotCalloutTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  activeSlotCalloutText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  dropdownSlotInstruments: {
    color: '#8A8FA0',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  slotActiveSessionRow: {
    marginTop: 2,
  },
  slotActiveSessionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  slotActiveSessionTextActive: {
    color: '#FFFFFF',
  },
  slotActiveSessionTextOpen: {
    color: '#8A8FA0',
  },

  /* ========================================================= */
  /* DYNAMIC PEOPLE IN ROOM TELEMETRY BOX                      */
  /* ========================================================= */
  autoPeopleBox: {
    backgroundColor: '#14141B',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  autoPeopleBoxReserved: {
    backgroundColor: '#1C1316',
    borderColor: '#6B2026',
  },
  autoPeopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPeopleVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  autoPeopleValReserved: {
    color: '#FFFFFF',
  },
  autoTag: {
    backgroundColor: '#101A24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#203A50',
  },
  autoTagText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  autoTagReserved: {
    backgroundColor: '#261015',
    borderColor: '#EF4444',
  },
  autoTagTextReserved: {
    color: '#EF4444',
  },
  autoPeopleSub: {
    color: '#8A8FA0',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },

  /* ========================================================= */
  /* MEETING SESSION CONFIG                                    */
  /* ========================================================= */
  meetingConfigBox: {
    gap: 12,
  },
  meetingContextCard: {
    backgroundColor: '#14141A',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#262638',
    padding: 16,
  },
  meetingContextInput: {
    backgroundColor: '#0E0E12',
    borderWidth: 1.5,
    borderColor: '#262638',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  meetingContextHelper: {
    color: '#8A8FA0',
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
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
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    width: 60,
    height: 40,
  },
  meetingInputLimitTag: {
    color: '#8A8580',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ========================================================= */
  /* CONFIRM RESERVATION BUTTON                                */
  /* ========================================================= */
  confirmBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: '#262635',
    borderColor: '#3A3A4E',
  },
  confirmBtnText: {
    color: '#0D0D10',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* ========================================================= */
  /* SUCCESS PASS LAMINATE TICKET                              */
  /* ========================================================= */
  ticketCard: {
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#82191F',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#82191F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  ticketWatermark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '60%',
    opacity: 0.12,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  ticketLanyardSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#240C10',
    borderWidth: 1,
    borderColor: '#7D1D22',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 14,
  },
  ticketHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D0D10',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#7D1D22',
  },
  ticketLanyardText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  ticketBadge: {
    backgroundColor: '#200B0E',
    borderWidth: 1,
    borderColor: '#7D1D22',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  ticketBadgeText: {
    color: '#F6F2EB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ticketTitle: {
    color: '#F6F2EB',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  ticketSession: {
    color: '#9E9891',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  ticketSoundwaveWrap: {
    width: '100%',
    marginVertical: 10,
    paddingVertical: 4,
  },
  ticketGrid: {
    width: '100%',
    backgroundColor: '#0D0D10',
    borderWidth: 1.5,
    borderColor: '#262635',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
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
    fontSize: 12,
    fontWeight: '800',
  },
  ticketPerforatedLine: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: '#3D1C24',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  ticketDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#262635',
    marginBottom: 14,
  },
  pushNote: {
    color: '#9E9891',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  doneBtn: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: {
    color: '#0D0D10',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
