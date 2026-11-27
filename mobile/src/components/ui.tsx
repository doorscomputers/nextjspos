import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextInputInstance,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, tap } from '../theme';

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const kind = props.kind ?? 'primary';
  const disabled = props.disabled || props.loading;
  const filled = kind === 'primary' || kind === 'danger';
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : colors.card;
  const border =
    kind === 'secondary' ? colors.secondary : kind === 'ghost' ? colors.border : bg;
  const fg = filled ? colors.onBrand : kind === 'secondary' ? colors.secondary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        props.small && styles.btnSmall,
        {
          backgroundColor: disabled && filled ? colors.disabled : bg,
          borderColor: disabled ? colors.disabled : border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        props.style,
      ]}
    >
      {props.loading && <ActivityIndicator color={filled ? colors.onBrand : colors.secondary} />}
      <Text
        style={[
          styles.btnText,
          props.small && { fontSize: font.small },
          { color: disabled && !filled ? colors.disabled : fg },
        ]}
      >
        {props.title}
      </Text>
    </Pressable>
  );
}

export function Card(props: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function Header(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      {props.onBack && (
        <Pressable
          onPress={props.onBack}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.headerBackText}>‹</Text>
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.right}
    </View>
  );
}

export function Field(props: TextInputProps & { label: string; inputRef?: React.Ref<TextInputInstance> }) {
  const { label, inputRef, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        placeholderTextColor={colors.disabled}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export type BannerKind = 'error' | 'warning' | 'info' | 'success';

export function Banner(props: { kind: BannerKind; text: string; style?: StyleProp<ViewStyle> }) {
  const map = {
    error: [colors.dangerSoft, colors.dangerText, colors.danger],
    warning: [colors.warningSoft, colors.warningText, colors.warning],
    info: [colors.infoSoft, colors.infoText, colors.secondary],
    success: [colors.successSoft, colors.successText, colors.primary],
  } as const;
  const [bg, fg, border] = map[props.kind];
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }, props.style]}>
      <Text style={[styles.bannerText, { color: fg }]}>{props.text}</Text>
    </View>
  );
}

export function Badge(props: { text: string; kind: BannerKind }) {
  const map = {
    error: [colors.dangerSoft, colors.dangerText],
    warning: [colors.warningSoft, colors.warningText],
    info: [colors.infoSoft, colors.infoText],
    success: [colors.successSoft, colors.successText],
  } as const;
  const [bg, fg] = map[props.kind];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{props.text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 40 },
  btn: {
    minHeight: tap,
    borderRadius: radius,
    borderWidth: 2,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 1,
  },
  btnSmall: { minHeight: 48, paddingHorizontal: 12 },
  btnText: { fontSize: font.body, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBack: { minWidth: 48, minHeight: 48, justifyContent: 'center' },
  headerBackText: { color: colors.onBrand, fontSize: 40, lineHeight: 44, fontWeight: '300' },
  headerTitle: { color: colors.onBrand, fontSize: font.title, fontWeight: '800' },
  headerSub: { color: colors.brandSoft, fontSize: font.small, marginTop: 2 },
  label: { fontSize: font.small, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  input: {
    minHeight: tap,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: font.large,
    color: colors.text,
  },
  banner: { borderWidth: 2, borderRadius: radius, padding: 14, marginBottom: 14 },
  bannerText: { fontSize: font.body, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.small, fontWeight: '700' },
  h2: { fontSize: font.large, fontWeight: '800', color: colors.text, marginBottom: 8 },
  body: { fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
