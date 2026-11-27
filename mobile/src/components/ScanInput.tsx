import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { colors, font, radius, tap } from '../theme';

export type ScanInputHandle = { focus: () => void };

/**
 * Text box that Bluetooth / built-in scanners type into (they act like a
 * keyboard and press Enter at the end). By default the on-screen keyboard is
 * hidden so it does not cover the screen; the ⌨ button shows it for typing.
 * The box takes focus back whenever it loses it, unless `keepFocus` is false
 * (for example while a pop-up is open).
 */
export const ScanInput = forwardRef<
  ScanInputHandle,
  { placeholder: string; onSubmit: (code: string) => void; keepFocus: boolean; onCamera?: () => void }
>(function ScanInput(props, ref) {
  const input = useRef<TextInputInstance>(null);
  const [value, setValue] = useState('');
  const [softKeyboard, setSoftKeyboard] = useState(false);
  const keepFocus = useRef(props.keepFocus);
  keepFocus.current = props.keepFocus;

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  // When a pop-up / camera closes, take the focus back so the next scan lands here.
  useEffect(() => {
    if (!props.keepFocus) return;
    const t = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [props.keepFocus]);

  const submit = () => {
    const code = value.trim();
    setValue('');
    if (code) props.onSubmit(code);
  };

  const toggleKeyboard = () => {
    setSoftKeyboard((v) => !v);
    // Re-focus so Android applies the new keyboard setting.
    input.current?.blur();
    setTimeout(() => input.current?.focus(), 150);
  };

  return (
    <View style={s.row}>
      <TextInput
        ref={input}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        submitBehavior="submit"
        autoFocus
        showSoftInputOnFocus={softKeyboard}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="go"
        placeholder={props.placeholder}
        placeholderTextColor={colors.disabled}
        style={s.input}
        onBlur={() => {
          if (keepFocus.current) setTimeout(() => keepFocus.current && input.current?.focus(), 250);
        }}
      />
      <Pressable
        onPress={toggleKeyboard}
        style={[s.iconBtn, softKeyboard && s.iconBtnOn]}
        accessibilityRole="button"
        accessibilityLabel={softKeyboard ? 'Hide keyboard' : 'Show keyboard to type'}
      >
        <Text style={[s.icon, softKeyboard && { color: colors.onBrand }]}>⌨</Text>
      </Pressable>
      {props.onCamera && (
        <Pressable
          onPress={props.onCamera}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Scan with camera"
        >
          <Text style={s.icon}>📷</Text>
        </Pressable>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 60,
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: font.large,
    color: colors.text,
  },
  iconBtn: {
    minWidth: tap + 4,
    minHeight: 60,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: colors.secondary },
  icon: { fontSize: 26, color: colors.secondary },
});
