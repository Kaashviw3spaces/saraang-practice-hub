import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { api, LiveSession } from '../api/client';
import { useStore } from '../store/useStore';
import { LiveSessionCard } from '../components/LiveSessionCard';

interface DashboardScreenProps {
  onNavigateToBooking: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToBooking }) => {
  const { liveSessions, setLiveSessions, currentUser, selectSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      const sessions = await api.getLiveSessions();
      setLiveSessions(sessions);

      // Fetch user's bookings today to display quota
      const bookings = await api.getUserBookings(currentUser.id);
      const todayStr = new Date().toISOString().split('T')[0];
      const count = bookings.filter((b) => b.booking_date === todayStr && b.status !== 'Cancelled').length;
      setTodayBookingsCount(count);
    } catch (err) {
      console.error('Failed to poll live sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id, setLiveSessions]);

  useEffect(() => {
    fetchSessions();

    // Step 1: Poll GET /api/sessions/live every 30 seconds
    const interval = setInterval(() => {
      fetchSessions();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleBookSession = (session: LiveSession) => {
    selectSession({
      id: session.id,
      name: session.name,
      participant_limit: session.participant_limit,
      is_strict_lockdown: session.is_strict_lockdown,
    });
    onNavigateToBooking();
  };

  const activeCount = liveSessions.filter((s) => s.is_occupied).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor="#e8c872" />
      }
    >
      {/* Top Banner with Rock Stencil Aesthetic */}
      <View style={styles.heroSection}>
        <View style={styles.liveHeaderRow}>
          <Text style={styles.liveIndicator}>((•)) LIVE NOW PLAYING</Text>
          <Text style={styles.pollTag}>POLLING: 30S</Text>
        </View>
        <Text style={styles.heroTitle}>REHEARSAL TELEMETRY</Text>
        <Text style={styles.heroSubtitle}>
          REAL-TIME SESSION TELEMETRY & CATEGORY STATUS.
        </Text>

        {/* Status Quota Bar */}
        <View style={styles.quotaBar}>
          <View style={styles.quotaItem}>
            <Text style={styles.quotaLabel}>ACTIVE SESSIONS</Text>
            <Text style={styles.quotaValue}>{activeCount} / {liveSessions.length} SESSIONS</Text>
          </View>
          <View style={styles.quotaDivider} />
          <View style={styles.quotaItem}>
            <Text style={styles.quotaLabel}>DAILY QUOTA</Text>
            <Text style={[styles.quotaValue, todayBookingsCount >= 3 ? styles.quotaDanger : styles.quotaSafe]}>
              {todayBookingsCount} / 3 BOOKED TODAY
            </Text>
          </View>
        </View>

        {/* Primary Booking Action */}
        <TouchableOpacity
          style={styles.heroBookBtn}
          activeOpacity={0.8}
          onPress={onNavigateToBooking}
        >
          <Text style={styles.heroBookBtnText}>⚡ BOOK REHEARSAL SLOT →</Text>
        </TouchableOpacity>
      </View>

      {/* Session Categories List */}
      <View style={styles.sessionsList}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>REHEARSAL SESSION CATEGORIES</Text>
          <TouchableOpacity onPress={onNavigateToBooking}>
            <Text style={styles.newBookingLink}>+ BOOK NEW SLOT</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#e8c872" />
            <Text style={styles.loadingText}>CALIBRATING SESSION TELEMETRY...</Text>
          </View>
        ) : (
          liveSessions.map((session) => (
            <LiveSessionCard
              key={session.id}
              session={session}
              onBookSession={handleBookSession}
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
  heroBookBtn: {
    backgroundColor: '#f7f4ea',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  heroBookBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sessionsList: {
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
