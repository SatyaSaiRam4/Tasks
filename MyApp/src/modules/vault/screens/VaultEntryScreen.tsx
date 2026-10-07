import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppSelector } from '../../../app/hooks';
import { colors, font, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { ErrorState, Skeleton } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { selectVaultUnlocked } from '../vaultSlice';
import { touchVault } from '../VaultAutoLock';
import {
  useCreateVaultEntryMutation,
  useDeleteVaultEntryMutation,
  useFlagVaultEntryMutation,
  useGetVaultEntryQuery,
  useUpdateVaultEntryMutation,
} from '../vaultApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

/** A private note: a title and the text. Deleted notes can be restored. */
export function VaultEntryScreen() {
  const navigation = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, 'VaultEntry'>>().params;
  const entryId = params?.entryId;
  const unlocked = useAppSelector(selectVaultUnlocked);
  const existing = useGetVaultEntryQuery(entryId ?? '', { skip: !entryId || !unlocked });
  const [create, { isLoading: creating }] = useCreateVaultEntryMutation();
  const [update, { isLoading: updating }] = useUpdateVaultEntryMutation();
  const [flag, { isLoading: flagging }] = useFlagVaultEntryMutation();
  const [remove, { isLoading: erasing }] = useDeleteVaultEntryMutation();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [confirm, setConfirm] = useState<'delete' | 'erase' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If the Vault locks while this screen is open, leave it.
  useEffect(() => {
    if (!unlocked) navigation.goBack();
  }, [unlocked, navigation]);

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    setTitle(e.title ?? '');
    setContent(e.content);
  }, [existing.data]);

  const deleted = Boolean(existing.data?.deleted_at);

  const save = async () => {
    setError(null);
    if (!content.trim() && !title.trim()) return setError('Write something to save.');
    const body = { title: title.trim() || null, content: content || title.trim() };
    try {
      if (entryId) await update({ id: entryId, ...body }).unwrap();
      else await create(body).unwrap();
      Toast.success('Saved.', 1);
      navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save.'));
    }
  };

  const moveToDeleted = async (restore: boolean) => {
    try {
      await flag({ id: entryId!, flag: restore ? 'restore' : 'trash' }).unwrap();
      setConfirm(null);
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const erase = async () => {
    try {
      await remove(entryId!).unwrap();
      setConfirm(null);
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  if (entryId && existing.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader close />
        <ErrorState message={getErrorMessage(existing.error)} onRetry={existing.refetch} />
      </Screen>
    );
  }

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen edges={['top', 'bottom']} glowColor={colors.primary}>
        <ScreenHeader title={!entryId ? 'New note' : deleted ? 'Deleted note' : 'Note'} close />
        {entryId && existing.isLoading ? (
          <Skeleton height={300} rounded={radius.lg} />
        ) : (
          <>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textTertiary}
              style={styles.title}
              maxLength={160}
              accessibilityLabel="Title"
              editable={!deleted}
            />
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write your private note…"
              placeholderTextColor={colors.textTertiary}
              style={styles.content}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Note"
              autoCorrect={false}
              editable={!deleted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {deleted ? (
              <View style={styles.actions}>
                <Button label="Restore" variant="secondary" onPress={() => moveToDeleted(true)} loading={flagging} />
                <Button label="Delete forever" variant="ghost" onPress={() => setConfirm('erase')} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label="Save" size="lg" onPress={save} loading={creating || updating} />
                {entryId ? <Button label="Delete" variant="ghost" onPress={() => setConfirm('delete')} /> : null}
              </View>
            )}
          </>
        )}
        <ConfirmSheet
          visible={confirm === 'delete'}
          icon="trash"
          destructive
          title="Delete this note?"
          message="You can still restore it from Deleted notes."
          confirmLabel="Delete"
          loading={flagging}
          onConfirm={() => moveToDeleted(false)}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmSheet
          visible={confirm === 'erase'}
          icon="trash"
          destructive
          title="Delete forever?"
          message="This can’t be undone."
          confirmLabel="Delete forever"
          loading={erasing}
          onConfirm={erase}
          onCancel={() => setConfirm(null)}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  title: {
    ...t.display,
    fontSize: 30,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldLine,
  },
  content: {
    ...t.body,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 280,
    padding: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    ...font.medium,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
