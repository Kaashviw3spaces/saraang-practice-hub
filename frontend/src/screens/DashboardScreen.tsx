import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, Image, Animated, Easing } from 'react-native';
import { api, LiveSession } from '../api/client';
import { useStore } from '../store/useStore';
import { LiveSessionCard } from '../components/LiveSessionCard';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { EqualizerBars } from '../components/EqualizerBars';
import { SoundwaveSvg } from '../components/SoundwaveSvg';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { LightningSvg } from '../components/LightningSvg';

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
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor="#FFFFFF" />
      }
    >
      {/* Top Banner with Rock Stencil & Soundwave Aesthetic */}
      <Animated.View
        style={[
          styles.heroSection,
          {
            opacity: heroFade,
            transform: [{ translateY: heroSlide }],
          },
        ]}
      >
        {/* Subtle Amplifier / Poster Texture Overlay */}
        <RockTextureOverlay pattern="mesh" opacity={0.07} />

        {/* Ambient Club Badge & Band Aesthetic Badges */}
        <View style={styles.ambientTopRow}>
          <View style={styles.ambientBadgeWrap}>
            <Image
              source={require('../../assets/saarang_logo.png')}
              style={styles.ambientBadgeImg}
              resizeMode="contain"
            />
            <View style={styles.ambientBadgeTextCol}>
              <Text style={styles.ambientClubTitle}>SAARANG</Text>
              <Text style={styles.ambientClubSub}>THE MUSIC CLUB</Text>
            </View>
          </View>

          <View style={styles.bandBadgesRow}>
            <View style={styles.lightningBadge}>
              <LightningSvg color="#FFFFFF" size={11} style={{ marginRight: 3 }} />
              <Text style={styles.lightningBadgeText}>HIGH VOLTAGE</Text>
            </View>
            <View style={styles.toneBadge}>
              <Text style={styles.toneBadgeText}>GAIN: 11</Text>
            </View>
            <View style={styles.tourYearBadge}>
              <Text style={styles.tourYearText}>TOUR 2026</Text>
            </View>
          </View>
        </View>

        <View style={styles.liveHeaderRow}>
          <View style={styles.liveIndicatorRow}>
            {activeCount > 0 && <EqualizerBars active={true} color="#00E5FF" size={11} />}
            <Text style={styles.liveIndicator}>((•)) LIVE SOUND ROOM TELEMETRY</Text>
          </View>
          <View style={styles.syncPill}>
            <Text style={styles.pollTag}>SYNC: 30S</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>REHEARSAL TELEMETRY</Text>
        <Text style={styles.heroSubtitle}>
          REAL-TIME STUDIO MONITORING • ACOUSTIC HEADROOM • CATEGORY STATUS
        </Text>

        {/* Arctic Monkeys AM & Metallica Ride the Lightning Soundwave */}
        <View style={styles.soundwaveWrap}>
          <SoundwaveSvg
            color="#EF4444"
            secondaryColor="#00E5FF"
            height={26}
            variant="metallica"
          />
        </View>

        {/* Status Quota Bar styled as dual-channel audio telemetry */}
        <View style={styles.quotaBar}>
          <View style={styles.quotaItem}>
            <View style={styles.quotaHeaderRow}>
              <Text style={[styles.quotaLabel, { color: '#38BDF8' }]}>ACTIVE SOUND ROOMS</Text>
              <View style={styles.cyanDot} />
            </View>
            <Text style={[styles.quotaValue, { color: '#00E5FF' }]}>{activeCount} / {liveSessions.length} LIVE</Text>
          </View>
          <View style={styles.quotaDivider} />
          <View style={styles.quotaItem}>
            <View style={styles.quotaHeaderRow}>
              <Text style={[styles.quotaLabel, { color: '#FFFFFF' }]}>DAILY QUOTA LIMIT</Text>
              <LightningSvg color="#FFFFFF" size={11} />
            </View>
            <Text style={[styles.quotaValue, todayBookingsCount >= 3 ? styles.quotaDanger : styles.quotaSafe]}>
              {todayBookingsCount} / 3 BOOKED TODAY
            </Text>
          </View>
        </View>

        {/* Primary Booking Action with AC/DC High-Voltage Spring Press */}
        <AnimatedPressable
          style={styles.heroBookBtn}
          onPress={onNavigateToBooking}
          scaleTo={0.97}
        >
          <View style={styles.heroBtnContentRow}>
            <LightningSvg color="#0D0D10" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.heroBookBtnText}>BOOK REHEARSAL SLOT →</Text>
          </View>
        </AnimatedPressable>
      </Animated.View>

      {/* Session Categories List */}
      <View style={styles.sessionsList}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ROOM ROSTER // SESSION CATEGORIES</Text>
          <TouchableOpacity onPress={onNavigateToBooking}>
            <Text style={styles.newBookingLink}>+ BOOK NEW SLOT</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFFFFF" />
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
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroSection: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#262635',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  ambientBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101015',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#262635',
  },
  ambientBadgeImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 7,
  },
  ambientBadgeTextCol: {
    marginRight: 4,
  },
  ambientClubTitle: {
    color: '#F6F2EB',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  ambientClubSub: {
    color: '#9E9891',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bandBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lightningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181822',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D3D4E',
  },
  lightningBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  toneBadge: {
    backgroundColor: '#181822',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D3D4E',
  },
  toneBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tourYearBadge: {
    backgroundColor: '#1C1215',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4A1C24',
  },
  tourYearText: {
    color: '#9E9891',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginLeft: 6,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  syncPill: {
    backgroundColor: '#121218',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#262635',
  },
  pollTag: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  heroTitle: {
    color: '#F6F2EB',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  heroSubtitle: {
    color: '#A8A29E',
    fontSize: 11,
    letterSpacing: 0.6,
    lineHeight: 16,
    marginBottom: 10,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  soundwaveWrap: {
    marginVertical: 10,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2D161C',
  },
  quotaBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0D10',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2D1B22',
  },
  quotaItem: {
    flex: 1,
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cyanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
  },
  quotaLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  quotaValue: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  quotaSafe: {
    color: '#FFFFFF',
  },
  quotaDanger: {
    color: '#EF4444',
  },
  quotaDivider: {
    width: 1,
    backgroundColor: '#2D1B22',
    marginHorizontal: 12,
  },
  heroBookBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  heroBtnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBookBtnText: {
    color: '#0D0D10',
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
    color: '#F6F2EB',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  newBookingLink: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
  },
});
