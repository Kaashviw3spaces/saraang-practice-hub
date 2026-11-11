import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Image } from 'react-native';
import { SessionType } from '../api/client';
import { AnimatedPressable } from './AnimatedPressable';
import { RockTextureOverlay } from './RockTextureOverlay';
import { SoundwaveSvg } from './SoundwaveSvg';
import { LightningSvg } from './LightningSvg';

interface SessionCardProps {
  session: SessionType;
  isSelected?: boolean;
  onBookSlot: () => void;
  roomNumber?: string;
  stageNumber?: string;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isSelected = false,
  onBookSlot,
  roomNumber,
  stageNumber = '01',
}) => {
  const displayRoomNumber = roomNumber || stageNumber;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: isSelected ? 1 : 0,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isSelected, checkAnim]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const getSessionMeta = (name: string) => {
    const n = (name || '').toUpperCase();
    if (n.includes('SESSION A')) {
      return {
        title: 'SESSION A',
        modes: 'Solo • Collaborative',
        bandTag: 'MAJOR NOISE COMPLAINTS',
        tagColor: '#EF4444',
        accentColor: '#B91C1C',
        waveVariant: 'metallica' as const,
        watermarkImage: require('../../assets/band6.jpg'),
        description: 'Amplified practice space for drums, electric guitar and Full Band rehearsals',
        capacity: '8',
      };
    }
    if (n.includes('SESSION B')) {
      return {
        title: 'SESSION B',
        modes: 'Collaborative Practice',
        bandTag: 'EASY DOES IT',
        tagColor: '#FFFFFF',
        accentColor: '#9E9891',
        waveVariant: 'arctic' as const,
        watermarkImage: require('../../assets/band1.jpg'),
        description: 'Practice space ideal for acoustic guitar, keyboards, vocals and bass.',
        capacity: '6',
      };
    }
    if (n.includes('JAM SESSION')) {
      return {
        title: 'JAM SESSION',
        modes: 'Jam • Ensemble',
        bandTag: 'NO PLANS, JUST PLAY',
        tagColor: '#A855F7',
        accentColor: '#8B5CF6',
        waveVariant: 'dense' as const,
        watermarkImage: require('../../assets/band4.avif'),
        description: 'Open jam space for multi-instrument collaborative sessions and small bands.',
        capacity: '8',
      };
    }
    if (n.includes('MEETING SESSION')) {
      return {
        title: 'MEETING SESSIOM',
        modes: 'Discussion • Planning',
        bandTag: 'BEHIND THE SCENESE',
        tagColor: '#FFFFFF',
        accentColor: '#9E9891',
        waveVariant: 'pulse' as const,
        watermarkImage: require('../../assets/band2.jpg'),
        description: 'Band meetings, production planning, setlist curation. No instruments needed.',
        capacity: '10',
      };
    }
    return {
      title: 'RECORDING STUDIO',
      modes: 'Solo • Group',
      bandTag: 'PERFECTION TAKES 27 TAKES',
      tagColor: '#00E5FF',
      accentColor: '#0284C7',
      waveVariant: 'metallica' as const,
      watermarkImage: require('../../assets/band3.jpg'),
      description: 'Isolated recording space for solo instruments or multi-instruments.',
      capacity: '4',
    };
  };

  const meta = getSessionMeta(session.name);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && [styles.selectedCard, { borderColor: meta.tagColor, shadowColor: meta.tagColor }],
        ]}
        activeOpacity={0.92}
        onPress={onBookSlot}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Subtle Amplifier / Stage Texture */}
        <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.05} />

        {/* Authentic Rock Band Watermark Image */}
        {meta.watermarkImage && (
          <Image
            source={meta.watermarkImage}
            style={[styles.cardWatermark, isSelected && styles.cardWatermarkSelected]}
            resizeMode="cover"
          />
        )}

        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.stageIndicator}>
            <Text style={styles.stageText}>ROOM // {displayRoomNumber}</Text>
          </View>

          <View style={styles.headerRight}>
            {isSelected ? (
              <Animated.View
                style={[
                  styles.selectedBadge,
                  {
                    backgroundColor: meta.tagColor,
                    borderColor: '#FFFFFF',
                    transform: [
                      {
                        scale: checkAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.6, 1],
                        }),
                      },
                    ],
                    opacity: checkAnim,
                  },
                ]}
              >
                <Text style={[styles.checkIcon, { color: '#0D0D10' }]}>✓</Text>
                <Text style={[styles.selectedBadgeText, { color: '#0D0D10' }]}>SELECTED</Text>
              </Animated.View>
            ) : (
              <View style={styles.badge}>
                <Animated.View style={[styles.badgeDot, { opacity: pulseAnim, backgroundColor: meta.tagColor }]} />
                <Text style={styles.badgeText}>STAGE OPEN</Text>
              </View>
            )}
          </View>
        </View>

        {/* Band Aesthetic Pill Tag */}
        <View style={[styles.bandTagBadge, { borderColor: meta.tagColor }]}>
          <LightningSvg color={meta.tagColor} size={11} style={{ marginRight: 4 }} />
          <Text style={[styles.bandTagText, { color: meta.tagColor }]}>{meta.bandTag}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{meta.title}</Text>

        {/* Mini Soundwave visualizer styled from the band */}
        <View style={styles.cardSoundwaveWrap}>
          <SoundwaveSvg
            color={meta.accentColor}
            secondaryColor={meta.tagColor}
            height={16}
            variant={meta.waveVariant}
          />
        </View>

        {/* Pill-shaped tag for allowed modes */}
        <View style={styles.modesPillRow}>
          <View style={[styles.modesPill, isSelected && [styles.modesPillSelected, { borderColor: meta.tagColor }]]}>
            <Text style={styles.modesPillText}>{meta.modes}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{meta.description}</Text>

        {/* Footer */}
        <View style={styles.footerRow}>
          <View style={styles.capContainer}>
            <Text style={styles.capText}>CAP // {meta.capacity} MUSICIANS</Text>
          </View>

          <View
            style={[
              styles.bookButton,
              isSelected
                ? [styles.bookButtonSelected, { backgroundColor: meta.tagColor, borderColor: '#FFFFFF' }]
                : { backgroundColor: '#F6F2EB' },
            ]}
          >
            <Text
              style={[
                styles.bookButtonText,
                isSelected ? [styles.bookButtonTextSelected, { color: '#0D0D10' }] : { color: '#0D0D10' },
              ]}
            >
              {isSelected ? '✓ SELECTED' : 'BOOK SLOT →'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 310,
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 12,
    padding: 22,
    marginRight: 16,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  selectedCard: {
    backgroundColor: '#2A0E13',
    borderColor: '#82191F',
    shadowColor: '#82191F',
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  cardWatermark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '45%',
    opacity: 0.10,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  cardWatermarkSelected: {
    opacity: 0.22,
    width: '55%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  stageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageText: {
    color: '#9E9891',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#32282C',
    backgroundColor: '#0D0D10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9E9891',
    marginRight: 6,
  },
  badgeText: {
    color: '#9E9891',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#82191F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A8222A',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginRight: 4,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bandTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  bandTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  cardSoundwaveWrap: {
    marginVertical: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 10,
    color: '#F6F2EB',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  modesPillRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modesPill: {
    backgroundColor: '#1E1E24',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A2A34',
  },
  modesPillSelected: {
    backgroundColor: '#5C1A1B',
    borderColor: '#82191F',
  },
  modesPillText: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  description: {
    color: '#9E9891',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#261C20',
  },
  capContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capText: {
    color: '#9E9891',
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  bookButton: {
    backgroundColor: '#F6F2EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  bookButtonSelected: {
    backgroundColor: '#82191F',
    borderColor: '#A8222A',
  },
  bookButtonText: {
    color: '#0D0D10',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bookButtonTextSelected: {
    color: '#FFFFFF',
  },
});
