import React, { useState } from 'react';
import { Text } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { getErrorMessage } from '../../../utils/apiError';
import { useChangePasswordMutation } from '../../auth/authApi';

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [change, { isLoading }] = useChangePasswordMutation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await change({ current_password: current, new_password: next }).unwrap();
      Toast.success('Password changed.', 1.4);
      navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change your password.'));
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Change password" close />
      <Text style={[t.body, { color: colors.textSecondary, marginBottom: spacing.xl }]}>
        Use at least 8 characters. Other devices stay signed in.
      </Text>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry secureToggle autoComplete="password" />
      <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry secureToggle autoComplete="password-new" error={error} />
      <Button label="Update password" size="lg" onPress={submit} loading={isLoading} disabled={!current || next.length < 8} />
    </Screen>
  );
}
