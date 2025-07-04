import { useCallback } from 'react';
import { useConversationStore, useStreamStore, useToolStore } from '../stores';
import { ChatMessage } from '../types';

export function useStreamingMessage() {
  const { addMessage, updateMessage } = useConversationStore();
  const { addStream, updateStreamBuffer, removeStream, getStreamBuffer } = useStreamStore();
  const { setCurrentTool, addToolExecution } = useToolStore();
  
  const startStreaming = useCallback((messageId: string, stream: any) => {
    // Add message in streaming state
    const message: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      streamResult: stream,
    };
    
    addMessage(message);
    addStream(messageId, stream);
  }, [addMessage, addStream]);
  
  const updateStreamingContent = useCallback((messageId: string, chunk: string) => {
    updateStreamBuffer(messageId, chunk);
    const fullContent = getStreamBuffer(messageId);
    updateMessage(messageId, { content: fullContent });
  }, [updateStreamBuffer, updateMessage, getStreamBuffer]);
  
  const completeStreaming = useCallback((messageId: string, finalContent: string) => {
    updateMessage(messageId, { 
      content: finalContent, 
      status: 'complete' 
    });
    removeStream(messageId);
    setCurrentTool(null);
  }, [updateMessage, removeStream, setCurrentTool]);
  
  const handleToolCall = useCallback((toolName: string, args: any) => {
    // Format tool display with filename context
    let toolDisplay = toolName;
    if (args) {
      const fileName = args.path?.split('/').pop() || args.sourcePath?.split('/').pop();
      if (fileName) {
        toolDisplay = `${toolName}: ${fileName}`;
      }
    }
    
    setCurrentTool(toolDisplay);
    
    // Add to tool execution history
    addToolExecution({
      id: `${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toolName,
      args,
      status: 'pending',
      timestamp: Date.now(),
    });
  }, [setCurrentTool, addToolExecution]);
  
  return { 
    startStreaming, 
    updateStreamingContent, 
    completeStreaming,
    handleToolCall,
  };
}