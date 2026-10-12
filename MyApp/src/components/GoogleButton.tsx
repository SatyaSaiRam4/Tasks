import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font, radius, spacing } from '../theme';
import { getErrorMessage } from '../utils/apiError';
import { useGoogleSignInMutation } from '../modules/auth/authApi';
import { getGoogleIdToken, googleEnabled } from '../modules/auth/google';

/** Google's four-colour "G". */
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * "Continue with Google": signs in, or creates the account, in one step.
 * Renders nothing until Google sign-in is configured (GOOGLE_WEB_CLIENT_ID).
 */
export function GoogleButton({ onError }: { onError: (message: string | null) => void }) {
  const [signIn, { isLoading }] = useGoogleSignInMutation();
  const [opening, setOpening] = useState(false);
  if (!googleEnabled) return null;
  const busy = opening || isLoading;

  const press = async () => {
    if (busy) return;
    onError(null);
    setOpening(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return; // they backed out of the picker
      await signIn({ id_token: idToken }).unwrap();
      // Signed in: the navigator moves on by itself.
    } catch (err) {
      onError(err instanceof Error ? err.message : getErrorMessage(err, 'Google sign-in failed.'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <View>
      <View style={styles.divider}>
        <View style={styles.rule} />
        <Text style={styles.or}>or</Text>
        <View style={styles.rule} />
      </View>
      <Pressable
        onPress={press}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {busy ? <ActivityIndicator color={colors.text} /> : <GoogleG />}
        <Text style={styles.label}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  or: {
    ...font.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  button: {
    height: 56,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    ...font.bold,
    fontSize: 15,
    color: colors.text,
  },
});
