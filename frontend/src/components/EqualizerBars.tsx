import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface EqualizerBarsProps {
  active?: boolean;
  color?: string;
  size?: number;
}

export const EqualizerBars: React.FC<EqualizerBarsProps> = ({
  active = true,
  color = '#FFFFFF',
  size = 14,
}) => {
  const anim1 = useRef(new Animated.Value(4)).current;
  const anim2 = useRef(new Animated.Value(8)).current;
  const anim3 = useRef(new Animated.Value(3)).current;

  useEffect(() => {
    if (!active) {
      anim1.setValue(3);
      anim2.setValue(3);
      anim3.setValue(3);
      return;
    }

    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: size, duration: 320, useNativeDriver: false }),
        Animated.timing(anim1, { toValue: 3, duration: 360, useNativeDriver: false }),
      ])
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 2, duration: 240, useNativeDriver: false }),
        Animated.timing(anim2, { toValue: size, duration: 280, useNativeDriver: false }),
        Animated.timing(anim2, { toValue: 5, duration: 200, useNativeDriver: false }),
      ])
    );
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(anim3, { toValue: size * 0.85, duration: 420, useNativeDriver: false }),
        Animated.timing(anim3, { toValue: 3, duration: 380, useNativeDriver: false }),
      ])
    );

    loop1.start();
    loop2.start();
    loop3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [active, size, anim1, anim2, anim3]);

  const barWidth = Math.max(2, Math.round(size / 6));

  return (
    <View style={[styles.container, { height: size }]}>
      <Animated.View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: anim1,
            backgroundColor: color,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: anim2,
            backgroundColor: color,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: anim3,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    marginRight: 6,
  },
  bar: {
    borderRadius: 2,
  },
});
