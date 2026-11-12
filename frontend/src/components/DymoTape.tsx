import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Platform } from 'react-native';

interface DymoTapeProps {
  text: string;
  angle?: number;
  color?: 'black' | 'red' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const DymoTape: React.FC<DymoTapeProps> = ({
  text,
  angle = 0,
  color = 'black',
  size = 'md',
  style,
}) => {
  const getBackgroundColor = () => {
    switch (color) {
      case 'red':
        return '#B91C1C';
      case 'lime':
        return '#1E293B';
      default:
        return '#121212';
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'lime':
        return '#CCFF00';
      default:
        return '#FFFFFF';
    }
  };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const fontSize = isSmall ? 9 : isLarge ? 12 : 10;
  const paddingV = isSmall ? 2 : isLarge ? 5 : 3.5;
  const paddingH = isSmall ? 6 : isLarge ? 10 : 8;

  return (
    <View
      style={[
        styles.tapeContainer,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ rotate: `${angle}deg` }],
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
        },
        style,
      ]}
    >
      {/* 3D Embossed Plastic Sheen Gradient / Highlight line */}
      <View style={styles.tapeHighlight} />

      <Text
        style={[
          styles.tapeText,
          {
            color: getTextColor(),
            fontSize,
          },
        ]}
      >
        {text.toUpperCase()}
      </Text>

      {/* Subtle bottom shadow line simulating tape thickness */}
      <View style={styles.tapeShadow} />
    </View>
  );
};

const styles = StyleSheet.create({
  tapeContainer: {
    alignSelf: 'flex-start',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 2,
  },
  tapeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tapeShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  tapeText: {
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", "Courier New", monospace',
      default: 'monospace',
    }),
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0.5, height: 1 },
    textShadowRadius: 1,
  },
});
