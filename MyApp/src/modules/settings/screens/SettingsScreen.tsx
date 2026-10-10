import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { alarmChanged, storyOpened } from '../../../app/preferencesSlice';
import {
  ACCENTS,
  brand,
  colors,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  font,
  gradients,
  radius,
  spacing,
  type AccentName,
  type ThemeMode,
  type as t,
} from '../../../theme';
import { Screen } from '../../../components/Screen';
import { Wordmark } from '../../../components/Brand';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar, Chip, ChipRow, Segmented, SectionHeader, Toggle } from '../../../components/Controls';
import { Card } from '../../../components/Card';
import { Gradient } from '../../../components/Gradient';
import { ListGroup, ListRow } from '../../../components/ListRow';
import { ConfirmSheet, SelectSheet, Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ErrorState, SkeletonList } from '../../../components/Feedback';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { ACCENT_STORAGE_KEY, THEME_STORAGE_KEY } from '../../../utils/storage';
import { hideReloadCover, reloadApp } from '../../../utils/appReload';
import {
  ALARM_LENGTHS,
  ALARM_SOUNDS,
  loadAlarmPreferences,
  openExactAlarmSettings,
  saveAlarmPreferences,
  testAlarm,
  type AlarmPreferences,
} from '../../../notifications';
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
  const [accent, setAccent] = useState<AccentName>(DEFAULT_ACCENT);
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME);
  const dispatch = useAppDispatch();
  const [alarm, setAlarm] = useState<AlarmPreferences | null>(null);

  useEffect(() => {
    loadAlarmPreferences().then(setAlarm);
  }, []);

  // After a theme reload, the snapshot over the screen fades out once
  // Settings is drawn with its data (a no-op any other time).
  useEffect(() => {
    if (!me.data) return;
    const timer = setTimeout(hideReloadCover, 250);
    return () => clearTimeout(timer);
  }, [me.data]);

  const pickAlarm = (next: AlarmPreferences) => {
    setAlarm(next);
    saveAlarmPreferences(next)
      .then(() => dispatch(alarmChanged()))
      .catch(() => undefined);
  };

  useEffect(() => {
    AsyncStorage.getMany([ACCENT_STORAGE_KEY, THEME_STORAGE_KEY])
      .then(values => {
        if (values[ACCENT_STORAGE_KEY] && values[ACCENT_STORAGE_KEY] in ACCENTS) {
          setAccent(values[ACCENT_STORAGE_KEY] as AccentName);
        }
        if (values[THEME_STORAGE_KEY] === 'light' || values[THEME_STORAGE_KEY] === 'dark') {
          setThemeMode(values[THEME_STORAGE_KEY]);
        }
      })
      .catch(() => undefined);
  }, []);

  const set = (patch: SettingsUpdate) =>
    updateSettings(patch)
      .unwrap()
      .catch(err => Toast.fail(getErrorMessage(err, 'Could not save that setting.'), 2));

  const pickAccent = async (key: AccentName) => {
    setAccent(key);
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, key).catch(() => undefined);
    await set({ accent_color: ACCENTS[key].primary });
    if (!(await reloadApp('Settings'))) Toast.info('Accent saved. It applies the next time you open the app.', 2);
  };

  const pickTheme = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => undefined);
    if (!(await reloadApp('Settings'))) Toast.info('Theme saved. It applies the next time you open the app.', 2);
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
      <ScreenHeader title="Settings" subtitle="Preferences" />

      <Card tone="hero" contentStyle={styles.member}>
        <Avatar name={me.data.display_name} emoji={me.data.avatar} size={58} />
        <View style={styles.flex}>
          <Text style={styles.memberName} numberOfLines={1}>
            {me.data.display_name}
          </Text>
          <Text style={styles.memberEmail} numberOfLines={1}>
            {me.data.email}
          </Text>
        </View>
      </Card>

      {/* Up top so it's easy to find: what makes Memo different. */}
      <Card tone="hero" onPress={() => navigation.navigate('WhyMemo')} style={styles.whyWrap} contentStyle={styles.whyCard} accessibilityLabel="Why Memo? See how Memo compares with alarms and to-do apps.">
        <View style={styles.whyIcon}>
          <Icon name="sparkles" size={20} color={brand.champagneLight} strokeWidth={1.7} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.whyTitle}>Why Memo?</Text>
          <Text style={styles.whyText}>See how Memo compares with alarms and other to-do apps</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.heroTextTertiary} />
      </Card>

      <SectionHeader title="Account" />
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
        <View style={styles.themeRow}>
          <Text style={t.bodyStrong}>Color theme</Text>
          <Segmented
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={themeMode}
            onChange={mode => pickTheme(mode as ThemeMode)}
            style={styles.themeSegment}
          />
          <Text style={[t.caption, styles.themeHint]}>Applies the next time you open the app</Text>
        </View>
        <View style={styles.accentRow}>
          <Text style={t.bodyStrong}>Accent color</Text>
          <View style={styles.swatches} accessibilityRole="radiogroup">
            {(Object.keys(ACCENTS) as AccentName[]).map(key => (
              <Pressable
                key={key}
                onPress={() => pickAccent(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: accent === key }}
                accessibilityLabel={`${ACCENTS[key].label} accent`}
                style={styles.swatchItem}
              >
                <View style={[styles.swatchRing, accent === key && styles.swatchRingOn]}>
                  <Gradient colors={[ACCENTS[key].bright, ACCENTS[key].primary]} borderRadius={17} style={styles.swatch}>
                    {accent === key ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={2.6} /> : null}
                  </Gradient>
                </View>
                <Text style={[styles.swatchLabel, accent === key && styles.swatchLabelOn]} numberOfLines={1}>
                  {ACCENTS[key].label}
                </Text>
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

      <SectionHeader title="Alarm" />
      <ListGroup>
        <View style={styles.modeBlock}>
          <Text style={t.bodyStrong}>Alarm sound</Text>
          <Text style={[t.caption, styles.mtXs]}>For reminders set to “Ring like an alarm”.</Text>
          <ChipRow style={styles.alarmChips}>
            {ALARM_SOUNDS.map(sound => (
              <Chip
                key={sound.id}
                label={sound.label}
                icon="bell"
                selected={alarm?.sound === sound.id}
                onPress={() => alarm && pickAlarm({ ...alarm, sound: sound.id })}
              />
            ))}
          </ChipRow>
          <Text style={[t.bodyStrong, styles.mtMd]}>Rings for</Text>
          <ChipRow style={styles.alarmChips}>
            {ALARM_LENGTHS.map(seconds => (
              <Chip key={seconds} label={`${seconds} seconds`} selected={alarm?.seconds === seconds} onPress={() => alarm && pickAlarm({ ...alarm, seconds })} />
            ))}
          </ChipRow>
        </View>
        <ListRow
          icon="play"
          title="Test alarm"
          subtitle="Hear it now. Press Stop to end it."
          onPress={() => alarm && testAlarm(alarm).catch(() => Toast.fail('Allow notifications to hear the alarm.', 2))}
          last
        />
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
                {s.confirmation_mode === mode ? (
                  <Gradient colors={gradients.primary} direction="diagonal" borderRadius={radius.md} style={StyleSheet.absoluteFill} />
                ) : null}
                <Text style={[t.bodyStrong, s.confirmation_mode === mode && { color: colors.onPrimary }]}>{mode === 'STANDARD' ? 'Standard' : 'Quick'}</Text>
                <Text style={[t.caption, s.confirmation_mode === mode && styles.modeCaptionOn]}>
                  {mode === 'STANDARD' ? '“Did you actually complete this?”' : 'One-tap confirm'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ListRow icon="info" title="Streak rules" subtitle="+1 for each plan finished in a day, −1 for each missed" onPress={() => navigation.navigate('Consistency')} last />
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

      <SectionHeader title="Melo" />
      <ListGroup>
        {toggle('satya_enabled', 'Melo on Home', 'Short tips from your guide', false, 'sparkles')}
        <ListRow
          icon="play"
          title="Replay tour"
          subtitle="Walk through the app with Melo again"
          onPress={async () => {
            await resetOnboarding().unwrap().catch(() => undefined);
          }}
        />
        <ListRow icon="sparkles" title="Watch the story" subtitle="What Memo does, in one short story" onPress={() => dispatch(storyOpened())} last />
      </ListGroup>

      <View style={styles.version}>
        <Wordmark />
        <Text style={styles.versionTag}>Your days, beautifully kept</Text>
        <Text style={[t.micro, styles.versionText]}>Version 2.1</Text>
      </View>

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
  flex: {
    flex: 1,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  memberName: {
    ...t.heading,
    color: colors.heroText,
  },
  memberEmail: {
    ...font.medium,
    fontSize: 13,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  mtXs: {
    marginTop: 4,
  },
  whyWrap: {
    marginTop: spacing.md,
  },
  whyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  whyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,220,166,0.14)',
  },
  whyTitle: {
    ...font.serif,
    fontSize: 20,
    lineHeight: 24,
    color: colors.heroText,
  },
  whyText: {
    ...font.medium,
    fontSize: 12.5,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  mtMd: {
    marginTop: spacing.md,
  },
  alarmChips: {
    paddingTop: spacing.sm,
  },
  accentRow: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  themeRow: {
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  themeSegment: {
    marginTop: spacing.md,
  },
  themeHint: {
    marginTop: spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  swatchRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  swatchRingOn: {
    borderColor: colors.gold,
  },
  swatch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    ...font.semibold,
    fontSize: 10.5,
    color: colors.textTertiary,
  },
  swatchLabelOn: {
    color: colors.text,
  },
  modeBlock: {
    paddingVertical: spacing.lg,
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
    padding: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: 2,
    overflow: 'hidden',
  },
  modeOn: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  modeCaptionOn: {
    color: 'rgba(11,15,26,0.7)',
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  version: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.huge,
  },
  versionTag: {
    ...t.aside,
    fontSize: 15,
  },
  versionText: {
    color: colors.textTertiary,
  },
});
