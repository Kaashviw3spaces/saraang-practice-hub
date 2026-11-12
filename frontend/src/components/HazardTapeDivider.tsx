import React from 'react';
import { View, StyleSheet, ViewStyle, Image } from 'react-native';

interface HazardTapeDividerProps {
  style?: ViewStyle;
}

export const HazardTapeDivider: React.FC<HazardTapeDividerProps> = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/hazard_tear_exact.png')}
        style={styles.tearImage}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 38,
    marginVertical: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 5,
  },
  tearImage: {
    width: '100%',
    height: '100%',
  },
});
