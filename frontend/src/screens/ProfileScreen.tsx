import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Image } from 'react-native';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { RockTextureOverlay } from '../components/RockTextureOverlay';
import { SoundwaveSvg } from '../components/SoundwaveSvg';
import { LightningSvg } from '../components/LightningSvg';

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
      message: 'Your rehearsal session starts in 15 minutes. Please proceed to Room // 01.',
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
        <Text style={styles.headerTitle}>ROOM CREDENTIALS</Text>
      </View>

      {/* User Card styled as official artist backstage credential */}
      <View style={styles.userCard}>
        <RockTextureOverlay pattern="mesh" opacity={0.06} />

        {/* Authentic Rock Band Watermark */}
        <Image
          source={require('../../assets/metallica.png')}
          style={styles.cardWatermark}
          resizeMode="cover"
        />

        <View style={styles.passHeaderStamp}>
          <LightningSvg color="#FFFFFF" size={12} style={{ marginRight: 6 }} />
          <Text style={styles.passHeaderStampText}>OFFICIAL BAND MEMBER // ALL ACCESS CREDENTIAL</Text>
          <LightningSvg color="#FFFFFF" size={12} style={{ marginLeft: 6 }} />
        </View>

        <View style={styles.clubBadgeWrap}>
          <Image
            source={require('../../assets/saarang_logo.png')}
            style={styles.clubBadgeImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.userName}>{currentUser.name}</Text>
        <Text style={styles.userEmail}>{currentUser.email}</Text>
        <Text style={styles.userId}>CREDENTIAL ID: #SRG-{currentUser.id}</Text>

        <View style={styles.credentialSoundwave}>
          <SoundwaveSvg color="#EF4444" secondaryColor="#00E5FF" height={22} variant="metallica" />
        </View>
      </View>

      {/* User Switcher */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SWITCH TEST USER</Text>
        <View style={styles.switcherRow}>
          {sampleUsers.map((u) => {
            const isSelected = currentUser.id === u.id;
            return (
              <AnimatedPressable
                key={u.id}
                style={[styles.userPill, isSelected && styles.userPillSelected]}
                onPress={() => setCurrentUser(u)}
                scaleTo={0.96}
                containerStyle={{ flex: 1, marginRight: 10 }}
              >
                <Text style={[styles.userPillName, isSelected && styles.userPillTextSelected]}>
                  {u.name}
                </Text>
                <Text style={styles.userPillMeta}>ID #{u.id}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {/* Push Notification Controls (Step 3) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS & CELERY ALERTS</Text>
        <View style={styles.notifyCard}>
          <Text style={styles.notifyStatus}>{pushTokenStatus}</Text>

          <AnimatedPressable style={styles.registerBtn} onPress={handleRegisterToken} scaleTo={0.97}>
            <View style={styles.btnRow}>
              <LightningSvg color="#0D0D10" size={13} style={{ marginRight: 6 }} />
              <Text style={styles.registerBtnText}>REGISTER ROOM PUSH TOKEN</Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable style={styles.testBtn} onPress={handleTestNotification} scaleTo={0.97}>
            <Text style={styles.testBtnText}>SIMULATE 15-MIN FOREGROUND BANNER</Text>
          </AnimatedPressable>
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
    backgroundColor: '#0D0D10',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 20,
  },
  headerSubtitle: {
    color: '#9E9891',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  headerTitle: {
    color: '#F6F2EB',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  userCard: {
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#7D1D22',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#7D1D22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  cardWatermark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    opacity: 0.08,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  passHeaderStamp: {
    backgroundColor: '#15151A',
    borderWidth: 1,
    borderColor: '#262635',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passHeaderStampText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  clubBadgeWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#121216',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#262635',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  clubBadgeImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    color: '#F6F2EB',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  userEmail: {
    color: '#9E9891',
    fontSize: 13,
    marginBottom: 6,
  },
  userId: {
    color: '#8A847D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  credentialSoundwave: {
    width: '80%',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#261C20',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#F6F2EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  switcherRow: {
    flexDirection: 'row',
  },
  userPill: {
    flex: 1,
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 14,
    marginRight: 10,
  },
  userPillSelected: {
    borderColor: '#82191F',
    backgroundColor: '#2A0E13',
  },
  userPillName: {
    color: '#9E9891',
    fontSize: 13,
    fontWeight: '900',
  },
  userPillTextSelected: {
    color: '#F6F2EB',
  },
  userPillMeta: {
    color: '#6A6560',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  notifyCard: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 18,
  },
  notifyStatus: {
    color: '#9E9891',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  registerBtnText: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  testBtn: {
    backgroundColor: '#240C10',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  testBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  policyCard: {
    backgroundColor: '#200B0E',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    borderRadius: 10,
    padding: 18,
  },
  policyTitle: {
    color: '#F6F2EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  policyItem: {
    color: '#E0D0D1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
});
