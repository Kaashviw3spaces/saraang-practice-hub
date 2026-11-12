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
import { GarageRockHeadline } from '../components/GarageRockHeadline';

interface DashboardScreenProps {
  onNavigateToBooking: () => void;
}

// Staggered Entrance Animation for Room Roster Tickets
const StaggeredCard: React.FC<{ index: number; children: React.ReactNode }> = ({
  index,
  children,
}) => {
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(14)).current;

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
  const { liveSessions, setLiveSessions, currentUser, selectSession } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(14)).current;
  const quotaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(heroSlide, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [heroFade, heroSlide]);

  useEffect(() => {
    const targetPct = Math.min(100, Math.round((todayBookingsCount / 3) * 100));
    Animated.timing(quotaAnim, {
      toValue: targetPct,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [todayBookingsCount, quotaAnim]);

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
      {/* Rehearsal Telemetry Header: Unboxed, matching screenshot */}
      <Animated.View
        style={[
          styles.headerBox,
          {
            opacity: heroFade,
            transform: [{ translateY: heroSlide }],
          },
        ]}
      >
        {/* Display Title: READY TO ROCK? with Garage Rock Animation */}
        <GarageRockHeadline title="READY TO ROCK?" />
      </Animated.View>

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
    paddingBottom: 16,
  },
  headerSubtitle: {
    color: '#B0DA30',
    fontSize: 10.5,
    letterSpacing: 1.8,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  headerTitle: {
    color: '#EFECE6',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
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
    marginTop: 8,
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
    flexShrink: 1,
  },
  quotaNum: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
    flexShrink: 0,
    marginLeft: 8,
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
  },
  quotaFill: {
    height: '100%',
    borderRadius: 2,
  },
  fillSafe: {
    backgroundColor: '#B0DA30',
  },
  fillWarning: {
    backgroundColor: '#F59E0B',
  },
  fillDanger: {
    backgroundColor: '#F87171',
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
