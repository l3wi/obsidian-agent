import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ToolExecution {
  id: string;
  toolName: string;
  args: any;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  error?: string;
  result?: any;
  timestamp: number;
}

interface ToolState {
  // State
  currentTool: string | null;
  toolHistory: ToolExecution[];
  pendingApprovals: Map<string, any>;
  
  // Actions
  addToolExecution: (execution: ToolExecution) => void;
  updateToolStatus: (id: string, status: ToolExecution['status'], error?: string) => void;
  setCurrentTool: (toolName: string | null) => void;
  addPendingApproval: (id: string, interruption: any) => void;
  resolvePendingApproval: (id: string, approved: boolean) => void;
  clearPendingApprovals: () => void;
  getToolHistory: () => string[];
  getPendingApprovals: () => Map<string, any>;
  hasApprovalTools: () => boolean;
}

export const useToolStore = create<ToolState>()(
  devtools(
    (set, get) => ({
      currentTool: null,
      toolHistory: [],
      pendingApprovals: new Map(),
      
      addToolExecution: (execution) =>
        set((state) => ({
          toolHistory: [...state.toolHistory, execution],
        })),
        
      updateToolStatus: (id, status, error) =>
        set((state) => ({
          toolHistory: state.toolHistory.map((exec) =>
            exec.id === id ? { ...exec, status, error } : exec
          ),
        })),
        
      setCurrentTool: (toolName) => set({ currentTool: toolName }),
      
      addPendingApproval: (id, interruption) =>
        set((state) => {
          const newApprovals = new Map(state.pendingApprovals);
          newApprovals.set(id, interruption);
          return { pendingApprovals: newApprovals };
        }),
        
      resolvePendingApproval: (id, approved) =>
        set((state) => {
          const newApprovals = new Map(state.pendingApprovals);
          newApprovals.delete(id);
          return { pendingApprovals: newApprovals };
        }),
        
      clearPendingApprovals: () => set({ pendingApprovals: new Map() }),
      
      getToolHistory: () => {
        const state = get();
        return state.toolHistory.map(exec => {
          // Format tool display with filename if available
          if (exec.args) {
            const fileName = exec.args.path?.split('/').pop() || exec.args.sourcePath?.split('/').pop();
            if (fileName) {
              return `${exec.toolName}: ${fileName}`;
            }
          }
          return exec.toolName;
        });
      },
      
      getPendingApprovals: () => {
        const state = get();
        return state.pendingApprovals;
      },
      
      hasApprovalTools: () => {
        const state = get();
        return state.pendingApprovals.size > 0;
      },
    })
  )
);