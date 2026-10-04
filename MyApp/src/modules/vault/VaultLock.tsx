import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, type as t } from '../../theme';
import { PinPad } from '../../components/PinPad';
import { Glow, Gradient } from '../../components/Gradient';
import { Icon } from '../../components/Icon';
import { FadeIn } from '../../components/Feedback';
import { getErrorMessage } from '../../utils/apiError';
import { useSetupVaultMutation, useUnlockVaultMutation, type VaultStatus } from './vaultApi';

const PIN_LENGTH = 4;

/** The lock screen: first-time PIN setup (with confirmation), or unlock. */
export function VaultLock({ status, onLockedRefresh }: { status: VaultStatus; onLockedRefresh: () => void }) {
  const [setup, { isLoading: settingUp }] = useSetupVaultMutation();
  const [unlock, { isLoading: unlocking }] = useUnlockVaultMutation();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const lockedUntil = status.locked_until ? new Date(status.locked_until).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  const lockedOut = lockedUntil > now;

  useEffect(() => {
    if (!lockedOut) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) onLockedRefresh();
    }, 1000);
    return () => clearInterval(id);
  }, [lockedOut, lockedUntil, onLockedRefresh]);

  const fail = (msg: string) => {
    setMessage(msg);
    setErrorKey(k => k + 1);
    setPin('');
  };

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    const value = pin;
    (async () => {
      if (!status.has_pin) {
        if (!first) {
          setFirst(value);
          setPin('');
          setMessage(null);
          return;
        }
        if (first !== value) {
          setFirst(null);
          return fail("Those PINs didn't match. Let's try again.");
        }
        try {
          await setup({ pin: value }).unwrap();
        } catch (err) {
          setFirst(null);
          fail(getErrorMessage(err, 'Could not set your PIN.'));
        }
        return;
      }
      try {
        await unlock({ pin: value }).unwrap();
      } catch (err) {
        fail(getErrorMessage(err, 'Incorrect PIN.'));
        onLockedRefresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const title = !status.has_pin ? (first ? 'Confirm your PIN' : 'Create a Vault PIN') : 'Vault locked';
  const subtitle = !status.has_pin
    ? first
      ? 'Enter the same 4 digits again.'
      : 'Your private space for secrets, credentials and personal notes. Choose a 4-digit PIN. It can’t be recovered if you forget it.'
    : lockedOut
      ? `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)}s.`
      : 'Enter your PIN to open your private space.';

  return (
    <FadeIn style={styles.root}>
      <View style={styles.lockArt}>
        <Glow color={colors.primary} size={220} intensity={0.4} style={styles.glow} />
        <Gradient colors={gradients.vault} borderRadius={radius.xxl} style={styles.lockIcon}>
          <Icon name="lock" size={34} color={colors.primary} />
        </Gradient>
      </View>
      <Text style={[t.title, styles.center]}>{title}</Text>
      <Text style={[t.body, styles.subtitle]}>{subtitle}</Text>
      <View style={styles.messageSlot}>
        {message ? (
          <Text style={styles.message} accessibilityLiveRegion="assertive">
            {message}
          </Text>
        ) : null}
      </View>
      <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} errorKey={errorKey} disabled={lockedOut || settingUp || unlocking} />
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.xl,
    alignItems: 'stretch',
  },
  lockArt: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  lockIcon: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  center: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    // Room for the longest (3-line) message, so the keypad never shifts
    // between "Create" and "Confirm" and a thumb doesn't land between keys.
    minHeight: 22 * 3,
  },
  messageSlot: {
    minHeight: 40,
    justifyContent: 'center',
  },
  message: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
});
