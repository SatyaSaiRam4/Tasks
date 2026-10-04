import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import SearchBar from '@ant-design/react-native/lib/search-bar';
import Toast from '@ant-design/react-native/lib/toast';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { LoadingView } from '../../../components/LoadingView';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Panel } from '../../../components/Panel';
import { border, colors, fontSize, radius, spacing } from '../../../theme';
import { getErrorMessage } from '../../../utils/apiError';
import {
  useDisableAdminUserMutation,
  useEnableAdminUserMutation,
  useListAdminUsersQuery,
  useUpdateAdminUserRoleMutation,
  type AdminUserOut,
} from '../adminApi';

function UserRow({
  user,
  onToggleActive,
  onToggleRole,
}: {
  user: AdminUserOut;
  onToggleActive: () => void;
  onToggleRole: () => void;
}) {
  return (
    <Panel style={styles.rowWrap} contentStyle={styles.row} shadowOffset={4}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.display_name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {user.display_name}
        </Text>
        <Text style={styles.rowEmail} numberOfLines={1}>
          {user.email}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, user.role === 'ADMIN' ? styles.badgeAdmin : styles.badgeUser]}>
            <Text style={styles.badgeText}>{user.role}</Text>
          </View>
          <View style={[styles.badge, user.is_active ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={styles.badgeText}>{user.is_active ? 'Active' : 'Disabled'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onToggleRole}>
          <Text style={styles.actionButtonText}>{user.role === 'ADMIN' ? 'Make user' : 'Make admin'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onToggleActive}>
          <Text style={[styles.actionButtonText, user.is_active && styles.actionButtonTextDanger]}>
            {user.is_active ? 'Disable' : 'Enable'}
          </Text>
        </TouchableOpacity>
      </View>
    </Panel>
  );
}

export function AdminUsersScreen() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch } = useListAdminUsersQuery({ search: search || undefined });
  const [disableUser] = useDisableAdminUserMutation();
  const [enableUser] = useEnableAdminUserMutation();
  const [updateRole] = useUpdateAdminUserRoleMutation();

  const handleToggleActive = (user: AdminUserOut) => {
    const willDisable = user.is_active;
    Modal.alert(
      willDisable ? 'Disable user' : 'Enable user',
      `${willDisable ? 'Disable' : 'Enable'} ${user.display_name}?`,
      [
        { text: 'Cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              if (willDisable) {
                await disableUser(user.id).unwrap();
              } else {
                await enableUser(user.id).unwrap();
              }
            } catch (err) {
              Toast.fail(getErrorMessage(err, 'Could not update user.'));
            }
          },
        },
      ],
    );
  };

  const handleToggleRole = (user: AdminUserOut) => {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    Modal.alert('Change role', `Set ${user.display_name}'s role to ${nextRole}?`, [
      { text: 'Cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await updateRole({ id: user.id, role: nextRole }).unwrap();
          } catch (err) {
            Toast.fail(getErrorMessage(err, 'Could not update role.'));
          }
        },
      },
    ]);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingView label="Loading users…" />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Could not load users.')} onRetry={refetch} />;
  } else if (!data || data.length === 0) {
    body = <EmptyState glyph="🔍" title="No users found" subtitle="Try a different search." />;
  } else {
    body = (
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onToggleActive={() => handleToggleActive(item)}
            onToggleRole={() => handleToggleRole(item)}
          />
        )}
      />
    );
  }

  return (
    <ScreenContainer edges={['bottom']}>
      <View style={styles.searchWrap}>
        <SearchBar placeholder="Search by name or email" value={search} onChange={setSearch} onSubmit={setSearch} />
      </View>
      {body}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  rowWrap: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accentYellowSoft,
    borderWidth: border.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: fontSize.md,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.ink,
  },
  rowEmail: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  badge: {
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  badgeAdmin: { backgroundColor: colors.accentOrange },
  badgeUser: { backgroundColor: colors.surfaceAlt },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeInactive: { backgroundColor: colors.dangerSoft },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
  },
  actions: {
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  actionButtonTextDanger: {
    color: colors.danger,
  },
});
