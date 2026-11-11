import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Instrument } from '../api/client';
import { AnimatedPressable } from './AnimatedPressable';
import { RockTextureOverlay } from './RockTextureOverlay';
import { LightningSvg } from './LightningSvg';

interface InstrumentGridProps {
  instruments: Instrument[];
  sessionName: string;
  practiceMode?: string;
  selectedQuantities: Record<number, number>;
  onQuantityChange: (instrumentId: number, qty: number) => void;
}

export const InstrumentGrid: React.FC<InstrumentGridProps> = ({
  instruments,
  sessionName,
  practiceMode = 'Solo Practice',
  selectedQuantities,
  onQuantityChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Strict Pre-Filtering based on Session Type and Practice Mode as required by Step 2C
  const filteredInstruments = useMemo(() => {
    const sName = sessionName.toUpperCase();
    const pMode = practiceMode.toUpperCase();

    return instruments
      .filter((inst) => {
        const nameLower = inst.name.toLowerCase();
        const isDrumsOrElectricGuitar = nameLower.includes('drum') || nameLower.includes('electric guitar');

        // Session A: ONLY Drums or Electric Guitar (Solo or Collaborative Practice)
        if (sName.includes('SESSION A')) {
          return isDrumsOrElectricGuitar;
        }

        // Session B Acoustic Policy: MUST NOT contain Acoustic Drums or Electric Guitar
        if (sName.includes('SESSION B')) {
          return !isDrumsOrElectricGuitar;
        }

        // Recording Session: Any instrument can be chosen here
        return true;
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
  }, [instruments, sessionName, practiceMode, searchQuery]);

  const getFilterBannerText = () => {
    const sName = sessionName.toUpperCase();
    const pMode = practiceMode.toUpperCase();

    if (sName.includes('SESSION B')) {
      return '⚠️ Session B Acoustic Policy: Collaborative Practice only. Drums and electric guitar are prohibited.';
    }
    if (sName.includes('SESSION A')) {
      if (pMode === 'FULL BAND REHEARSAL') {
        return '🥁 Session A Full Band: Reserved exclusively for your band. No individual instruments needed.';
      }
      return pMode === 'SOLO PRACTICE'
        ? '🎸 Session A Solo Policy: Practice drums or guitar alone in the room.'
        : '⚡ Session A Collaborative: Practice with other electric guitarists and drummers.';
    }
    if (sName.includes('RECORDING')) {
      return '🎙️ Studio Recording: Any instrument can be chosen for studio recording.';
    }
    return '⚡ Rehearsal Space: Select gear for instrumentalists (vocalists do not require instruments).';
  };

  const getBandColor = (band?: string) => {
    const b = (band || '').toUpperCase();
    if (b.includes('LOW') || b.includes('SUB') || b.includes('BASS')) return '#EF4444';
    if (b.includes('HI') || b.includes('TREBLE')) return '#00E5FF';
    return '#FFFFFF';
  };

  return (
    <View style={styles.container}>
      {/* Session Filter Badge */}
      <View style={styles.filterBanner}>
        <View style={styles.filterHeaderRow}>
          <LightningSvg color="#FFFFFF" size={13} style={{ marginRight: 6 }} />
          <Text style={styles.filterTitle}>{getFilterBannerText()}</Text>
        </View>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="SEARCH INSTRUMENTS..."
        placeholderTextColor="#707070"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Instruments Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={242}
        contentContainerStyle={styles.horizontalScroll}
      >
        {filteredInstruments.map((inst) => {
          const qty = selectedQuantities[inst.id] || 0;
          const isSelected = qty > 0;
          const bandColor = getBandColor(inst.frequency_band);

          return (
            <View
              key={inst.id}
              style={[
                styles.chip,
                isSelected && [styles.selectedChip, { borderColor: bandColor }],
              ]}
            >
              <RockTextureOverlay pattern="mesh" opacity={isSelected ? 0.08 : 0.04} />
              <View style={styles.chipHeader}>
                <Text style={styles.instName}>{inst.name.toUpperCase()}</Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: bandColor }]}>
                    <Text style={[styles.checkText, { color: bandColor === '#00E5FF' || bandColor === '#FFFFFF' ? '#0D0D10' : '#FFFFFF' }]}>✓</Text>
                  </View>
                )}
              </View>

              <View style={styles.chipMeta}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaBadge}>{inst.category || 'Gear'}</Text>
                </View>
                <View style={[styles.metaPill, { borderColor: bandColor, borderWidth: 1 }]}>
                  <Text style={[styles.metaBadge, { color: bandColor, fontWeight: '900' }]}>
                    {inst.frequency_band || 'Mid'}
                  </Text>
                </View>
              </View>

              {/* Quantity Stepper */}
              <View style={styles.stepperRow}>
                <AnimatedPressable
                  style={[styles.stepBtn, qty === 0 && styles.stepBtnDisabled]}
                  onPress={() => onQuantityChange(inst.id, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                  scaleTo={0.88}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </AnimatedPressable>

                <Text style={[styles.qtyText, isSelected && { color: bandColor }]}>{qty}</Text>

                <AnimatedPressable
                  style={[styles.stepBtn, styles.stepBtnAdd]}
                  onPress={() => onQuantityChange(inst.id, qty + 1)}
                  scaleTo={0.88}
                >
                  <Text style={styles.stepBtnAddText}>+</Text>
                </AnimatedPressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  filterBanner: {
    backgroundColor: '#200B0E',
    borderWidth: 1.5,
    borderColor: '#7D1D22',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    color: '#F6F2EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  searchInput: {
    backgroundColor: '#15151A',
    borderWidth: 1.5,
    borderColor: '#261C20',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F6F2EB',
    fontSize: 12,
    letterSpacing: 0.8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
    marginBottom: 14,
  },
  horizontalScroll: {
    paddingVertical: 4,
    paddingRight: 16,
  },
  chip: {
    width: 230,
    backgroundColor: '#15151A',
    borderWidth: 2,
    borderColor: '#261C20',
    borderRadius: 10,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  selectedChip: {
    borderColor: '#82191F',
    backgroundColor: '#2A0E13',
  },
  chipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  instName: {
    color: '#F6F2EB',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    flex: 1,
    marginRight: 6,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#82191F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  chipMeta: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  metaPill: {
    backgroundColor: '#22222A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metaBadge: {
    color: '#9E9891',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0D0D10',
    borderRadius: 6,
    padding: 4,
    borderWidth: 1,
    borderColor: '#261C20',
  },
  stepBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#22222A',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#15151A',
  },
  stepBtnText: {
    color: '#F6F2EB',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepBtnAdd: {
    backgroundColor: '#FFFFFF',
  },
  stepBtnAddText: {
    color: '#0D0D10',
    fontSize: 16,
    fontWeight: '900',
  },
  qtyText: {
    color: '#F6F2EB',
    fontSize: 13,
    fontWeight: '900',
  },
});
