import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/tokens';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function Button({ label, onPress, loading = false, variant = 'primary' }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.button, isPrimary ? styles.primary : styles.secondary, (pressed || loading) && styles.pressed]}>
    {loading ? <ActivityIndicator color={isPrimary ? colors.paper : colors.ink} /> : <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: 'rgba(255,255,255,0.5)' },
  label: { fontSize: 15, fontWeight: '800' },
  primaryLabel: { color: colors.paper },
  secondaryLabel: { color: colors.ink },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
});
