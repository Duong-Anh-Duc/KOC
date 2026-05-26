import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'antd';
import { appNotification as notification } from '../utils';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ytScraperApi } from '../api';
import { toastError, toastSuccess } from '../utils';
import { LinkOutlined } from '@ant-design/icons';

/**
 * Hook encapsulating all YouTube scraper session management logic:
 * - Status polling
 * - Login / change account
 * - Cookie import
 * - Session verification
 * - Auto-login config
 */
export function useYtScraperStatus() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const [loginBrowserOpen, setLoginBrowserOpen] = useState(false);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);

  const statusData = undefined as { loggedIn?: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean } | undefined;
  const statusLoading = false;
  const refetchStatus = () => Promise.resolve();
  const isLoggedIn = false;

  // Auto-fetch account info
  const refreshAccountInfoMutation = useMutation({
    mutationFn: () => ytScraperApi.refreshAccountInfo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
  });

  useEffect(() => {
    if (isLoggedIn && !statusData?.channelName && !statusData?.email && !statusLoading) {
      refreshAccountInfoMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, statusLoading]);

  // Session expired listener
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    };
    window.addEventListener('yt-session-expired', handler);
    return () => window.removeEventListener('yt-session-expired', handler);
  }, [queryClient]);

  // Change account
  const changeAccountMutation = useMutation({
    mutationFn: async () => {
      await ytScraperApi.resetSession();
      return await ytScraperApi.openLogin();
    },
    onSuccess: (res) => {
      const url = (res.data?.data as any)?.vncUrl as string | undefined;
      const vncLink = url || 'http://46.62.170.132:6080/vnc.html';
      toastSuccess('ytScraperChangeAccount', t('ytScraper.changeAccountSuccess'));
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
      setWaitingForLogin(true);
      notification.open({
        key: 'vnc-login',
        message: t('ytScraper.vncBrowserOpened'),
        description: t('ytScraper.vncLoginDescAuto'),
        duration: 0,
        btn: React.createElement(Button, {
          type: 'primary',
          icon: React.createElement(LinkOutlined),
          onClick: () => { window.open(vncLink, '_blank', 'noopener,noreferrer'); notification.destroy('vnc-login'); },
        }, t('ytScraper.openLoginPage')),
      });
    },
    onError: () => {
      toastError('ytScraperChangeError', t('ytScraper.resetSessionError'));
      setWaitingForLogin(false);
    },
  });

  // Sync from Chrome
  const syncFromChromeMutation = useMutation({
    mutationFn: () => ytScraperApi.syncFromChrome(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        toastSuccess('ytSyncChrome', t('ytScraper.syncFromChromeSuccess'));
      } else {
        toastError('ytSyncChromeFail', t('ytScraper.syncFromChromeFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || t('ytScraper.syncFromChromeFailed');
      toastError('ytSyncChromeErr', msg);
    },
  });

  // Import cookies
  const importCookiesMutation = useMutation({
    mutationFn: (cookies: Array<Record<string, unknown>>) => ytScraperApi.importCookies(cookies),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        setCookieModalOpen(false);
        setWaitingForLogin(false);
        setLoginBrowserOpen(false);
        toastSuccess('ytCookieImport', t('ytScraper.importCookiesSuccess'));
      } else {
        toastError('ytCookieImportFail', t('ytScraper.importCookiesFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      toastError('ytCookieImportErr', t('ytScraper.importCookiesFailed'));
    },
  });

  // Verify session
  const verifySessionMutation = useMutation({
    mutationFn: () => ytScraperApi.verifySession(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        setWaitingForLogin(false);
        setLoginBrowserOpen(false);
        notification.destroy('vnc-login');
        toastSuccess('ytLoginSuccess', t('ytScraper.loginSuccess'));
      } else {
        toastError('ytVerifyFailed', t('ytScraper.verifyFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      toastError('ytVerifyError', t('ytScraper.verifyFailed'));
    },
  });

  // Check connection
  const checkConnectionMutation = useMutation({
    mutationFn: () => ytScraperApi.verifySession(),
    onSuccess: (res) => {
      const data = res.data?.data;
      if (data?.loggedIn) {
        toastSuccess('ytCheckConn', t('ytScraper.checkConnectionSuccess'));
      } else {
        toastError('ytCheckConnFail', t('ytScraper.checkConnectionFailed'));
      }
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
    onError: () => {
      toastError('ytCheckConnErr', t('ytScraper.checkConnectionFailed'));
      queryClient.invalidateQueries({ queryKey: ['yt-scraper-status'] });
    },
  });

  return {
    statusData,
    statusLoading,
    isLoggedIn,
    waitingForLogin,
    loginBrowserOpen,
    cookieModalOpen,
    setCookieModalOpen,
    refetchStatus,
    changeAccountMutation,
    syncFromChromeMutation,
    importCookiesMutation,
    verifySessionMutation,
    checkConnectionMutation,
  };
}
