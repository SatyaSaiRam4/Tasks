import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAppSelector } from '../../../app/hooks';
import { colors, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Chip, IconButton } from '../../../components/Controls';
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
  useListVaultFoldersQuery,
  useUpdateVaultEntryMutation,
} from '../vaultApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

const DEFAULT_FOLDERS = ['Personal', 'Important', 'Credentials', 'Ideas'];

export function VaultEntryScreen() {
  const navigation = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, 'VaultEntry'>>().params;
  const entryId = params?.entryId;
  const unlocked = useAppSelector(selectVaultUnlocked);
  const existing = useGetVaultEntryQuery(entryId ?? '', { skip: !entryId || !unlocked });
  const folders = useListVaultFoldersQuery(undefined, { skip: !unlocked });
  const [create, { isLoading: creating }] = useCreateVaultEntryMutation();
  const [update, { isLoading: updating }] = useUpdateVaultEntryMutation();
  const [flag] = useFlagVaultEntryMutation();
  const [remove, { isLoading: deleting }] = useDeleteVaultEntryMutation();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folder, setFolder] = useState<string | null>(params?.folder ?? null);
  const [customFolder, setCustomFolder] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [confirm, setConfirm] = useState<'trash' | 'delete' | null>(null);
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
    setFolder(e.folder);
    setTags(e.tags);
  }, [existing.data]);

  const e = existing.data;
  const inTrash = Boolean(e?.deleted_at);
  const folderChoices = Array.from(new Set([...DEFAULT_FOLDERS, ...(folders.data ?? []).map(f => f.name).filter(n => n !== 'Unsorted')]));

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag) && tags.length < 10) setTags([...tags, tag.slice(0, 24)]);
    setTagDraft('');
  };

  const save = async () => {
    setError(null);
    if (!content.trim()) return setError('Write something to keep.');
    const body = { title: title.trim() || null, content, folder: (customFolder.trim() || folder) ?? null, tags };
    try {
      if (entryId) await update({ id: entryId, ...body }).unwrap();
      else await create(body).unwrap();
      Toast.success('Saved to Vault.', 1);
      navigation.goBack();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save.'));
    }
  };

  const setFlag = async (f: Parameters<typeof flag>[0]['flag']) => {
    if (!entryId) return;
    try {
      await flag({ id: entryId, flag: f }).unwrap();
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
      <Screen edges={['top', 'bottom']} glowColor="#6B4BFF">
        <ScreenHeader
          title={entryId ? (inTrash ? 'In Trash' : 'Vault entry') : 'New secret'}
          close
          right={
            e && !inTrash ? (
              <>
                <IconButton
                  icon="star"
                  color={e.is_favorite ? colors.streakGold : colors.textSecondary}
                  accessibilityLabel={e.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  onPress={() => setFlag(e.is_favorite ? 'unfavorite' : 'favorite')}
                />
                <IconButton
                  icon="pin"
                  color={e.pinned ? colors.primary : colors.textSecondary}
                  accessibilityLabel={e.pinned ? 'Unpin' : 'Pin'}
                  onPress={() => setFlag(e.pinned ? 'unpin' : 'pin')}
                />
              </>
            ) : null
          }
        />
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
              editable={!inTrash}
            />
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write anything private: account details, recovery codes, thoughts…"
              placeholderTextColor={colors.textTertiary}
              style={styles.content}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Content"
              autoCorrect={false}
              editable={!inTrash}
            />

            <Text style={styles.label}>Folder</Text>
            <View style={styles.wrap}>
              {folderChoices.map(f => (
                <Chip key={f} label={f} icon="folder" selected={folder === f && !customFolder} onPress={() => { setFolder(cur => (cur === f ? null : f)); setCustomFolder(''); }} />
              ))}
            </View>
            <TextInput
              value={customFolder}
              onChangeText={setCustomFolder}
              placeholder="Or create a new folder"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              maxLength={40}
              accessibilityLabel="New folder name"
            />

            <Text style={styles.label}>Tags</Text>
            <View style={styles.wrap}>
              {tags.map(tag => (
                <Chip key={tag} label={`#${tag}`} icon="x" onPress={() => setTags(tags.filter(x => x !== tag))} />
              ))}
            </View>
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTag}
              placeholder="Add a tag and press enter"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              returnKeyType="done"
              accessibilityLabel="New tag"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {inTrash ? (
              <View style={styles.actions}>
                <Button label="Restore" icon="refresh" variant="secondary" onPress={() => setFlag('restore')} />
                <Button label="Delete forever" icon="trash" variant="danger" onPress={() => setConfirm('delete')} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label="Save" icon="check" size="lg" onPress={save} loading={creating || updating} />
                {e ? (
                  <View style={styles.row}>
                    <Button
                      label={e.is_archived ? 'Unarchive' : 'Archive'}
                      icon="archive"
                      variant="secondary"
                      style={styles.flex}
                      onPress={() => setFlag(e.is_archived ? 'unarchive' : 'archive')}
                    />
                    <Button label="Move to Trash" icon="trash" variant="danger" style={styles.flex} onPress={() => setConfirm('trash')} />
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
        <ConfirmSheet
          visible={confirm === 'trash'}
          icon="trash"
          destructive
          title="Move to Trash?"
          message="You can restore it from Trash until you empty it."
          confirmLabel="Move to Trash"
          onConfirm={async () => {
            setConfirm(null);
            await setFlag('trash');
            navigation.goBack();
          }}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmSheet
          visible={confirm === 'delete'}
          icon="trash"
          destructive
          title="Delete forever?"
          message="This permanently erases the entry. This can’t be undone."
          confirmLabel="Delete forever"
          loading={deleting}
          onConfirm={async () => {
            try {
              await remove(entryId!).unwrap();
              setConfirm(null);
              navigation.goBack();
            } catch (err) {
              Toast.fail(getErrorMessage(err), 2);
            }
          }}
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    ...t.title,
    paddingVertical: spacing.sm,
  },
  content: {
    ...t.body,
    minHeight: 220,
    padding: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    fontFamily: undefined,
  },
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
