import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export const PunkRansomLogo: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/saarang_script_logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  logoImage: {
    width: 140,
    height: 44,
  },
});
