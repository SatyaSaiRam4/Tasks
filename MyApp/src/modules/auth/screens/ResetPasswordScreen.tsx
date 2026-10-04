import React, { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from '@ant-design/react-native/lib/toast';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useResetPasswordMutation } from '../authApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';
import { AuthLayout } from './AuthLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const [reset, { isLoading }] = useResetPasswordMutation();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.includes('@') && /^\d{6}$/.test(code) && password.length >= 8 && !isLoading;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await reset({ email: email.trim().toLowerCase(), code, new_password: password }).unwrap();
      Toast.success('Password updated. Sign in with your new password.', 2);
      navigation.navigate('Login');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset your password.'));
    }
  };

  return (
    <AuthLayout title="Enter your code" subtitle="Check your email for the 6-digit code. It expires in 15 minutes." back>
      {!route.params?.email ? (
        <TextField label="Email" icon="message" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      ) : null}
      <TextField
        label="Reset code"
        icon="shield"
        value={code}
        onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <TextField
        label="New password"
        icon="key"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        secureToggle
        autoComplete="password-new"
        error={error}
      />
      <Button label="Update password" onPress={submit} disabled={!canSubmit} loading={isLoading} size="lg" />
    </AuthLayout>
  );
}
