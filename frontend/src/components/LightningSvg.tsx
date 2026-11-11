import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface LightningSvgProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export const LightningSvg: React.FC<LightningSvgProps> = ({
  color = '#FFFFFF',
  size = 18,
  style,
}) => {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* AC/DC & Metallica sharp electric bolt */}
        <Path
          d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
          fill={color}
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};
