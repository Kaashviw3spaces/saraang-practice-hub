import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Path, Polygon } from 'react-native-svg';

interface HazardTapeDividerProps {
  style?: ViewStyle;
}

export const HazardTapeDivider: React.FC<HazardTapeDividerProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      {/* Industrial Yellow & Black 45-degree Hazard Caution Stripes */}
      <View style={styles.hazardStrip}>
        <Svg width="100%" height="22">
          <Defs>
            <Pattern
              id="hazardStripePattern"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Rect width="12" height="24" fill="#FFD600" />
              <Rect x="12" width="12" height="24" fill="#121212" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="22" fill="url(#hazardStripePattern)" />
        </Svg>
      </View>

      {/* Distressed Ripped / Torn Paper Edge Layered Over the Hazard Tape */}
      <View style={styles.tornEdgeWrap}>
        <Svg width="100%" height="14" viewBox="0 0 600 14" preserveAspectRatio="none">
          {/* Jagged, torn paper contour */}
          <Polygon
            points="
              0,0
              20,7 35,2 55,9 70,3 90,11 115,4 135,9 155,2 175,8 195,3 220,10 240,4 265,11 285,3 305,9 325,2 345,8 370,4 395,11 415,3 435,9 455,2 475,8 500,4 520,10 545,3 565,9 585,4 600,8
              600,14 0,14
            "
            fill="#121212"
          />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 18,
    position: 'relative',
  },
  hazardStrip: {
    width: '100%',
    height: 22,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#121212',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  tornEdgeWrap: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    height: 14,
    zIndex: 2,
  },
});
