import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
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
            <TouchableOpacity
              style={styles.modifyBtn}
              activeOpacity={0.8}
              onPress={onAdjustInstruments}
            >
              <Text style={styles.modifyBtnText}>ADJUST INSTRUMENTS →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161313',
    borderWidth: 1.5,
    borderColor: '#e05a47',
    borderRadius: 8,
    padding: 22,
    shadowColor: '#e05a47',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#2e120f',
    borderWidth: 1,
    borderColor: '#e05a47',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  headerTitle: {
    color: '#e05a47',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mainReason: {
    color: '#f4ede4',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 16,
  },
  reasonHighlight: {
    color: '#e05a47',
    fontWeight: '800',
  },
  telemetryBox: {
    backgroundColor: '#1c1514',
    borderWidth: 1,
    borderColor: '#382522',
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  telemetryLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  telemetryDanger: {
    color: '#e05a47',
    fontSize: 12,
    fontWeight: '800',
  },
  telemetrySafe: {
    color: '#52b79a',
    fontSize: 12,
    fontWeight: '800',
  },
  collisionBox: {
    backgroundColor: '#1f1a14',
    borderWidth: 1,
    borderColor: '#4d3a20',
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
  },
  collisionHeader: {
    color: '#e8c872',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  collisionItem: {
    color: '#cbb585',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modifyBtn: {
    backgroundColor: '#f7f4ea',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 10,
  },
  modifyBtnText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelBtn: {
    backgroundColor: '#262626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
  cancelBtnText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
