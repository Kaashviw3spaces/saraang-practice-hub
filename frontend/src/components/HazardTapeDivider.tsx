import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Pattern, Defs, Polygon, Line } from 'react-native-svg';

interface HazardTapeDividerProps {
  style?: ViewStyle;
}

export const HazardTapeDivider: React.FC<HazardTapeDividerProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      {/* 1. Top White Fibrous Page Tear Layer overlapping over Hazard Tape */}
      <View style={styles.topTearWrap}>
        <Svg width="100%" height="16" viewBox="0 0 600 16" preserveAspectRatio="none">
          {/* Subtle paper shadow */}
          <Polygon
            points="
              0,0
              15,9 35,5 55,11 80,6 110,13 140,7 165,12 195,6 225,14 255,8 285,13 315,6 345,12 375,7 405,14 435,8 465,13 495,6 525,12 555,7 580,13 600,8
              600,0 0,0
            "
            fill="rgba(0, 0, 0, 0.45)"
          />
          {/* Authentic white/cream fibrous torn paper edge */}
          <Polygon
            points="
              0,0
              15,8 35,4 55,10 80,5 110,12 140,6 165,11 195,5 225,13 255,7 285,12 315,5 345,11 375,6 405,13 435,7 465,12 495,5 525,11 555,6 580,12 600,7
              600,0 0,0
            "
            fill="#F7F5EE"
          />
        </Svg>
      </View>

      {/* 2. Industrial 45-degree Yellow & Black Hazard Caution Stripes */}
      <View style={styles.hazardStrip}>
        <Svg width="100%" height="24">
          <Defs>
            <Pattern
              id="hazardStripePattern"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Rect width="12" height="24" fill="#FFD600" />
              <Rect x="12" width="12" height="24" fill="#141416" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="24" fill="url(#hazardStripePattern)" />
        </Svg>
      </View>

      {/* 3. Bottom White Fibrous Page Tear Layer overlapping under Hazard Tape */}
      <View style={styles.bottomTearWrap}>
        <Svg width="100%" height="16" viewBox="0 0 600 16" preserveAspectRatio="none">
          {/* Authentic white/cream fibrous torn paper edge */}
          <Polygon
            points="
              0,0
              20,8 45,4 70,11 95,5 125,12 155,6 180,11 210,5 240,13 270,7 300,12 330,5 360,11 390,6 420,13 450,7 480,12 510,5 540,11 570,6 600,10
              600,16 0,16
            "
            fill="#F7F5EE"
          />
          {/* Subtle bottom shadow casting onto background */}
          <Polygon
            points="
              0,14
              20,15 45,14 70,16 95,14 125,16 155,14 180,16 210,14 240,16 270,15 300,16 330,14 360,16 390,14 420,16 450,15 480,16 510,14 540,16 570,15 600,16
              600,16 0,16
            "
            fill="rgba(0, 0, 0, 0.4)"
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
  topTearWrap: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    height: 16,
    zIndex: 3,
  },
  hazardStrip: {
    width: '100%',
    height: 24,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#141416',
    overflow: 'hidden',
  },
  bottomTearWrap: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    height: 16,
    zIndex: 3,
  },
});
