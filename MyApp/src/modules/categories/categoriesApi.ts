import { baseApi } from '../../api/baseApi';
import { cleanParams } from '../../utils/queryParams';

export interface CategoryOut {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListCategoriesParams {
  includeArchived?: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export const categoriesApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    listCategories: builder.query<CategoryOut[], ListCategoriesParams | void>({
      query: arg => ({
        url: '/categories',
        params: cleanParams({ include_archived: arg?.includeArchived ?? false }),
      }),
      providesTags: result =>
        result
          ? [...result.map(c => ({ type: 'Category' as const, id: c.id })), { type: 'Category' as const, id: 'LIST' }]
          : [{ type: 'Category' as const, id: 'LIST' }],
    }),

    getCategory: builder.query<CategoryOut, string>({
      query: id => `/categories/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Category', id }],
    }),

    createCategory: builder.mutation<CategoryOut, CreateCategoryRequest>({
      query: body => ({ url: '/categories', method: 'POST', body }),
      invalidatesTags: [{ type: 'Category', id: 'LIST' }],
    }),

    updateCategory: builder.mutation<CategoryOut, UpdateCategoryRequest>({
      query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Category', id: arg.id },
        { type: 'Category', id: 'LIST' },
      ],
    }),

    deleteCategory: builder.mutation<void, string>({
      query: id => ({ url: `/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Category', id: 'LIST' }],
    }),

    archiveCategory: builder.mutation<CategoryOut, string>({
      query: id => ({ url: `/categories/${id}/archive`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Category', id },
        { type: 'Category', id: 'LIST' },
      ],
    }),

    restoreCategory: builder.mutation<CategoryOut, string>({
      query: id => ({ url: `/categories/${id}/restore`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Category', id },
        { type: 'Category', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useArchiveCategoryMutation,
  useRestoreCategoryMutation,
} = categoriesApi;
