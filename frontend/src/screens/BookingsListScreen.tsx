import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { api, BookingResponse } from '../api/client';
import { useStore } from '../store/useStore';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { LightningSvg } from '../components/LightningSvg';

interface BookingsListScreenProps {
  onNavigateToWizard: () => void;
}

export const BookingsListScreen: React.FC<BookingsListScreenProps> = ({ onNavigateToWizard }) => {
  const { currentUser, userBookings, setUserBookings, showNotification } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const quotaAnim = useRef(new Animated.Value(0)).current;

  const todayStr = new Date().toISOString().split('T')[0];
  const activeTodayCount = userBookings.filter(
    (b) => b.booking_date === todayStr && b.status !== 'Cancelled'
  ).length;

  useEffect(() => {
    Animated.timing(quotaAnim, {
      toValue: Math.min(100, (activeTodayCount / 3) * 100),
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeTodayCount, quotaAnim]);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await api.getUserBookings(currentUser.id);
      setUserBookings(data);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id, setUserBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = (booking: BookingResponse) => {
    Alert.alert(
      'Cancel Reservation',
      `Are you sure you want to cancel booking #${booking.id} (${booking.session_name})? This slot will immediately become available to other club members.`,
      [
        { text: 'Keep Reservation', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.id);
            try {
              await api.cancelBooking(booking.id);
              showNotification({
                title: 'RESERVATION CANCELLED',
                message: `Booking #${booking.id} was successfully cancelled.`,
                type: 'warning',
              });
              fetchBookings();
            } catch (err: any) {
              Alert.alert('Cancellation Error', err.response?.data?.detail || 'Failed to cancel booking.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchBookings();
          }}
          tintColor="#FFFFFF"
        />
      }
    >
      {/* Header */}
      <View style={styles.headerBox}>
        <Text style={styles.headerSubtitle}>PASSES & ACTIVE WINDOWS</Text>
        <Text style={styles.headerTitle}>MY REHEARSALS</Text>

        {/* Quota Indicator Banner */}
        <View style={styles.quotaBanner}>
          <View style={styles.quotaRow}>
            <Text style={styles.quotaTitle}>DAILY BOOKING LIMIT (RULE 1):</Text>
            <Text
              style={[
                styles.quotaNum,
                activeTodayCount >= 3 ? styles.quotaDanger : styles.quotaSafe,
              ]}
            >
              {activeTodayCount} / 3 ACTIVE TODAY
            </Text>
          </View>
          <View style={styles.quotaTrack}>
            <Animated.View
              style={[
                styles.quotaFill,
                {
                  width: quotaAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
                activeTodayCount >= 3
                  ? styles.fillDanger
                  : activeTodayCount === 2
                  ? styles.fillWarning
                  : styles.fillSafe,
              ]}
            />
          </View>
        </View>
      </View>

      {/* Bookings List */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#00E5FF" />
        </View>
      ) : userBookings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>NO ACTIVE RESERVATIONS</Text>
          <Text style={styles.emptyText}>
            You have not booked any rehearsal sessions. Browse available sessions and lock in your window.
          </Text>
          <AnimatedPressable style={styles.bookEmptyBtn} onPress={onNavigateToWizard} scaleTo={0.96}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LightningSvg color="#0D0D10" size={14} style={{ marginRight: 6 }} />
              <Text style={styles.bookEmptyBtnText}>BOOK REHEARSAL SLOT</Text>
            </View>
          </AnimatedPressable>
        </View>
      ) : (
        userBookings.map((b) => {
          const isCancelled = b.status === 'Cancelled';
          const isConfirmed = b.status === 'Confirmed';

          return (
            <View key={b.id} style={[styles.bookingCard, isCancelled && styles.cancelledCard]}>
              <RockTextureOverlay pattern="mesh" opacity={isConfirmed ? 0.06 : 0.03} />

              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.bookingId}>PASS #{b.id}</Text>
                  <Text style={styles.bookingSessionTitle}>{b.session_name.toUpperCase()}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isConfirmed && styles.confirmedBadge,
                    isCancelled && styles.cancelledBadge,
                  ]}
                >
                  {isConfirmed && <LightningSvg color="#FFFFFF" size={10} style={{ marginRight: 4 }} />}
                  <Text
                    style={[
                      styles.statusText,
                      isConfirmed && styles.confirmedText,
                      isCancelled && styles.cancelledText,
                    ]}
                  >
                    {isConfirmed ? '★ ALL ACCESS PASS' : b.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ROOM // SESSION:</Text>
                  <Text style={styles.detailVal}>{b.session_name}</Text>
                </View>
                {b.practice_mode ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {(b.session_name || '').toUpperCase().includes('MEETING') ? 'CONTEXT:' : 'MODE:'}
                    </Text>
                    <Text style={styles.detailVal}>{b.practice_mode}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DATE:</Text>
                  <Text style={styles.detailVal}>{b.booking_date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>WINDOW:</Text>
                  <Text style={styles.detailVal}>
                    {b.start_time} - {b.end_time}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {(b.session_name || '').toUpperCase().includes('MEETING') ? 'PARTICIPANTS:' : 'PEOPLE PLAYING:'}
                  </Text>
                  <Text style={styles.detailVal}>
                    {b.participant_count} {b.participant_count === 1 ? 'Person' : 'People'}
                  </Text>
                </View>
              </View>

              {isConfirmed && (
                <AnimatedPressable
                  style={styles.cancelBtn}
                  onPress={() => handleCancelBooking(b)}
                  disabled={cancellingId === b.id}
                  scaleTo={0.97}
                >
                  {cancellingId === b.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.cancelBtnText}>CANCEL RESERVATION</Text>
                  )}
                </AnimatedPressable>
              )}
            </View>
          );
        })
      )}
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
  headerBox: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#27272A',
    paddingBottom: 12,
  },
  headerSubtitle: {
    color: '#C8E676',
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
  quotaBanner: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 14,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaTitle: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quotaNum: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  quotaSafe: {
    color: '#F6F2EB',
  },
  quotaDanger: {
    color: '#F87171',
  },
  quotaTrack: {
    height: 4,
    backgroundColor: '#0D0D10',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#261C20',
  },
  quotaFill: {
    height: '100%',
  },
  fillSafe: {
    backgroundColor: '#10B981',
  },
  fillWarning: {
    backgroundColor: '#FBBF24',
  },
  fillDanger: {
    backgroundColor: '#EF4444',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyBox: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#F6F2EB',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  emptyText: {
    color: '#9E9891',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  bookEmptyBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  bookEmptyBtnText: {
    color: '#0D0D10',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bookingCard: {
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cancelledCard: {
    opacity: 0.45,
    borderColor: '#1D1D22',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bookingId: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
    marginBottom: 2,
  },
  bookingSessionTitle: {
    color: '#F6F2EB',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E26',
    borderColor: '#4A4A5A',
  },
  cancelledBadge: {
    backgroundColor: '#0D0D10',
    borderColor: '#261C20',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  confirmedText: {
    color: '#FFFFFF',
  },
  cancelledText: {
    color: '#6A6560',
  },
  detailsGrid: {
    backgroundColor: '#0D0D10',
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#261C20',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  detailLabel: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailVal: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    backgroundColor: '#240C10',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
