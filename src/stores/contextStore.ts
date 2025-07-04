import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TFile } from 'obsidian';

interface ContextState {
  // State
  contextFiles: TFile[];
  
  // Actions
  addContextFile: (file: TFile) => void;
  removeContextFile: (filePath: string) => void;
  setContextFiles: (files: TFile[]) => void;
  clearContextFiles: () => void;
  hasContextFile: (filePath: string) => boolean;
}

export const useContextStore = create<ContextState>()(
  devtools(
    (set, get) => ({
      contextFiles: [],
      
      addContextFile: (file) =>
        set((state) => {
          // Prevent duplicates
          if (state.contextFiles.some(f => f.path === file.path)) {
            return state;
          }
          return { contextFiles: [...state.contextFiles, file] };
        }),
        
      removeContextFile: (filePath) =>
        set((state) => ({
          contextFiles: state.contextFiles.filter((f) => f.path !== filePath),
        })),
        
      setContextFiles: (files) => set({ contextFiles: files }),
      
      clearContextFiles: () => set({ contextFiles: [] }),
      
      hasContextFile: (filePath) => {
        return get().contextFiles.some(f => f.path === filePath);
      },
    })
  )
);