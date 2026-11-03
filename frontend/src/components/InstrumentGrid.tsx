import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Instrument } from '../api/client';

interface InstrumentGridProps {
  instruments: Instrument[];
  sessionName: string;
  selectedQuantities: Record<number, number>;
  onQuantityChange: (instrumentId: number, qty: number) => void;
}

export const InstrumentGrid: React.FC<InstrumentGridProps> = ({
  instruments,
  sessionName,
  selectedQuantities,
  onQuantityChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Strict Pre-Filtering based on Session Type as required by Step 2B
  const filteredInstruments = useMemo(() => {
    const sName = sessionName.toUpperCase();
    const isLoudSession = sName.includes('SESSION A') || sName.includes('JAM');

    return instruments
      .filter((inst) => {
        // Step 2B Rule:
        // Loud sessions show Drums, Electric Guitar, Amplifiers/Percussion
        // Quiet/Recording sessions strictly restrict to low-decibel/acoustic instruments
        if (isLoudSession) {
          // Exclude exclusively soft recording mics if needed, or allow all loud instruments
          return true;
        } else {
          // Session B or Recording Session: low-decibel / acoustic instruments ONLY
          // Instruments > 105 dB (like acoustic drums) are strictly hidden from selection
          return inst.base_decibels <= 100;
        }
      })
      .filter((inst) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          inst.name.toLowerCase().includes(q) ||
          inst.category?.toLowerCase().includes(q) ||
          inst.frequency_band?.toLowerCase().includes(q)
        );
      });
  }, [instruments, sessionName, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Session Filter Badge */}
      <View style={styles.filterBanner}>
        <Text style={styles.filterTitle}>
          {sessionName.toUpperCase().includes('RECORDING') || sessionName.toUpperCase().includes('SESSION B')
            ? '🎙️ ACOUSTIC FILTER ACTIVE (ACOUSTIC & MODERATE DECIBEL ONLY)'
            : '⚡ FULL ISOLATION ACTIVE (LOUD INSTRUMENTS ALLOWED)'}
        </Text>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="SEARCH INSTRUMENTS / BANDS..."
        placeholderTextColor="#666666"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Instruments Grid */}
      <View style={styles.grid}>
        {filteredInstruments.map((inst) => {
          const qty = selectedQuantities[inst.id] || 0;
          const isSelected = qty > 0;

          return (
            <View key={inst.id} style={[styles.chip, isSelected && styles.selectedChip]}>
              <View style={styles.chipHeader}>
                <Text style={styles.instName}>{inst.name}</Text>
                <Text style={styles.instDb}>{inst.base_decibels} dB</Text>
              </View>

              <View style={styles.chipMeta}>
                <Text style={styles.metaBadge}>{inst.category || 'General'}</Text>
                <Text style={[styles.metaBadge, styles.freqBadge]}>{inst.frequency_band || 'Mid'}</Text>
              </View>

              {/* Quantity Stepper */}
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, qty === 0 && styles.stepBtnDisabled]}
                  onPress={() => onQuantityChange(inst.id, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                >
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>

                <Text style={styles.qtyText}>{qty}</Text>

                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => onQuantityChange(inst.id, qty + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  filterBanner: {
    backgroundColor: '#1b1812',
    borderWidth: 1,
    borderColor: '#42371e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  filterTitle: {
    color: '#e8c872',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  searchInput: {
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f4ede4',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chip: {
    width: '48%',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  selectedChip: {
    borderColor: '#e8c872',
    backgroundColor: '#1c1a14',
  },
  chipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  instName: {
    color: '#f4ede4',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 4,
  },
  instDb: {
    color: '#e8c872',
    fontSize: 11,
    fontWeight: '800',
  },
  chipMeta: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  metaBadge: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 6,
    backgroundColor: '#222222',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  freqBadge: {
    color: '#52b79a',
    backgroundColor: '#10241e',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#262626',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: '#1a1a1a',
  },
  stepBtnText: {
    color: '#f4ede4',
    fontSize: 14,
    fontWeight: 'bold',
  },
  qtyText: {
    color: '#f4ede4',
    fontSize: 12,
    fontWeight: '800',
  },
});
