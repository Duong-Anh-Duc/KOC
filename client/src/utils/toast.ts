import { toast, TypeOptions } from 'react-toastify';
import i18n from '../locales/i18n';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const showToast = (message: string, type: ToastType = 'info') => {
  const options: { type: TypeOptions } = { type };
  
  toast(message, options);
};

// Success notifications
export const toastSuccess = (messageKey: string, defaultMessage?: string) => {
  const message = i18n.exists(`toast.${messageKey}`) 
    ? i18n.t(`toast.${messageKey}`) 
    : defaultMessage || messageKey;
  showToast(message, 'success');
};

// Error notifications
export const toastError = (messageKey: string, defaultMessage?: string) => {
  const message = defaultMessage || (i18n.exists(`toast.${messageKey}`) 
    ? i18n.t(`toast.${messageKey}`) 
    : messageKey);
  showToast(message, 'error');
};

// Info notifications
export const toastInfo = (messageKey: string, defaultMessage?: string) => {
  const message = i18n.exists(`toast.${messageKey}`) 
    ? i18n.t(`toast.${messageKey}`) 
    : defaultMessage || messageKey;
  showToast(message, 'info');
};

// Warning notifications
export const toastWarning = (messageKey: string, defaultMessage?: string) => {
  const message = i18n.exists(`toast.${messageKey}`) 
    ? i18n.t(`toast.${messageKey}`) 
    : defaultMessage || messageKey;
  showToast(message, 'warning');
};
