import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Line, Circle } from 'react-native-svg';

interface RockTextureOverlayProps {
  style?: ViewStyle;
  opacity?: number;
  pattern?: 'mesh' | 'dots' | 'grooves';
}

export const RockTextureOverlay: React.FC<RockTextureOverlayProps> = ({
  style,
  opacity = 0.06,
  pattern = 'mesh',
}) => {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {pattern === 'mesh' && (
            <Pattern
              id="ampMesh"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="1.5" cy="1.5" r="0.75" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
              <Circle cx="4.5" cy="4.5" r="0.75" fill="#FFFFFF" fillOpacity={opacity * 1.5} />
            </Pattern>
          )}

          {pattern === 'grooves' && (
            <Pattern
              id="ampMesh"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <Line
                x1="0"
                y1="5"
                x2="10"
                y2="5"
                stroke="#FFFFFF"
                strokeWidth="0.6"
                strokeOpacity={opacity * 1.8}
              />
            </Pattern>
          )}

          {pattern === 'dots' && (
            <Pattern
              id="ampMesh"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="3" cy="3" r="1" fill="#FFFFFF" fillOpacity={opacity * 2} />
              <Circle cx="9" cy="9" r="1" fill="#FFFFFF" fillOpacity={opacity * 2} />
            </Pattern>
          )}
        </Defs>

        <Rect width="100%" height="100%" fill="url(#ampMesh)" />
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
