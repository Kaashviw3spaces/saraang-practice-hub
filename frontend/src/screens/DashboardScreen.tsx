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
        {/* Gritty Noise / Mesh Print Texture */}
        <RockTextureOverlay pattern="grit" opacity={0.05} color="#FFFFFF" />

        {/* Section Title */}
        <View style={styles.heroHeaderWrap}>
          <Text style={styles.heroTitle}>REHEARSAL TELEMETRY</Text>
          <Text style={styles.heroSubtitle}>
            REAL-TIME STUDIO MONITORING • ACOUSTIC HEADROOM • CATEGORY STATUS
          </Text>
        </View>

        {/* Jagged High-Gain Oscilloscope Screen showing Daily Rehearsal Quota */}
        <OscilloscopeWaveform
          activeCount={activeCount}
          totalRooms={liveSessions.length || 5}
          todayBookingsCount={todayBookingsCount}
        />
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
    backgroundColor: '#151518',
    borderWidth: 1.5,
    borderColor: '#2E2E38',
    borderRadius: 2,
    padding: 16,
    marginBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  heroHeaderWrap: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#22222A',
    paddingBottom: 6,
  },
  heroTitle: {
    color: '#EAE6DC',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Oswald", sans-serif',
      default: 'sans-serif',
    }),
    lineHeight: 25,
    marginBottom: 3,
  },
  heroSubtitle: {
    color: '#8A867E',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
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
    backgroundColor: '#222228',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3D3D47',
    borderRadius: 2,
  },
  newBookingLink: {
    color: '#EAE6DC',
    fontSize: 9,
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
