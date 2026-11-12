import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

export type NoteType =
  | 'double_eighth'
  | 'eighth'
  | 'quarter'
  | 'sixteenth'
  | 'treble_clef'
  | 'bass_clef'
  | 'sharp';

export interface FloatingNoteConfig {
  id: number;
  type: NoteType;
  xPercent: number;
  size: number;
  color: string;
  baseOpacity: number;
  duration: number;
  initialOffset: number;
  swayAmount: number;
  rotationRange: number;
  strokeWidth: number;
}

// Curated Pale Studio Palette: Ethereal, low-saturation, atmospheric
const PALE_COLORS = {
  amber: '#FDE68A',     // Pale vintage brass / amber
  rose: '#FCA5A5',      // Pale Saarang crimson / velvet rose
  moonlight: '#F1F5F9', // Pale studio acoustic silver / white
  cyan: '#BAE6FD',      // Pale electric air / ice cyan
  lavender: '#DDD6FE',  // Pale harmonic lilac / violet
};

// Curated 15-note constellation for organic distribution and zero visual pop
const DEFAULT_NOTES: FloatingNoteConfig[] = [
  {
    id: 1,
    type: 'double_eighth',
    xPercent: 8,
    size: 26,
    color: PALE_COLORS.amber,
    baseOpacity: 0.15,
    duration: 19000,
    initialOffset: 0.08,
    swayAmount: 26,
    rotationRange: 12,
    strokeWidth: 1.8,
  },
  {
    id: 2,
    type: 'treble_clef',
    xPercent: 84,
    size: 32,
    color: PALE_COLORS.rose,
    baseOpacity: 0.16,
    duration: 23000,
    initialOffset: 0.22,
    swayAmount: 22,
    rotationRange: -14,
    strokeWidth: 1.8,
  },
  {
    id: 3,
    type: 'eighth',
    xPercent: 24,
    size: 20,
    color: PALE_COLORS.moonlight,
    baseOpacity: 0.12,
    duration: 16000,
    initialOffset: 0.45,
    swayAmount: -28,
    rotationRange: 16,
    strokeWidth: 1.8,
  },
  {
    id: 4,
    type: 'quarter',
    xPercent: 64,
    size: 20,
    color: PALE_COLORS.lavender,
    baseOpacity: 0.13,
    duration: 17500,
    initialOffset: 0.62,
    swayAmount: 18,
    rotationRange: -10,
    strokeWidth: 1.8,
  },
  {
    id: 5,
    type: 'bass_clef',
    xPercent: 14,
    size: 24,
    color: PALE_COLORS.cyan,
    baseOpacity: 0.14,
    duration: 22000,
    initialOffset: 0.35,
    swayAmount: 32,
    rotationRange: 12,
    strokeWidth: 1.8,
  },
  {
    id: 6,
    type: 'sixteenth',
    xPercent: 46,
    size: 22,
    color: PALE_COLORS.amber,
    baseOpacity: 0.13,
    duration: 15000,
    initialOffset: 0.78,
    swayAmount: -22,
    rotationRange: -15,
    strokeWidth: 1.8,
  },
  {
    id: 7,
    type: 'double_eighth',
    xPercent: 76,
    size: 22,
    color: PALE_COLORS.rose,
    baseOpacity: 0.14,
    duration: 18500,
    initialOffset: 0.15,
    swayAmount: 24,
    rotationRange: 10,
    strokeWidth: 1.8,
  },
  {
    id: 8,
    type: 'treble_clef',
    xPercent: 36,
    size: 34,
    color: PALE_COLORS.moonlight,
    baseOpacity: 0.15,
    duration: 25000,
    initialOffset: 0.85,
    swayAmount: -30,
    rotationRange: 15,
    strokeWidth: 1.8,
  },
  {
    id: 9,
    type: 'sharp',
    xPercent: 92,
    size: 18,
    color: PALE_COLORS.lavender,
    baseOpacity: 0.11,
    duration: 16500,
    initialOffset: 0.52,
    swayAmount: 16,
    rotationRange: -8,
    strokeWidth: 1.8,
  },
  {
    id: 10,
    type: 'eighth',
    xPercent: 5,
    size: 18,
    color: PALE_COLORS.rose,
    baseOpacity: 0.11,
    duration: 14000,
    initialOffset: 0.92,
    swayAmount: -20,
    rotationRange: 14,
    strokeWidth: 1.8,
  },
  {
    id: 11,
    type: 'quarter',
    xPercent: 70,
    size: 18,
    color: PALE_COLORS.cyan,
    baseOpacity: 0.11,
    duration: 20500,
    initialOffset: 0.28,
    swayAmount: 25,
    rotationRange: -12,
    strokeWidth: 1.8,
  },
  {
    id: 12,
    type: 'double_eighth',
    xPercent: 30,
    size: 28,
    color: PALE_COLORS.amber,
    baseOpacity: 0.15,
    duration: 21000,
    initialOffset: 0.68,
    swayAmount: -24,
    rotationRange: 18,
    strokeWidth: 1.8,
  },
  {
    id: 13,
    type: 'bass_clef',
    xPercent: 54,
    size: 24,
    color: PALE_COLORS.moonlight,
    baseOpacity: 0.12,
    duration: 24000,
    initialOffset: 0.40,
    swayAmount: 20,
    rotationRange: -14,
    strokeWidth: 1.8,
  },
  {
    id: 14,
    type: 'sixteenth',
    xPercent: 88,
    size: 22,
    color: PALE_COLORS.amber,
    baseOpacity: 0.13,
    duration: 17000,
    initialOffset: 0.03,
    swayAmount: -18,
    rotationRange: 11,
    strokeWidth: 1.8,
  },
  {
    id: 15,
    type: 'sharp',
    xPercent: 20,
    size: 18,
    color: PALE_COLORS.rose,
    baseOpacity: 0.10,
    duration: 19500,
    initialOffset: 0.74,
    swayAmount: 22,
    rotationRange: -9,
    strokeWidth: 1.8,
  },
];

