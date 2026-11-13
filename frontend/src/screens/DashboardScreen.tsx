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
  Animated,
  Easing,
} from 'react-native';
import { api, LiveSession } from '../api/client';
import { useStore } from '../store/useStore';
import { LiveSessionCard } from '../components/LiveSessionCard';
import { EqualizerBars } from '../components/EqualizerBars';

interface DashboardScreenProps {
  onNavigateToBooking: () => void;
}

// Staggered Entrance Animation for Room Roster Tickets
const StaggeredCard: React.FC<{ index: number; children: React.ReactNode }> = ({
  index,
  children,
}) => {
  const cardFade = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 320,
        delay: Math.min(index * 50, 200),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 320,
        delay: Math.min(index * 50, 200),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [cardFade, cardSlide, index]);

  return (
    <Animated.View
      style={{
        opacity: cardFade,
        transform: [{ translateY: cardSlide }],
      }}
    >
      {children}
    </Animated.View>
  );
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToBooking }) => {
  const { liveSessions, setLiveSessions, selectSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const sessions = await api.getLiveSessions();
      setLiveSessions(sessions);
    } catch (err) {
      console.error('Failed to poll live sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setLiveSessions]);

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
      {/* Rehearsal Header */}
      <View style={styles.headerBox}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSubtitle}>CLAIM YOUR RIG</Text>
            <Text style={styles.headerTitle}>BOOK YOUR SLOT</Text>
          </View>

          {/* Musical Analog Audio Telemetry Rack Unit */}
          <View style={styles.audioTelemetryBadge}>
            <View style={styles.telemetryTopRow}>
              <EqualizerBars active={true} size={11} color="#B0DA30" />
              <Text style={styles.telemetryTitle}>LIVE REHEARSAL RIG</Text>
            </View>
            <Text style={styles.telemetryFreq}>440 Hz // CONCERT PITCH</Text>
            <Text style={styles.telemetryStats}>INPUT CH-1/2: OK • STEREO FEED</Text>
          </View>
        </View>
      </View>

      {/* Room Roster: Concert Ticket Stub Cards */}
      <View style={styles.sessionsList}>
        <View style={styles.sectionHeader}>
          <View>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>SESSION TYPES</Text>
              <View style={styles.musicNotationPill}>
                <Text style={styles.musicNotationText}>♫ 44.1 kHz</Text>
              </View>
            </View>
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
          liveSessions.map((session, index) => (
            <StaggeredCard key={session.id} index={index}>
              <LiveSessionCard
                session={session}
                onBookSession={handleBookSession}
              />
            </StaggeredCard>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  headerBox: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#27272A',
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  audioTelemetryBadge: {
    backgroundColor: '#161618',
    borderWidth: 1.5,
    borderColor: '#2E2E32',
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  telemetryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  telemetryTitle: {
    color: '#B0DA30',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  telemetryFreq: {
    color: '#EFECE6',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  telemetryStats: {
    color: '#71717A',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  headerSubtitle: {
    color: '#B0DA30',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  musicNotationPill: {
    backgroundColor: 'rgba(176, 218, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(176, 218, 48, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  musicNotationText: {
    color: '#B0DA30',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
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
    backgroundColor: '#C93032',
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
