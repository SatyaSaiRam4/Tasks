import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useForgotPasswordMutation } from '../authApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';
import { AuthLayout } from './AuthLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await forgot({ email: email.trim().toLowerCase() }).unwrap();
      navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send a reset code.'));
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Enter your email and we'll send you a 6-digit code." back>
      <TextField
        label="Email"
        icon="message"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={error}
      />
      <Button label="Send code" onPress={submit} disabled={email.trim().length < 5} loading={isLoading} size="lg" />
    </AuthLayout>
  );
}
