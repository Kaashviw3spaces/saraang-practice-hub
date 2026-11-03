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
    backgroundColor: '#1b1a16',
    borderWidth: 1.5,
    borderColor: '#e8c872',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 10,
  },
  warningContainer: {
    borderColor: '#e05a47',
    backgroundColor: '#201210',
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
    color: '#e8c872',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  warningTitle: {
    color: '#e05a47',
  },
  timeText: {
    color: '#777777',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  message: {
    color: '#f4ede4',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  closeText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
