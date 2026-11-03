import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { api, LiveRoom } from '../api/client';
import { useStore } from '../store/useStore';
import { RoomCard } from '../components/RoomCard';

interface DashboardScreenProps {
  onNavigateToBooking: (roomId?: number) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToBooking }) => {
  const { liveRooms, setLiveRooms, currentUser, selectRoom, setWizardStep } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);

  const fetchRooms = useCallback(async () => {
    try {
      const rooms = await api.getLiveRooms();
      setLiveRooms(rooms);

      // Fetch user's bookings today to display quota
      const bookings = await api.getUserBookings(currentUser.id);
      const todayStr = new Date().toISOString().split('T')[0];
      const count = bookings.filter((b) => b.booking_date === todayStr && b.status !== 'Cancelled').length;
      setTodayBookingsCount(count);
    } catch (err) {
      console.error('Failed to poll live rooms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id, setLiveRooms]);

  useEffect(() => {
    fetchRooms();

    // Step 1 Requirement: Poll GET /api/rooms/live every 30 seconds
    const interval = setInterval(() => {
      fetchRooms();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleBookRoom = (room: LiveRoom) => {
    selectRoom(room.id);
    onNavigateToBooking(room.id);
  };

  const occupiedCount = liveRooms.filter((r) => r.is_occupied).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} tintColor="#e8c872" />
      }
    >
      {/* Top Banner with Rock Stencil Aesthetic */}
      <View style={styles.heroSection}>
        <View style={styles.liveHeaderRow}>
          <Text style={styles.liveIndicator}>((•)) LIVE NOW PLAYING</Text>
          <Text style={styles.pollTag}>POLLING: 30S</Text>
        </View>
        <Text style={styles.heroTitle}>STAGE TELEMETRY</Text>
        <Text style={styles.heroSubtitle}>
          REAL-TIME ACOUSTIC MONITORING AND ROOM OCCUPANCY DASHBOARD.
        </Text>

        {/* Status Quota Bar */}
        <View style={styles.quotaBar}>
          <View style={styles.quotaItem}>
            <Text style={styles.quotaLabel}>ACTIVE SESSIONS</Text>
            <Text style={styles.quotaValue}>{occupiedCount} / {liveRooms.length} ROOMS</Text>
          </View>
          <View style={styles.quotaDivider} />
          <View style={styles.quotaItem}>
            <Text style={styles.quotaLabel}>DAILY QUOTA</Text>
            <Text style={[styles.quotaValue, todayBookingsCount >= 3 ? styles.quotaDanger : styles.quotaSafe]}>
              {todayBookingsCount} / 3 BOOKED TODAY
            </Text>
          </View>
        </View>
      </View>

      {/* Room Cards List */}
      <View style={styles.roomsList}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ROOMS & ACOUSTIC CEILINGS</Text>
          <TouchableOpacity onPress={() => onNavigateToBooking()}>
            <Text style={styles.newBookingLink}>+ BOOK NEW SLOT</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#e8c872" />
            <Text style={styles.loadingText}>CALIBRATING ACOUSTIC SENSORS...</Text>
          </View>
        ) : (
          liveRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onBookNow={handleBookRoom}
            />
          ))
        )}
      </View>
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
  heroSection: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 8,
    padding: 18,
    marginBottom: 20,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    color: '#e05a47',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pollTag: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  heroTitle: {
    color: '#f4ede4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 16,
    marginBottom: 16,
  },
  quotaBar: {
    flexDirection: 'row',
    backgroundColor: '#1b1b1b',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  quotaItem: {
    flex: 1,
  },
  quotaLabel: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  quotaValue: {
    color: '#f4ede4',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  quotaSafe: {
    color: '#52b79a',
  },
  quotaDanger: {
    color: '#e05a47',
  },
  quotaDivider: {
    width: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 12,
  },
  roomsList: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#e8c872',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  newBookingLink: {
    color: '#f7f4ea',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 12,
  },
});
