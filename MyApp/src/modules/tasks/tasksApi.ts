import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type TaskStatus = 'PENDING' | 'COMPLETED';

export interface TaskChecklistItemOut {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

export interface TaskOut {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  task_type_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_at: string | null;
  repeat_rule: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  checklist_items: TaskChecklistItemOut[];
}

export interface TaskTypeOut {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
}

export interface ListTasksParams {
  status_filter?: TaskStatus;
  category_id?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category_id?: string;
  task_type_id?: string;
  priority?: TaskPriority;
  scheduled_at?: string;
  repeat_rule?: Record<string, unknown>;
  checklist?: { title: string }[];
}

export interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string | null;
  category_id?: string | null;
  task_type_id?: string | null;
  priority?: TaskPriority;
  scheduled_at?: string | null;
  repeat_rule?: Record<string, unknown> | null;
}

export interface CreateTaskTypeRequest {
  name: string;
  icon?: string;
  color?: string;
}

export const tasksApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listTasks: builder.query<TaskOut[], ListTasksParams | void>({
      query: arg => ({ url: '/tasks', params: cleanParams({ ...arg }) }),
      providesTags: result =>
        result
          ? [...result.map(t => ({ type: 'Task' as const, id: t.id })), { type: 'Task' as const, id: 'LIST' }]
          : [{ type: 'Task' as const, id: 'LIST' }],
    }),

    getTask: builder.query<TaskOut, string>({
      query: id => `/tasks/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),

    createTask: builder.mutation<TaskOut, CreateTaskRequest>({
      query: body => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    updateTask: builder.mutation<TaskOut, UpdateTaskRequest>({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Task', id: arg.id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    deleteTask: builder.mutation<void, string>({
      query: id => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),

    completeTask: builder.mutation<TaskOut, string>({
      query: id => ({ url: `/tasks/${id}/complete`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    uncompleteTask: builder.mutation<TaskOut, string>({
      query: id => ({ url: `/tasks/${id}/uncomplete`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),

    addTaskChecklistItem: builder.mutation<TaskChecklistItemOut, { taskId: string; title: string }>({
      query: ({ taskId, title }) => ({ url: `/tasks/${taskId}/checklist`, method: 'POST', body: { title } }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Task', id: arg.taskId }],
    }),

    updateTaskChecklistItem: builder.mutation<
      TaskChecklistItemOut,
      { id: string; taskId: string; title?: string; is_completed?: boolean }
    >({
      query: ({ id, taskId: _taskId, ...body }) => ({
        url: `/task-checklist-items/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Task', id: arg.taskId }],
    }),

    deleteTaskChecklistItem: builder.mutation<void, { id: string; taskId: string }>({
      query: ({ id }) => ({ url: `/task-checklist-items/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Task', id: arg.taskId }],
    }),

    listTaskTypes: builder.query<TaskTypeOut[], void>({
      query: () => '/task-types',
      providesTags: result =>
        result
          ? [...result.map(t => ({ type: 'TaskType' as const, id: t.id })), { type: 'TaskType' as const, id: 'LIST' }]
          : [{ type: 'TaskType' as const, id: 'LIST' }],
    }),

    createTaskType: builder.mutation<TaskTypeOut, CreateTaskTypeRequest>({
      query: body => ({ url: '/task-types', method: 'POST', body }),
      invalidatesTags: [{ type: 'TaskType', id: 'LIST' }],
    }),

    deleteTaskType: builder.mutation<void, string>({
      query: id => ({ url: `/task-types/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TaskType', id: 'LIST' }],
    }),
  }),
});

export const {
  useListTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useCompleteTaskMutation,
  useUncompleteTaskMutation,
  useAddTaskChecklistItemMutation,
  useUpdateTaskChecklistItemMutation,
  useDeleteTaskChecklistItemMutation,
  useListTaskTypesQuery,
  useCreateTaskTypeMutation,
  useDeleteTaskTypeMutation,
} = tasksApi;
