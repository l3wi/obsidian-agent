import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { App, TFile } from 'obsidian';

interface UndoableOperation {
  id: string;
  type: 'create' | 'modify' | 'delete' | 'move';
  timestamp: number;
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface UndoState {
  history: UndoableOperation[];
  currentIndex: number;
  
  // Actions
  addOperation: (operation: UndoableOperation) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  getHistory: () => UndoableOperation[];
}

export const useUndoStore = create<UndoState>()(
  devtools(
    (set, get) => ({
      history: [],
      currentIndex: -1,
      
      addOperation: (operation) =>
        set((state) => {
          // Remove any operations after current index
          const newHistory = state.history.slice(0, state.currentIndex + 1);
          newHistory.push(operation);
          
          // Limit history size
          if (newHistory.length > 50) {
            newHistory.shift();
          }
          
          return {
            history: newHistory,
            currentIndex: newHistory.length - 1,
          };
        }),
        
      undo: async () => {
        const state = get();
        if (!state.canUndo()) return;
        
        const operation = state.history[state.currentIndex];
        await operation.undo();
        
        set({ currentIndex: state.currentIndex - 1 });
      },
      
      redo: async () => {
        const state = get();
        if (!state.canRedo()) return;
        
        const operation = state.history[state.currentIndex + 1];
        await operation.redo();
        
        set({ currentIndex: state.currentIndex + 1 });
      },
      
      canUndo: () => {
        const state = get();
        return state.currentIndex >= 0;
      },
      
      canRedo: () => {
        const state = get();
        return state.currentIndex < state.history.length - 1;
      },
      
      clearHistory: () => set({ history: [], currentIndex: -1 }),
      
      getHistory: () => get().history,
    }),
    {
      name: 'undo-storage',
    }
  )
);

// Helper to create undoable operations
export function createUndoableFileOperation(
  app: App,
  type: 'create' | 'modify' | 'delete',
  path: string,
  oldContent?: string,
  newContent?: string
): UndoableOperation {
  return {
    id: `${type}-${path}-${Date.now()}`,
    type,
    timestamp: Date.now(),
    description: `${type} ${path}`,
    
    undo: async () => {
      switch (type) {
        case 'create':
          // Undo create = delete
          const file = app.vault.getAbstractFileByPath(path);
          if (file) await app.vault.trash(file, true);
          break;
          
        case 'modify':
          // Undo modify = restore old content
          const modFile = app.vault.getAbstractFileByPath(path);
          if (modFile && oldContent !== undefined) {
            await app.vault.modify(modFile as TFile, oldContent);
          }
          break;
          
        case 'delete':
          // Undo delete = recreate
          if (oldContent !== undefined) {
            await app.vault.create(path, oldContent);
          }
          break;
      }
    },
    
    redo: async () => {
      switch (type) {
        case 'create':
          // Redo create = create again
          if (newContent !== undefined) {
            await app.vault.create(path, newContent);
          }
          break;
          
        case 'modify':
          // Redo modify = apply new content
          const modFile = app.vault.getAbstractFileByPath(path);
          if (modFile && newContent !== undefined) {
            await app.vault.modify(modFile as TFile, newContent);
          }
          break;
          
        case 'delete':
          // Redo delete = delete again
          const file = app.vault.getAbstractFileByPath(path);
          if (file) await app.vault.trash(file, true);
          break;
      }
    },
  };
}

// Helper for folder operations
export function createUndoableFolderOperation(
  app: App,
  type: 'create' | 'delete',
  path: string
): UndoableOperation {
  return {
    id: `${type}-folder-${path}-${Date.now()}`,
    type: type === 'create' ? 'create' : 'delete',
    timestamp: Date.now(),
    description: `${type} folder ${path}`,
    
    undo: async () => {
      switch (type) {
        case 'create':
          // Undo create = delete folder
          const folder = app.vault.getAbstractFileByPath(path);
          if (folder) await app.vault.trash(folder, true);
          break;
          
        case 'delete':
          // Undo delete = recreate folder
          await app.vault.createFolder(path);
          break;
      }
    },
    
    redo: async () => {
      switch (type) {
        case 'create':
          // Redo create = create folder again
          await app.vault.createFolder(path);
          break;
          
        case 'delete':
          // Redo delete = delete folder again
          const folder = app.vault.getAbstractFileByPath(path);
          if (folder) await app.vault.trash(folder, true);
          break;
      }
    },
  };
}

// Helper for copy operations
export function createUndoableCopyOperation(
  app: App,
  sourcePath: string,
  destinationPath: string
): UndoableOperation {
  return {
    id: `copy-${sourcePath}-to-${destinationPath}-${Date.now()}`,
    type: 'create', // Copy is essentially a create
    timestamp: Date.now(),
    description: `copy ${sourcePath} to ${destinationPath}`,
    
    undo: async () => {
      // Undo copy = delete the copied file
      const file = app.vault.getAbstractFileByPath(destinationPath);
      if (file) await app.vault.trash(file, true);
    },
    
    redo: async () => {
      // Redo copy = copy again
      const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
      if (sourceFile && sourceFile instanceof TFile) {
        const content = await app.vault.read(sourceFile);
        await app.vault.create(destinationPath, content);
      }
    },
  };
}