import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { api, BookingResponse } from '../api/client';
import { useStore } from '../store/useStore';

interface BookingsListScreenProps {
  onNavigateToWizard: () => void;
}

export const BookingsListScreen: React.FC<BookingsListScreenProps> = ({ onNavigateToWizard }) => {
  const { currentUser, userBookings, setUserBookings, showNotification } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

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
      `Are you sure you want to cancel booking #${booking.id} for ${booking.room_name}? This slot will immediately become available to other club members.`,
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

  const todayStr = new Date().toISOString().split('T')[0];
  const activeTodayCount = userBookings.filter(
    (b) => b.booking_date === todayStr && b.status !== 'Cancelled'
  ).length;

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
          tintColor="#e8c872"
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
            <View
              style={[
                styles.quotaFill,
                { width: `${Math.min(100, (activeTodayCount / 3) * 100)}%` },
                activeTodayCount >= 3 ? styles.fillDanger : styles.fillSafe,
              ]}
            />
          </View>
        </View>
      </View>

      {/* Bookings List */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#e8c872" />
        </View>
      ) : userBookings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>NO ACTIVE RESERVATIONS</Text>
          <Text style={styles.emptyText}>
            You have not booked any studio sessions. Browse stage openings and lock in your window.
          </Text>
          <TouchableOpacity style={styles.bookEmptyBtn} onPress={onNavigateToWizard}>
            <Text style={styles.bookEmptyBtnText}>+ BOOK REHEARSAL SLOT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        userBookings.map((b) => {
          const isCancelled = b.status === 'Cancelled';
          const isConfirmed = b.status === 'Confirmed';

          return (
            <View key={b.id} style={[styles.bookingCard, isCancelled && styles.cancelledCard]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.bookingId}>PASS #{b.id}</Text>
                  <Text style={styles.bookingRoom}>{b.room_name}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isConfirmed && styles.confirmedBadge,
                    isCancelled && styles.cancelledBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isConfirmed && styles.confirmedText,
                      isCancelled && styles.cancelledText,
                    ]}
                  >
                    {b.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SESSION:</Text>
                  <Text style={styles.detailVal}>{b.session_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DATE:</Text>
                  <Text style={styles.detailVal}>{b.booking_date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TIME:</Text>
                  <Text style={styles.detailVal}>
                    {b.start_time} - {b.end_time}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PARTICIPANTS:</Text>
                  <Text style={styles.detailVal}>{b.participant_count}</Text>
                </View>
              </View>

              {isConfirmed && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.8}
                  onPress={() => handleCancelBooking(b)}
                  disabled={cancellingId === b.id}
                >
                  {cancellingId === b.id ? (
                    <ActivityIndicator size="small" color="#e05a47" />
                  ) : (
                    <Text style={styles.cancelBtnText}>CANCEL RESERVATION</Text>
                  )}
                </TouchableOpacity>
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
    backgroundColor: '#0d0d0d',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 20,
  },
  headerSubtitle: {
    color: '#e05a47',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerTitle: {
    color: '#f4ede4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 14,
  },
  quotaBanner: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    padding: 12,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaTitle: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  quotaNum: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  quotaSafe: {
    color: '#52b79a',
  },
  quotaDanger: {
    color: '#e05a47',
  },
  quotaTrack: {
    height: 4,
    backgroundColor: '#262626',
    borderRadius: 2,
    overflow: 'hidden',
  },
  quotaFill: {
    height: '100%',
  },
  fillSafe: {
    backgroundColor: '#3ddc97',
  },
  fillDanger: {
    backgroundColor: '#e05a47',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyBox: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#f4ede4',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyText: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  bookEmptyBtn: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  bookEmptyBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bookingCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
  },
  cancelledCard: {
    opacity: 0.6,
    borderColor: '#1e1e1e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bookingId: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  bookingRoom: {
    color: '#f4ede4',
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  confirmedBadge: {
    backgroundColor: '#0f241e',
    borderColor: '#255e4e',
  },
  cancelledBadge: {
    backgroundColor: '#201a1a',
    borderColor: '#3a2e2e',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  confirmedText: {
    color: '#52b79a',
  },
  cancelledText: {
    color: '#777777',
  },
  detailsGrid: {
    backgroundColor: '#121212',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailVal: {
    color: '#f4ede4',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#4d2320',
    backgroundColor: '#1a1212',
    paddingVertical: 9,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#e05a47',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
