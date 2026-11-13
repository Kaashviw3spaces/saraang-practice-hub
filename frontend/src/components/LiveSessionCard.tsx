import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Image,
  Pressable,
  Easing,
} from 'react-native';
import { LiveSession } from '../api/client';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { RockTextureOverlay } from './RockTextureOverlay';
import { SoundwaveSvg } from './SoundwaveSvg';

interface LiveSessionCardProps {
  session: LiveSession;
  onBookSession: (session: LiveSession) => void;
}

// 5-Line Musical Staff with Notation Component for Ticket Stub
const MusicalStaffSvg: React.FC<{ width?: number; height?: number }> = ({ width = 28, height = 18 }) => {
  return (
    <View style={styles.staffWrap}>
      <Svg width={width} height={height} viewBox="0 0 28 18">
        {/* 5 Staff hairline lines */}
        <Line x1="1" y1="2" x2="27" y2="2" stroke="#000000" strokeWidth="0.8" opacity={0.65} />
        <Line x1="1" y1="5.5" x2="27" y2="5.5" stroke="#000000" strokeWidth="0.8" opacity={0.65} />
        <Line x1="1" y1="9" x2="27" y2="9" stroke="#000000" strokeWidth="0.8" opacity={0.65} />
        <Line x1="1" y1="12.5" x2="27" y2="12.5" stroke="#000000" strokeWidth="0.8" opacity={0.65} />
        <Line x1="1" y1="16" x2="27" y2="16" stroke="#000000" strokeWidth="0.8" opacity={0.65} />
        
        {/* Quarter Note on 4th line */}
        <Circle cx="6" cy="12.5" r="1.8" fill="#000000" />
        <Line x1="7.7" y1="12.5" x2="7.7" y2="4" stroke="#000000" strokeWidth="1.1" />
        
        {/* Beamed Eighth Notes on 2nd & 3rd lines */}
        <Circle cx="15" cy="9" r="1.7" fill="#000000" />
        <Line x1="16.6" y1="9" x2="16.6" y2="3" stroke="#000000" strokeWidth="1.1" />
        <Circle cx="22" cy="5.5" r="1.7" fill="#000000" />
        <Line x1="23.6" y1="5.5" x2="23.6" y2="1.5" stroke="#000000" strokeWidth="1.1" />
        <Line x1="16.6" y1="3" x2="23.8" y2="1.5" stroke="#000000" strokeWidth="1.8" />
      </Svg>
    </View>
  );
};

