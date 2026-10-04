import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../../app/hooks';
import { ACCENTS, colors, radius, spacing, type AccentName, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { SectionHeader, Toggle } from '../../../components/Controls';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { ConfirmSheet, SelectSheet, Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ErrorState, SkeletonList } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { ACCENT_STORAGE_KEY } from '../../../utils/storage';
import { openExactAlarmSettings } from '../../../notifications';
import { useLogoutAllMutation, useLogoutMutation } from '../../auth/authApi';
import { selectRefreshToken } from '../../auth/authSlice';
import { useChangeVaultPinMutation, useGetVaultStatusQuery } from '../../vault/vaultApi';
import {
  useGetMeQuery,
  useResetOnboardingMutation,
  useUpdateMeMutation,
  useUpdateSettingsMutation,
  type SettingsUpdate,
} from '../../users/usersApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AUTOLOCK = [
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '0', label: 'Never (while the app is open)' },
];

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const me = useGetMeQuery();
  const vault = useGetVaultStatusQuery();
  const refreshToken = useAppSelector(selectRefreshToken);
  const [updateSettings] = useUpdateSettingsMutation();
  const [updateMe, { isLoading: savingName }] = useUpdateMeMutation();
  const [resetOnboarding] = useResetOnboardingMutation();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const [logoutAll, { isLoading: loggingOutAll }] = useLogoutAllMutation();
  const [changePin, { isLoading: changingPin }] = useChangeVaultPinMutation();

  const [sheet, setSheet] = useState<'name' | 'autolock' | 'pin' | 'logout' | 'logoutAll' | null>(null);
  const [name, setName] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentName>('violet');

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_STORAGE_KEY)
      .then(v => v && v in ACCENTS && setAccent(v as AccentName))
      .catch(() => undefined);
  }, []);

  const set = (patch: SettingsUpdate) =>
    updateSettings(patch)
      .unwrap()
      .catch(err => Toast.fail(getErrorMessage(err, 'Could not save that setting.'), 2));

  const pickAccent = async (key: AccentName) => {
    setAccent(key);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, key).catch(() => undefined);
    set({ accent_color: ACCENTS[key].primary });
    Toast.info('Accent saved. It applies the next time you open the app.', 2);
  };

  if (me.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Settings" />
        <SkeletonList count={6} height={60} />
      </Screen>
    );
  }
  if (me.isError || !me.data) {
    return (
      <Screen>
        <ScreenHeader title="Settings" />
        <ErrorState message={getErrorMessage(me.error)} onRetry={me.refetch} />
      </Screen>
    );
  }

  const s = me.data.settings;
  const toggle = (key: keyof typeof s, label: string, subtitle?: string, last?: boolean, icon?: Parameters<typeof ListRow>[0]['icon']) => (
    <ListRow
      icon={icon}
      title={label}
      subtitle={subtitle}
      last={last}
      right={<Toggle value={Boolean(s[key])} onChange={v => set({ [key]: v } as SettingsUpdate)} accessibilityLabel={label} />}
    />
  );

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <SectionHeader title="Account" style={styles.firstSection} />
      <ListGroup>
        <ListRow icon="user" title="Display name" value={me.data.display_name} onPress={() => { setName(me.data!.display_name); setSheet('name'); }} />
        <ListRow icon="tag" title="User ID" value={me.data.public_id} />
        <ListRow icon="message" title="Email" value={me.data.email} />
        <ListRow icon="key" title="Password" subtitle="Change your password" onPress={() => navigation.navigate('ChangePassword')} />
        <ListRow icon="logout" title="Sign out" onPress={() => setSheet('logout')} destructive />
        <ListRow icon="logout" title="Sign out everywhere" subtitle="Ends every session on every device" onPress={() => setSheet('logoutAll')} destructive last />
      </ListGroup>

      <SectionHeader title="Appearance" />
      <ListGroup>
        <ListRow icon="moon" title="Dark theme" subtitle="Memo is designed dark-first" right={<Text style={t.caption}>Always on</Text>} />
        <View style={styles.accentRow}>
          <Text style={t.bodyStrong}>Accent color</Text>
          <View style={styles.swatches}>
            {(Object.keys(ACCENTS) as AccentName[]).map(key => (
              <Pressable
                key={key}
                onPress={() => pickAccent(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: accent === key }}
                accessibilityLabel={`${key} accent`}
                style={[styles.swatch, { backgroundColor: ACCENTS[key].primary }, accent === key && styles.swatchOn]}
              >
                {accent === key ? <Icon name="check" size={14} color={colors.white} strokeWidth={3} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        {toggle('animations_enabled', 'Animations', 'Celebrations, counters and transitions', false, 'sparkles')}
        {toggle('reduced_motion', 'Reduced motion', 'Keep only essential movement', true, 'eye')}
      </ListGroup>

      <SectionHeader title="Notifications" />
      <ListGroup>
        {toggle('notify_reminders', 'Reminders', 'Your date & time reminders', false, 'bell')}
        {toggle('notify_streak_warnings', 'Streak warnings', 'At 8 PM if today’s tasks aren’t done', false, 'flame')}
        {toggle('notify_achievements', 'Achievements', 'When you unlock something', false, 'award')}
        <ListRow icon="clock" title="Exact alarms" subtitle="Allow on-time delivery on Android 12+" onPress={() => openExactAlarmSettings().catch(() => undefined)} last />
      </ListGroup>

      <SectionHeader title="Streak" />
      <ListGroup>
        <View style={styles.modeBlock}>
          <Text style={t.bodyStrong}>Completion confirmation</Text>
          <Text style={[t.caption, styles.mtXs]}>Every completion is confirmed. Quick mode uses a lighter one-tap sheet.</Text>
          <View style={styles.modeRow}>
            {(['STANDARD', 'QUICK'] as const).map(mode => (
              <Pressable
                key={mode}
                onPress={() => set({ confirmation_mode: mode })}
                accessibilityRole="radio"
                accessibilityState={{ selected: s.confirmation_mode === mode }}
                style={[styles.mode, s.confirmation_mode === mode && styles.modeOn]}
              >
                <Text style={[t.bodyStrong, s.confirmation_mode === mode && { color: colors.white }]}>{mode === 'STANDARD' ? 'Standard' : 'Quick'}</Text>
                <Text style={[t.caption, s.confirmation_mode === mode && { color: 'rgba(255,255,255,0.8)' }]}>
                  {mode === 'STANDARD' ? '“Did you actually complete this?”' : 'One-tap confirm'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ListRow icon="info" title="Streak rules" subtitle="Tick all of a day’s tasks to keep it going" onPress={() => navigation.navigate('Consistency')} last />
      </ListGroup>

      <SectionHeader title="Privacy" />
      <ListGroup>
        {toggle('is_public_profile', 'Public profile', 'Let people find you by User ID', !s.is_public_profile, 'users')}
        {s.is_public_profile ? (
          <>
            {toggle('show_current_streak', 'Show current streak', undefined, false, 'flame')}
            {toggle('show_best_streak', 'Show best streak', undefined, false, 'trophy')}
            {toggle('show_achievements', 'Show achievements', undefined, true, 'award')}
          </>
        ) : null}
      </ListGroup>
      <Text style={[t.caption, styles.note]}>Your Vault, reminders and tasks are never shown to anyone.</Text>

      <SectionHeader title="Vault" />
      <ListGroup>
        <ListRow icon="lock" title="Auto-lock" value={AUTOLOCK.find(a => a.value === String(s.vault_autolock_minutes))?.label} onPress={() => setSheet('autolock')} />
        <ListRow
          icon="key"
          title="Security method"
          subtitle={vault.data?.has_pin ? '4-digit PIN · Change PIN' : 'Set up a PIN when you first open the Vault'}
          onPress={vault.data?.has_pin ? () => { setCurrentPin(''); setNewPin(''); setPinError(null); setSheet('pin'); } : undefined}
          last
        />
      </ListGroup>

      <SectionHeader title="Satya" />
      <ListGroup>
        {toggle('satya_enabled', 'Satya on Home', 'Short tips from your guide', false, 'sparkles')}
        <ListRow
          icon="play"
          title="Replay tour"
          subtitle="Walk through the app with Satya again"
          onPress={async () => {
            await resetOnboarding().unwrap().catch(() => undefined);
          }}
          last
        />
      </ListGroup>

      <Text style={[t.caption, styles.version]}>Memo · v2.1</Text>

      <Sheet visible={sheet === 'name'} onClose={() => setSheet(null)} title="Display name">
        <TextField value={name} onChangeText={setName} placeholder="Your name" maxLength={120} autoFocus />
        <Button
          label="Save"
          size="lg"
          loading={savingName}
          disabled={!name.trim()}
          onPress={async () => {
            try {
              await updateMe({ display_name: name.trim() }).unwrap();
              setSheet(null);
            } catch (err) {
              Toast.fail(getErrorMessage(err), 2);
            }
          }}
        />
      </Sheet>

      <SelectSheet
        visible={sheet === 'autolock'}
        title="Auto-lock the Vault after"
        options={AUTOLOCK}
        value={String(s.vault_autolock_minutes)}
        onSelect={v => set({ vault_autolock_minutes: Number(v) })}
        onClose={() => setSheet(null)}
      />

      <Sheet visible={sheet === 'pin'} onClose={() => setSheet(null)} title="Change Vault PIN">
        <TextField label="Current PIN" value={currentPin} onChangeText={v => setCurrentPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry />
        <TextField label="New PIN" value={newPin} onChangeText={v => setNewPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry hint="4 to 6 digits" error={pinError} />
        <Button
          label="Change PIN"
          size="lg"
          loading={changingPin}
          disabled={currentPin.length < 4 || newPin.length < 4}
          onPress={async () => {
            setPinError(null);
            try {
              await changePin({ current_pin: currentPin, new_pin: newPin }).unwrap();
              setSheet(null);
              Toast.success('Vault PIN changed.', 1.4);
            } catch (err) {
              setPinError(getErrorMessage(err, 'Could not change your PIN.'));
            }
          }}
        />
      </Sheet>

      <ConfirmSheet
        visible={sheet === 'logout'}
        icon="logout"
        title="Sign out?"
        message="Your Vault locks and scheduled notifications on this device are cleared."
        confirmLabel="Sign out"
        loading={loggingOut}
        onConfirm={() => refreshToken && logout({ refresh_token: refreshToken })}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'logoutAll'}
        icon="logout"
        destructive
        title="Sign out everywhere?"
        message="Every device signed in to your account will need to sign in again."
        confirmLabel="Sign out everywhere"
        loading={loggingOutAll}
        onConfirm={() => logoutAll()}
        onCancel={() => setSheet(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  firstSection: {
    marginTop: spacing.sm,
  },
  mtXs: {
    marginTop: 4,
  },
  accentRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  swatches: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOn: {
    borderWidth: 2,
    borderColor: colors.white,
  },
  modeBlock: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mode: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  modeOn: {
    backgroundColor: colors.primary,
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  version: {
    textAlign: 'center',
    marginTop: spacing.xxl,
    color: colors.textTertiary,
  },
});
