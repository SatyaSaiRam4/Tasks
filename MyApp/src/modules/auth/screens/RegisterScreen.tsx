import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../../theme';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useRegisterMutation } from '../authApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';
import { AuthLayout } from './AuthLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const [register, { isLoading }] = useRegisterMutation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const emailError = touched && email && !EMAIL.test(email.trim()) ? 'That email doesn’t look right.' : null;
  const passwordError = touched && password && password.length < 8 ? 'Use at least 8 characters.' : null;
  const canSubmit = name.trim() && EMAIL.test(email.trim()) && password.length >= 8 && !isLoading;

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setError(null);
    try {
      // On success the navigator moves to Satya's first-time tour automatically.
      await register({ display_name: name.trim(), email: email.trim().toLowerCase(), password }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account.'));
    }
  };

  return (
    <AuthLayout
      title="Start your streak"
      subtitle="Plan small actions, confirm them honestly, and watch consistency compound."
      back
      footer={
        <Pressable onPress={() => navigation.navigate('Login')} accessibilityRole="link">
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </Pressable>
      }
    >
      <TextField
        label="Your name"
        icon="user"
        value={name}
        onChangeText={setName}
        placeholder="Alex"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Email"
        icon="message"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onBlur={() => setTouched(true)}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={emailError}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="key"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        secureToggle
        autoComplete="password-new"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={passwordError ?? error}
      />
      <Button label="Create account" onPress={submit} disabled={!canSubmit} loading={isLoading} size="lg" iconRight="arrow-right" />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
