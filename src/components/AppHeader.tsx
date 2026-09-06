import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, spacing } from '../theme/tokens';
import { RadarMark } from './RadarMark';

type AppHeaderProps = {
  backTo?: '/' | '/create' | '/join';
};

export function AppHeader({ backTo = '/' }: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Roommate Radar home" hitSlop={10} onPress={() => router.replace(backTo)} style={styles.brand}>
        <RadarMark size={34} />
        <Text style={styles.name}>Roommate Radar</Text>
      </Pressable>
      <View style={styles.pill}><View style={styles.pillDot} /><Text style={styles.pillText}>EARLY ACCESS</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.72)' },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral },
  pillText: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
});
