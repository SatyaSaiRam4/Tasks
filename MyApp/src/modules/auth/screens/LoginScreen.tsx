import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '../../../theme';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useLoginMutation } from '../authApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';
import { AuthLayout } from './AuthLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !isLoading;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await login({ email: email.trim().toLowerCase(), password }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign you in.'));
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Pick up where you left off. Your streak is waiting."
      footer={
        <Pressable onPress={() => navigation.navigate('Register')} accessibilityRole="link">
          <Text style={styles.footerText}>
            New here? <Text style={styles.link}>Create an account</Text>
          </Text>
        </Pressable>
      }
    >
      <TextField
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
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="key"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        secureToggle
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
      />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} accessibilityRole="link" style={styles.forgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <Button label="Sign in" onPress={submit} disabled={!canSubmit} loading={isLoading} size="lg" iconRight="arrow-right" />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.xl,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
