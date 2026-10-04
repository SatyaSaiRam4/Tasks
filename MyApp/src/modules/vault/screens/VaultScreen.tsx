import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from '@ant-design/react-native/lib/toast';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { colors, gradients, radius, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Chip, ChipRow, Fab, IconButton } from '../../../components/Controls';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { ConfirmSheet } from '../../../components/Sheet';
import { Gradient } from '../../../components/Gradient';
import { Icon } from '../../../components/Icon';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { selectVaultUnlocked, vaultLocked } from '../vaultSlice';
import { touchVault } from '../VaultAutoLock';
import { VaultLock } from '../VaultLock';
import {
  useEmptyVaultTrashMutation,
  useGetVaultStatusQuery,
  useListVaultEntriesQuery,
  useListVaultFoldersQuery,
  type VaultView,
} from '../vaultApi';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const VIEWS: { key: VaultView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'archived', label: 'Archive' },
  { key: 'trash', label: 'Trash' },
];

export function VaultScreen() {
  const unlocked = useAppSelector(selectVaultUnlocked);
  const status = useGetVaultStatusQuery();

  if (!unlocked) {
    return (
      <Screen glowColor="#6B4BFF">
        <LargeTitle eyebrow="Private & encrypted" title="Vault" />
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
  const [view, setView] = useState<VaultView>('all');
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const entries = useListVaultEntriesQuery({ view, q: query.trim() || undefined, folder: folder ?? undefined });
  const folders = useListVaultFoldersQuery();
  const [emptyTrash, { isLoading: emptying }] = useEmptyVaultTrashMutation();

  const lock = () => {
    dispatch(vaultLocked());
    Toast.info('Vault locked.', 1);
  };

  return (
    <View style={styles.flex} onTouchStart={touchVault}>
      <Screen
        padded={false}
        glowColor="#6B4BFF"
        onRefresh={() => {
          entries.refetch();
          folders.refetch();
        }}
        refreshing={entries.isFetching && !entries.isLoading}
        footer={<Fab icon="plus" accessibilityLabel="New secret" onPress={() => navigation.navigate('VaultEntry', { folder: folder ?? undefined })} />}
      >
        <View style={styles.pad}>
          <LargeTitle eyebrow="Private space" title="Vault" right={<IconButton icon="lock" accessibilityLabel="Lock Vault" onPress={lock} />} />
          <Gradient colors={gradients.vault} borderRadius={radius.lg} style={styles.banner}>
            <Icon name="shield" size={18} color={colors.primary} />
            <Text style={[t.caption, styles.flex]}>Encrypted at rest. Locks automatically when you leave the app.</Text>
          </Gradient>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Vault…"
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              accessibilityLabel="Search Vault"
              autoCorrect={false}
            />
          </View>
        </View>

        <ChipRow style={styles.pad}>
          {VIEWS.map(v => (
            <Chip key={v.key} label={v.label} selected={view === v.key} onPress={() => setView(v.key)} />
          ))}
        </ChipRow>

        {view === 'all' && (folders.data?.length ?? 0) > 0 ? (
          <View style={[styles.pad, styles.folders]}>
            {folders.data!.map(f => (
              <Pressable
                key={f.name}
                onPress={() => setFolder(cur => (cur === f.name ? null : f.name))}
                accessibilityRole="button"
                accessibilityState={{ selected: folder === f.name }}
                style={[styles.folder, folder === f.name && styles.folderOn]}
              >
                <Icon name="folder" size={18} color={folder === f.name ? colors.white : colors.primary} />
                <Text style={[t.bodyStrong, folder === f.name && { color: colors.white }]} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={[t.caption, folder === f.name && { color: 'rgba(255,255,255,0.8)' }]}>
                  {f.count} {f.count === 1 ? 'item' : 'items'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.pad}>
          {view === 'trash' && entries.data?.length ? (
            <Pressable onPress={() => setConfirmEmpty(true)} style={styles.emptyTrash} accessibilityRole="button">
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Empty Trash</Text>
            </Pressable>
          ) : null}
          {entries.isLoading ? (
            <SkeletonList count={4} height={86} />
          ) : entries.isError ? (
            <ErrorState message={getErrorMessage(entries.error, 'Could not open your Vault.')} onRetry={entries.refetch} />
          ) : !entries.data?.length ? (
            <EmptyState
              icon={view === 'trash' ? 'trash' : 'lock'}
              title={query ? 'Nothing matches' : view === 'all' ? 'Your private space is ready' : `Nothing in ${VIEWS.find(v => v.key === view)?.label}`}
              message={query ? 'Try another search.' : view === 'all' ? 'Add something only you should see.' : undefined}
              actionLabel={view === 'all' && !query ? 'New secret' : undefined}
              onAction={() => navigation.navigate('VaultEntry')}
            />
          ) : (
            entries.data.map((e, i) => (
              <FadeIn key={e.id} index={i}>
                <Card onPress={() => navigation.navigate('VaultEntry', { entryId: e.id })} style={styles.entry} accessibilityLabel={e.title ?? 'Untitled entry'}>
                  <View style={styles.entryHead}>
                    <Text style={[t.subtitle, styles.flex]} numberOfLines={1}>
                      {e.title || 'Untitled'}
                    </Text>
                    {e.pinned ? <Icon name="pin" size={15} color={colors.primary} /> : null}
                    {e.is_favorite ? <Icon name="star" size={15} color={colors.streakGold} fill={colors.streakGold} /> : null}
                  </View>
                  <Text style={[t.caption, styles.preview]} numberOfLines={2}>
                    {e.preview}
                  </Text>
                  <View style={styles.entryMeta}>
                    {e.folder ? <Text style={styles.metaChip}>{e.folder}</Text> : null}
                    {e.tags.slice(0, 3).map(tag => (
                      <Text key={tag} style={styles.metaChip}>
                        #{tag}
                      </Text>
                    ))}
                    <Text style={[t.caption, styles.date]}>{formatFullDate(e.updated_at)}</Text>
                  </View>
                </Card>
              </FadeIn>
            ))
          )}
        </View>
      </Screen>
      <ConfirmSheet
        visible={confirmEmpty}
        icon="trash"
        destructive
        title="Empty Trash?"
        message="Everything in Trash is permanently deleted. This can’t be undone."
        confirmLabel="Delete forever"
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 20,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  folders: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  folder: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: 4,
  },
  folderOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyTrash: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
  },
  entry: {
    marginTop: spacing.md,
  },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    marginTop: 4,
    lineHeight: 18,
  },
  entryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  metaChip: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  date: {
    marginLeft: 'auto',
    fontSize: 11,
  },
});
