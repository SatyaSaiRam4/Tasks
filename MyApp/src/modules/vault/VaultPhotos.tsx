import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../app/hooks';
import { API_BASE_URL } from '../../config/env';
import { colors, font, radius, spacing, type as t, withAlpha } from '../../theme';
import { Icon } from '../../components/Icon';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { pickPhoto, type PickedPhoto } from '../users/pickPhoto';
import { selectVaultToken } from './vaultSlice';
import type { VaultImageRef } from './vaultApi';

/** A note holds up to this many photos (the server checks too). */
export const MAX_VAULT_PHOTOS = 6;

/**
 * Loads one Vault photo into memory as a data URI. It is decrypted on the
 * server for this request only and never written to the image disk cache,
 * so a private photo doesn't linger on the phone.
 */
function useVaultPhoto(entryId: string | undefined, imageId: string | undefined) {
  const token = useAppSelector(s => s.auth.accessToken);
  const vaultToken = useAppSelector(selectVaultToken);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!entryId || !imageId || !token || !vaultToken) return;
    let alive = true;
    setFailed(false);
    fetch(`${API_BASE_URL}/vault/entries/${entryId}/images/${imageId}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-vault-token': vaultToken },
    })
      .then(res => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then(
        blob =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read')));
            reader.onerror = () => reject(new Error('read'));
            reader.readAsDataURL(blob);
          }),
      )
      .then(data => alive && setUri(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [entryId, imageId, token, vaultToken]);
  return { uri, failed };
}

/** A photo on the note: one already saved (fetched privately) or one just picked. */
type Shown = { kind: 'saved'; ref: VaultImageRef } | { kind: 'pending'; photo: PickedPhoto; index: number };

/**
 * The photos of a Vault note: ID cards, documents, anything private. New
 * photos and removals are kept here and applied when the note is saved,
 * like the voice note.
 */
export function VaultPhotos({
  entryId,
  saved,
  pending,
  removedIds,
  onAdd,
  onRemovePending,
  onRemoveSaved,
  disabled,
}: {
  entryId?: string;
  saved: VaultImageRef[];
  pending: PickedPhoto[];
  removedIds: string[];
  onAdd: (photo: PickedPhoto) => void;
  onRemovePending: (index: number) => void;
  onRemoveSaved: (id: string) => void;
  disabled?: boolean;
}) {
  const [choosing, setChoosing] = useState(false);
  const [viewing, setViewing] = useState<Shown | null>(null);
  const shown: Shown[] = [
    ...saved.filter(s => !removedIds.includes(s.id)).map(ref => ({ kind: 'saved' as const, ref })),
    ...pending.map((photo, index) => ({ kind: 'pending' as const, photo, index })),
  ];
  const full = shown.length >= MAX_VAULT_PHOTOS;

  const add = async (camera: boolean) => {
    setChoosing(false);
    try {
      const photo = await pickPhoto({ maxSide: 1600, camera });
      if (photo) onAdd(photo);
    } catch (err) {
      Toast.fail(err instanceof Error ? err.message : 'Could not add this photo.', 2);
    }
  };

  const remove = (item: Shown) => {
    setViewing(null);
    if (item.kind === 'saved') onRemoveSaved(item.ref.id);
    else onRemovePending(item.index);
  };

  if (disabled && !shown.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.round}>
          <Icon name="camera" size={18} color={colors.violet} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>Photos</Text>
          <Text style={t.caption}>
            {shown.length ? `${shown.length} of ${MAX_VAULT_PHOTOS} · encrypted, only you can see them` : 'ID cards, documents… encrypted, only you can see them'}
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {shown.map(item => (
          <Pressable
            key={item.kind === 'saved' ? item.ref.id : `p${item.index}`}
            onPress={() => setViewing(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open photo"
            style={styles.thumb}
          >
            {item.kind === 'saved' ? <SavedPhoto entryId={entryId} imageId={item.ref.id} style={styles.thumbImage} /> : <Image source={{ uri: item.photo.uri }} style={styles.thumbImage} />}
            {item.kind === 'pending' ? (
              <View style={styles.newTag}>
                <Text style={styles.newTagText}>New</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
        {disabled || full ? null : (
          <Pressable onPress={() => setChoosing(true)} style={({ pressed }) => [styles.thumb, styles.addThumb, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Add a photo">
            <Icon name="plus" size={22} color={colors.violet} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        )}
      </ScrollView>

      <Sheet visible={choosing} onClose={() => setChoosing(false)} title="Add a photo">
        <ListGroup>
          <ListRow icon="camera" title="Take a photo" subtitle="Use the camera" onPress={() => add(true)} />
          <ListRow icon="folder" title="Choose from gallery" subtitle="Up to 10 MB" onPress={() => add(false)} last />
        </ListGroup>
      </Sheet>

      <PhotoViewer item={viewing} entryId={entryId} disabled={disabled} onClose={() => setViewing(null)} onRemove={remove} />
    </View>
  );
}

function SavedPhoto({ entryId, imageId, style }: { entryId?: string; imageId: string; style: object }) {
  const { uri, failed } = useVaultPhoto(entryId, imageId);
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  return (
    <View style={[style, styles.loading]}>
      {failed ? <Icon name="alert" size={18} color={colors.textTertiary} /> : <ActivityIndicator color={colors.violet} />}
    </View>
  );
}

/** A photo full screen, with Remove. */
function PhotoViewer({
  item,
  entryId,
  disabled,
  onClose,
  onRemove,
}: {
  item: Shown | null;
  entryId?: string;
  disabled?: boolean;
  onClose: () => void;
  onRemove: (item: Shown) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.viewer, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.viewerBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.viewerButton} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={20} color="#ffffff" />
          </Pressable>
          {item && !disabled ? (
            <Pressable onPress={() => onRemove(item)} hitSlop={12} style={styles.viewerButton} accessibilityRole="button" accessibilityLabel="Remove photo">
              <Icon name="trash" size={19} color="#ff8a80" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.flex}>
          {item?.kind === 'saved' ? (
            <SavedPhoto entryId={entryId} imageId={item.ref.id} style={styles.viewerImage} />
          ) : item ? (
            <Image source={{ uri: item.photo.uri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
        </View>
        {item && !disabled ? <Text style={styles.viewerHint}>Removing takes effect when you save the note.</Text> : null}
      </View>
    </Modal>
  );
}

const THUMB = 84;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.violet, 0.35),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.violet, 0.14),
  },
  title: {
    ...font.semibold,
    fontSize: 15,
    color: colors.text,
  },
  strip: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
  },
  addThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(colors.violet, 0.5),
  },
  addText: {
    ...font.semibold,
    fontSize: 12,
    color: colors.violet,
    marginTop: 2,
  },
  newTag: {
    position: 'absolute',
    left: 4,
    top: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.violet,
  },
  newTagText: {
    ...font.bold,
    fontSize: 10,
    color: '#ffffff',
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(5,7,13,0.96)',
    paddingHorizontal: spacing.lg,
  },
  viewerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  viewerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  viewerHint: {
    ...font.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