// Vertical Barcode Graphic Component
const TicketBarcodeSvg: React.FC<{ height?: number }> = ({ height = 75 }) => {
  return (
    <View style={styles.barcodeWrap}>
      <Svg width="22" height={height} viewBox="0 0 22 75">
        <Rect x="1" y="0" width="2" height="75" fill="#000000" />
        <Rect x="4" y="0" width="1" height="75" fill="#000000" />
        <Rect x="6" y="0" width="3" height="75" fill="#000000" />
        <Rect x="10" y="0" width="1" height="75" fill="#000000" />
        <Rect x="12" y="0" width="2" height="75" fill="#000000" />
        <Rect x="15" y="0" width="1" height="75" fill="#000000" />
        <Rect x="17" y="0" width="3" height="75" fill="#000000" />
        <Rect x="21" y="0" width="1" height="75" fill="#000000" />
      </Svg>
    </View>
  );
};

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({ session, onBookSession }) => {
  const isOccupied = session.is_occupied;
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const stampPulseAnim = useRef(new Animated.Value(1)).current;
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Subtle breathing pulse for live room status stamp
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(stampPulseAnim, {
          toValue: 1.035,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(stampPulseAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [stampPulseAnim]);

  const handlePressIn = () => {
    Animated.spring(hoverAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(hoverAnim, {
      toValue: 0,
      friction: 6,
      tension: 80,
      useNativeDriver: false,
    }).start();
  };

  const cardRotate = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '0.6deg'],
  });

  const cardTranslateY = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const getSessionDescription = (name: string): string => {
    const n = (name || '').toUpperCase();
    if (n.includes('SESSION A')) {
      return 'Full band rehearsals, solo drums or electric guitar, collaborative jams.';
    }
    if (n.includes('SESSION B')) {
      return 'Acoustic & low-gain focus. Acoustic\nguitar, keys, vocals, bass.';
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
        label: 'AC/DC // CUSTOM TUBE STACK',
        serial: 'SN-0826-A',
        watermark: require('../../assets/band6.jpg'),
        acousticNote: '105 dB • HIGH-GAIN',
        instruments: ['🥁 DRUMS', '🎸 E-GUITAR', '🎸 BASS', '🎛️ AMPS'],
        waveVariant: 'dense' as const,
      };
    }
    if (n.includes('SESSION B')) {
      return {
        label: 'THE BEATLES // ABBEY ROAD',
        serial: 'SN-1969-B',
        watermark: require('../../assets/sebs_clean.png'),
        acousticNote: '85 dB • ACOUSTIC & KEYS',
        instruments: ['🪕 ACOUSTIC', '🎹 PIANO', '🎤 VOCALS', '🎻 BASS'],
        waveVariant: 'arctic' as const,
      };
    }
    if (n.includes('JAM SESSION')) {
      return {
        label: 'ARENA ROCK // LIVE ENSEMBLE',
        serial: 'SN-9021-JAM',
        watermark: require('../../assets/band4.avif'),
        acousticNote: '110 dB • LIVE ENSEMBLE',
        instruments: ['🥁 DRUM KIT', '🎸 GUITARS', '🎹 SYNTH', '🎤 OPEN MIC'],
        waveVariant: 'pulse' as const,
      };
    }
    if (n.includes('RECORDING')) {
      return {
        label: 'METALLICA // RIDE THE LIGHTNING',
        serial: 'SN-1984-REC',
        watermark: require('../../assets/band3.jpg'),
        acousticNote: '24-BIT / 96kHz • -32dB ISO',
        instruments: ['🎙️ MICS', '🎧 MONITORS', '🎚️ 16-TRACK', '🎛️ ANALOG'],
        waveVariant: 'metallica' as const,
      };
    }
    return {
      label: 'BACKSTAGE // SETLIST LOUNGE',
      serial: 'SN-2026-MTG',
      watermark: require('../../assets/band2.jpg'),
      acousticNote: 'PLAYBACK • SETLIST LAB',
      instruments: ['📝 SETLIST', '🎧 PLAYBACK', '📋 STAGE PLAN'],
      waveVariant: 'arctic' as const,
    };
  };

  const bandMeta = getSessionBandTag(session.name);

  return (
    <Animated.View
      style={[
        styles.ticketCard,
        {
          transform: [
            { translateY: cardTranslateY },
            { rotate: cardRotate },
          ],
        },
      ]}
    >
      {/* Semi-circular Ticket Punch Notches on Perforation Ends */}
      <View style={[styles.punchNotch, styles.notchTopLeft]} />
      <View style={[styles.punchNotch, styles.notchBottomLeft]} />

      {/* Left Perforated Tear-off Stub */}
      <View style={styles.leftTearStub}>
        <MusicalStaffSvg width={28} height={18} />
        <TicketBarcodeSvg height={62} />
        <Text style={styles.stubPassText}>PASS</Text>
        <Text style={styles.stubPitchText}>440Hz</Text>
      </View>

      {/* Perforated Dashed Tear Line */}
      <View style={styles.perforationLine} />

      {/* Main Ticket Surface (Warm Aged Zine Paper) */}
      <View style={styles.ticketMain}>
        {/* High-Contrast Halftone Band Silhouette on Right */}
        {bandMeta.watermark && (
          <View style={styles.bandPhotoCutoutWrap}>
            <Image
              source={bandMeta.watermark}
              style={[
                styles.bandSilhouettePhoto,
                Platform.select({
                  web: {
                    filter: 'grayscale(100%) contrast(290%) brightness(1.03)',
                    mixBlendMode: 'multiply',
                  } as any,
                }),
              ]}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Ticket Header & Metadata */}
        <View style={styles.ticketHeader}>
          <Text style={styles.sessionTitle}>{session.name.toUpperCase()}</Text>
          <Text style={styles.capacityMonospace}>
            CAPACITY // UP TO {session.participant_limit} MUSICIANS • {bandMeta.acousticNote}
          </Text>
        </View>

        {/* Copy / Description */}
        <Text style={styles.descriptionText}>{getSessionDescription(session.name)}</Text>

        {/* Musical Rig Instruments & Acoustic Soundwave */}
        <View style={styles.musicalRigRow}>
          <View style={styles.gearChipsWrap}>
            {bandMeta.instruments.map((inst, i) => (
              <View key={i} style={styles.gearChip}>
                <Text style={styles.gearChipText}>{inst}</Text>
              </View>
            ))}
          </View>
          <View style={styles.miniWaveBox}>
            <SoundwaveSvg
              height={10}
              color="#000000"
              secondaryColor="#000000"
              variant={bandMeta.waveVariant}
              style={{ opacity: 0.4 }}
            />
          </View>
        </View>

        {/* Diagonally Stamped Rubber Badge: AMPS WARMED (Acid-Lime) or LIVE ON STAGE (Crimson) */}
        <Animated.View
          style={[
            styles.rubberStampBox,
            isOccupied ? styles.stampCrimson : styles.stampAcidLime,
            {
              transform: [
                { rotate: '-10deg' },
                { scale: stampPulseAnim },
              ],
            },
          ]}
        >
          <Text
            style={[
              styles.stampText,
              isOccupied ? styles.stampTextCrimson : styles.stampTextLime,
            ]}
          >
            {isOccupied ? '⚡ LIVE ON STAGE' : '⚡ AMPS WARMED'}
          </Text>
        </Animated.View>

        {/* Ticket CTA Footswitch Stub */}
        <Pressable
          onPress={() => onBookSession(session)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.bookTicketBtn,
            pressed && styles.bookTicketBtnPressed,
          ]}
        >
          <Text style={styles.bookTicketBtnText}>
            BOOK {session.name.toUpperCase()} →
          </Text>
        </Pressable>
      </View>

      {/* Very Slight Tactile Cardstock / Paper Texture Overlay */}
      <RockTextureOverlay pattern="paperGrain" opacity={0.35} style={styles.paperTextureOverlay} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  ticketCard: {
    backgroundColor: '#DDD7C9',
    borderWidth: 2.2,
    borderColor: '#000000',
    borderRadius: 2,
    marginBottom: 18,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.85,
    shadowRadius: 0,
    elevation: 4,
  },
  leftTearStub: {
    width: 44,
    backgroundColor: '#D2CCBE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  barcodeWrap: {
    transform: [{ rotate: '90deg' }],
    marginVertical: 10,
  },
  staffWrap: {
    marginBottom: 2,
  },
  stubSerialText: {
    color: '#000000',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 18,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  stubPassText: {
    color: '#524C44',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  stubPitchText: {
    color: '#000000',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  perforationLine: {
    width: 0,
    borderRightWidth: 2,
    borderRightColor: '#000000',
    borderStyle: 'dashed',
  },
  punchNotch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#121214',
    zIndex: 10,
    borderWidth: 1.8,
    borderColor: '#000000',
  },
  notchTopLeft: {
    top: -7,
    left: 37,
  },
  notchBottomLeft: {
    bottom: -7,
    left: 37,
  },
  ticketMain: {
    flex: 1,
    padding: 16,
    position: 'relative',
    backgroundColor: '#DDD7C9',
  },
  bandPhotoCutoutWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '42%',
    overflow: 'hidden',
    borderLeftWidth: 1.5,
    borderLeftColor: '#000000',
    backgroundColor: '#DDD7C9',
  },
  bandSilhouettePhoto: {
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  ticketHeader: {
    marginBottom: 8,
    maxWidth: '55%',
    zIndex: 2,
  },
  dymoRigTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#222222',
  },
  dymoRigText: {
    color: '#EAE6DC',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  sessionTitle: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
    lineHeight: 28,
  },
  capacityMonospace: {
    color: '#26221D',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  descriptionText: {
    color: '#12100E',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 8,
    maxWidth: '55%',
    zIndex: 2,
  },
  musicalRigRow: {
    maxWidth: '55%',
    marginBottom: 10,
    zIndex: 2,
  },
  gearChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  gearChip: {
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 1,
  },
  gearChipText: {
    color: '#000000',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  miniWaveBox: {
    width: 130,
    marginTop: 2,
  },
  rubberStampBox: {
    position: 'absolute',
    top: 10,
    right: 8,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  stampAcidLime: {
    backgroundColor: '#B0DA30',
    borderColor: '#121212',
  },
  stampCrimson: {
    backgroundColor: '#C93032',
    borderColor: '#FFFFFF',
  },
  stampText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  stampTextLime: {
    color: '#121212',
  },
  stampTextCrimson: {
    color: '#FFFFFF',
  },
  bookTicketBtn: {
    backgroundColor: '#0D0D10',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.85,
    shadowRadius: 0,
    elevation: 3,
    borderRadius: 2,
    zIndex: 6,
  },
  bookTicketBtnPressed: {
    transform: [{ translateX: 1.5 }, { translateY: 1.5 }],
    shadowOffset: { width: 0.5, height: 0.5 },
  },
  bookTicketBtnText: {
    color: '#EAE6DC',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    fontFamily: Platform.select({
      web: '"Oswald", "Space Mono", sans-serif',
      default: 'sans-serif',
    }),
  },
  paperTextureOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
