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
import { api, SessionType, Instrument, LiveRoom } from '../api/client';
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
    selectRoom,
    setBookingDateTime,
    setParticipantCount,
    setInstrumentQuantity,
    setAcousticPreview,
    setIsCheckingAcoustics,
    openRejectionModal,
    closeRejectionModal,
    resetWizard,
    currentUser,
    liveRooms,
    setLiveRooms,
    showNotification,
  } = useStore();

  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBooking, setSuccessBooking] = useState<any>(null);

  // Load catalogues
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [st, inst, rooms] = await Promise.all([
          api.getSessionTypes(),
          api.getInstruments(),
          api.getLiveRooms(),
        ]);
        setSessionTypes(st);
        setInstruments(inst);
        setLiveRooms(rooms);
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
    if (!wizard.selectedSession || !wizard.selectedRoomId) return;

    const selectedInstrumentsList = Object.entries(wizard.instruments).map(([id, qty]) => ({
      instrument_id: parseInt(id, 10),
      quantity: qty,
    }));

    try {
      setIsCheckingAcoustics(true);
      const res = await api.checkAcoustics({
        room_id: wizard.selectedRoomId,
        session_type_id: wizard.selectedSession.id,
        instruments: selectedInstrumentsList,
      });
      setAcousticPreview(res);
    } catch (err) {
      console.error('Acoustic dry-run failed:', err);
    } finally {
      setIsCheckingAcoustics(false);
    }
  }, [wizard.selectedSession, wizard.selectedRoomId, wizard.instruments]);

  useEffect(() => {
    if (wizard.step === 2) {
      const timer = setTimeout(() => {
        runAcousticCheck();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [wizard.step, wizard.instruments, wizard.selectedRoomId, runAcousticCheck]);

  // Step 2C: Submission & AI Rejection Handling
  const handleConfirmReservation = async () => {
    if (!wizard.selectedSession || !wizard.selectedRoomId) return;

    // Calculate end time based on duration
    const startHour = parseInt(wizard.startTime.split(':')[0], 10);
    const endHour = startHour + Math.floor(wizard.durationMinutes / 60);
    const endMinutes = wizard.startTime.split(':')[1] || '00';
    const formattedEndTime = `${String(endHour).padStart(2, '0')}:${endMinutes}:00`;

    const selectedInstrumentsList = Object.entries(wizard.instruments).map(([id, qty]) => ({
      instrument_id: parseInt(id, 10),
      quantity: qty,
    }));

    const payload = {
      user_id: currentUser.id,
      room_id: wizard.selectedRoomId,
      session_type_id: wizard.selectedSession.id,
      booking_date: wizard.bookingDate,
      start_time: wizard.startTime,
      end_time: formattedEndTime,
      participant_count: wizard.participantCount,
      instruments: selectedInstrumentsList,
    };

    setIsSubmitting(true);
    try {
      const res = await api.createBooking(payload);
      setSuccessBooking(res);
      showNotification({
        title: 'RESERVATION CONFIRMED',
        message: `Your booking #${res.id} for ${res.room_name} (${res.start_time}-${res.end_time}) has been confirmed!`,
        type: 'success',
      });
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 400 && detail) {
        // Step 2C Requirement: Check for Acoustic AI Rejection
        if (typeof detail === 'object' && detail.ai_acoustics) {
          openRejectionModal(detail.ai_acoustics.reason, detail.ai_acoustics);
        } else if (typeof detail === 'string') {
          // Concurrency overlap or Daily Limit 3/day violation
          Alert.alert('Booking Error', detail);
        } else {
          Alert.alert('Booking Error', detail.message || 'Booking request failed.');
        }
      } else {
        Alert.alert('Error', err.response?.data?.detail || 'An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoom = liveRooms.find((r) => r.id === wizard.selectedRoomId) || liveRooms[0];

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
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.ticketCard}>
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>RESERVATION CONFIRMED</Text>
          </View>
          <Text style={styles.ticketTitle}>PASS #{successBooking.id}</Text>
          <Text style={styles.ticketRoom}>{successBooking.room_name}</Text>

          <View style={styles.ticketGrid}>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>SESSION:</Text>
              <Text style={styles.ticketVal}>{successBooking.session_name}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>DATE:</Text>
              <Text style={styles.ticketVal}>{successBooking.booking_date}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>WINDOW:</Text>
              <Text style={styles.ticketVal}>{successBooking.start_time} - {successBooking.end_time}</Text>
            </View>
            <View style={styles.ticketField}>
              <Text style={styles.ticketLabel}>PARTICIPANTS:</Text>
              <Text style={styles.ticketVal}>{successBooking.participant_count}</Text>
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
        <Text style={styles.stepTitle}>BOOK REHEARSAL SLOT</Text>
        <Text style={styles.stepDesc}>
          CHECK YOUR SETUP, SELECT SLOT, AND LOCK IN YOUR REHEARSAL WINDOW WITH AUTOMATED CONFLICT CHECKS.
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
      {/* STEP 2B: INSTRUMENT SELECTION & TIME CONFIGURATION         */}
      {/* ========================================================= */}
      {wizard.step === 2 && wizard.selectedSession && (
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

          {/* Room Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>ROOM SELECTION:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroller}>
              {liveRooms.map((room) => {
                const isSelected = wizard.selectedRoomId === room.id;
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomPill, isSelected && styles.roomPillSelected]}
                    onPress={() => selectRoom(room.id)}
                  >
                    <Text style={[styles.roomPillName, isSelected && styles.roomPillTextSelected]}>
                      {room.name}
                    </Text>
                    <Text style={styles.roomPillMeta}>
                      MAX {room.max_decibel_threshold} dB • ECHO {room.echo_factor}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Live Acoustic AI Preview Bar */}
          <View style={styles.aiPreviewBox}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>⚡ ACOUSTIC AI REAL-TIME PREVIEW</Text>
              {wizard.isCheckingAcoustics && <ActivityIndicator size="small" color="#e8c872" />}
            </View>

            {wizard.acousticPreview ? (
              <View>
                <View style={styles.previewStats}>
                  <Text style={styles.statItem}>
                    LEVEL:{' '}
                    <Text
                      style={[
                        styles.statVal,
                        wizard.acousticPreview.compatible ? styles.statSafe : styles.statDanger,
                      ]}
                    >
                      {wizard.acousticPreview.effective_decibels.toFixed(1)} dB
                    </Text>
                  </Text>
                  <Text style={styles.statItem}>
                    ROOM CEILING: <Text style={styles.statVal}>{wizard.acousticPreview.max_allowed_decibels} dB</Text>
                  </Text>
                </View>

                {wizard.acousticPreview.warnings.length > 0 && (
                  <Text style={styles.previewWarn}>
                    ⚠️ {wizard.acousticPreview.warnings[0]}
                  </Text>
                )}
                {!wizard.acousticPreview.compatible && (
                  <Text style={styles.previewFail}>
                    ❌ Rejection predicted: {wizard.acousticPreview.rejection_reasons[0]}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.previewPlaceholder}>Add instruments below to calculate projected acoustic noise.</Text>
            )}
          </View>

          {/* Step 2B: Searchable pre-filtered Instrument Grid */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>INSTRUMENTS SETUP (PRE-FILTERED):</Text>
            <InstrumentGrid
              instruments={instruments}
              sessionName={wizard.selectedSession.name}
              selectedQuantities={wizard.instruments}
              onQuantityChange={setInstrumentQuantity}
            />
          </View>

          {/* Date, Time & Participants Form */}
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.textInput}
                value={wizard.bookingDate}
                onChangeText={(val) => setBookingDateTime(val, wizard.startTime, wizard.durationMinutes)}
                placeholder="2026-11-04"
                placeholderTextColor="#666666"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>START TIME:</Text>
              <TextInput
                style={styles.textInput}
                value={wizard.startTime}
                onChangeText={(val) => setBookingDateTime(wizard.bookingDate, val, wizard.durationMinutes)}
                placeholder="16:00:00"
                placeholderTextColor="#666666"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.fieldLabel}>DURATION:</Text>
              <View style={styles.durationRow}>
                {[60, 120].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.durationBtn, wizard.durationMinutes === mins && styles.durationBtnSelected]}
                    onPress={() => setBookingDateTime(wizard.bookingDate, wizard.startTime, mins)}
                  >
                    <Text
                      style={[
                        styles.durationBtnText,
                        wizard.durationMinutes === mins && styles.durationBtnTextSelected,
                      ]}
                    >
                      {mins} MINS
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.fieldLabel}>
                PARTICIPANTS (MAX {wizard.selectedSession.participant_limit}):
              </Text>
              <TextInput
                style={styles.textInput}
                value={String(wizard.participantCount)}
                keyboardType="numeric"
                onChangeText={(val) => setParticipantCount(parseInt(val, 10) || 1)}
              />
            </View>
          </View>

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
              <Text style={styles.confirmBtnText}>CONFIRM RESERVATION →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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
  roomScroller: {
    flexDirection: 'row',
  },
  roomPill: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 6,
    padding: 12,
    marginRight: 10,
    minWidth: 140,
  },
  roomPillSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1c1913',
  },
  roomPillName: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  roomPillTextSelected: {
    color: '#e8c872',
  },
  roomPillMeta: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '600',
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
  ticketRoom: {
    color: '#e8c872',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 20,
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
});
