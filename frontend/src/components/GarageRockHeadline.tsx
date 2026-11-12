import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Pressable,
} from 'react-native';

interface GarageRockHeadlineProps {
  title?: string;
  align?: 'left' | 'center';
}

export const GarageRockHeadline: React.FC<GarageRockHeadlineProps> = ({
  title = 'BOOK YOUR SLOT',
  align = 'left',
}) => {
  // Motion primitives for garage rock aesthetic
  const jitterX = useRef(new Animated.Value(0)).current;
  const jitterY = useRef(new Animated.Value(0)).current;
  const rotVal = useRef(new Animated.Value(0)).current; // -1 to 1 => -1.2deg to 1.2deg
  const scaleVal = useRef(new Animated.Value(1)).current;
  const chromaticVal = useRef(new Animated.Value(0)).current; // 0 to 1
  const tubeHum = useRef(new Animated.Value(1)).current;

  // Track if a manual trigger is active
  const isStrumming = useRef(false);

  // Power-chord amp rumble shudder animation sequence
  const createPowerChordAnimation = useCallback(
    (intensity = 1.0) => {
      return Animated.parallel([
        // Electrical filament spark on strike
        Animated.sequence([
          Animated.timing(tubeHum, {
            toValue: 0.82,
            duration: 20,
            useNativeDriver: false,
          }),
          Animated.timing(tubeHum, {
            toValue: 1.0,
            duration: 25,
            useNativeDriver: false,
          }),
          Animated.timing(tubeHum, {
            toValue: 0.9,
            duration: 25,
            useNativeDriver: false,
          }),
          Animated.timing(tubeHum, {
            toValue: 1.0,
            duration: 40,
            useNativeDriver: false,
          }),
        ]),
        // High-frequency physical amp cabinet shudder
        Animated.sequence([
          // Strike!
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1.0 + 0.045 * intensity,
              duration: 24,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(chromaticVal, {
              toValue: 1.0 * intensity,
              duration: 24,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(rotVal, {
              toValue: -0.9 * intensity,
              duration: 24,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterX, {
              toValue: -2.4 * intensity,
              duration: 24,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterY, {
              toValue: 1.6 * intensity,
              duration: 24,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
          ]),
          // Cabinet recoil rebound
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1.0 + 0.025 * intensity,
              duration: 28,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(chromaticVal, {
              toValue: 0.8 * intensity,
              duration: 28,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(rotVal, {
              toValue: 1.1 * intensity,
              duration: 28,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterX, {
              toValue: 2.6 * intensity,
              duration: 28,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterY, {
              toValue: -1.5 * intensity,
              duration: 28,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
          ]),
          // Secondary decay oscillation
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1.01,
              duration: 30,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(chromaticVal, {
              toValue: 0.4 * intensity,
              duration: 30,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(rotVal, {
              toValue: -0.5 * intensity,
              duration: 30,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterX, {
              toValue: -1.3 * intensity,
              duration: 30,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
            Animated.timing(jitterY, {
              toValue: 0.8 * intensity,
              duration: 30,
              easing: Easing.linear,
              useNativeDriver: false,
            }),
          ]),
          // Smooth return to resting register
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1.0,
              duration: 50,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(chromaticVal, {
              toValue: 0,
              duration: 50,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(rotVal, {
              toValue: 0,
              duration: 50,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(jitterX, {
              toValue: 0,
              duration: 50,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(jitterY, {
              toValue: 0,
              duration: 50,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]),
        ]),
      ]);
    },
    [scaleVal, chromaticVal, rotVal, jitterX, jitterY, tubeHum]
  );

  // Quick rhythmic strum ("chug")
  const createRhythmChugAnimation = useCallback(() => {
    return Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleVal, {
          toValue: 1.02,
          duration: 22,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(chromaticVal, {
          toValue: 0.6,
          duration: 22,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(rotVal, {
          toValue: 0.5,
          duration: 22,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(jitterX, {
          toValue: 1.3,
          duration: 22,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(jitterY, {
          toValue: -0.9,
          duration: 22,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scaleVal, {
          toValue: 1.0,
          duration: 38,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(chromaticVal, {
          toValue: 0,
          duration: 38,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(rotVal, {
          toValue: 0,
          duration: 38,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(jitterX, {
          toValue: 0,
          duration: 38,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(jitterY, {
          toValue: 0,
          duration: 38,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]);
  }, [scaleVal, chromaticVal, rotVal, jitterX, jitterY]);

  // Main rhythmic garage rock groove loop
  useEffect(() => {
    // 1. Warm tube amp filament breathing
    const tubeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tubeHum, {
          toValue: 0.95,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(tubeHum, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    // 2. Rhythmic garage rock amplifier shudder & rhythm chugs
    const grooveLoop = Animated.loop(
      Animated.sequence([
        // Beat 1: Heavy power-chord strike
        createPowerChordAnimation(1.0),
        Animated.delay(1400),
        // Beat 3: Rhythm guitar double-chug
        createRhythmChugAnimation(),
        Animated.delay(180),
        createRhythmChugAnimation(),
        Animated.delay(2600),
      ])
    );

    tubeLoop.start();
    grooveLoop.start();

    return () => {
      tubeLoop.stop();
      grooveLoop.stop();
    };
  }, [createPowerChordAnimation, createRhythmChugAnimation, tubeHum]);

  // Interactive strum on hover or press
  const handleStrum = () => {
    if (isStrumming.current) return;
    isStrumming.current = true;
    createPowerChordAnimation(1.4).start(() => {
      isStrumming.current = false;
    });
  };

  // Interpolated rotation string
  const rotateInterpolation = rotVal.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.3deg', '1.3deg'],
  });

  // Chromatic red misprint offset
  const redTranslateX = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3.0],
  });
  const redTranslateY = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1.8],
  });
  const redOpacity = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.8],
  });

  // Chromatic lime misprint offset
  const limeTranslateX = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2.6],
  });
  const limeTranslateY = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1.4],
  });
  const limeOpacity = chromaticVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.7],
  });

  return (
    <Pressable
      onPress={handleStrum}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: handleStrum,
            style: { cursor: 'pointer', alignSelf: align === 'left' ? 'flex-start' : 'center' } as any,
          }
        : { style: { alignSelf: align === 'left' ? 'flex-start' : 'center' } })}
      accessibilityRole="header"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.titleContainer,
          align === 'left' ? styles.containerLeft : styles.containerCenter,
        ]}
      >
        {/* Layer 1: Crimson Red Silkscreen / Chromatic Misprint Shadow (#C93032) */}
        <Animated.Text
          style={[
            styles.baseTitleText,
            align === 'left' ? styles.textLeft : styles.textCenter,
            styles.redLayer,
            align === 'left' ? styles.layerLeft : styles.layerCenter,
            {
              transform: [
                { translateX: redTranslateX },
                { translateY: redTranslateY },
                { rotate: rotateInterpolation },
                { scale: scaleVal },
              ],
              opacity: redOpacity,
            },
          ]}
          aria-hidden={true}
        >
          {title}
        </Animated.Text>

        {/* Layer 2: Acid Lime Undertone Misprint Shadow (#B0DA30) */}
        <Animated.Text
          style={[
            styles.baseTitleText,
            align === 'left' ? styles.textLeft : styles.textCenter,
            styles.limeLayer,
            align === 'left' ? styles.layerLeft : styles.layerCenter,
            {
              transform: [
                { translateX: limeTranslateX },
                { translateY: limeTranslateY },
                { rotate: rotateInterpolation },
                { scale: scaleVal },
              ],
              opacity: limeOpacity,
            },
          ]}
          aria-hidden={true}
        >
          {title}
        </Animated.Text>

        {/* Layer 3: Main Display Title (Off-White Pale #EFECE6) with Shudder & Tube Hum */}
        <Animated.Text
          style={[
            styles.baseTitleText,
            align === 'left' ? styles.textLeft : styles.textCenter,
            styles.mainLayer,
            {
              transform: [
                { translateX: jitterX },
                { translateY: jitterY },
                { rotate: rotateInterpolation },
                { scale: scaleVal },
              ],
              opacity: tubeHum,
            },
          ]}
        >
          {title}
        </Animated.Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    position: 'relative',
    marginVertical: 2,
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
        } as any)
      : {}),
  },
  containerLeft: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  containerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  baseTitleText: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  textLeft: {
    textAlign: 'left',
  },
  textCenter: {
    textAlign: 'center',
  },
  mainLayer: {
    color: '#EFECE6',
  },
  redLayer: {
    position: 'absolute',
    color: '#C93032',
    top: 0,
    bottom: 0,
  },
  limeLayer: {
    position: 'absolute',
    color: '#B0DA30',
    top: 0,
    bottom: 0,
  },
  layerLeft: {
    left: 0,
    textAlign: 'left',
  },
  layerCenter: {
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
