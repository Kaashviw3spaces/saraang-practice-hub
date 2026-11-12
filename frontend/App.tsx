import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Image,
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
import { MusicalNotesBackground } from './src/components/MusicalNotesBackground';

// Configure foreground notification presentation handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Tab = 'dashboard' | 'booking' | 'bookings' | 'profile';

const TABS: Tab[] = ['dashboard', 'booking', 'bookings', 'profile'];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [barWidth, setBarWidth] = useState(0);
  const { currentUser, showNotification, setWizardStep } = useStore();

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;
  const screenSlide = useRef(new Animated.Value(0)).current;

  const switchTab = (tab: Tab) => {
    const targetIdx = TABS.indexOf(tab);
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
    const targetIdx = TABS.indexOf(activeTab);
    Animated.spring(tabIndicatorAnim, {
      toValue: targetIdx,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicatorAnim]);

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
      <StatusBar barStyle="light-content" backgroundColor="#0D0D10" />

      {/* Global Foreground Notification Banner */}
      <NotificationBanner />

      {/* Top Header with Centered Big Saarang Brand & Seamless Black Background */}
      <View style={styles.header}>
        {/* Top utility row with Live Hub tag and Book Slot CTA */}
        <View style={styles.headerTopBar}>
          <View style={styles.liveTagWrap}>
            <LightningSvg color="#FFFFFF" size={11} style={{ marginRight: 4 }} />
            <Text style={styles.liveTagText}>LIVE HUB • TOUR 2026</Text>
          </View>
          <AnimatedPressable
            style={styles.joinBtn}
            onPress={() => {
              setWizardStep(1);
              switchTab('booking');
            }}
            scaleTo={0.95}
          >
            <View style={styles.joinBtnRow}>
              <LightningSvg color="#0D0D10" size={13} style={{ marginRight: 4 }} />
              <Text style={styles.joinBtnText}>BOOK SLOT</Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Big Centered Saarang Music Club Logo */}
        <View style={styles.brandCentered}>
          <Image
            source={require('./assets/saarang_logo.png')}
            style={styles.bigCenteredLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Navigation Tab Bar with Smooth Yousician Sliding Indicator */}
      <View
        style={styles.tabBar}
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
          onPress={() => switchTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
            NOW PLAYING
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.7}
          onPress={() => switchTab('booking')}
        >
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>
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
                width: barWidth / 4,
                transform: [
                  {
                    translateX: tabIndicatorAnim.interpolate({
                      inputRange: [0, 1, 2, 3],
                      outputRange: [0, barWidth * 0.25, barWidth * 0.5, barWidth * 0.75],
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

      {/* Atmospheric Pale Musical Notes Falling Gracefully from the Very Top of the Page */}
      <MusicalNotesBackground />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D10',
    position: 'relative',
  },
  header: {
    backgroundColor: 'rgba(13, 13, 16, 0.90)',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15151A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262635',
  },
  liveTagText: {
    color: '#9E9891',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bigCenteredLogo: {
    width: 160,
    height: 160,
  },
  joinBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  joinBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(13, 13, 16, 0.93)',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#8A847D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  slidingIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#EF4444',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
