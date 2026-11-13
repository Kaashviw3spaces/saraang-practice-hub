import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  LayoutChangeEvent,
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
import { AnimatedPressable } from './src/components/AnimatedPressable';
import { LightningSvg } from './src/components/LightningSvg';
import { PunkRansomLogo } from './src/components/PunkRansomLogo';
import { RockTextureOverlay } from './src/components/RockTextureOverlay';

// Dynamically inject Google Fonts on Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById('google-fonts-punk')) {
    const link = document.createElement('link');
    link.id = 'google-fonts-punk';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;700;800&family=Oswald:wght@600;700&family=Space+Mono:ital,wght@0,400;0,700;1,700&display=swap';
    document.head.appendChild(link);
  }
}

// Configure foreground notification presentation handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Tab = 'dashboard' | 'booking' | 'bookings' | 'profile';

const getTabIndicatorIndex = (tab: Tab): number => {
  if (tab === 'dashboard' || tab === 'booking') return 0;
  if (tab === 'bookings') return 1;
  return 2;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [barWidth, setBarWidth] = useState(0);
  const { currentUser, showNotification, setWizardStep } = useStore();

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;
  const screenSlide = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: Tab) => {
    const targetIdx = getTabIndicatorIndex(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: targetIdx,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();

    screenFade.setValue(0.2);
    screenSlide.setValue(8);
    setActiveTab(tab);

    Animated.parallel([
      Animated.timing(screenFade, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(screenSlide, {
        toValue: 0,
        tension: 110,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    const targetIdx = getTabIndicatorIndex(activeTab);
    Animated.spring(tabIndicatorAnim, {
      toValue: targetIdx,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicatorAnim]);

  // Push Notification Listeners
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

    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title || 'ROOM ALERT';
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
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Ultra-Subtle Whispering Textured Background */}
      <RockTextureOverlay opacity={0.03} />

      {/* Global Foreground Notification Banner */}
      <NotificationBanner />

      {/* Gritty Punk Zine Brutalist Header */}
      <View style={styles.header}>
        {/* Top Header Row: Ransom Logo + Stamped CTA */}
        <View style={styles.headerTopBar}>
          {/* Wheat-pasted Ransom-Note Logo Cutout */}
          <PunkRansomLogo />

          {/* Book Slot Stamped Action Button */}
          <AnimatedPressable
            style={styles.joinBtn}
            onPress={() => {
              switchTab('dashboard');
            }}
            scaleTo={0.96}
          >
            <View style={styles.joinBtnRow}>
              <LightningSvg color="#EFECE6" size={11} style={{ marginRight: 5 }} />
              <Text style={styles.joinBtnText}>BOOK SLOT</Text>
            </View>
          </AnimatedPressable>
        </View>
      </View>

      {/* Navigation Tab Bar: Heavy Condensed Grotesque Typography */}
      <View
        style={styles.tabBar}
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
          onPress={() => switchTab('dashboard')}
        >
          <Text
            style={[
              styles.tabText,
              (activeTab === 'dashboard' || activeTab === 'booking') && styles.tabTextActive,
            ]}
          >
            BOOK SLOT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
          onPress={() => switchTab('bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>
            MY PASSES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
          onPress={() => switchTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            PROFILE
          </Text>
        </TouchableOpacity>

        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingIndicator,
              {
                width: barWidth / 3,
                transform: [
                  {
                    translateX: tabIndicatorAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, barWidth / 3, (barWidth * 2) / 3],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </View>

      {/* Active Screen Content with Fluid Transitions */}
      <Animated.View
        style={[
          styles.screenContainer,
          {
            opacity: screenFade,
            transform: [{ translateY: screenSlide }],
          },
        ]}
      >
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onNavigateToBooking={() => {
              switchTab('booking');
            }}
          />
        )}
        {activeTab === 'booking' && (
          <BookingWizardScreen
            onBookingSuccess={() => {
              switchTab('bookings');
            }}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsListScreen
            onNavigateToWizard={() => {
              setWizardStep(1);
              switchTab('booking');
            }}
          />
        )}
        {activeTab === 'profile' && <ProfileScreen />}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#121212',
    borderBottomWidth: 2.5,
    borderBottomColor: '#27272A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  joinBtn: {
    backgroundColor: 'rgba(239, 236, 230, 0.08)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 236, 230, 0.28)',
  },
  joinBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#EFECE6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161618',
    borderBottomWidth: 2,
    borderBottomColor: '#27272A',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: Platform.select({
      web: '"Oswald", "Anton", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  tabTextActive: {
    color: '#EFECE6',
    fontWeight: '900',
  },
  slidingIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3.5,
    backgroundColor: '#C93032',
    borderRadius: 0,
    shadowColor: '#C93032',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
