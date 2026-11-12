import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Svg, { Path, Line, Rect, Defs, Pattern } from 'react-native-svg';
import { RockTextureOverlay } from './RockTextureOverlay';

interface OscilloscopeWaveformProps {
  activeCount: number;
  totalRooms?: number;
  todayBookingsCount?: number;
  maxQuota?: number;
}

export const OscilloscopeWaveform: React.FC<OscilloscopeWaveformProps> = ({
  activeCount = 0,
  totalRooms = 5,
  todayBookingsCount = 0,
  maxQuota = 3,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 450,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const quotaSlots = Array.from({ length: maxQuota }, (_, i) => i < todayBookingsCount);

  return (
    <View style={styles.scopeContainer}>
      {/* Gritty Texture Overlay */}
      <RockTextureOverlay pattern="grit" opacity={0.04} color="#FFFFFF" />

      {/* Top Header Bar: Replaces 'LIVE ON STAGE' with Daily Rehearsal Quota */}
      <View style={styles.scopeHeaderRow}>
        <View style={styles.quotaPill}>
          <Animated.View
            style={[
              styles.quotaDot,
              {
                backgroundColor: todayBookingsCount >= maxQuota ? '#C83838' : '#D4A373',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Text style={styles.quotaLabel}>
            DAILY REHEARSAL QUOTA:{' '}
            <Text style={styles.quotaHighlight}>
              {todayBookingsCount}/{maxQuota} BOOKED TODAY
            </Text>
          </Text>
        </View>

        <View style={styles.counterWrap}>
          <Text style={styles.counterText}>{activeCount}/{totalRooms}</Text>
          <Text style={styles.counterUnit}>ROOMS LIVE</Text>
        </View>
      </View>

      {/* Cathode Ray Oscilloscope Screen with Reticle Grid & Jagged Waveform */}
      <View style={styles.screenFrame}>
        <Svg width="100%" height="56" viewBox="0 0 320 56" preserveAspectRatio="none">
          <Defs>
            {/* Fine Reticle Grid */}
            <Pattern id="scopeGrid" width="20" height="14" patternUnits="userSpaceOnUse">
              <Line x1="0" y1="14" x2="20" y2="14" stroke="#221C1E" strokeWidth="0.8" />
              <Line x1="20" y1="0" x2="20" y2="14" stroke="#221C1E" strokeWidth="0.8" />
            </Pattern>
          </Defs>

          {/* Grid Background */}
          <Rect width="100%" height="56" fill="url(#scopeGrid)" />

          {/* Center Voltage Baseline */}
          <Line x1="0" y1="28" x2="320" y2="28" stroke="#362226" strokeWidth="1" strokeDasharray="4,3" />

          {/* Overdriven Jagged High-Gain Waveform in Faded Crimson Red */}
          <Path
            d="M 0 28 
               L 15 28 L 24 24 L 32 32 L 40 20 L 48 36 L 56 14 L 64 42 L 72 8 L 80 48 L 88 6 L 96 50 L 104 4 L 112 52 L 120 4 L 128 50 L 136 8 L 144 46 L 152 12 L 160 44 L 168 16 L 176 40 L 184 20 L 192 36 L 200 23 L 208 33 L 216 25 L 224 31 L 232 26 L 242 29 L 255 28 L 270 28 L 285 26 L 295 30 L 305 28 L 320 28"
            fill="none"
            stroke="#D63D3D"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          {/* Harmonic Amber Ghost Surge */}
          <Path
            d="M 25 28 L 45 22 L 65 34 L 85 11 L 105 46 L 125 7 L 145 49 L 165 11 L 185 43 L 205 20 L 225 32 L 245 28 L 275 28 L 320 28"
            fill="none"
            stroke="#D4A373"
            strokeWidth="1"
            opacity={0.65}
            strokeDasharray="2,2"
          />
        </Svg>
      </View>

      {/* Tactile Daily Quota Slot Segments */}
      <View style={styles.quotaSegmentsRow}>
        <Text style={styles.quotaSegmentTitle}>SETLIST SLOTS:</Text>
        <View style={styles.slotsPillsRow}>
          {quotaSlots.map((isBooked, idx) => (
            <View
              key={`slot-${idx}`}
              style={[
                styles.slotSegment,
                isBooked ? styles.slotSegmentBooked : styles.slotSegmentAvailable,
              ]}
            >
              <Text
                style={[
                  styles.slotSegmentText,
                  isBooked ? styles.slotTextBooked : styles.slotTextAvailable,
                ]}
              >
                SLOT 0{idx + 1}: {isBooked ? 'RESERVED' : 'OPEN'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scopeContainer: {
    backgroundColor: '#121215',
    borderWidth: 1.5,
    borderColor: '#2A2A32',
    borderRadius: 2,
    padding: 10,
    marginVertical: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1817',
    borderWidth: 1.2,
    borderColor: '#3D342E',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 2,
  },
  quotaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4A373',
    marginRight: 7,
  },
  quotaLabel: {
    color: '#A8A49D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  quotaHighlight: {
    color: '#EAE6DC',
    fontWeight: '900',
  },
  counterWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  counterText: {
    color: '#D63D3D',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  counterUnit: {
    color: '#8A867E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  screenFrame: {
    width: '100%',
    backgroundColor: '#08080A',
    borderWidth: 1,
    borderColor: '#261C1E',
    overflow: 'hidden',
    borderRadius: 1,
  },
  quotaSegmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#222228',
    flexWrap: 'wrap',
    gap: 6,
  },
  quotaSegmentTitle: {
    color: '#706D67',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  slotsPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotSegment: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 1,
    borderWidth: 1,
  },
  slotSegmentBooked: {
    backgroundColor: '#2A181A',
    borderColor: '#59262B',
  },
  slotSegmentAvailable: {
    backgroundColor: '#161917',
    borderColor: '#2B352D',
  },
  slotSegmentText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  slotTextBooked: {
    color: '#E06C75',
  },
  slotTextAvailable: {
    color: '#98C379',
  },
});
