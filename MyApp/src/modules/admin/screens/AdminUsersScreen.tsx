import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
import { useAppSelector } from '../../../app/hooks';
import { colors, spacing, type as t } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Avatar, Pill } from '../../../components/Controls';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/Sheet';
import { EmptyState, ErrorState, SkeletonList } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { formatFullDate } from '../../../utils/date';
import { selectCurrentUser } from '../../auth/authSlice';
import {
  useDisableAdminUserMutation,
  useEnableAdminUserMutation,
  useListAdminUsersQuery,
  useUpdateAdminUserRoleMutation,
  type AdminUserOut,
} from '../adminApi';

type Pending = { kind: 'role' | 'active'; user: AdminUserOut } | null;

export function AdminUsersScreen() {
  const me = useAppSelector(selectCurrentUser);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch, isFetching } = useListAdminUsersQuery({ search: search.trim() || undefined });
  const [disable] = useDisableAdminUserMutation();
  const [enable] = useEnableAdminUserMutation();
  const [setRole] = useUpdateAdminUserRoleMutation();
  const [pending, setPending] = useState<Pending>(null);

  const confirm = async () => {
    if (!pending) return;
    const u = pending.user;
    try {
      if (pending.kind === 'role') await setRole({ id: u.id, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' }).unwrap();
      else if (u.is_active) await disable(u.id).unwrap();
      else await enable(u.id).unwrap();
      setPending(null);
    } catch (err) {
      Toast.fail(getErrorMessage(err), 2);
    }
  };

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <ScreenHeader title="Users" subtitle={data ? `${data.length} accounts` : 'Admin'} />
      <TextField icon="search" value={search} onChangeText={setSearch} placeholder="Search name, email or User ID" autoCapitalize="none" />
      {isLoading ? (
        <SkeletonList count={5} height={110} />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        data.map(u => {
          const self = u.id === me?.id;
          return (
            <Card key={u.id} style={styles.card}>
              <View style={styles.row}>
                <Avatar name={u.display_name} size={42} />
                <View style={styles.flex}>
                  <Text style={styles.name}>
                    {u.display_name}
                    {self ? ' (you)' : ''}
                  </Text>
                  <Text style={t.caption}>{u.email}</Text>
                  <Text style={t.caption}>
                    {u.public_id} · Joined {formatFullDate(u.created_at)}
                  </Text>
                </View>
              </View>
              <View style={styles.pills}>
                <Pill label={u.role} color={u.role === 'ADMIN' ? colors.warning : colors.textSecondary} background={u.role === 'ADMIN' ? colors.warningSoft : colors.surfaceHigh} />
                <Pill label={u.is_active ? 'Active' : 'Disabled'} color={u.is_active ? colors.success : colors.danger} background={u.is_active ? colors.successSoft : colors.dangerSoft} />
              </View>
              {!self ? (
                <View style={styles.actions}>
                  <Button size="sm" variant="secondary" label={u.role === 'ADMIN' ? 'Make user' : 'Make admin'} onPress={() => setPending({ kind: 'role', user: u })} style={styles.flex} />
                  <Button size="sm" variant={u.is_active ? 'danger' : 'secondary'} label={u.is_active ? 'Disable' : 'Enable'} onPress={() => setPending({ kind: 'active', user: u })} style={styles.flex} />
                </View>
              ) : null}
            </Card>
          );
        })
      )}
      <ConfirmSheet
        visible={Boolean(pending)}
        icon={pending?.kind === 'role' ? 'shield' : 'user'}
        destructive={pending?.kind === 'active' && pending.user.is_active}
        title={
          pending?.kind === 'role'
            ? `${pending.user.role === 'ADMIN' ? 'Remove admin rights from' : 'Make'} ${pending.user.display_name}${pending.user.role === 'ADMIN' ? '?' : ' an admin?'}`
            : `${pending?.user.is_active ? 'Disable' : 'Enable'} ${pending?.user.display_name}?`
        }
        message={pending?.kind === 'active' && pending.user.is_active ? 'They will be signed out and unable to sign in.' : undefined}
        confirmLabel="Confirm"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  name: {
    ...t.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
