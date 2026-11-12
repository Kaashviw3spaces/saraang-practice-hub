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
  opacity = 0.03,
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

      {/* 2. Ultra-Subtle Paper Fiber Speckles */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Pattern id="chalkDustOverlay" width="36" height="36" patternUnits="userSpaceOnUse">
            <Circle cx="6" cy="12" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.2} />
            <Circle cx="24" cy="8" r="0.8" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
            <Circle cx="18" cy="26" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.0} />
            <Circle cx="31" cy="20" r="0.5" fill="#FFFFFF" fillOpacity={opacity * 1.2} />
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
    opacity: 0.22,
  },
});
