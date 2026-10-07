import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from '@ant-design/react-native/lib/toast';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { colors, font, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Fab, IconButton } from '../../../components/Controls';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet } from '../../../components/Sheet';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { selectVaultUnlocked, vaultLocked } from '../vaultSlice';
import { touchVault } from '../VaultAutoLock';
import { VaultLock } from '../VaultLock';
import {
  useEmptyVaultTrashMutation,
  useGetVaultStatusQuery,
  useListVaultEntriesQuery,
} from '../vaultApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VaultScreen() {
  const unlocked = useAppSelector(selectVaultUnlocked);
  const status = useGetVaultStatusQuery();

  if (!unlocked) {
    return (
      <Screen glowColor={colors.primary}>
        <LargeTitle title="Vault" />
        {status.isLoading ? (
          <SkeletonList count={1} height={300} />
        ) : status.isError || !status.data ? (
          <ErrorState message={getErrorMessage(status.error, 'Could not reach your Vault.')} onRetry={status.refetch} />
        ) : (
          <VaultLock status={status.data} onLockedRefresh={status.refetch} />
        )}
      </Screen>
    );
  }
  return <UnlockedVault />;
}

function UnlockedVault() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const [showDeleted, setShowDeleted] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const entries = useListVaultEntriesQuery({ view: showDeleted ? 'trash' : 'all', q: query.trim() || undefined });
  const [emptyTrash, { isLoading: emptying }] = useEmptyVaultTrashMutation();

  const lock = () => {
    dispatch(vaultLocked());
    Toast.info('Vault locked.', 1);
  };

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen
        glowColor={colors.primary}
        onRefresh={entries.refetch}
        refreshing={entries.isFetching && !entries.isLoading}
        footer={showDeleted ? null : <Fab accessibilityLabel="New note" onPress={() => navigation.navigate('VaultEntry')} />}
      >
        <LargeTitle
          eyebrow="Private"
          title={showDeleted ? 'Deleted notes' : 'Vault'}
          right={<IconButton icon="lock" accessibilityLabel="Lock Vault" onPress={lock} />}
        />
        {showDeleted ? (
          <Pressable onPress={() => setShowDeleted(false)} style={styles.back} accessibilityRole="button">
            <Icon name="chevron-left" size={16} color={colors.primary} />
            <Text style={styles.link}>Back to notes</Text>
          </Pressable>
        ) : (
          <View style={styles.note}>
            <Icon name="lock" size={14} color={colors.textTertiary} />
            <Text style={t.caption}>Private notes are encrypted. Search, edit, or delete them here; the Vault locks when you leave Memo.</Text>
          </View>
        )}

        {!showDeleted ? (
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.gold} strokeWidth={1.7} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes"
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              accessibilityLabel="Search notes"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {entries.isLoading ? (
          <SkeletonList count={4} height={72} />
        ) : entries.isError ? (
          <ErrorState message={getErrorMessage(entries.error, 'Could not open your Vault.')} onRetry={entries.refetch} />
        ) : !entries.data?.length ? (
          <EmptyState
            icon={showDeleted ? 'trash' : 'lock'}
            title={showDeleted ? 'Nothing deleted' : query ? 'No notes found' : 'No notes yet'}
            message={showDeleted || query ? undefined : 'Save passwords, recovery codes, or personal notes. Only you can open them with your Vault PIN.'}
            actionLabel={showDeleted || query ? undefined : 'New note'}
            onAction={() => navigation.navigate('VaultEntry')}
          />
        ) : (
          entries.data.map((e, i) => (
            <FadeIn key={e.id} index={i}>
              <Card onPress={() => navigation.navigate('VaultEntry', { entryId: e.id })} style={styles.entry} accessibilityLabel={e.title ?? 'Untitled note'}>
                <View style={styles.entryRow}>
                  <View style={styles.entryIcon}>
                    <Icon name="key" size={16} color={colors.gold} strokeWidth={1.7} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {e.title || 'Untitled'}
                    </Text>
                    {e.preview ? (
                      <Text style={[t.caption, styles.preview]} numberOfLines={1}>
                        {e.preview}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </FadeIn>
          ))
        )}

        {showDeleted ? (
          entries.data?.length ? (
            <Pressable onPress={() => setConfirmEmpty(true)} style={styles.footerLink} accessibilityRole="button">
              <Text style={styles.danger}>Delete all forever</Text>
            </Pressable>
          ) : null
        ) : (
          <Pressable onPress={() => setShowDeleted(true)} style={styles.footerLink} accessibilityRole="button">
            <Icon name="trash" size={14} color={colors.textTertiary} />
            <Text style={t.caption}>Deleted notes</Text>
          </Pressable>
        )}

        <ConfirmSheet
          visible={confirmEmpty}
          icon="trash"
          destructive
          title="Delete all forever?"
          message="This can’t be undone."
          confirmLabel="Delete all"
          loading={emptying}
          onConfirm={async () => {
            try {
              await emptyTrash().unwrap();
              setConfirmEmpty(false);
            } catch (err) {
              Toast.fail(getErrorMessage(err), 2);
            }
          }}
          onCancel={() => setConfirmEmpty(false)}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  link: {
    ...font.bold,
    color: colors.primary,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg + 2,
    marginBottom: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  searchInput: {
    ...font.medium,
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
  },
  entry: {
    marginBottom: spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156,139,218,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(156,139,218,0.35)',
  },
  entryTitle: {
    ...font.serif,
    fontSize: 18,
    lineHeight: 21,
    color: colors.text,
  },
  preview: {
    marginTop: 2,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xl,
  },
  danger: {
    ...font.bold,
    color: colors.danger,
  },
});
