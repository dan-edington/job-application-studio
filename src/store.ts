import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocumentSelection } from '../shared/schema';
type State = {
  activeId: string | null;
  url: string;
  jobText: string;
  coverLetterPersonalisation: string;
  model: string;
  cvTemplate: string;
  letterTemplate: string;
  documentSelection: DocumentSelection;
  set: (state: Partial<Omit<State, 'set' | 'newApplication'>>) => void;
  newApplication: () => void;
};
export const useStudio = create<State>()(
  persist(
    (set) => ({
      activeId: null,
      url: '',
      jobText: '',
      coverLetterPersonalisation: '',
      model: '',
      cvTemplate: 'standard',
      letterTemplate: 'standard',
      documentSelection: 'both',
      set: (state) => set(state),
      newApplication: () =>
        set({
          activeId: null,
          url: '',
          jobText: '',
          coverLetterPersonalisation: '',
        }),
    }),
    {
      name: 'application-studio-preferences',
      version: 1,
      // Adopt the new budget default once, without losing drafts or template choices.
      migrate: (persisted) => {
        const old = (persisted || {}) as Partial<State>;
        return {
          activeId: old.activeId ?? null,
          cvTemplate: old.cvTemplate ?? 'standard',
          letterTemplate: old.letterTemplate ?? 'standard',
          model: '',
        };
      },
      partialize: (state) => ({
        activeId: state.activeId,
        model: state.model,
        cvTemplate: state.cvTemplate,
        letterTemplate: state.letterTemplate,
        documentSelection: state.documentSelection,
      }),
    },
  ),
);
