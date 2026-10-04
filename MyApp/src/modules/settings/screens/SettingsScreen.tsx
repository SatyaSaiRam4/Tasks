import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import Toast from '@ant-design/react-native/lib/toast';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { SectionCard } from '../../../components/SectionCard';
import { AppButton } from '../../../components/AppButton';
import { border, colors, fontSize, radius, spacing, typography } from '../../../theme';
import { API_BASE_URL } from '../../../config/env';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser, selectRefreshToken } from '../../auth/authSlice';
import { useLogoutAllMutation, useLogoutMutation } from '../../auth/authApi';
import { getErrorMessage } from '../../../utils/apiError';

export function SettingsScreen() {
  const user = useAppSelector(selectCurrentUser);
  const refreshToken = useAppSelector(selectRefreshToken);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [logoutAll, { isLoading: isLoggingOutAll }] = useLogoutAllMutation();

  const handleLogout = () => {
    Modal.alert('Sign out', 'You can sign back in anytime.', [
      { text: 'Cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          try {
            await logout({ refresh_token: refreshToken ?? '' }).unwrap();
          } catch (err) {
            // Even if the network call fails, the mutation's onQueryStarted
            // clears local session state via `finally`, so the user is
            // effectively signed out locally.
            Toast.info(getErrorMessage(err, 'Signed out locally; could not reach the server.'));
          }
        },
      },
    ]);
  };

  const handleLogoutAll = () => {
    Modal.alert('Sign out everywhere', 'This signs you out on every device.', [
      { text: 'Cancel' },
      {
        text: 'Sign out everywhere',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutAll().unwrap();
          } catch (err) {
            Toast.info(getErrorMessage(err, 'Signed out locally; could not reach the server.'));
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <SectionCard title="Account">
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.display_name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          {user?.role === 'ADMIN' ? (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          ) : null}
        </View>
      </SectionCard>

      <SectionCard title="Connection" subtitle="Configured in src/config/env.ts">
        <Text style={styles.apiUrl}>{API_BASE_URL}</Text>
      </SectionCard>

      <AppButton
        label={isLoggingOut ? 'Signing out…' : 'Sign out'}
        variant="secondary"
        onPress={handleLogout}
        disabled={isLoggingOut}
        style={styles.button}
      />

      <AppButton
        label={isLoggingOutAll ? 'Signing out…' : 'Sign out on all devices'}
        variant="danger"
        onPress={handleLogoutAll}
        disabled={isLoggingOutAll}
        style={styles.dangerButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accentYellowSoft,
    borderWidth: border.thick,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: fontSize.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  profileEmail: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  adminBadge: {
    backgroundColor: colors.accentOrange,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  adminBadgeText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 10,
  },
  apiUrl: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: spacing.lg,
  },
  dangerButton: {
    marginTop: spacing.sm,
  },
});
