import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { api, LiveSession } from '../api/client';
import { useStore } from '../store/useStore';
import { LiveSessionCard } from '../components/LiveSessionCard';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { OscilloscopeWaveform } from '../components/OscilloscopeWaveform';
import { HazardTapeDivider } from '../components/HazardTapeDivider';

interface DashboardScreenProps {
  onNavigateToBooking: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToBooking }) => {
  const { liveSessions, setLiveSessions, currentUser, selectSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heroSlide, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroFade, heroSlide]);

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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchSessions();
          }}
          tintColor="#EFECE6"
        />
      }
    >
      {/* Film Grain Texture across Viewport */}
      <RockTextureOverlay pattern="dots" opacity={0.025} />

      {/* Hero Section: "Rehearsal Telemetry" Brutalist Control Panel */}
      <Animated.View
        style={[
          styles.heroSection,
          {
            opacity: heroFade,
            transform: [{ translateY: heroSlide }],
          },
        ]}
      >
        {/* Halftone / Mesh Print Texture */}
        <RockTextureOverlay pattern="mesh" opacity={0.06} />

        {/* Top Control Deck: SYNC indicator */}
        <View style={styles.controlDeckTopBar}>
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>SYNC: 30S</Text>
          </View>
        </View>

        {/* Section Title */}
        <Text style={styles.heroTitle}>REHEARSAL TELEMETRY</Text>
        <Text style={styles.heroSubtitle}>
          REAL-TIME STUDIO MONITORING • ACOUSTIC HEADROOM • CATEGORY STATUS
        </Text>

        {/* Jagged High-Gain Oscilloscope Screen */}
        <OscilloscopeWaveform activeCount={activeCount} totalRooms={liveSessions.length || 5} />
      </Animated.View>

      {/* Section Divider: Ripped Paper Edge Layered Over Diagonal Hazard Stripes */}
      <HazardTapeDivider />

      {/* Room Roster: Concert Ticket Stub Cards */}
      <View style={styles.sessionsList}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>ROOM ROSTER // CONCERT TICKET STUBS</Text>
            <Text style={styles.sectionSubtitle}>SELECT A PERFORATED PASS TO ENTER REHEARSAL</Text>
          </View>
          <TouchableOpacity onPress={onNavigateToBooking} style={styles.quickBookBtn}>
            <Text style={styles.newBookingLink}>+ NEW PASS</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#EFECE6" />
            <Text style={styles.loadingText}>CALIBRATING TELEMETRY...</Text>
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
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  heroSection: {
    backgroundColor: '#1E1E20',
    borderWidth: 3,
    borderColor: '#EFECE6',
    borderRadius: 0,
    padding: 18,
    marginBottom: 4,
    shadowColor: '#FF1E27',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  controlDeckTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncBadge: {
    backgroundColor: '#09090C',
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  syncText: {
    color: '#CCFF00',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  heroTitle: {
    color: '#EFECE6',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
    lineHeight: 30,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#A1A1AA',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 14,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  sessionsList: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#3F3F46',
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#EFECE6',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  sectionSubtitle: {
    color: '#9E9891',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  quickBookBtn: {
    backgroundColor: '#FF1E27',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  newBookingLink: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderWidth: 2,
    borderColor: '#3F3F46',
  },
  loadingText: {
    color: '#EFECE6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 12,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
});
