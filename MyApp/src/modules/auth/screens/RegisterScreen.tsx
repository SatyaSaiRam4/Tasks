import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LabeledInput } from '../../../components/LabeledInput';
import { AppButton } from '../../../components/AppButton';
import { colors, fontSize, spacing, typography } from '../../../theme';
import { useRegisterMutation } from '../authApi';
import { getErrorMessage } from '../../../utils/apiError';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, { isLoading }] = useRegisterMutation();

  const canSubmit =
    displayName.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await register({ email: email.trim(), password, display_name: displayName.trim() }).unwrap();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not create your account.'));
    }
  };

  return (
    <ScreenContainer scroll edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.hero}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.tagline}>A few seconds, then your memory assistant is ready.</Text>
        </View>

        <View style={styles.form}>
          <LabeledInput
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ada"
          />
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
            placeholder="At least 8 characters"
            type="password"
          />

          <AppButton
            label={isLoading ? 'Creating account…' : 'Create account'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isLoading}
            style={styles.submitButton}
          />

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkTextStrong}>Sign in</Text>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.h1,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  form: {
    paddingHorizontal: spacing.xl,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  loginLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  loginLinkText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  loginLinkTextStrong: {
    color: colors.primary,
    fontWeight: '800',
  },
});