// Vector Double Beamed Eighth Notes (♫)
const DoubleEighthSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18V5l12-2v13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="6" cy="18" r="3" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
    <Circle cx="18" cy="16" r="3" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
  </Svg>
);

// Vector Single Eighth Note with curved flag (♪)
const SingleEighthSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="8" cy="18" r="3.5" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
    <Path d="M11.5 18V3C14 5 18 5 19 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Vector Quarter Note (♩)
const QuarterSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="8" cy="18" r="3.5" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
    <Line x1="11.5" y1="18" x2="11.5" y2="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Vector Sixteenth Note with double beam (♬)
const SixteenthSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18V5l12-2v13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M9 9.5l12-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="6" cy="18" r="3" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
    <Circle cx="18" cy="16" r="3" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={0.7} />
  </Svg>
);

// Vector Treble Clef Component (𝄞)
const TrebleClefSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => {
  const height = size * 1.5;
  return (
    <Svg width={size} height={height} viewBox="0 0 32 48" fill="none">
      <Path
        d="M 16 46 C 13.5 46 11 44 11 40.5 C 11 36.8 14 34 17.5 34 C 20.2 34 22 35.8 22 38.5 C 22 41.5 19.5 43.8 16.5 43.8 C 15.2 43.8 14.5 43.2 14.2 42.6 C 14.8 40.5 16.5 40 17.5 40 C 18.2 40 18.8 40.5 18.8 41.2 C 18.8 42.2 17.8 42.8 16.8 42.8 C 16.2 42.8 15.8 42.5 15.6 42.1 L 16.4 28 C 14 27.2 11.5 25 11.5 21.5 C 11.5 16.5 15.5 12 18.5 7 L 19 3 L 20.5 3 L 19.8 14 C 22.5 17 24 20.5 24 24 C 24 28.5 21 32 17.8 33.2 L 17 46 C 16.7 46 16.3 46 16 46 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

// Vector Bass Clef Component (𝄢)
const BassClefSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M 10 14 C 10 11.5 12 9.5 14.5 9.5 C 17 9.5 18.5 11 18.5 13.5 C 18.5 17 14 21 11 25"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx="10" cy="14" r="2.5" fill={color} />
      <Circle cx="22" cy="11" r="1.5" fill={color} />
      <Circle cx="22" cy="17" r="1.5" fill={color} />
    </Svg>
  );
};

// Vector Sharp Symbol (♯)
const SharpSvg: React.FC<{ size: number; color: string; strokeWidth?: number }> = ({
  size,
  color,
  strokeWidth = 1.8,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="9" y1="3" x2="8" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="16" y1="3" x2="15" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="4" y1="9" x2="20" y2="7" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
      <Line x1="4" y1="16" x2="20" y2="14" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
    </Svg>
  );
};

