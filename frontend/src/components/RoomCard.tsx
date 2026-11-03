import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LiveRoom } from '../api/client';

interface RoomCardProps {
  room: LiveRoom;
  onBookNow: (room: LiveRoom) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onBookNow }) => {
  const isOccupied = room.is_occupied;
  const dbPercentage = Math.min(100, Math.round((room.current_decibels / room.max_decibel_threshold) * 100));

  // Determine meter color based on acoustic threshold
  const getMeterColor = (pct: number) => {
    if (pct >= 90) return '#e05a47'; // Red/Warning
    if (pct >= 70) return '#e8c872'; // Yellow/Gold
    return '#3ddc97'; // Safe Teal
  };

  const meterColor = getMeterColor(dbPercentage);

  return (
    <View style={[styles.card, isOccupied && styles.occupiedCard]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.subText}>
            CAP: {room.base_capacity} • ECHO FACTOR: {room.echo_factor.toFixed(2)}x
          </Text>
        </View>

        <View style={[styles.statusBadge, isOccupied ? styles.occupiedBadge : styles.availableBadge]}>
          <View style={[styles.statusDot, { backgroundColor: isOccupied ? '#e05a47' : '#3ddc97' }]} />
          <Text style={[styles.statusText, { color: isOccupied ? '#e05a47' : '#52b79a' }]}>
            {isOccupied ? 'ON AIR' : 'STAGE OPEN'}
          </Text>
        </View>
      </View>

      {/* Live Decibel Meter Gauge */}
      <View style={styles.meterContainer}>
        <View style={styles.meterLabels}>
          <Text style={styles.meterTitle}>LIVE NOISE LEVEL</Text>
          <Text style={[styles.meterValue, { color: meterColor }]}>
            {room.current_decibels.toFixed(1)} dB{' '}
            <Text style={styles.meterThreshold}>/ {room.max_decibel_threshold} dB MAX</Text>
          </Text>
        </View>

        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${dbPercentage}%`, backgroundColor: meterColor }]} />
        </View>
      </View>

      {/* Current Session Info or Availability Banner */}
      {isOccupied && room.current_session ? (
        <View style={styles.sessionBox}>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>SESSION:</Text>
            <Text style={styles.sessionVal}>{room.current_session.session_type}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>HOST:</Text>
            <Text style={styles.sessionVal}>{room.current_session.user_name}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>WINDOW:</Text>
            <Text style={styles.sessionVal}>
              {room.current_session.start_time} - {room.current_session.end_time}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.vacantBox}>
          <Text style={styles.vacantText}>⚡ Studio is currently silent and calibrated for new sessions.</Text>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.actionBtn, isOccupied && styles.disabledBtn]}
        activeOpacity={0.8}
        onPress={() => onBookNow(room)}
        disabled={isOccupied}
      >
        <Text style={[styles.actionBtnText, isOccupied && styles.disabledBtnText]}>
          {isOccupied ? 'OCCUPIED' : 'BOOK ROOM →'}
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
    marginBottom: 14,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  roomName: {
    color: '#f4ede4',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  subText: {
    color: '#777777',
    fontSize: 11,
    letterSpacing: 1,
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
  meterContainer: {
    marginBottom: 14,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  meterTitle: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  meterValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  meterThreshold: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '500',
  },
  meterTrack: {
    height: 6,
    backgroundColor: '#262626',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
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
    marginBottom: 3,
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
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  disabledBtn: {
    backgroundColor: '#222222',
  },
  disabledBtnText: {
    color: '#555555',
  },
});
