import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { SessionType } from '../api/client';
import { RockTextureOverlay } from './RockTextureOverlay';
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

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
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
        bandTag: 'AC/DC // TUBE STACK RIG',
        description: 'Full band rehearsals, solo drums or electric guitar, collaborative jams.',
        capacity: '8',
      };
    }
    if (n.includes('SESSION B')) {
      return {
        title: 'SESSION B',
        modes: 'Collaborative Practice',
        bandTag: 'THE BEATLES // ABBEY ROAD',
        description: 'Acoustic & low-gain focus. Acoustic guitar, keys, vocals, bass.',
        capacity: '6',
      };
    }
    if (n.includes('JAM SESSION')) {
      return {
        title: 'JAM SESSION',
        modes: 'Jam • Ensemble',
        bandTag: 'ARENA ROCK // LIVE ENSEMBLE',
        description: 'Multi-instrument open jams and collaborative live rehearsals.',
        capacity: '8',
      };
    }
    if (n.includes('MEETING')) {
      return {
        title: 'MEETING SESSION',
        modes: 'Discussion • Planning',
        bandTag: 'BACKSTAGE // LOUNGE',
        description: 'Band meetings, setlists, and production planning. No gear required.',
        capacity: '10',
      };
    }
    return {
      title: 'RECORDING STUDIO',
      modes: 'Solo • Group',
      bandTag: 'METALLICA // LIGHTNING STUDIO',
      description: 'Strict lockdown session. Noise isolation & frequency clash prevention.',
      capacity: '4',
    };
  };

  const meta = getSessionMeta(session.name);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && styles.cardSelected,
        ]}
        activeOpacity={0.92}
        onPress={onBookSlot}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.04} />

        {/* Card Header matching MY REHEARSALS cardHeader */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.roomTag}>ROOM {displayRoomNumber} // RIG SPEC</Text>
            <Text style={styles.sessionTitle}>{session.name.toUpperCase()}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isSelected ? styles.selectedBadge : styles.availableBadge,
            ]}
          >
            {isSelected && <LightningSvg color="#F87171" size={10} style={{ marginRight: 4 }} />}
            <Text
              style={[
                styles.statusText,
                isSelected ? styles.selectedText : styles.availableText,
              ]}
            >
              {isSelected ? '★ SELECTED' : 'AVAILABLE'}
            </Text>
          </View>
        </View>

        {/* Subtitle Rig Spec Tag */}
        <Text style={styles.rigSubtitle}>{meta.bandTag}</Text>

        {/* Details Grid matching BookingsListScreen detailsGrid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CAPACITY:</Text>
            <Text style={styles.detailVal}>
              Up to {session.participant_limit || meta.capacity} Musicians
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MODES:</Text>
            <Text style={styles.detailVal}>{meta.modes}</Text>
          </View>

          <View style={styles.detailRowCol}>
            <Text style={styles.detailLabel}>DESCRIPTION:</Text>
            <Text style={styles.descriptionVal} numberOfLines={2}>
              {meta.description}
            </Text>
          </View>
        </View>

        {/* Minimalist Action Button matching MY REHEARSALS buttons */}
        <View
          style={[
            styles.actionBtn,
            isSelected ? styles.actionBtnSelected : styles.actionBtnDefault,
          ]}
        >
          {isSelected ? (
            <View style={styles.btnRow}>
              <LightningSvg color="#0D0D10" size={12} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnTextSelected}>✓ ROOM SELECTED</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <LightningSvg color="#0D0D10" size={12} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnTextDefault}>SELECT ROOM →</Text>
            </View>
          )}
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
    borderRadius: 10,
    padding: 16,
    marginRight: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#181820',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  roomTag: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
    marginBottom: 3,
  },
  sessionTitle: {
    color: '#F6F2EB',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  rigSubtitle: {
    color: '#F87171',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedBadge: {
    backgroundColor: '#240C10',
    borderColor: '#7D1D22',
  },
  availableBadge: {
    backgroundColor: '#0D0D10',
    borderColor: '#261C20',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  selectedText: {
    color: '#F87171',
  },
  availableText: {
    color: '#9E9891',
  },
  detailsGrid: {
    backgroundColor: '#0D0D10',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#261C20',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailRowCol: {
    marginTop: 2,
  },
  detailLabel: {
    color: '#9E9891',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  detailVal: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '700',
  },
  descriptionVal: {
    color: '#9E9891',
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 14.5,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  actionBtnDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  actionBtnSelected: {
    backgroundColor: '#240C10',
    borderColor: '#7D1D22',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTextDefault: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actionBtnTextSelected: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
