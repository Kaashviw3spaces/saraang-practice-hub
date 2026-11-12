import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

interface OscilloscopeWaveformProps {
  activeCount?: number;
  totalRooms?: number;
}

export const OscilloscopeWaveform: React.FC<OscilloscopeWaveformProps> = () => {
  const signalGainAnim = useRef(new Animated.Value(1)).current;
  const harmonicPhaseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Organic analog signal gain breathing loop
    const gainLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(signalGainAnim, {
          toValue: 1.1,
          duration: 950,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(signalGainAnim, {
          toValue: 0.92,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(signalGainAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(signalGainAnim, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    // 2. Microscopic harmonic line electrical drift loop
    const phaseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(harmonicPhaseAnim, {
          toValue: 1.6,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(harmonicPhaseAnim, {
          toValue: -1.4,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(harmonicPhaseAnim, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    gainLoop.start();
    phaseLoop.start();

    return () => {
      gainLoop.stop();
      phaseLoop.stop();
    };
  }, [signalGainAnim, harmonicPhaseAnim]);

  return (
    <View style={styles.waveformContainer}>
      {/* Subtle Dashed Center Audio Baseline */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="200" height="20" viewBox="0 0 200 20">
          <Line
            x1="0"
            y1="10"
            x2="200"
            y2="10"
            stroke="#34343E"
            strokeWidth="0.8"
            strokeDasharray="2.5,3.5"
          />
        </Svg>
      </View>

      {/* Breathing Primary Overdriven Waveform */}
      <Animated.View
        style={{
          width: 200,
          height: 20,
          transform: [{ scaleY: signalGainAnim }],
        }}
      >
        <Svg width="200" height="20" viewBox="0 0 200 20">
          <Path
            d="M 0 10 L 19.4 10 L 25.1 8.6 L 30.9 11.4 L 36.6 7.1 L 42.4 12.9 L 48.2 4.9 L 53.9 15.1 L 59.7 2.7 L 65.4 17.3 L 71.2 2 L 77 18 L 82.7 2 L 88.5 18.7 L 94.2 2 L 100 18.4 L 105.8 3.4 L 111.5 16.9 L 117.3 4.9 L 123 15.8 L 128.8 6.4 L 134.6 14.4 L 140.3 7.8 L 146.1 12.9 L 151.8 8.9 L 157.6 11.8 L 163.4 9.6 L 169.1 11.1 L 174.9 10 L 182.1 10.4 L 191.4 10 L 200 10"
            fill="none"
            stroke="#C93032"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="miter"
          />
        </Svg>
      </Animated.View>

      {/* Drifting Secondary Harmonic Line */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{ translateX: harmonicPhaseAnim }],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width="200" height="20" viewBox="0 0 200 20">
          <Path
            d="M 25.1 10 L 39.5 8.2 L 53.9 12.2 L 68.3 4.2 L 82.7 16.6 L 97.1 3.1 L 111.5 17.6 L 125.9 4.6 L 140.3 15.4 L 154.7 7.8 L 169.1 11.4 L 183.5 10"
            fill="none"
            stroke="#B0DA30"
            strokeWidth="0.85"
            opacity={0.65}
            strokeDasharray="2,3"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  waveformContainer: {
    width: 200,
    height: 20,
    alignSelf: 'center',
    marginVertical: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
