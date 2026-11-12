import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Line, Polygon } from 'react-native-svg';

interface HazardTapeDividerProps {
  style?: ViewStyle;
}

export const HazardTapeDivider: React.FC<HazardTapeDividerProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      {/* Industrial Calibrated Hash-Mark Band in Pale Bone & Graphite */}
      <View style={styles.tapeStrip}>
        <Svg width="100%" height="16">
          <Defs>
            <Pattern
              id="distressedHashPattern"
              width="24"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              {/* Background */}
              <Rect width="24" height="16" fill="#18181C" />
              {/* Metric Calibrated Ticks */}
              <Line x1="0" y1="0" x2="0" y2="16" stroke="#2B2B33" strokeWidth="1" />
              <Line x1="6" y1="0" x2="6" y2="6" stroke="#444450" strokeWidth="1" />
              <Line x1="12" y1="0" x2="12" y2="10" stroke="#8E8B82" strokeWidth="1.2" />
              <Line x1="18" y1="0" x2="18" y2="6" stroke="#444450" strokeWidth="1" />
              {/* Pale Bone Accent Hash */}
              <Line x1="24" y1="0" x2="24" y2="16" stroke="#D8D4C8" strokeWidth="1" strokeDasharray="3,3" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="16" fill="url(#distressedHashPattern)" />
        </Svg>
      </View>

      {/* Tactile Ripped Paper Edge Polygon in Matte Canvas Asphalt */}
      <View style={styles.tornEdgeWrap}>
        <Svg width="100%" height="10" viewBox="0 0 600 10" preserveAspectRatio="none">
          <Polygon
            points="
              0,0
              25,5 50,1 75,6 100,2 130,7 160,3 190,6 220,2 250,7 280,3 310,6 340,1 370,5 400,2 430,7 460,3 490,6 520,2 550,6 575,2 600,5
              600,10 0,10
            "
            fill="#121214"
          />
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 14,
    position: 'relative',
  },
  tapeStrip: {
    width: '100%',
    height: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#26262D',
    overflow: 'hidden',
  },
  tornEdgeWrap: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    height: 10,
    zIndex: 2,
  },
});
