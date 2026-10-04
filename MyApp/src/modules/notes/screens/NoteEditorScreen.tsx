import React, { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Input from '@ant-design/react-native/lib/input';
import Modal from '@ant-design/react-native/lib/modal';
import Toast from '@ant-design/react-native/lib/toast';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { LabeledInput } from '../../../components/LabeledInput';
import { AppButton } from '../../../components/AppButton';
import { border, colors, spacing, typography } from '../../../theme';
import { getErrorMessage } from '../../../utils/apiError';
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useGetNoteQuery,
  useUpdateNoteMutation,
  usePinNoteMutation,
  useUnpinNoteMutation,
} from '../notesApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'NoteEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'NoteEditor'>;

/** Notes are kept deliberately plain: a title, the content, and a pin — no
 * types or categories to think about, just somewhere to write things down. */
export function NoteEditorScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const noteId = route.params?.noteId;
  const isEditing = Boolean(noteId);

  const { data: existingNote, isLoading: isLoadingNote } = useGetNoteQuery(noteId ?? '', { skip: !noteId });
  const [createNote, { isLoading: isCreating }] = useCreateNoteMutation();
  const [updateNote, { isLoading: isUpdating }] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [pinNote] = usePinNoteMutation();
  const [unpinNote] = useUnpinNoteMutation();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title ?? '');
      setContent(existingNote.content);
      setPinned(existingNote.pinned);
    }
  }, [existingNote]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit note' : 'New note' });
  }, [navigation, isEditing]);

  const isSaving = isCreating || isUpdating;
  const canSave = content.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      if (isEditing && noteId) {
        await updateNote({ id: noteId, title: title.trim() || undefined, content: content.trim() }).unwrap();
      } else {
        await createNote({ title: title.trim() || undefined, content: content.trim() }).unwrap();
      }
      navigation.goBack();
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not save note.'));
    }
  };

  const handleTogglePin = async () => {
    if (!noteId) return;
    try {
      if (pinned) {
        await unpinNote(noteId).unwrap();
      } else {
        await pinNote(noteId).unwrap();
      }
      setPinned(!pinned);
    } catch (err) {
      Toast.fail(getErrorMessage(err, 'Could not update note.'));
    }
  };

  const handleDelete = () => {
    if (!noteId) return;
    Modal.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(noteId).unwrap();
            navigation.goBack();
          } catch (err) {
            Toast.fail(getErrorMessage(err, 'Could not delete note.'));
          }
        },
      },
    ]);
  };

  if (isEditing && isLoadingNote) {
    return (
      <ScreenContainer>
        <LoadingView label="Loading note…" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll contentStyle={styles.content} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <LabeledInput label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Give it a name" />

        <Text style={styles.label}>Content</Text>
        <View style={styles.textAreaWrap}>
          <Input.TextArea
            value={content}
            onChangeText={setContent}
            placeholder="Write it down before you forget…"
            placeholderTextColor={colors.textFaint}
            rows={8}
            autoSize={{ minRows: 8 }}
          />
        </View>

        <AppButton
          label={isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Save note'}
          onPress={handleSave}
          disabled={!canSave}
          loading={isSaving}
          style={styles.saveButton}
        />

        {isEditing ? (
          <View style={styles.secondaryActions}>
            <AppButton
              label={pinned ? 'Unpin note' : 'Pin note'}
              variant="secondary"
              onPress={handleTogglePin}
              style={styles.secondaryButton}
            />
            <AppButton label="Delete note" variant="danger" onPress={handleDelete} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  textAreaWrap: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  secondaryActions: {
    marginTop: spacing.xl,
  },
  secondaryButton: {
    marginBottom: spacing.sm,
  },
});
