import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuthStore } from '../stores';
import type { LoginInput } from '../types';
import { toastError, toastInfo, toastSuccess } from '../utils';

export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (data: LoginInput) => authApi.login(data),
    onSuccess: (response) => {
      const { token, user } = response.data.data!;
      setAuth(user, token);
      toastSuccess('loginSuccess');
    },
    onError: () => {
      toastError('loginError');
    },
  });
};

export const useLogout = () => {
  const logout = useAuthStore((s) => s.logout);

  return () => {
    logout();
    toastInfo('logoutSuccess');
  };
};
