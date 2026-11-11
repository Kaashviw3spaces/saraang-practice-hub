import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useStore } from '../store/useStore';

export const NotificationBanner: React.FC = () => {
  const { activeNotification, dismissNotification } = useStore();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (activeNotification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();

      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => {
        dismiss();
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-100);
    }
  }, [activeNotification]);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 250,
      useNativeDriver: true,
    }).start(() => dismissNotification());
  };

  if (!activeNotification) return null;

  const isWarning = activeNotification.type === 'warning' || activeNotification.type === 'alert';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
        isWarning && styles.warningContainer,
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={dismiss} style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{isWarning ? '🔔' : '🚀'}</Text>
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isWarning && styles.warningTitle]}>
              {activeNotification.title}
            </Text>
            <Text style={styles.timeText}>{activeNotification.timestamp}</Text>
          </View>
          <Text style={styles.message}>{activeNotification.message}</Text>
        </View>

        <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    borderRadius: 8,
    shadowColor: '#7D1D22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  warningContainer: {
    borderColor: '#82191F',
    backgroundColor: '#240C10',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  title: {
    color: '#F6F2EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  warningTitle: {
    color: '#F6F2EB',
  },
  timeText: {
    color: '#9E9891',
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  message: {
    color: '#9E9891',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  closeText: {
    color: '#9E9891',
    fontSize: 14,
    fontWeight: '800',
  },
});
