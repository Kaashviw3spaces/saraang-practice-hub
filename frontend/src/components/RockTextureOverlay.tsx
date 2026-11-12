import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Line, Circle } from 'react-native-svg';

interface RockTextureOverlayProps {
  style?: ViewStyle;
  opacity?: number;
  pattern?: 'mesh' | 'dots' | 'grooves' | 'grit' | 'halftone';
  color?: string;
}

export const RockTextureOverlay: React.FC<RockTextureOverlayProps> = ({
  style,
  opacity = 0.06,
  pattern = 'mesh',
  color = '#FFFFFF',
}) => {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {pattern === 'mesh' && (
            <Pattern id="rockPattern" width="6" height="6" patternUnits="userSpaceOnUse">
              <Circle cx="1.5" cy="1.5" r="0.75" fill={color} fillOpacity={opacity * 1.5} />
              <Circle cx="4.5" cy="4.5" r="0.75" fill={color} fillOpacity={opacity * 1.5} />
            </Pattern>
          )}

          {pattern === 'grit' && (
            <Pattern id="rockPattern" width="8" height="8" patternUnits="userSpaceOnUse">
              <Circle cx="1" cy="2" r="0.5" fill={color} fillOpacity={opacity * 2.2} />
              <Circle cx="5" cy="1" r="0.8" fill={color} fillOpacity={opacity * 1.8} />
              <Circle cx="3" cy="6" r="0.6" fill={color} fillOpacity={opacity * 2.5} />
              <Circle cx="7" cy="5" r="0.4" fill={color} fillOpacity={opacity * 1.5} />
            </Pattern>
          )}

          {pattern === 'halftone' && (
            <Pattern id="rockPattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="1.2" fill={color} fillOpacity={opacity * 2.5} />
              <Circle cx="7" cy="7" r="1.2" fill={color} fillOpacity={opacity * 2.5} />
              <Circle cx="7" cy="2" r="0.6" fill={color} fillOpacity={opacity * 1.5} />
              <Circle cx="2" cy="7" r="0.6" fill={color} fillOpacity={opacity * 1.5} />
            </Pattern>
          )}

          {pattern === 'grooves' && (
            <Pattern id="rockPattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <Line
                x1="0"
                y1="5"
                x2="10"
                y2="5"
                stroke={color}
                strokeWidth="0.6"
                strokeOpacity={opacity * 1.8}
              />
            </Pattern>
          )}

          {pattern === 'dots' && (
            <Pattern id="rockPattern" width="12" height="12" patternUnits="userSpaceOnUse">
              <Circle cx="3" cy="3" r="1" fill={color} fillOpacity={opacity * 2} />
              <Circle cx="9" cy="9" r="1" fill={color} fillOpacity={opacity * 2} />
            </Pattern>
          )}
        </Defs>

        <Rect width="100%" height="100%" fill="url(#rockPattern)" />
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
