import React, { useEffect, useRef, useState } from 'react';
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
  useDeleteVaultAudioMutation,
  useDeleteVaultEntryMutation,
  useDeleteVaultImageMutation,
  useFlagVaultEntryMutation,
  useGetVaultEntryQuery,
  useUpdateVaultEntryMutation,
  useUploadVaultAudioMutation,
  useUploadVaultImageMutation,
  type VaultEntry,
} from '../vaultApi';
import { VoiceNote, type Recording } from '../VoiceNote';
import { VaultPhotos } from '../VaultPhotos';
import type { PickedPhoto } from '../../users/pickPhoto';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

/** A private note: a title, the text, an optional voice recording and photos. Deleted notes can be restored. */
export function VaultEntryScreen() {
  const navigation = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, 'VaultEntry'>>().params;
  const entryId = params?.entryId;
  const unlocked = useAppSelector(selectVaultUnlocked);
  // Once the note is saved or deleted the screen is on its way out: stop
  // listening for it, and keep showing what was there, so it doesn't flash
  // a "Deleted note" or an error before closing.
  const [leaving, setLeaving] = useState(false);
  const query = useGetVaultEntryQuery(entryId ?? '', { skip: !entryId || !unlocked || leaving });
  const last = useRef<VaultEntry | undefined>(undefined);
  if (query.data) last.current = query.data;
  const entry = leaving ? last.current : query.data;
  const [create, { isLoading: creating }] = useCreateVaultEntryMutation();
  const [update, { isLoading: updating }] = useUpdateVaultEntryMutation();
  const [flag, { isLoading: flagging }] = useFlagVaultEntryMutation();
  const [remove, { isLoading: erasing }] = useDeleteVaultEntryMutation();
  const [uploadAudio, { isLoading: uploading }] = useUploadVaultAudioMutation();
  const [deleteAudio] = useDeleteVaultAudioMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadVaultImageMutation();
  const [deleteImage] = useDeleteVaultImageMutation();
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [audioRemoved, setAudioRemoved] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [confirm, setConfirm] = useState<'delete' | 'erase' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If the Vault locks while this screen is open, leave it.
  useEffect(() => {
    if (!unlocked) navigation.goBack();
  }, [unlocked, navigation]);

  useEffect(() => {
    if (!query.data) return;
    setTitle(query.data.title ?? '');
    setContent(query.data.content);
  }, [query.data]);

  const deleted = Boolean(entry?.deleted_at);
  const savedPhotos = entry?.images ?? [];
  const keptPhotos = savedPhotos.filter(p => !removedPhotos.includes(p.id)).length + newPhotos.length;

  const save = async () => {
    setError(null);
    const hasVoice = Boolean(recording) || (Boolean(entry?.has_audio) && !audioRemoved);
    if (!content.trim() && !title.trim() && !hasVoice && !keptPhotos) return setError('Write something, record a voice note or add a photo to save.');
    const fallbackTitle = content.trim() ? null : hasVoice ? 'Voice note' : keptPhotos ? 'Photos' : null;
    const body = { title: title.trim() || fallbackTitle, content: content || title.trim() };
    setLeaving(true);
    try {
      const saved = entryId ? await update({ id: entryId, ...body }).unwrap() : await create(body).unwrap();
      // Recording and photos go up once the note exists.
      if (recording) await uploadAudio({ id: saved.id, uri: recording.uri, seconds: recording.seconds }).unwrap();
      else if (audioRemoved && entry?.has_audio) await deleteAudio(saved.id).unwrap();
      for (const id of removedPhotos) await deleteImage({ id: saved.id, imageId: id }).unwrap();
      for (const photo of newPhotos) await uploadImage({ id: saved.id, ...photo }).unwrap();
      Toast.success('Saved.', 1);
      navigation.goBack();
    } catch (err) {
      setLeaving(false);
      setError(getErrorMessage(err, 'Could not save.'));
    }
  };

  const moveToDeleted = async (restore: boolean) => {
    setLeaving(true);
    try {
      await flag({ id: entryId!, flag: restore ? 'restore' : 'trash' }).unwrap();
      navigation.goBack();
    } catch (err) {
      setLeaving(false);
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  const erase = async () => {
    setLeaving(true);
    try {
      await remove(entryId!).unwrap();
      navigation.goBack();
    } catch (err) {
      setLeaving(false);
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  if (entryId && query.isError && !leaving) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader close />
        <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />
      </Screen>
    );
  }

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen edges={['top', 'bottom']} glowColor={colors.violet}>
        <ScreenHeader title={!entryId ? 'New note' : deleted ? 'Deleted note' : 'Note'} subtitle="Private vault" close />
        {entryId && !entry ? (
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

            <VoiceNote
              entryId={entryId}
              savedSeconds={entry?.has_audio ? entry.audio_seconds ?? 1 : null}
              recording={recording}
              removed={audioRemoved}
              onRecorded={r => {
                setRecording(r);
                setAudioRemoved(false);
              }}
              onRemove={() => {
                setRecording(null);
                setAudioRemoved(true);
              }}
              disabled={deleted}
            />

            <VaultPhotos
              entryId={entryId}
              saved={savedPhotos}
              pending={newPhotos}
              removedIds={removedPhotos}
              onAdd={photo => setNewPhotos(list => [...list, photo])}
              onRemovePending={index => setNewPhotos(list => list.filter((_, i) => i !== index))}
              onRemoveSaved={id => setRemovedPhotos(list => [...list, id])}
              disabled={deleted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {deleted ? (
              <View style={styles.actions}>
                <Button label="Restore" variant="secondary" onPress={() => moveToDeleted(true)} loading={flagging} />
                <Button label="Delete forever" icon="trash" variant="dangerGhost" onPress={() => setConfirm('erase')} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label="Save" size="lg" onPress={save} loading={creating || updating || uploading || uploadingImage} />
                {entryId ? <Button label="Delete" icon="trash" variant="dangerGhost" onPress={() => setConfirm('delete')} /> : null}
              </View>
            )}
          </>
        )}
        <ConfirmSheet
          visible={confirm === 'delete' && !leaving}
          icon="trash"
          destructive
          title="Delete this note?"
          message="It moves to the bin. You can restore it there for 30 days."
          confirmLabel="Delete"
          loading={flagging}
          onConfirm={() => moveToDeleted(false)}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmSheet
          visible={confirm === 'erase' && !leaving}
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
    fontSize: 34,
    lineHeight: 40,
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
    backgroundColor: colors.surface,
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
