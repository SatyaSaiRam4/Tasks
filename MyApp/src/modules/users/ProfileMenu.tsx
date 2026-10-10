import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, hitSlop, spacing, type as t } from '../../theme';
import { useAppSelector } from '../../app/hooks';
import { Avatar } from '../../components/Controls';
import { Button } from '../../components/Button';
import { ListGroup, ListRow } from '../../components/ListRow';
import { RealIcon } from '../../components/RealIcon';
import { Sheet } from '../../components/Sheet';
import { useGetMeQuery } from './usersApi';
import { usePhotoActions } from './usePhotoActions';

type Navigate = { navigate: (...args: unknown[]) => void };

/**
 * The profile picture in the top bar. Tapping it opens a menu with the
 * user's photo (add, change or remove, up to 10 MB), then Find a friend,
 * Wallet and Settings.
 */
export function ProfileMenu() {
  const navigation = useNavigation<Navigate>();
  const user = useAppSelector(s => s.auth.user);
  const me = useGetMeQuery();
  const [open, setOpen] = useState(false);
  const photoActions = usePhotoActions();
  const name = me.data?.display_name ?? user?.display_name ?? '';
  const emoji = me.data?.avatar ?? user?.avatar;
  const photo = me.data?.photo_url ?? null;

  const go = (route: string) => {
    setOpen(false);
    navigation.navigate(route);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Your profile and menu">
        <Avatar name={name} emoji={emoji} photo={photo} size={40} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.head}>
          <Avatar name={name} emoji={emoji} photo={photo} size={76} />
          <View style={styles.flex}>
            <Text style={t.heading} numberOfLines={1}>
              {name}
            </Text>
            {me.data?.public_id ? <Text style={[t.caption, styles.id]}>ID · {me.data.public_id}</Text> : null}
            <View style={styles.photoActions}>
              <Button
                label={photo ? 'Change photo' : 'Add photo'}
                icon="camera"
                size="sm"
                variant="secondary"
                loading={photoActions.uploading}
                onPress={photoActions.change}
              />
              {photo ? <Button label="Remove" size="sm" variant="ghost" loading={photoActions.removing} onPress={photoActions.clear} /> : null}
            </View>
          </View>
        </View>
        <Text style={[t.caption, styles.hint]}>JPEG, PNG or WebP, up to 10 MB.</Text>

        <ListGroup>
          <ListRow icon="search" title="Find a friend" subtitle="See their streaks by User ID" onPress={() => go('Discover')} />
          <ListRow leading={<RealIcon name="wallet" size={38} />} title="Wallet" subtitle="Points and rewards" onPress={() => go('Wallet')} />
          <ListRow icon="settings" title="Settings" subtitle="Account, privacy and alerts" onPress={() => go('Settings')} last />
        </ListGroup>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  id: {
    marginTop: 2,
    color: colors.textSecondary,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hint: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
