import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

interface OscilloscopeWaveformProps {
  activeCount?: number;
  totalRooms?: number;
}

export const OscilloscopeWaveform: React.FC<OscilloscopeWaveformProps> = () => {
  return (
    <View style={styles.waveformContainer}>
      <Svg width="100%" height="46" viewBox="0 0 320 46" preserveAspectRatio="none">
        {/* Subtle Dashed Center Audio Baseline */}
        <Line
          x1="0"
          y1="23"
          x2="320"
          y2="23"
          stroke="#383842"
          strokeWidth="1"
          strokeDasharray="3,5"
        />

        {/* Minimalistic, Gritty Overdriven Audio Waveform in Electric Crimson */}
        <Path
          d="M 0 23 
             L 16 23 L 24 19 L 32 27 L 40 15 L 48 31 L 56 9 L 64 37 L 72 3 L 80 43 L 88 1 L 96 45 L 104 1 L 112 47 L 120 1 L 128 46 L 136 5 L 144 42 L 152 9 L 160 39 L 168 13 L 176 35 L 184 17 L 192 31 L 200 20 L 208 28 L 216 22 L 224 26 L 232 23 L 242 24 L 255 23 L 270 23 L 285 22 L 295 24 L 305 23 L 320 23"
          fill="none"
          stroke="#D9383A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />

        {/* Raw Secondary Harmonic Distortion Line */}
        <Path
          d="M 24 23 L 44 18 L 64 29 L 84 7 L 104 41 L 124 4 L 144 44 L 164 8 L 184 38 L 204 17 L 224 27 L 244 23 L 274 23 L 320 23"
          fill="none"
          stroke="#BCE83A"
          strokeWidth="1"
          opacity={0.65}
          strokeDasharray="2,3"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  waveformContainer: {
    width: '100%',
    paddingVertical: 10,
    marginVertical: 4,
    overflow: 'hidden',
  },
});
