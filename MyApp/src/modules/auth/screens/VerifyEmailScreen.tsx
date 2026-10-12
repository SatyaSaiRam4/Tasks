import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Toast from '@ant-design/react-native/lib/toast';
import { spacing } from '../../../theme';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useResendCodeMutation, useVerifyEmailMutation } from '../authApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';
import { AuthLayout } from './AuthLayout';

/** Seconds before another code can be requested (the server enforces it too). */
const RESEND_WAIT = 60;

/**
 * Proves the email is real: the 6-digit code we just sent. A correct code
 * signs the user in, and the navigator moves on by itself.
 */
export function VerifyEmailScreen() {
  const { email } = useRoute<RouteProp<RootStackParamList, 'VerifyEmail'>>().params;
  const [verify, { isLoading }] = useVerifyEmailMutation();
  const [resend, { isLoading: resending }] = useResendCodeMutation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A code was sent just before this screen opened.
  const [wait, setWait] = useState(RESEND_WAIT);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const submit = async (value = code) => {
    if (!/^\d{6}$/.test(value) || isLoading) return;
    setError(null);
    try {
      await verify({ email, code: value }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, 'That code didn’t work. Try again.'));
    }
  };

  const sendAgain = async () => {
    if (wait > 0) return;
    setError(null);
    try {
      await resend({ email }).unwrap();
      setCode('');
      setWait(RESEND_WAIT);
      Toast.success('A new code is on its way.', 1.6);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send a new code.'));
    }
  };

  return (
    <AuthLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`} back>
      <TextField
        label="Verification code"
        icon="shield"
        value={code}
        onChangeText={v => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          // Six digits in: verify straight away, no extra tap.
          if (digits.length === 6) submit(digits);
        }}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        error={error}
      />
      <Button label="Verify and continue" onPress={() => submit()} disabled={code.length !== 6} loading={isLoading} size="lg" />
      <Button
        label={wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        variant="ghost"
        onPress={sendAgain}
        disabled={wait > 0}
        loading={resending}
        style={styles.resend}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  resend: {
    marginTop: spacing.sm,
  },
});
