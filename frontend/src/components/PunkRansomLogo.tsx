import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { RockTextureOverlay } from './RockTextureOverlay';

export const PunkRansomLogo: React.FC = () => {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.mastheadFrame}>
        {/* Gritty Film Grain Texture Overlay */}
        <RockTextureOverlay pattern="grit" opacity={0.06} color="#FFFFFF" />

        {/* Top Mechanical Index Bar */}
        <View style={styles.indexBar}>
          <View style={styles.statusIndicator}>
            <View style={styles.statusLed} />
            <Text style={styles.indexMonoText}>EST. 2026 // AUDIO ARCHIVE</Text>
          </View>
          <Text style={styles.indexChamberText}>CH. 01</Text>
        </View>

        {/* Main Brand Title: Heavy, Pale Bone Condensed Letterforms with Gritty Shadow */}
        <View style={styles.titleRow}>
          <Text style={styles.brandTitle}>SAARANG</Text>
          <View style={styles.ampDotStamp}>
            <Text style={styles.ampDotText}>⚡</Text>
          </View>
        </View>

        {/* Subtitle Bar: Gritty Monospace Music Club Tag */}
        <View style={styles.subBar}>
          <View style={styles.clubPill}>
            <Text style={styles.clubPillText}>THE MUSIC CLUB</Text>
          </View>
          <Text style={styles.subDivider}>•</Text>
          <Text style={styles.hubMonoText}>PRACTICE HUB</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    alignSelf: 'flex-start',
  },
  mastheadFrame: {
    backgroundColor: '#161619',
    borderWidth: 1.5,
    borderColor: '#2F2F36',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 2,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
    elevation: 3,
  },
  indexBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#24242B',
    paddingBottom: 3,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLed: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C83838',
    marginRight: 5,
  },
  indexMonoText: {
    color: '#8A867E',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", "JetBrains Mono", monospace',
      default: 'monospace',
    }),
  },
  indexChamberText: {
    color: '#B0AAA0',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#EAE6DC',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.5,
    fontFamily: Platform.select({
      web: '"Anton", "Impact", "Oswald", sans-serif',
      default: 'sans-serif',
    }),
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
  },
  ampDotStamp: {
    marginLeft: 6,
    backgroundColor: '#26262E',
    borderWidth: 1,
    borderColor: '#3D3D47',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  ampDotText: {
    color: '#E0A96D',
    fontSize: 10,
    fontWeight: '900',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  clubPill: {
    backgroundColor: '#EAE6DC',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 1,
  },
  clubPillText: {
    color: '#121214',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  subDivider: {
    color: '#C83838',
    fontSize: 9,
    marginHorizontal: 5,
    fontWeight: '900',
  },
  hubMonoText: {
    color: '#A8A49C',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
});
