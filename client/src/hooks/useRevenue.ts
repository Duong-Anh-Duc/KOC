import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cycleApi, revenueApi } from '../api';
import type {
    BulkCreateRevenueRecordInput,
    CreateCycleInput,
    CreateRevenueRecordInput,
    UpdateCycleInput,
    UpdateRevenueRecordInput,
} from '../types';
import { getApiErrorMessage, toastError, toastSuccess } from '../utils';

// ============================================================
// REVENUE CYCLES
// ============================================================

const CYCLES_KEY = 'cycles';
const RECORDS_KEY = 'revenue-records';

export const useCycles = () => {
  return useQuery({
    queryKey: [CYCLES_KEY],
    queryFn: () => cycleApi.getAll().then((res) => res.data.data),
  });
};

export const useCycleDetail = (id: number) => {
  return useQuery({
    queryKey: [CYCLES_KEY, id],
    queryFn: () => cycleApi.getById(id).then((res) => res.data.data),
    enabled: !!id,
  });
};

export const useAddKocsToCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, kocIds }: { cycleId: number; kocIds?: string[] }) =>
      cycleApi.addKocsToCycle(cycleId, kocIds),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY, vars.cycleId] });
      const { added } = res.data.data!;
      toastSuccess(added > 0 ? `Đã thêm ${added} KOC vào chu kỳ` : 'Không có KOC mới để thêm');
    },
    onError: () => toastError('Thêm KOC thất bại'),
  });
};

export const useCreateCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCycleInput) => cycleApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('cycleCreateSuccess');
    },
    onError: () => {
      toastError('cycleCreateError');
    },
  });
};

export const useUpdateCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCycleInput }) =>
      cycleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('cycleUpdateSuccess');
    },
    onError: () => {
      toastError('cycleUpdateError');
    },
  });
};

export const useLockCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cycleApi.lock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('cycleLockSuccess');
    },
    onError: (error) => {
      toastError('cycleLockError', getApiErrorMessage(error));
    },
  });
};

export const useReopenCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cycleApi.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('cycleReopenSuccess');
    },
    onError: (error) => {
      toastError('cycleReopenError', getApiErrorMessage(error));
    },
  });
};

export const useCompleteCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cycleApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('cycleCompleteSuccess');
    },
    onError: () => {
      toastError('cycleCompleteError');
    },
  });
};

export const useLockExchangeRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cycleApi.lockExchangeRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('exchangeRateLockSuccess');
    },
    onError: () => {
      toastError('exchangeRateLockError');
    },
  });
};

export const useUnlockExchangeRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cycleApi.unlockExchangeRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      toastSuccess('exchangeRateUnlockSuccess');
    },
    onError: () => {
      toastError('exchangeRateUnlockError');
    },
  });
};

export const useFetchExchangeRate = () => {
  return useMutation({
    mutationFn: () => cycleApi.getExchangeRate(),
  });
};

export const useUpdateExchangeRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCycleInput }) =>
      cycleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('exchangeRateUpdateSuccess');
    },
    onError: () => {
      toastError('exchangeRateUpdateError');
    },
  });
};

export const useScrapeRevenue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cycleId, kocIds }: { cycleId: number; kocIds?: string[] }) => cycleApi.scrapeRevenue(cycleId, kocIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CYCLES_KEY] });
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueScrapeSuccess');
    },
    onError: () => {
      toastError('revenueScrapeError');
    },
  });
};

// ============================================================
// REVENUE RECORDS
// ============================================================

export const useRevenueRecords = (cycleId: number) => {
  return useQuery({
    queryKey: [RECORDS_KEY, cycleId],
    queryFn: () => revenueApi.getRecordsByCycle(cycleId).then((res) => res.data),
    enabled: !!cycleId,
  });
};

export const useCreateRevenueRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRevenueRecordInput) => revenueApi.createRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueCreateSuccess');
    },
    onError: () => {
      toastError('revenueCreateError');
    },
  });
};

export const useBulkCreateRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkCreateRevenueRecordInput) => revenueApi.bulkCreateRecords(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueCreateSuccess');
    },
    onError: () => {
      toastError('revenueCreateError');
    },
  });
};

export const useUpdateRevenueRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRevenueRecordInput }) =>
      revenueApi.updateRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueUpdateSuccess');
    },
    onError: () => {
      toastError('revenueUpdateError');
    },
  });
};

export const useDeleteRevenueRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revenueApi.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueDeleteSuccess');
    },
    onError: () => {
      toastError('revenueDeleteError');
    },
  });
};

export const useDeleteManyRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => revenueApi.bulkDeleteRecords(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      toastSuccess('revenueDeleteSuccess');
    },
    onError: () => {
      toastError('revenueDeleteError');
    },
  });
};

export const useApproveRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revenueApi.approveRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      toastSuccess('revenueApproveSuccess');
    },
    onError: () => {
      toastError('revenueApproveError');
    },
  });
};

export const useUnapproveRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revenueApi.unapproveRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['payment-status'] });
      toastSuccess('revenueUnapproveSuccess');
    },
    onError: (error) => {
      toastError('revenueUnapproveError', getApiErrorMessage(error));
    },
  });
};

export const usePreviewCalculation = () => {
  return useMutation({
    mutationFn: (data: {
      original_revenue_usd: number;
      us_tax_deduction: number;
      base_rate?: number;
      exchange_rate?: number;
    }) => revenueApi.previewCalculation(data).then((res) => res.data.data),
  });
};

export const usePaymentStatus = (cycleId: number) => {
  return useQuery({
    queryKey: ['payment-status', cycleId],
    queryFn: () => revenueApi.getPaymentStatus(cycleId).then((res) => res.data.data),
    enabled: !!cycleId,
  });
};
