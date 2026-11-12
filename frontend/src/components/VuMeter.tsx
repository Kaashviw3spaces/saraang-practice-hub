import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';

interface VuMeterProps {
  value: number; // 0 to 3 (or 0 to 100)
  label?: string;
  sublabel?: string;
}

export const VuMeter: React.FC<VuMeterProps> = ({
  value = 0,
  label = '0/3 BOOKED TODAY',
  sublabel = 'DAILY SETLIST QUOTA',
}) => {
  const needleAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(needleAnim, {
      toValue: value,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [value, needleAnim]);

  // Interpolate angle: 0 -> -36deg, 1 -> -14deg, 2 -> +8deg, 3 -> +32deg
  const needleRotate = needleAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['-36deg', '-14deg', '8deg', '32deg'],
  });

  return (
    <View style={styles.container}>
      {/* Outer Brutalist Enclosure */}
      <View style={styles.bezelFrame}>
        {/* Backlit Amber Dial Glass Face */}
        <View style={styles.dialFace}>
          <Svg width="100%" height="86" viewBox="0 0 160 86" preserveAspectRatio="xMidYMid meet">
            <Defs>
              <LinearGradient id="amberBacklight" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFF2B2" />
                <Stop offset="40%" stopColor="#FAD872" />
                <Stop offset="100%" stopColor="#DFB346" />
              </LinearGradient>
              <LinearGradient id="glassGlare" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* Backlit Dial Plate */}
            <Rect x="0" y="0" width="160" height="86" fill="url(#amberBacklight)" rx="2" />

            {/* Scale Arcs: Safe Black Zone & Red Peak Zone */}
            {/* Safe zone (-20 to 0) */}
            <Path
              d="M 24 64 A 75 75 0 0 1 114 26"
              fill="none"
              stroke="#121212"
              strokeWidth="2"
            />
            {/* Danger red zone (0 to +3) */}
            <Path
              d="M 114 26 A 75 75 0 0 1 140 38"
              fill="none"
              stroke="#FF1E27"
              strokeWidth="3.5"
            />

            {/* Scale Ticks & dB Labels */}
            {/* -20 */}
            <Line x1="28" y1="62" x2="34" y2="58" stroke="#121212" strokeWidth="1.5" />
            <SvgText x="32" y="70" fontSize="7" fontWeight="bold" fill="#121212" textAnchor="middle">-20</SvgText>

            {/* -10 */}
            <Line x1="50" y1="46" x2="55" y2="43" stroke="#121212" strokeWidth="1.5" />
            <SvgText x="52" y="55" fontSize="7" fontWeight="bold" fill="#121212" textAnchor="middle">-10</SvgText>

            {/* -5 */}
            <Line x1="78" y1="34" x2="81" y2="30" stroke="#121212" strokeWidth="1.5" />
            <SvgText x="80" y="42" fontSize="7" fontWeight="bold" fill="#121212" textAnchor="middle">-5</SvgText>

            {/* 0 dB threshold */}
            <Line x1="114" y1="26" x2="114" y2="20" stroke="#FF1E27" strokeWidth="2.5" />
            <SvgText x="114" y="16" fontSize="8" fontWeight="bold" fill="#FF1E27" textAnchor="middle">0</SvgText>

            {/* +3 dB peak */}
            <Line x1="140" y1="38" x2="145" y2="42" stroke="#FF1E27" strokeWidth="2" />
            <SvgText x="144" y="50" fontSize="7" fontWeight="bold" fill="#FF1E27" textAnchor="middle">+3</SvgText>

            {/* Vintage "VU" typographic branding */}
            <SvgText x="80" y="66" fontSize="13" fontWeight="900" fill="#121212" textAnchor="middle" letterSpacing="1">
              VU
            </SvgText>
            <SvgText x="80" y="75" fontSize="5.5" fontWeight="bold" fill="#52441D" textAnchor="middle" letterSpacing="0.8">
              VOLUME UNIT
            </SvgText>

            {/* Diagonal glass reflection highlight */}
            <Path d="M 0 0 L 80 0 L 0 60 Z" fill="url(#glassGlare)" />
          </Svg>

          {/* Animated Analog Needle (rotates around center pivot at bottom) */}
          <View style={styles.needlePivotAnchor}>
            <Animated.View
              style={[
                styles.needleStick,
                {
                  transform: [{ rotate: needleRotate }],
                },
              ]}
            >
              {/* Slender red needle with tapered tip */}
              <View style={styles.needleBlade} />
            </Animated.View>
          </View>

          {/* Heavy Bakelite Pivot Cap at bottom */}
          <View style={styles.pivotCap} />
        </View>
      </View>

      {/* Monospace Reading & Status Label */}
      <View style={styles.readoutBox}>
        <View style={styles.readoutHeaderRow}>
          <View style={[styles.ledIndicator, value >= 3 ? styles.ledRed : value > 0 ? styles.ledLime : styles.ledDim]} />
          <Text style={styles.quotaTitle}>{label}</Text>
        </View>
        <Text style={styles.quotaSubtitle}>{sublabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 4,
  },
  bezelFrame: {
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: '#38383A',
    borderRadius: 4,
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 4,
    width: 172,
  },
  dialFace: {
    width: 160,
    height: 86,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7DC8B',
    borderWidth: 1,
    borderColor: '#4A3B18',
  },
  needlePivotAnchor: {
    position: 'absolute',
    bottom: -8,
    left: 80,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  needleStick: {
    width: 2,
    height: 78,
    alignItems: 'center',
    transformOrigin: 'bottom center' as any,
  },
  needleBlade: {
    width: 2,
    height: 68,
    backgroundColor: '#FF1E27',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  pivotCap: {
    position: 'absolute',
    bottom: -10,
    left: 70,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#121212',
    borderWidth: 2,
    borderColor: '#71717A',
    zIndex: 10,
  },
  readoutBox: {
    alignItems: 'center',
    marginTop: 6,
  },
  readoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ledIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ledLime: {
    backgroundColor: '#CCFF00',
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  ledRed: {
    backgroundColor: '#FF1E27',
    shadowColor: '#FF1E27',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  ledDim: {
    backgroundColor: '#4A4A52',
  },
  quotaTitle: {
    color: '#EFECE6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  quotaSubtitle: {
    color: '#9E9891',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 2,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
});
