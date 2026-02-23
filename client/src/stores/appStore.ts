import { create } from 'zustand';

type Locale = 'vi' | 'en';

interface AppState {
  locale: Locale;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: (localStorage.getItem('locale') as Locale) || 'vi',
  sidebarCollapsed: false,
  darkMode: localStorage.getItem('darkMode') === 'true',

  setLocale: (locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  toggleDarkMode: () => {
    set((state) => {
      const newDarkMode = !state.darkMode;
      localStorage.setItem('darkMode', String(newDarkMode));
      return { darkMode: newDarkMode };
    });
  },

  setDarkMode: (darkMode) => {
    localStorage.setItem('darkMode', String(darkMode));
    set({ darkMode });
  },
}));
