import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kocApi } from '../api';
import type { CreateKOCInput, UpdateKOCInput } from '../types';
import { toastError, toastSuccess } from '../utils';

const QUERY_KEY = 'kocs';

export const useKOCs = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}) => {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => kocApi.getAll(params).then((res) => res.data),
  });
};

export const useActiveKOCs = () => {
  return useQuery({
    queryKey: [QUERY_KEY, 'active'],
    queryFn: () => kocApi.getActive().then((res) => res.data),
  });
};

export const useKOCDetail = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => kocApi.getById(id).then((res) => res.data.data),
    enabled: !!id,
  });
};

export const useCreateKOC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateKOCInput) => kocApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toastSuccess('kocCreateSuccess');
    },
    onError: () => {
      toastError('kocCreateError');
    },
  });
};

export const useUpdateKOC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKOCInput }) =>
      kocApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      toastSuccess('kocUpdateSuccess');
    },
    onError: () => {
      toastError('kocUpdateError');
    },
  });
};

export const useDeleteKOC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => kocApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toastSuccess('kocDeleteSuccess');
    },
    onError: () => {
      toastError('kocDeleteError');
    },
  });
};
