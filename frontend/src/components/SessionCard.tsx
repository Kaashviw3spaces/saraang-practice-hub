import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SessionType } from '../api/client';

interface SessionCardProps {
  session: SessionType;
  isSelected?: boolean;
  onBookSlot: () => void;
  stageNumber?: string;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isSelected = false,
  onBookSlot,
  stageNumber = '01',
}) => {
  // Static visual mappings based on reference design screenshot
  const getSessionMeta = (name: string) => {
    switch (name.toUpperCase()) {
      case 'SESSION A':
        return {
          title: 'SESSION A',
          description: 'Rehearsal space with drums, drum pads and amplifiers.',
          tagline: 'FULLY ISOLATED - SUITABLE FOR LOUD INSTRUMENTS AND FULL-BAND REHEARSALS.',
          capacity: '8',
          titleColor: '#e8c872', // Gold
        };
      case 'SESSION B':
        return {
          title: 'SESSION B',
          description: 'Practice space ideal for solo practice, duets, and acoustic or electronic sessions.',
          tagline: 'SEMI-ISOLATED - SUITABLE FOR MODERATELY LOUD PRACTICE SESSIONS TOGETHER.',
          capacity: '6',
          titleColor: '#f4ede4', // Off-white
        };
      case 'JAM SESSION':
        return {
          title: 'JAM SESSION',
          description: 'Open jam space for collaborative sessions and small band rehearsals.',
          tagline: 'ACOUSTIC PANELS - GOOD FOR ENSEMBLE PRACTICE.',
          capacity: '8',
          titleColor: '#f4ede4',
        };
      case 'RECORDING SESSION':
      default:
        return {
          title: 'RECORDING SESSION',
          description: 'Recording space for vocals and acoustic instruments.',
          tagline: 'ISOLATED - PERFECT FOR FOCUSED RECORDING SESSIONS.',
          capacity: '4',
          titleColor: '#f4ede4',
        };
    }
  };

  const meta = getSessionMeta(session.name);

  return (
    <View style={[styles.card, isSelected && styles.selectedCard]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.stageIndicator}>
          <Text style={styles.radioIcon}>((•))</Text>
          <Text style={styles.stageText}>STAGE // {stageNumber}</Text>
        </View>

        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>STAGE OPEN</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: meta.titleColor }]}>{meta.title}</Text>

      {/* Description */}
      <Text style={styles.description}>{meta.description}</Text>

      {/* Highlight Box */}
      <View style={styles.highlightBox}>
        <Text style={styles.lightningIcon}>⚡</Text>
        <Text style={styles.tagline}>{meta.tagline}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        <View style={styles.capContainer}>
          <Text style={styles.capIcon}>👥</Text>
          <Text style={styles.capText}>CAP: {meta.capacity}</Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          activeOpacity={0.8}
          onPress={onBookSlot}
        >
          <Text style={styles.bookButtonText}>BOOK SLOT →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedCard: {
    borderColor: '#e8c872',
    borderWidth: 1.5,
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
  radioIcon: {
    color: '#e05a47',
    fontSize: 12,
    marginRight: 6,
    fontWeight: 'bold',
  },
  stageText: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#255e4e',
    backgroundColor: '#0f241e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3ddc97',
    marginRight: 6,
  },
  badgeText: {
    color: '#52b79a',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  description: {
    color: '#a0a0a0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1813',
    borderWidth: 1,
    borderColor: '#42371e',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  lightningIcon: {
    color: '#cbb585',
    fontSize: 12,
    marginRight: 8,
  },
  tagline: {
    color: '#cbb585',
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '700',
    flex: 1,
    lineHeight: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  capContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#777777',
  },
  capText: {
    color: '#888888',
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bookButton: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 4,
  },
  bookButtonText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
