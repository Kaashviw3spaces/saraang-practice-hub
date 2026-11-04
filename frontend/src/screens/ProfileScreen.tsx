import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { api } from '../api/client';

export const ProfileScreen: React.FC = () => {
  const { currentUser, setCurrentUser, showNotification } = useStore();
  const [pushTokenStatus, setPushTokenStatus] = useState<string>('Token registered with Celery.');

  const sampleUsers = [
    { id: 3, name: 'Aarav Sharma', email: 'aarav@musicclub.org' },
    { id: 4, name: 'Priya Nair', email: 'priya@musicclub.org' },
  ];

  const handleTestNotification = () => {
    showNotification({
      title: 'SESSION REMINDER (15M MARK)',
      message: 'Your rehearsal session starts in 15 minutes. Please proceed to Stage // 01.',
      type: 'warning',
    });
  };

  const handleRegisterToken = async () => {
    try {
      const dummyToken = `ExponentPushToken[${Math.random().toString(36).substring(2, 14)}]`;
      await api.registerPushToken(currentUser.id, dummyToken);
      setPushTokenStatus(`Active: ${dummyToken}`);
      Alert.alert('Push Token Registered', `Device token linked to ${currentUser.name} on the Celery notification worker.`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to register push token.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.headerSubtitle}>MEMBER PROFILE</Text>
        <Text style={styles.headerTitle}>STAGE CREDENTIALS</Text>
      </View>

      {/* User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser.name.charAt(0)}</Text>
        </View>
        <Text style={styles.userName}>{currentUser.name}</Text>
        <Text style={styles.userEmail}>{currentUser.email}</Text>
        <Text style={styles.userId}>MEMBER ID: #{currentUser.id}</Text>
      </View>

      {/* User Switcher */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SWITCH TEST USER</Text>
        <View style={styles.switcherRow}>
          {sampleUsers.map((u) => {
            const isSelected = currentUser.id === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                style={[styles.userPill, isSelected && styles.userPillSelected]}
                onPress={() => setCurrentUser(u)}
              >
                <Text style={[styles.userPillName, isSelected && styles.userPillTextSelected]}>
                  {u.name}
                </Text>
                <Text style={styles.userPillMeta}>ID #{u.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Push Notification Controls (Step 3) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS & CELERY ALERTS</Text>
        <View style={styles.notifyCard}>
          <Text style={styles.notifyStatus}>{pushTokenStatus}</Text>

          <TouchableOpacity style={styles.registerBtn} onPress={handleRegisterToken}>
            <Text style={styles.registerBtnText}>REGISTER DEVICE PUSH TOKEN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
            <Text style={styles.testBtnText}>SIMULATE 15-MIN FOREGROUND BANNER</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Policy Card */}
      <View style={styles.policyCard}>
        <Text style={styles.policyTitle}>CLUB BOOKING RULES</Text>
        <Text style={styles.policyItem}>• Rule 1: Maximum 3 active reservations per member per day.</Text>
        <Text style={styles.policyItem}>• Rule 2: Participant count strictly capped by Session limit.</Text>
        <Text style={styles.policyItem}>• Rule 3: AI Acoustic Engine enforces session dB ceilings & frequency clash limits.</Text>
        <Text style={styles.policyItem}>• Automated PostgreSQL scheduling protects against concurrent rehearsal overlaps.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 20,
  },
  headerSubtitle: {
    color: '#e05a47',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerTitle: {
    color: '#f4ede4',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  userCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e8c872',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '900',
  },
  userName: {
    color: '#f4ede4',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  userEmail: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 6,
  },
  userId: {
    color: '#555555',
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#e8c872',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  switcherRow: {
    flexDirection: 'row',
  },
  userPill: {
    flex: 1,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 6,
    padding: 12,
    marginRight: 10,
  },
  userPillSelected: {
    borderColor: '#e8c872',
    backgroundColor: '#1c1913',
  },
  userPillName: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '800',
  },
  userPillTextSelected: {
    color: '#e8c872',
  },
  userPillMeta: {
    color: '#666666',
    fontSize: 10,
    marginTop: 2,
  },
  notifyCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 6,
    padding: 16,
  },
  notifyStatus: {
    color: '#52b79a',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 14,
  },
  registerBtn: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 10,
  },
  registerBtnText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  testBtn: {
    borderWidth: 1,
    borderColor: '#383838',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  testBtnText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  policyCard: {
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    padding: 16,
  },
  policyTitle: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  policyItem: {
    color: '#999999',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 4,
  },
});
