import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { colors } from '../theme/tokens';

type RadarMarkProps = {
  size: number;
};

const SCAN_DURATION_MS = 2800;
const STATIC_ANGLE = '42deg';

export function RadarMark({ size }: RadarMarkProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReduceMotion(enabled); })
      .catch(() => { if (mounted) setReduceMotion(false); });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    rotation.stopAnimation();
    rotation.setValue(0);
    if (reduceMotion !== false) return;

    const scan = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: SCAN_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    }));
    scan.start();
    return () => scan.stop();
  }, [reduceMotion, rotation]);

  const rotate = reduceMotion === false
    ? rotation.interpolate({
      inputRange: [0, 1],
      outputRange: [STATIC_ANGLE, '402deg'],
    })
    : STATIC_ANGLE;

  return (
    <View
      accessible={false}
      testID="radar-mark"
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View
        style={[
          styles.ring,
          { width: size * 0.58, height: size * 0.58, borderRadius: size },
        ]}
      />
      <Animated.View testID="radar-scan" style={[styles.scan, { transform: [{ rotate }] }]}>
        <View style={[styles.needle, { height: size * 0.38 }]} />
      </Animated.View>
      <View style={styles.center} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  ring: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.52)',
  },
  scan: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  needle: {
    position: 'absolute',
    left: '50%',
    bottom: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.mint,
  },
  center: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.paper,
  },
});
