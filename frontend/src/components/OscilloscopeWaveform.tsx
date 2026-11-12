import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Svg, { Path, Line, Rect, Defs, Pattern } from 'react-native-svg';

interface OscilloscopeWaveformProps {
  activeCount: number;
  totalRooms?: number;
}

export const OscilloscopeWaveform: React.FC<OscilloscopeWaveformProps> = ({
  activeCount = 0,
  totalRooms = 5,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.94,
          duration: 380,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.scopeContainer}>
      {/* Cathode Ray Oscilloscope Screen with Grid & Jagged High-Gain Waveform */}
      <View style={styles.screenFrame}>
        <Svg width="100%" height="52" viewBox="0 0 320 52" preserveAspectRatio="none">
          <Defs>
            {/* Oscilloscope Reticle Grid Pattern */}
            <Pattern id="scopeGrid" width="20" height="13" patternUnits="userSpaceOnUse">
              <Line x1="0" y1="13" x2="20" y2="13" stroke="#2A1518" strokeWidth="0.8" />
              <Line x1="20" y1="0" x2="20" y2="13" stroke="#2A1518" strokeWidth="0.8" />
            </Pattern>
          </Defs>

          {/* Grid Background */}
          <Rect width="100%" height="52" fill="url(#scopeGrid)" />
          {/* Center Voltage Baseline */}
          <Line x1="0" y1="26" x2="320" y2="26" stroke="#45181C" strokeWidth="1" strokeDasharray="3,3" />

          {/* Overdriven Jagged High-Gain Electric Crimson Waveform */}
          <Path
            d="M 0 26 
               L 15 26 L 25 22 L 32 30 L 40 18 L 48 34 L 56 12 L 64 40 L 72 6 L 80 46 L 88 4 L 96 48 L 104 2 L 112 50 L 120 2 L 128 49 L 136 6 L 144 45 L 152 10 L 160 42 L 168 14 L 176 38 L 184 18 L 192 34 L 200 21 L 208 31 L 216 23 L 224 29 L 232 24 L 242 27 L 255 26 L 270 26 L 285 24 L 295 28 L 305 26 L 320 26"
            fill="none"
            stroke="#FF1E27"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          {/* Secondary Harmonic Ghost Surge (Overdrive Distortion) */}
          <Path
            d="M 25 26 L 45 20 L 65 32 L 85 8 L 105 44 L 125 5 L 145 47 L 165 9 L 185 41 L 205 18 L 225 30 L 245 26 L 275 26 L 320 26"
            fill="none"
            stroke="#CCFF00"
            strokeWidth="1"
            opacity={0.7}
            strokeDasharray="2,2"
          />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scopeContainer: {
    backgroundColor: '#09090C',
    borderWidth: 2,
    borderColor: '#26262B',
    borderRadius: 0,
    padding: 10,
    marginVertical: 6,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2914',
    borderWidth: 1.5,
    borderColor: '#CCFF00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCFF00',
    marginRight: 6,
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  liveText: {
    color: '#CCFF00',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  counterWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  counterText: {
    color: '#FF1E27',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  counterUnit: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '700',
  },
  screenFrame: {
    width: '100%',
    backgroundColor: '#050507',
    borderWidth: 1,
    borderColor: '#3F1215',
    overflow: 'hidden',
  },
});
