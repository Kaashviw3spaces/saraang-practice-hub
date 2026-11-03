import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './src/api/client';
import { useStore } from './src/store/useStore';
import { NotificationBanner } from './src/components/NotificationBanner';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { BookingWizardScreen } from './src/screens/BookingWizardScreen';
import { BookingsListScreen } from './src/screens/BookingsListScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

// Configure foreground notification presentation handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Tab = 'dashboard' | 'booking' | 'bookings' | 'profile';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { currentUser, showNotification, setWizardStep } = useStore();

  // Step 3 Requirement: Push Notification Listeners
  useEffect(() => {
    async function registerForPushNotificationsAsync() {
      if (Platform.OS === 'web') return;

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
          return;
        }

        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const token = tokenData.data;
          console.log('FCM / Expo Push Token:', token);

          // Save the device's FCM push token to the backend
          await api.registerPushToken(currentUser.id, token);
        } catch (error) {
          console.error('Error fetching push token:', error);
        }
      }
    }

    registerForPushNotificationsAsync();

    // Foreground Notification Listener: Triggers in-app banner for 15-min / 45-min alerts
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title || 'STAGE ALERT';
      const body = notification.request.content.body || '';

      showNotification({
        title,
        message: body,
        type: title.includes('WARNING') || title.includes('ALERT') ? 'warning' : 'info',
      });
    });

    return () => {
      notificationListener.remove();
    };
  }, [currentUser.id, showNotification]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />

      {/* Global Foreground Notification Banner */}
      <NotificationBanner />

      {/* Top Navigation Bar with Vintage Rock Aesthetic */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBolt}>⚡</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>SAARANG</Text>
            <Text style={styles.brandSub}>PRACTICE HUB</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => {
            setWizardStep(1);
            setActiveTab('booking');
          }}
        >
          <Text style={styles.joinBtnText}>BOOK SLOT</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
            NOW PLAYING
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'booking' && styles.tabItemActive]}
          onPress={() => setActiveTab('booking')}
        >
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>
            BOOK SLOT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'bookings' && styles.tabItemActive]}
          onPress={() => setActiveTab('bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>
            MY PASSES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'profile' && styles.tabItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            PROFILE
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Screen Content */}
      <View style={styles.screenContainer}>
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onNavigateToBooking={(roomId) => {
              setActiveTab('booking');
            }}
          />
        )}
        {activeTab === 'booking' && (
          <BookingWizardScreen
            onBookingSuccess={() => {
              setActiveTab('bookings');
            }}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsListScreen
            onNavigateToWizard={() => {
              setWizardStep(1);
              setActiveTab('booking');
            }}
          />
        )}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    backgroundColor: '#121212',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 32,
    height: 32,
    backgroundColor: '#f7f4ea',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoBolt: {
    fontSize: 16,
  },
  brandTitle: {
    color: '#f4ede4',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSub: {
    color: '#888888',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  joinBtn: {
    backgroundColor: '#f7f4ea',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
  },
  joinBtnText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#e8c872',
  },
  tabText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#e8c872',
  },
  screenContainer: {
    flex: 1,
  },
});
