import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LabeledInput } from '../../../components/LabeledInput';
import { AppButton } from '../../../components/AppButton';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { useLoginMutation } from '../authApi';
import { getErrorMessage } from '../../../utils/apiError';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading }] = useLoginMutation();

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await login({ email: email.trim(), password }).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not sign in. Check your credentials.'));
    }
  };

  return (
    <ScreenContainer scroll edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeGlyph}>◈</Text>
          </View>
          <Text style={styles.appName}>Rememberly</Text>
          <Text style={styles.tagline}>Your memory assistant — tasks, notes, and context in one place.</Text>
        </View>

        <View style={styles.form}>
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <LabeledInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            type="password"
          />

          <AppButton
            label={isLoading ? 'Signing in…' : 'Sign in'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isLoading}
            style={styles.submitButton}
          />

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>
              New here? <Text style={styles.registerLinkTextStrong}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    borderWidth: border.thick,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    transform: [{ rotate: '-4deg' }],
  },
  badgeGlyph: {
    color: colors.white,
    fontSize: 32,
  },
  appName: {
    ...typography.display,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  form: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  registerLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  registerLinkText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  registerLinkTextStrong: {
    color: colors.primary,
    fontWeight: '800',
  },
});
