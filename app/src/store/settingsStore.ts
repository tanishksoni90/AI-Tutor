import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  // Appearance
  theme: Theme;
  
  // AI Tutor preferences
  enableValidation: boolean;
  defaultTopK: number;
  
  // Notifications
  enableNotifications: boolean;
  
  // Actions
  setTheme: (theme: Theme) => void;
  setEnableValidation: (enable: boolean) => void;
  setDefaultTopK: (topK: number) => void;
  setEnableNotifications: (enable: boolean) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  theme: 'light' as Theme,
  enableValidation: true,
  defaultTopK: 5,
  enableNotifications: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),
      setEnableValidation: (enableValidation) => set({ enableValidation }),
      setDefaultTopK: (defaultTopK) => set({ defaultTopK }),
      setEnableNotifications: (enableNotifications) => set({ enableNotifications }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'settings-storage',
    }
  )
);
