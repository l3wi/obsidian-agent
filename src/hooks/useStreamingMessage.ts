import { useCallback } from 'react';
import { useConversationStore, useStreamStore, useToolStore } from '../stores';
import { ChatMessage, MessageSegment } from '../types';

export function useStreamingMessage() {
  const { addMessage, updateMessage, messages } = useConversationStore();
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
    
    // Find the message to check if it has segments
    const message = messages.find(m => m.id === messageId);
    
    if (message?.segments && message.segments.length > 0) {
      // Update the last segment if it's a text or continuation segment
      const lastSegment = message.segments[message.segments.length - 1];
      if (lastSegment.type === 'text' || lastSegment.type === 'continuation') {
        const updatedSegments = message.segments.map(seg => 
          seg.id === lastSegment.id 
            ? { ...seg, content: fullContent }
            : seg
        );
        updateMessage(messageId, { 
          segments: updatedSegments,
          content: fullContent 
        });
      } else {
        // Add content to main message if last segment is not text
        updateMessage(messageId, { content: fullContent });
      }
    } else {
      // No segments, update content normally
      updateMessage(messageId, { content: fullContent });
    }
  }, [updateStreamBuffer, updateMessage, getStreamBuffer, messages]);
  
  const completeStreaming = useCallback((messageId: string, finalContent: string) => {
    // Find the message to preserve segments
    const message = messages.find(m => m.id === messageId);
    
    if (message?.segments && message.segments.length > 0) {
      // Update the last text/continuation segment with final content
      const lastTextSegmentIndex = message.segments.findLastIndex(
        seg => seg.type === 'text' || seg.type === 'continuation'
      );
      
      if (lastTextSegmentIndex !== -1) {
        const updatedSegments = [...message.segments];
        updatedSegments[lastTextSegmentIndex] = {
          ...updatedSegments[lastTextSegmentIndex],
          content: finalContent
        };
        
        updateMessage(messageId, { 
          content: finalContent, 
          status: 'complete',
          segments: updatedSegments
        });
      } else {
        updateMessage(messageId, { 
          content: finalContent, 
          status: 'complete' 
        });
      }
    } else {
      updateMessage(messageId, { 
        content: finalContent, 
        status: 'complete' 
      });
    }
    
    removeStream(messageId);
    setCurrentTool(null);
  }, [updateMessage, removeStream, setCurrentTool, messages]);
  
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