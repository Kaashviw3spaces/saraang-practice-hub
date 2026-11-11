import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Platform, Animated } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';

interface AcousticRejectionModalProps {
  visible: boolean;
  reason: string;
  details?: {
    effective_decibels?: number;
    max_allowed_decibels?: number;
    frequency_collisions?: string[];
    rejection_reasons?: string[];
  };
  onClose: () => void;
  onAdjustInstruments: () => void;
}

export const AcousticRejectionModal: React.FC<AcousticRejectionModalProps> = ({
  visible,
  reason,
  details,
  onClose,
  onAdjustInstruments,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalBox,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.warningBadge}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.headerTitle}>ACOUSTIC AI REJECTION</Text>
            </View>
          </View>

          {/* Primary Reason (Step 2C Required Text) */}
          <Text style={styles.mainReason}>
            Booking rejected by Acoustic AI:{' '}
            <Text style={styles.reasonHighlight}>{reason || 'Acoustic limits exceeded.'}</Text>
          </Text>

          {/* Decibel Diagnostics if available */}
          {details?.effective_decibels !== undefined && details?.max_allowed_decibels !== undefined && (
            <View style={styles.telemetryBox}>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>CALCULATED LEVEL:</Text>
                <Text style={styles.telemetryDanger}>{details.effective_decibels.toFixed(1)} dB</Text>
              </View>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>ACOUSTIC CEILING:</Text>
                <Text style={styles.telemetrySafe}>{details.max_allowed_decibels.toFixed(1)} dB</Text>
              </View>
            </View>
          )}

          {/* Frequency Collisions */}
          {details?.frequency_collisions && details.frequency_collisions.length > 0 && (
            <View style={styles.collisionBox}>
              <Text style={styles.collisionHeader}>⚡ FREQUENCY CONFLICTS:</Text>
              {details.frequency_collisions.map((c, i) => (
                <Text key={i} style={styles.collisionItem}>• {c}</Text>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <AnimatedPressable
              style={styles.modifyBtn}
              onPress={onAdjustInstruments}
              scaleTo={0.96}
            >
              <Text style={styles.modifyBtnText}>ADJUST INSTRUMENTS →</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.cancelBtn}
              onPress={onClose}
              scaleTo={0.96}
            >
              <Text style={styles.cancelBtnText}>DISMISS</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#82191F',
    borderRadius: 10,
    padding: 22,
    shadowColor: '#82191F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    marginBottom: 16,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#240C10',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  headerTitle: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  mainReason: {
    color: '#F6F2EB',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  reasonHighlight: {
    color: '#F87171',
    fontWeight: '900',
  },
  telemetryBox: {
    backgroundColor: '#0D0D10',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  telemetryLabel: {
    color: '#9E9891',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  telemetryDanger: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '900',
  },
  telemetrySafe: {
    color: '#9E9891',
    fontSize: 12,
    fontWeight: '800',
  },
  collisionBox: {
    backgroundColor: '#200B0E',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  collisionHeader: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  collisionItem: {
    color: '#E0D0D1',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  modifyBtn: {
    backgroundColor: '#F6F2EB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  modifyBtnText: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  cancelBtn: {
    backgroundColor: '#22222A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2E2E38',
  },
  cancelBtnText: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
