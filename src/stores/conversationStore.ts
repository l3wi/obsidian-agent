import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ChatMessage, ApprovalRequest } from '../types';

interface ConversationState {
  // State
  messages: ChatMessage[];
  activeStreamId: string | null;
  isProcessing: boolean;
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setActiveStreamId: (streamId: string | null) => void;
}

export const useConversationStore = create<ConversationState>()(
  devtools(
    persist(
      (set, get) => ({
        messages: [],
        activeStreamId: null,
        isProcessing: false,
        
        addMessage: (message) =>
          set((state) => ({ messages: [...state.messages, message] })),
          
        updateMessage: (id, updates) =>
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === id ? { ...msg, ...updates } : msg
            ),
          })),
          
        deleteMessage: (id) =>
          set((state) => ({
            messages: state.messages.filter((msg) => msg.id !== id),
          })),
          
        clearMessages: () => set({ messages: [] }),
        
        setProcessing: (isProcessing) => set({ isProcessing }),
        
        setActiveStreamId: (streamId) => set({ activeStreamId: streamId }),
      }),
      {
        name: 'conversation-storage',
        partialize: (state) => ({ messages: state.messages }), // Only persist messages
      }
    )
  )
);