// Individual Animated Note Component
const FloatingNoteItem: React.FC<{
  config: FloatingNoteConfig;
  screenHeight: number;
  screenWidth: number;
}> = ({ config, screenHeight, screenWidth }) => {
  const animProgress = useRef(new Animated.Value(config.initialOffset)).current;

  useEffect(() => {
    // First run from initialOffset to 1 over remaining proportional duration
    const firstDuration = Math.max(100, Math.round(config.duration * (1 - config.initialOffset)));
    let animationRef: Animated.CompositeAnimation | null = null;

    const startContinuousLoop = () => {
      animProgress.setValue(0);
      animationRef = Animated.loop(
        Animated.timing(animProgress, {
          toValue: 1,
          duration: config.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animationRef.start();
    };

    animationRef = Animated.timing(animProgress, {
      toValue: 1,
      duration: firstDuration,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animationRef.start(({ finished }) => {
      if (finished) {
        startContinuousLoop();
      }
    });

    return () => {
      if (animationRef) animationRef.stop();
    };
  }, [config.duration, config.initialOffset, animProgress]);

  // Vertical upward motion
  const translateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight + 40, -80],
  });

  // Sinusoidal horizontal sway
  const translateX = animProgress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, config.swayAmount, 0, -config.swayAmount, 0],
  });

  // Tilt oscillation
  const rot = Math.abs(config.rotationRange);
  const rotDir = config.rotationRange >= 0 ? 1 : -1;
  const rotate = animProgress.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: ['0deg', `${rotDir * rot}deg`, `${-rotDir * rot}deg`, '0deg'],
  });

  // Subtle breathing scale
  const scale = animProgress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.95, 1.06, 0.98, 1.05, 0.95],
  });

  // Pale fade lifecycle: invisible at very bottom/top, peak pale glow through body
  const opacity = animProgress.interpolate({
    inputRange: [0, 0.12, 0.5, 0.88, 1],
    outputRange: [
      0,
      config.baseOpacity,
      config.baseOpacity * 0.95,
      config.baseOpacity * 0.85,
      0,
    ],
  });

  // Compute horizontal pixel coordinate
  const leftPos = Math.round((config.xPercent / 100) * screenWidth);

  const renderGlyph = () => {
    switch (config.type) {
      case 'double_eighth':
        return <DoubleEighthSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'eighth':
        return <SingleEighthSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'quarter':
        return <QuarterSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'sixteenth':
        return <SixteenthSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'treble_clef':
        return <TrebleClefSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'bass_clef':
        return <BassClefSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      case 'sharp':
        return <SharpSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
      default:
        return <DoubleEighthSvg size={config.size} color={config.color} strokeWidth={config.strokeWidth} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.noteWrapper,
        {
          left: leftPos,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { rotate },
            { scale },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.glowWrap,
          {
            shadowColor: config.color,
          },
        ]}
      >
        {renderGlyph()}
      </View>
    </Animated.View>
  );
};

// Subtle curved acoustic stave lines in the background
const AmbientStaveLines: React.FC<{ screenWidth: number; screenHeight: number }> = ({
  screenWidth,
  screenHeight,
}) => {
  const midY = screenHeight * 0.42;
  const lineSpacing = 12;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="staveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="25%" stopColor="#EF4444" stopOpacity="0.035" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.045" />
            <Stop offset="75%" stopColor="#F59E0B" stopOpacity="0.035" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="subtleAura" x1="50%" y1="0%" x2="50%" y2="100%">
            <Stop offset="0%" stopColor="#EF4444" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#0D0D10" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Ambient Top Glow Aura */}
        <Circle cx={screenWidth * 0.5} cy={-40} r={screenWidth * 0.6} fill="url(#subtleAura)" />

        {/* 5 Classical Acoustic Staff Lines with gentle harmonic curve */}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = midY + i * lineSpacing;
          const cpY = y - 18;
          return (
            <Path
              key={`stave-${i}`}
              d={`M -20 ${y} Q ${screenWidth * 0.5} ${cpY} ${screenWidth + 20} ${y + 8}`}
              stroke="url(#staveGrad)"
              strokeWidth="0.8"
              fill="none"
            />
          );
        })}
      </Svg>
    </View>
  );
};

interface MusicalNotesBackgroundProps {
  showStaveLines?: boolean;
  notes?: FloatingNoteConfig[];
}

export const MusicalNotesBackground: React.FC<MusicalNotesBackgroundProps> = ({
  showStaveLines = true,
  notes = DEFAULT_NOTES,
}) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const screenWidth = winW && winW > 0 ? winW : 400;
  const screenHeight = winH && winH > 0 ? winH : 800;

  // Memoize note items to avoid unnecessary re-renders
  const renderedNotes = useMemo(() => {
    return notes.map((note) => (
      <FloatingNoteItem
        key={`floating-note-${note.id}`}
        config={note}
        screenHeight={screenHeight}
        screenWidth={screenWidth}
      />
    ));
  }, [notes, screenHeight, screenWidth]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Background Stave Lines */}
      {showStaveLines && (
        <AmbientStaveLines screenWidth={screenWidth} screenHeight={screenHeight} />
      )}

      {/* Floating Pale Musical Notes */}
      {renderedNotes}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  noteWrapper: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
});
