import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface StreamState {
  // State
  activeStreams: Map<string, any>; // streamId -> streamResult
  streamBuffers: Map<string, string>; // streamId -> accumulated content
  
  // Actions
  addStream: (streamId: string, stream: any) => void;
  removeStream: (streamId: string) => void;
  updateStreamBuffer: (streamId: string, chunk: string) => void;
  getStreamBuffer: (streamId: string) => string;
  clearStreamBuffer: (streamId: string) => void;
}

export const useStreamStore = create<StreamState>()(
  devtools(
    (set, get) => ({
      activeStreams: new Map(),
      streamBuffers: new Map(),
      
      addStream: (streamId, stream) =>
        set((state) => {
          const newStreams = new Map(state.activeStreams);
          newStreams.set(streamId, stream);
          return { activeStreams: newStreams };
        }),
        
      removeStream: (streamId) =>
        set((state) => {
          const newStreams = new Map(state.activeStreams);
          const newBuffers = new Map(state.streamBuffers);
          newStreams.delete(streamId);
          newBuffers.delete(streamId);
          return { activeStreams: newStreams, streamBuffers: newBuffers };
        }),
        
      updateStreamBuffer: (streamId, chunk) =>
        set((state) => {
          const newBuffers = new Map(state.streamBuffers);
          const current = newBuffers.get(streamId) || '';
          newBuffers.set(streamId, current + chunk);
          return { streamBuffers: newBuffers };
        }),
        
      getStreamBuffer: (streamId) => {
        return get().streamBuffers.get(streamId) || '';
      },
      
      clearStreamBuffer: (streamId) =>
        set((state) => {
          const newBuffers = new Map(state.streamBuffers);
          newBuffers.delete(streamId);
          return { streamBuffers: newBuffers };
        }),
    })
  )
);