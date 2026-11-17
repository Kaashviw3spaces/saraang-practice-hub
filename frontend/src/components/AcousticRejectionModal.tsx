import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Platform, Animated } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { RockTextureOverlay } from './RockTextureOverlay';
import { LightningSvg } from './LightningSvg';

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
          <RockTextureOverlay pattern="mesh" opacity={0.06} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.warningBadge}>
              <LightningSvg color="#F87171" size={11} style={{ marginRight: 5 }} />
              <Text style={styles.badgeText}>ACOUSTIC AI LIMIT EXCEEDED</Text>
            </View>
            <Text style={styles.headerTitle}>RESERVATION CONFLICT</Text>
          </View>

          {/* Primary Reason */}
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
              <Text style={styles.collisionHeader}>FREQUENCY CONFLICTS:</Text>
              {details.frequency_collisions.map((c, i) => (
                <Text key={i} style={styles.collisionItem}>• {c}</Text>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <AnimatedPressable
              style={styles.cancelBtn}
              onPress={onClose}
              scaleTo={0.96}
            >
              <Text style={styles.cancelBtnText}>DISMISS</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.modifyBtn}
              onPress={onAdjustInstruments}
              scaleTo={0.96}
            >
              <Text style={styles.modifyBtnText}>ADJUST RIG →</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#7D1D22',
    borderRadius: 10,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    marginBottom: 14,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#240C10',
    borderWidth: 1,
    borderColor: '#7D1D22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  badgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  headerTitle: {
    color: '#EFECE6',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.select({
      web: '"Anton", "Oswald", "Arial Black", sans-serif',
      default: 'sans-serif',
    }),
  },
  mainReason: {
    color: '#F6F2EB',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 14,
    fontFamily: Platform.select({
      web: '"Space Mono", monospace',
      default: 'monospace',
    }),
  },
  reasonHighlight: {
    color: '#F87171',
    fontWeight: '900',
  },
  telemetryBox: {
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    borderColor: '#261C20',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  telemetryLabel: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  telemetryDanger: {
    color: '#F87171',
    fontSize: 11.5,
    fontWeight: '900',
  },
  telemetrySafe: {
    color: '#10B981',
    fontSize: 11.5,
    fontWeight: '900',
  },
  collisionBox: {
    backgroundColor: '#0D0D10',
    borderWidth: 1,
    borderColor: '#261C20',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  collisionHeader: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  collisionItem: {
    color: '#F6F2EB',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 3,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    backgroundColor: '#240C10',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  cancelBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modifyBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  modifyBtnText: {
    color: '#0D0D10',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
