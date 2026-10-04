import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';
import type { TaskOut } from '../tasks/tasksApi';

export type NoteType = 'QUICK' | 'CONTEXT' | 'DECISION' | 'REFERENCE' | 'LESSON' | 'CHECKLIST';

export interface NoteOut {
  id: string;
  title: string | null;
  content: string;
  category_id: string | null;
  task_id: string | null;
  note_type: NoteType;
  pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListNotesParams {
  category_id?: string;
  task_id?: string;
  include_archived?: boolean;
}

export interface CreateNoteRequest {
  title?: string;
  content: string;
  category_id?: string;
  task_id?: string;
  note_type?: NoteType;
}

export interface UpdateNoteRequest {
  id: string;
  title?: string;
  content?: string;
  category_id?: string;
  note_type?: NoteType;
}

export const notesApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listNotes: builder.query<NoteOut[], ListNotesParams | void>({
      query: arg => ({ url: '/notes', params: cleanParams({ include_archived: false, ...arg }) }),
      providesTags: result =>
        result
          ? [...result.map(n => ({ type: 'Note' as const, id: n.id })), { type: 'Note' as const, id: 'LIST' }]
          : [{ type: 'Note' as const, id: 'LIST' }],
    }),

    getNote: builder.query<NoteOut, string>({
      query: id => `/notes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Note', id }],
    }),

    createNote: builder.mutation<NoteOut, CreateNoteRequest>({
      query: body => ({ url: '/notes', method: 'POST', body }),
      invalidatesTags: [{ type: 'Note', id: 'LIST' }],
    }),

    updateNote: builder.mutation<NoteOut, UpdateNoteRequest>({
      query: ({ id, ...body }) => ({ url: `/notes/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Note', id: arg.id },
        { type: 'Note', id: 'LIST' },
      ],
    }),

    deleteNote: builder.mutation<void, string>({
      query: id => ({ url: `/notes/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Note', id: 'LIST' }],
    }),

    pinNote: builder.mutation<NoteOut, string>({
      query: id => ({ url: `/notes/${id}/pin`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Note', id },
        { type: 'Note', id: 'LIST' },
      ],
    }),

    unpinNote: builder.mutation<NoteOut, string>({
      query: id => ({ url: `/notes/${id}/unpin`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Note', id },
        { type: 'Note', id: 'LIST' },
      ],
    }),

    archiveNote: builder.mutation<NoteOut, string>({
      query: id => ({ url: `/notes/${id}/archive`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Note', id },
        { type: 'Note', id: 'LIST' },
      ],
    }),

    restoreNote: builder.mutation<NoteOut, string>({
      query: id => ({ url: `/notes/${id}/restore`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Note', id },
        { type: 'Note', id: 'LIST' },
      ],
    }),

    convertNoteToTask: builder.mutation<TaskOut, string>({
      query: id => ({ url: `/notes/${id}/convert-to-task`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Note', id },
        { type: 'Note', id: 'LIST' },
        { type: 'Task', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListNotesQuery,
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  usePinNoteMutation,
  useUnpinNoteMutation,
  useArchiveNoteMutation,
  useRestoreNoteMutation,
  useConvertNoteToTaskMutation,
} = notesApi;
