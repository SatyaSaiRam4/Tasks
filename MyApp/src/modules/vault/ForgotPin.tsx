import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { colors, font, spacing, type as t } from '../../theme';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { getErrorMessage } from '../../utils/apiError';
import { useResetVaultPinMutation } from './vaultApi';

/**
 * Forgot the Vault PIN: the account password proves it's you, then a new PIN
 * opens the same notes. (They're encrypted with the server's key, not the
 * PIN, so nothing is lost.) An email tells the owner it happened.
 */
export function ForgotPin({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [reset, { isLoading }] = useResetVaultPinMutation();
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setPassword('');
    setPin('');
    setAgain('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!password) return setError('Enter your Memo account password.');
    if (!/^\d{4}$/.test(pin)) return setError('Your new PIN is 4 digits.');
    if (pin !== again) return setError('The two PINs don’t match.');
    try {
      await reset({ password, new_pin: pin }).unwrap();
      Toast.success('New PIN set. Your Vault is open.', 1.6);
      close();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset your PIN.'));
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Forgot your PIN?" subtitle="Your notes stay safe" placement="top">
      <Text style={[t.body, styles.lead]}>Enter your Memo account password, then choose a new 4-digit PIN. Your notes, voice notes and photos stay as they are.</Text>
      <TextField label="Account password" value={password} onChangeText={setPassword} secureTextEntry secureToggle icon="key" autoCapitalize="none" />
      <TextField label="New PIN" value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} icon="lock" />
      <TextField label="New PIN again" value={again} onChangeText={v => setAgain(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} icon="lock" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Set new PIN" size="lg" onPress={submit} loading={isLoading} />
        <Text style={t.caption}>Forgot your account password too? Sign out and use “Forgot password” on the sign-in screen first.</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  error: {
    ...font.semibold,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
