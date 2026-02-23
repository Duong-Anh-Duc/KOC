import { useQuery } from '@tanstack/react-query';
import { kocPortalApi } from '../api';

export const useMyRevenue = () => {
  return useQuery({
    queryKey: ['koc-portal', 'my-revenue'],
    queryFn: () => kocPortalApi.getMyRevenue().then((res) => res.data.data),
  });
};

export const useMyStats = () => {
  return useQuery({
    queryKey: ['koc-portal', 'my-stats'],
    queryFn: () => kocPortalApi.getMyStats().then((res) => res.data.data),
  });
};
