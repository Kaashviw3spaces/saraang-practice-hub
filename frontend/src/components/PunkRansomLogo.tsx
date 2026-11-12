import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const PunkRansomLogo: React.FC = () => {
  const letters = [
    { char: 'S', bg: '#121212', text: '#FFFFFF', border: '#EFECE6', rot: -2.5, width: 22 },
    { char: 'A', bg: '#EFECE6', text: '#121212', border: '#121212', rot: 1.8, width: 20 },
    { char: 'A', bg: '#D9383A', text: '#FFFFFF', border: '#EFECE6', rot: -1.0, width: 20 },
    { char: 'R', bg: '#EFECE6', text: '#121212', border: '#121212', rot: 2.2, width: 20 },
    { char: 'A', bg: '#121212', text: '#FFFFFF', border: '#EFECE6', rot: -1.8, width: 20 },
    { char: 'N', bg: '#EFECE6', text: '#121212', border: '#121212', rot: 1.5, width: 21 },
    { char: 'G', bg: '#BCE83A', text: '#121212', border: '#121212', rot: -2.0, width: 23 },
  ];

  return (
    <View style={styles.outerContainer}>
      {/* Ransom Note Letter Scraps Row */}
      <View style={styles.lettersRow}>
        {letters.map((item, idx) => (
          <View
            key={`ransom-${idx}`}
            style={[
              styles.letterScrap,
              {
                backgroundColor: item.bg,
                borderColor: item.border,
                transform: [{ rotate: `${item.rot}deg` }],
                width: item.width,
              },
            ]}
          >
            <Text
              style={[
                styles.ransomLetterText,
                {
                  color: item.text,
                },
              ]}
            >
              {item.char}
            </Text>
          </View>
        ))}
      </View>

      {/* Sub-tag row with Hand-drawn Punk Arrow and "THE MUSIC CLUB" */}
      <View style={styles.subTagRow}>
        {/* Bold Hand-drawn Punk Arrow SVG */}
        <Svg width="26" height="14" viewBox="0 0 26 14" fill="none" style={styles.arrowSvg}>
          <Path
            d="M 2 7 L 22 7 M 16 2 L 23 7 L 16 12"
            stroke="#D9383A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        <View style={styles.musicClubTape}>
          <Text style={styles.musicClubText}>THE MUSIC CLUB</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    transform: [{ rotate: '-2deg' }],
    alignSelf: 'flex-start',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
  letterScrap: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 3,
  },
  ransomLetterText: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
    letterSpacing: -0.5,
    marginTop: -2,
  },
  subTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 6,
  },
  arrowSvg: {
    marginRight: 2,
  },
  musicClubTape: {
    backgroundColor: '#EFECE6',
    borderWidth: 1.5,
    borderColor: '#121212',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 1,
    shadowColor: '#D9383A',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  musicClubText: {
    color: '#121212',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    fontFamily: Platform.select({
      web: '"Oswald", "Space Mono", sans-serif',
      default: 'sans-serif',
    }),
  },
});
