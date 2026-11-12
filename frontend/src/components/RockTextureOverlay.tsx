import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Circle, Line, RadialGradient, Stop } from 'react-native-svg';

interface RockTextureOverlayProps {
  style?: ViewStyle;
  opacity?: number;
  pattern?: 'mesh' | 'dots' | 'grooves' | 'zineGrain';
}

export const RockTextureOverlay: React.FC<RockTextureOverlayProps> = ({
  style,
  opacity = 0.06,
  pattern = 'zineGrain',
}) => {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {/* 1. Fine High-Frequency Rough Punk Film Grain */}
          <Pattern id="roughGrain" width="8" height="8" patternUnits="userSpaceOnUse">
            <Circle cx="1.5" cy="1.5" r="0.65" fill="#FFFFFF" fillOpacity={opacity * 1.8} />
            <Circle cx="5.5" cy="2.5" r="0.45" fill="#FFFFFF" fillOpacity={opacity * 1.4} />
            <Circle cx="3.5" cy="6.0" r="0.8" fill="#FFFFFF" fillOpacity={opacity * 2.2} />
            <Circle cx="7.0" cy="5.0" r="0.4" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
          </Pattern>

          {/* 2. Zine Halftone Screen Print Cluster (Left Edge & Margins) */}
          <Pattern id="halftoneScreen" width="12" height="12" patternUnits="userSpaceOnUse">
            <Circle cx="3" cy="3" r="1.3" fill="#FFFFFF" fillOpacity={opacity * 2.4} />
            <Circle cx="9" cy="9" r="1.3" fill="#FFFFFF" fillOpacity={opacity * 2.4} />
            <Circle cx="9" cy="3" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.2} />
            <Circle cx="3" cy="9" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.2} />
          </Pattern>

          {/* 3. Subtle Chalk Dust Noise Stipple */}
          <Pattern id="chalkDust" width="24" height="24" patternUnits="userSpaceOnUse">
            <Circle cx="4" cy="8" r="0.5" fill="#FFFFFF" fillOpacity={opacity * 1.6} />
            <Circle cx="16" cy="4" r="0.9" fill="#FFFFFF" fillOpacity={opacity * 2.0} />
            <Circle cx="12" cy="18" r="0.6" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
            <Circle cx="21" cy="14" r="0.4" fill="#FFFFFF" fillOpacity={opacity * 1.8} />
          </Pattern>
        </Defs>

        {/* Global Rough Gritty Grain Background */}
        <Rect width="100%" height="100%" fill="url(#roughGrain)" />
        {/* Subtle Chalk Dust Stipple */}
        <Rect width="100%" height="100%" fill="url(#chalkDust)" />

        {/* Left-edge Zine Halftone Print Screen (Matches Screenshot) */}
        <Rect x="0" y="0" width="70" height="100%" fill="url(#halftoneScreen)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
