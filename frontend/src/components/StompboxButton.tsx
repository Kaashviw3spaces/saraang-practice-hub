import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import Svg, { Polygon, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface StompboxButtonProps {
  onPress: () => void;
  label?: string;
}

export const StompboxButton: React.FC<StompboxButtonProps> = ({
  onPress,
  label = 'BOOK REHEARSAL SLOT →',
}) => {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 60,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const translateX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  const translateY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressableContainer}
    >
      <Animated.View
        style={[
          styles.stompboxOuter,
          {
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        {/* Hexagonal Nut Bezel & Brushed Metallic Footswitch Graphic */}
        <View style={styles.footswitchAssembly}>
          <Svg width="54" height="54" viewBox="0 0 54 54">
            <Defs>
              <LinearGradient id="chromeNut" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="30%" stopColor="#D4D4D8" />
                <Stop offset="70%" stopColor="#71717A" />
                <Stop offset="100%" stopColor="#3F3F46" />
              </LinearGradient>
              <LinearGradient id="innerActuator" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#E4E4E7" />
                <Stop offset="50%" stopColor="#A1A1AA" />
                <Stop offset="100%" stopColor="#52525B" />
              </LinearGradient>
            </Defs>

            {/* Industrial Hex Nut Bezel */}
            <Polygon
              points="27,3 49,15 49,39 27,51 5,39 5,15"
              fill="url(#chromeNut)"
              stroke="#18181B"
              strokeWidth="2"
            />

            {/* Circular Steel Base Collar */}
            <Circle cx="27" cy="27" r="17" fill="#27272A" stroke="#52525B" strokeWidth="1.5" />

            {/* Brushed Metal Plunger Top */}
            <Circle cx="27" cy="27" r="13" fill="url(#innerActuator)" stroke="#18181B" strokeWidth="1.5" />

            {/* Radial Plunger Knurled Grip Ring */}
            <Circle cx="27" cy="27" r="9" fill="none" stroke="#3F3F46" strokeWidth="1" strokeDasharray="2,2" />
            <Circle cx="27" cy="27" r="4" fill="#E4E4E7" />
          </Svg>
        </View>

        {/* Center 3D Embossed Dymo Label Tape */}
        <View style={styles.dymoTapeCenter}>
          <View style={styles.dymoHighlight} />
          <Text style={styles.dymoText}>{label.toUpperCase()}</Text>
          <View style={styles.dymoShadow} />
        </View>

        {/* Heavy Duty Status LED in Acid Lime */}
        <View style={styles.statusLedGlow} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressableContainer: {
    width: '100%',
    marginVertical: 8,
  },
  stompboxOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    borderWidth: 2.5,
    borderColor: '#EFECE6',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#FF1E27',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    position: 'relative',
  },
  footswitchAssembly: {
    marginRight: 12,
  },
  dymoTapeCenter: {
    flex: 1,
    backgroundColor: '#0D0D10',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  dymoHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dymoShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dymoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", "Courier New", monospace',
      default: 'monospace',
    }),
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1.5 },
    textShadowRadius: 1,
  },
  statusLedGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CCFF00',
    borderWidth: 1.5,
    borderColor: '#121212',
    marginLeft: 10,
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
});
