import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api';

export const useDashboardOverview = () => {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => dashboardApi.getOverview().then((res) => res.data.data),
  });
};

export const useRevenueTrend = (limit?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'revenue-trend', limit],
    queryFn: () => dashboardApi.getRevenueTrend(limit).then((res) => res.data.data),
  });
};
