import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Image } from 'react-native';
import { LiveSession } from '../api/client';
import { EqualizerBars } from './EqualizerBars';
import { AnimatedPressable } from './AnimatedPressable';
import { RockTextureOverlay } from './RockTextureOverlay';
import { LightningSvg } from './LightningSvg';

interface LiveSessionCardProps {
  session: LiveSession;
  onBookSession: (session: LiveSession) => void;
}

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({ session, onBookSession }) => {
  const isOccupied = session.is_occupied;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(btnScaleAnim, {
      toValue: 0.96,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const getSessionDescription = (name: string): string => {
    const n = (name || '').toUpperCase();
    if (n.includes('SESSION A')) {
      return 'Full band rehearsals, solo drums or electric guitar, collaborative jams.';
    }
    if (n.includes('SESSION B')) {
      return 'Acoustic & low-gain focus. Acoustic guitar, keys, vocals, bass.';
    }
    if (n.includes('JAM SESSION')) {
      return 'Multi-instrument open jams and collaborative live rehearsals.';
    }
    if (n.includes('RECORDING')) {
      return 'Strict lockdown session. Noise isolation & frequency clash prevention.';
    }
    if (n.includes('MEETING')) {
      return 'Band meetings, setlist curation, production planning. No instruments needed.';
    }
    return 'Standard rehearsal session.';
  };

  const getSessionBandTag = (name: string) => {
    const n = (name || '').toUpperCase();
    if (n.includes('SESSION A')) {
      return {
        label: 'AC/DC // HIGH VOLTAGE RIG',
        color: '#EF4444',
        watermark: require('../../assets/band6.jpg'),
      };
    }
    if (n.includes('SESSION B')) {
      return {
        label: 'THE BEATLES // ABBEY ROAD',
        color: '#FFFFFF',
        watermark: require('../../assets/band1.jpg'),
      };
    }
    if (n.includes('JAM SESSION')) {
      return {
        label: 'ARENA ROCK // LIVE ENSEMBLE',
        color: '#A855F7',
        watermark: require('../../assets/band4.avif'),
      };
    }
    if (n.includes('RECORDING')) {
      return {
        label: 'METALLICA // RIDE THE LIGHTNING',
        color: '#00E5FF',
        watermark: require('../../assets/band3.jpg'),
      };
    }
    return {
      label: 'BACKSTAGE // SETLIST LOUNGE',
      color: '#FFFFFF',
      watermark: require('../../assets/band2.jpg'),
    };
  };

  const bandMeta = getSessionBandTag(session.name);

  return (
    <View style={[styles.card, isOccupied && styles.occupiedCard]}>
      {/* Subtle Amplifier / Room Texture */}
      <RockTextureOverlay pattern="mesh" opacity={0.05} />

      {/* Authentic Rock Band Watermark */}
      {bandMeta.watermark && (
        <Image
          source={bandMeta.watermark}
          style={styles.cardWatermark}
          resizeMode="cover"
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.sessionName}>{session.name.toUpperCase()}</Text>
          <Text style={styles.subText}>
            CAPACITY // UP TO {session.participant_limit} MUSICIANS
          </Text>
        </View>

        <View style={[styles.statusBadge, isOccupied ? styles.occupiedBadge : styles.availableBadge]}>
          {isOccupied ? (
            <EqualizerBars active={true} color="#EF4444" size={12} />
          ) : (
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: '#10B981',
                  opacity: pulseAnim,
                },
              ]}
            />
          )}
          <Text style={[styles.statusText, { color: isOccupied ? '#FCA5A5' : '#10B981' }]}>
            {isOccupied ? '🔴 ON AIR' : '⚡ ROOM READY'}
          </Text>
        </View>
      </View>

      {/* Description / Rules */}
      <Text style={styles.descText}>{getSessionDescription(session.name)}</Text>

      {/* Current Active Session Info or Availability Banner */}
      {isOccupied && session.current_session ? (
        <View style={styles.sessionBox}>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>CURRENT REHEARSAL:</Text>
            <Text style={styles.sessionVal}>{session.current_session.practice_mode || 'Rehearsal'}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>ROOM LEAD:</Text>
            <Text style={styles.sessionVal}>{session.current_session.user_name}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>LIVE WINDOW:</Text>
            <Text style={styles.sessionVal}>
              {session.current_session.start_time} - {session.current_session.end_time}
            </Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>LINEUP:</Text>
            <Text style={styles.sessionVal}>{session.current_session.participant_count} Musicians Active</Text>
          </View>
        </View>
      ) : (
        <View style={styles.vacantBox}>
          <Text style={styles.vacantText}>⚡ Book room for immediate rehearsal reservation.</Text>
        </View>
      )}

      {/* Action Button: Book this Session */}
      <AnimatedPressable
        style={styles.actionBtn}
        onPress={() => onBookSession(session)}
        scaleTo={0.97}
      >
        <View style={styles.actionBtnRow}>
          <LightningSvg color="#0D0D10" size={14} style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>
            BOOK {session.name.toUpperCase()} →
          </Text>
        </View>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  occupiedCard: {
    borderColor: '#7D1D22',
    backgroundColor: '#181215',
    shadowColor: '#7D1D22',
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  cardWatermark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '45%',
    opacity: 0.08,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  bandTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  bandTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  sessionName: {
    color: '#F6F2EB',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  subText: {
    color: '#9E9891',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  availableBadge: {
    borderColor: '#32282C',
    backgroundColor: '#0D0D10',
  },
  occupiedBadge: {
    borderColor: '#7D1D22',
    backgroundColor: '#2A0E12',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  descText: {
    color: '#9E9891',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  sessionBox: {
    backgroundColor: '#240C10',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  sessionLabel: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sessionVal: {
    color: '#F6F2EB',
    fontSize: 12,
    fontWeight: '700',
  },
  vacantBox: {
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  vacantText: {
    color: '#9E9891',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#0D0D10',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
