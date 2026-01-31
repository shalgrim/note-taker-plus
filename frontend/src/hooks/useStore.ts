import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;

  // Quiz session state
  currentQuizTag: string | null;
  setCurrentQuizTag: (tag: string | null) => void;

  // UI preferences
  showHints: boolean;
  setShowHints: (show: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (key) => {
        if (key) {
          localStorage.setItem('apiKey', key);
        } else {
          localStorage.removeItem('apiKey');
        }
        set({ apiKey: key });
      },

      currentQuizTag: null,
      setCurrentQuizTag: (tag) => set({ currentQuizTag: tag }),

      showHints: true,
      setShowHints: (show) => set({ showHints: show }),
    }),
    {
      name: 'note-taker-plus-storage',
      partialize: (state) => ({
        apiKey: state.apiKey,
        showHints: state.showHints,
      }),
    }
  )
);
