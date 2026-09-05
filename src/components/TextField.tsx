import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, spacing } from '../theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor="#809092" style={[styles.input, error && styles.inputError]} {...inputProps} />
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 16 },
  inputError: { borderColor: colors.coral },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
