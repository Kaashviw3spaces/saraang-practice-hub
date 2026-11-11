import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SoundwaveSvgProps {
  color?: string;
  secondaryColor?: string;
  height?: number;
  width?: number | string;
  style?: ViewStyle;
  variant?: 'arctic' | 'dense' | 'pulse' | 'metallica';
}

export const SoundwaveSvg: React.FC<SoundwaveSvgProps> = ({
  color = '#EF4444',
  secondaryColor = '#00E5FF',
  height = 24,
  style,
  variant = 'arctic',
}) => {
  return (
    <View style={[styles.container, { height }, style]}>
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 300 24"
        preserveAspectRatio="none"
      >
        {variant === 'arctic' && (
          <>
            {/* Arctic Monkeys AM inspired wave silhouette */}
            <Path
              d="M0 12 L20 12 L30 11 L40 13 L50 10 L60 14 L70 9 L80 15 L90 7 L100 17 L110 5 L120 19 L130 3 L138 21 L144 2 L150 22 L156 2 L162 21 L170 3 L180 19 L190 5 L200 17 L210 7 L220 15 L230 9 L240 14 L250 10 L260 13 L270 11 L280 12 L300 12"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dual channel harmonic line */}
            <Path
              d="M40 12 L60 11 L80 13 L100 10 L120 14 L135 8 L145 16 L150 7 L155 17 L165 8 L180 14 L200 10 L220 13 L240 11 L260 12"
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.2"
              opacity={0.7}
              strokeLinecap="round"
            />
          </>
        )}

        {variant === 'metallica' && (
          <>
            {/* Ride the Lightning jagged electric surge */}
            <Path
              d="M0 12 L20 12 L35 15 L45 8 L55 16 L65 4 L75 20 L85 2 L95 22 L105 1 L115 23 L125 0 L135 24 L145 2 L155 22 L165 1 L175 23 L185 3 L195 21 L205 5 L215 19 L225 7 L235 17 L245 9 L255 15 L270 12 L300 12"
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M30 12 L60 12 L85 6 L110 18 L135 5 L150 19 L165 5 L190 18 L215 6 L240 12 L270 12"
              fill="none"
              stroke={color}
              strokeWidth="1"
              opacity={0.8}
              strokeLinecap="round"
            />
          </>
        )}

        {variant === 'dense' && (
          <Path
            d="M0 12 L15 12 L25 8 L35 16 L45 6 L55 18 L65 4 L75 20 L85 3 L95 21 L105 2 L115 22 L125 1 L135 23 L145 1 L150 23 L155 1 L165 23 L175 1 L185 22 L195 2 L205 21 L215 3 L225 20 L235 4 L245 18 L255 6 L265 16 L275 8 L285 12 L300 12"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {variant === 'pulse' && (
          <Path
            d="M0 12 L80 12 L95 12 L105 4 L115 20 L125 2 L135 22 L145 6 L155 18 L165 12 L300 12"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
