import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LiveSession } from '../api/client';

interface LiveSessionCardProps {
  session: LiveSession;
  onBookSession: (session: LiveSession) => void;
}

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({ session, onBookSession }) => {
  const isOccupied = session.is_occupied;

  const getSessionDescription = (name: string): string => {
    const n = name.toUpperCase();
    if (n.includes('SESSION A')) {
      return 'Full band rehearsals, solo drums or electric guitar, collaborative jams.';
    }
    if (n.includes('SESSION B')) {
      return 'Acoustic & low-gain focus. Acoustic guitar, keys, vocals, bass.';
    }
    if (n.includes('JAM SESSION')) {
      return 'Multi-instrument open jams and collaborative live rehearsals.';
    }
    if (n.includes('RECORDING')) {
      return 'Strict lockdown session. Noise isolation & frequency clash prevention.';
    }
    if (n.includes('MEETING')) {
      return 'Band meetings, setlist curation, production planning. No instruments needed.';
    }
    return 'Standard rehearsal session.';
  };

  return (
    <View style={[styles.card, isOccupied && styles.occupiedCard]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.sessionName}>{session.name.toUpperCase()}</Text>
          <Text style={styles.subText}>
            CAPACITY: UP TO {session.participant_limit} MUSICIANS
          </Text>
        </View>

        <View style={[styles.statusBadge, isOccupied ? styles.occupiedBadge : styles.availableBadge]}>
          <View style={[styles.statusDot, { backgroundColor: isOccupied ? '#e05a47' : '#3ddc97' }]} />
          <Text style={[styles.statusText, { color: isOccupied ? '#e05a47' : '#52b79a' }]}>
            {isOccupied ? 'ON AIR' : 'STAGE OPEN'}
          </Text>
        </View>
      </View>

      {/* Description / Rules */}
      <Text style={styles.descText}>{getSessionDescription(session.name)}</Text>

      {/* Current Active Session Info or Availability Banner */}
      {isOccupied && session.current_session ? (
        <View style={styles.sessionBox}>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>CURRENT REHEARSAL:</Text>
            <Text style={styles.sessionVal}>{session.current_session.practice_mode || 'Rehearsal'}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>HOST:</Text>
            <Text style={styles.sessionVal}>{session.current_session.user_name}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>WINDOW:</Text>
            <Text style={styles.sessionVal}>
              {session.current_session.start_time} - {session.current_session.end_time}
            </Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>MEMBERS:</Text>
            <Text style={styles.sessionVal}>{session.current_session.participant_count} Musicians</Text>
          </View>
        </View>
      ) : (
        <View style={styles.vacantBox}>
          <Text style={styles.vacantText}>⚡ Session is open and available for immediate reservation.</Text>
        </View>
      )}

      {/* Action Button: Book this Session */}
      <TouchableOpacity
        style={styles.actionBtn}
        activeOpacity={0.8}
        onPress={() => onBookSession(session)}
      >
        <Text style={styles.actionBtnText}>
          BOOK {session.name.toUpperCase()} →
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  occupiedCard: {
    borderColor: '#3a201c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  sessionName: {
    color: '#f4ede4',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  subText: {
    color: '#888888',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  availableBadge: {
    borderColor: '#255e4e',
    backgroundColor: '#0f241e',
  },
  occupiedBadge: {
    borderColor: '#63251e',
    backgroundColor: '#241210',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  descText: {
    color: '#bbbbbb',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  sessionBox: {
    backgroundColor: '#1d1514',
    borderWidth: 1,
    borderColor: '#382522',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sessionLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sessionVal: {
    color: '#f4ede4',
    fontSize: 11,
    fontWeight: '600',
  },
  vacantBox: {
    backgroundColor: '#151c18',
    borderWidth: 1,
    borderColor: '#22382c',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  vacantText: {
    color: '#52b79a',
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 11,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
});
