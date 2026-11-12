import React from 'react';
import { View, StyleSheet, ViewStyle, Image } from 'react-native';
import Svg, { Rect, Pattern, Defs, Circle } from 'react-native-svg';

interface RockTextureOverlayProps {
  style?: ViewStyle;
  opacity?: number;
  pattern?: 'mesh' | 'dots' | 'grooves' | 'zineGrain';
}

export const RockTextureOverlay: React.FC<RockTextureOverlayProps> = ({
  style,
  opacity = 0.08,
  pattern = 'zineGrain',
}) => {
  if (pattern === 'mesh') {
    return (
      <View style={[styles.container, style]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="meshGrid" width="6" height="6" patternUnits="userSpaceOnUse">
              <Circle cx="1" cy="1" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#meshGrid)" />
        </Svg>
      </View>
    );
  }

  if (pattern === 'dots') {
    return (
      <View style={[styles.container, style]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="cardDots" width="10" height="10" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="0.7" fill="#000000" fillOpacity={opacity * 1.8} />
              <Circle cx="7" cy="7" r="0.7" fill="#000000" fillOpacity={opacity * 1.8} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#cardDots)" />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* 1. Exact Asphalt Paper & Film Grain Backdrop Tile (From Screenshot) */}
      <Image
        source={require('../../assets/bg_asphalt_exact.png')}
        style={styles.asphaltBg}
        resizeMode="repeat"
      />

      {/* 2. Authentic Zine Halftone Screen Print Column along Left Margin (From Screenshot) */}
      <Image
        source={require('../../assets/bg_halftone_left.png')}
        style={styles.leftHalftoneStrip}
        resizeMode="repeat"
      />

      {/* 3. Subtle Chalk Dust & Paper Fiber Speckles */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Pattern id="chalkDustOverlay" width="32" height="32" patternUnits="userSpaceOnUse">
            <Circle cx="5" cy="12" r="0.7" fill="#FFFFFF" fillOpacity={opacity * 1.8} />
            <Circle cx="22" cy="7" r="1.0" fill="#FFFFFF" fillOpacity={opacity * 2.2} />
            <Circle cx="16" cy="24" r="0.8" fill="#FFFFFF" fillOpacity={opacity * 1.6} />
            <Circle cx="29" cy="19" r="0.5" fill="#FFFFFF" fillOpacity={opacity * 2.0} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#chalkDustOverlay)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  asphaltBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  leftHalftoneStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 70,
    height: '100%',
    opacity: 0.85,
  },
});
