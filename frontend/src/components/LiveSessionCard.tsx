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

interface LiveSessionCardProps {
  session: LiveSession;
  onBookSession: (session: LiveSession) => void;
}

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
        label: 'AC/DC // CUSTOM TUBE STACK',
        serial: 'SN-0826-A',
        watermark: require('../../assets/band6.jpg'),
      };
    }
    if (n.includes('SESSION B')) {
      return {
        label: 'THE BEATLES // ABBEY ROAD',
        serial: 'SN-1969-B',
        watermark: require('../../assets/sebs_clean.png'),
      };
    }
    if (n.includes('JAM SESSION')) {
      return {
        label: 'ARENA ROCK // LIVE ENSEMBLE',
        serial: 'SN-9021-JAM',
        watermark: require('../../assets/band4.avif'),
      };
    }
    if (n.includes('RECORDING')) {
      return {
        label: 'METALLICA // RIDE THE LIGHTNING',
        serial: 'SN-1984-REC',
        watermark: require('../../assets/band3.jpg'),
      };
    }
    return {
      label: 'BACKSTAGE // SETLIST LOUNGE',
      serial: 'SN-2026-MTG',
      watermark: require('../../assets/band2.jpg'),
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
        <TicketBarcodeSvg height={80} />
        <Text style={styles.stubPassText}>PASS</Text>
      </View>

      {/* Perforated Dashed Tear Line */}
      <View style={styles.perforationLine} />

      {/* Main Ticket Surface (Warm Aged Zine Paper) */}
      <View style={styles.ticketMain}>
        {/* Subtle Halftone Print Texture */}
        <RockTextureOverlay pattern="dots" opacity={0.03} />

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
            CAPACITY // UP TO {session.participant_limit} MUSICIANS
          </Text>
        </View>

        {/* Copy / Description */}
        <Text style={styles.descriptionText}>{getSessionDescription(session.name)}</Text>

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
    marginVertical: 12,
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
    marginTop: 10,
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
    maxWidth: '65%',
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
    marginBottom: 14,
    maxWidth: '65%',
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
});
