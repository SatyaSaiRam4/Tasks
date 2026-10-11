import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';
import { vaultUnlocked } from './vaultSlice';

export interface VaultStatus {
  has_pin: boolean;
  locked_until: string | null;
  autolock_minutes: number;
}

export interface VaultSession {
  vault_token: string;
  expires_at: string;
}

export interface VaultEntrySummary {
  id: string;
  title: string | null;
  preview: string;
  folder: string | null;
  tags: string[];
  pinned: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** A voice recording is attached (fetched separately, never in lists). */
  has_audio: boolean;
  audio_seconds: number | null;
  /** How many photos are attached (the photos are fetched one by one). */
  image_count?: number;
}

export interface VaultImageRef {
  id: string;
  mime: string;
  created_at: string;
}

export interface VaultEntry extends VaultEntrySummary {
  content: string;
  images?: VaultImageRef[];
}

export type VaultView = 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';
export type VaultFlag = 'pin' | 'unpin' | 'favorite' | 'unfavorite' | 'archive' | 'unarchive' | 'trash' | 'restore';

export interface VaultEntryInput {
  title?: string | null;
  content: string;
  folder?: string | null;
  tags?: string[];
}

async function storeSession(dispatch: (a: unknown) => unknown, queryFulfilled: Promise<{ data: VaultSession }>) {
  try {
    const { data } = await queryFulfilled;
    dispatch(vaultUnlocked({ token: data.vault_token, expiresAt: data.expires_at }));
  } catch {
    // surfaced by the caller
  }
}

export const vaultApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getVaultStatus: builder.query<VaultStatus, void>({
      query: () => '/vault/status',
      providesTags: ['VaultStatus'],
    }),
    setupVault: builder.mutation<VaultSession, { pin: string }>({
      query: body => ({ url: '/vault/setup', method: 'POST', body }),
      invalidatesTags: ['VaultStatus', 'VaultEntry'],
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => storeSession(dispatch, queryFulfilled),
    }),
    unlockVault: builder.mutation<VaultSession, { pin: string }>({
      query: body => ({ url: '/vault/unlock', method: 'POST', body }),
      invalidatesTags: ['VaultStatus', 'VaultEntry'],
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => storeSession(dispatch, queryFulfilled),
    }),
    changeVaultPin: builder.mutation<VaultSession, { current_pin: string; new_pin: string }>({
      query: body => ({ url: '/vault/change-pin', method: 'POST', body }),
      invalidatesTags: ['VaultStatus'],
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => storeSession(dispatch, queryFulfilled),
    }),
    /** Forgot the PIN: the account password sets a new one; notes are kept. */
    resetVaultPin: builder.mutation<VaultSession, { password: string; new_pin: string }>({
      query: body => ({ url: '/vault/reset-pin', method: 'POST', body }),
      invalidatesTags: ['VaultStatus', 'VaultEntry'],
      onQueryStarted: (_arg, { dispatch, queryFulfilled }) => storeSession(dispatch, queryFulfilled),
    }),
    listVaultEntries: builder.query<VaultEntrySummary[], { view?: VaultView; q?: string; folder?: string; tag?: string }>({
      query: arg => ({ url: '/vault/entries', params: cleanParams({ ...arg }) }),
      providesTags: ['VaultEntry'],
      keepUnusedDataFor: 0, // don't keep decrypted content in the cache after leaving
    }),
    listVaultFolders: builder.query<{ name: string; count: number }[], void>({
      query: () => '/vault/folders',
      providesTags: ['VaultEntry'],
      keepUnusedDataFor: 0,
    }),
    getVaultEntry: builder.query<VaultEntry, string>({
      query: id => `/vault/entries/${id}`,
      providesTags: ['VaultEntry'],
      keepUnusedDataFor: 0,
    }),
    createVaultEntry: builder.mutation<VaultEntry, VaultEntryInput>({
      query: body => ({ url: '/vault/entries', method: 'POST', body }),
      invalidatesTags: ['VaultEntry'],
    }),
    updateVaultEntry: builder.mutation<VaultEntry, Partial<VaultEntryInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/vault/entries/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['VaultEntry'],
    }),
    flagVaultEntry: builder.mutation<VaultEntry, { id: string; flag: VaultFlag }>({
      query: ({ id, flag }) => ({ url: `/vault/entries/${id}/${flag}`, method: 'POST' }),
      invalidatesTags: ['VaultEntry'],
    }),
    deleteVaultEntry: builder.mutation<void, string>({
      query: id => ({ url: `/vault/entries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['VaultEntry'],
    }),
    emptyVaultTrash: builder.mutation<void, void>({
      query: () => ({ url: '/vault/trash/empty', method: 'POST' }),
      invalidatesTags: ['VaultEntry'],
    }),
    /** Attaches a voice recording (a local file) to a note, replacing any earlier one. */
    uploadVaultAudio: builder.mutation<VaultEntry, { id: string; uri: string; seconds: number }>({
      query: ({ id, uri, seconds }) => {
        const form = new FormData();
        form.append('file', { uri: uri.startsWith('file://') ? uri : `file://${uri}`, name: 'voice.mp4', type: 'audio/mp4' } as unknown as Blob);
        form.append('seconds', String(Math.max(1, Math.round(seconds))));
        return { url: `/vault/entries/${id}/audio`, method: 'PUT', body: form };
      },
      invalidatesTags: ['VaultEntry'],
    }),
    deleteVaultAudio: builder.mutation<VaultEntry, string>({
      query: id => ({ url: `/vault/entries/${id}/audio`, method: 'DELETE' }),
      invalidatesTags: ['VaultEntry'],
    }),
    /** Attaches a photo (a local file) to a note, encrypted on the server. */
    uploadVaultImage: builder.mutation<VaultEntry, { id: string; uri: string; type: string; name: string }>({
      query: ({ id, uri, type, name }) => {
        const form = new FormData();
        form.append('file', { uri, name, type } as unknown as Blob);
        return { url: `/vault/entries/${id}/images`, method: 'POST', body: form };
      },
      invalidatesTags: ['VaultEntry'],
    }),
    deleteVaultImage: builder.mutation<VaultEntry, { id: string; imageId: string }>({
      query: ({ id, imageId }) => ({ url: `/vault/entries/${id}/images/${imageId}`, method: 'DELETE' }),
      invalidatesTags: ['VaultEntry'],
    }),
  }),
});

export const {
  useGetVaultStatusQuery,
  useSetupVaultMutation,
  useUnlockVaultMutation,
  useChangeVaultPinMutation,
  useListVaultEntriesQuery,
  useListVaultFoldersQuery,
  useGetVaultEntryQuery,
  useCreateVaultEntryMutation,
  useUpdateVaultEntryMutation,
  useFlagVaultEntryMutation,
  useDeleteVaultEntryMutation,
  useEmptyVaultTrashMutation,
  useUploadVaultAudioMutation,
  useDeleteVaultAudioMutation,
  useUploadVaultImageMutation,
  useDeleteVaultImageMutation,
  useResetVaultPinMutation,
} = vaultApi;
