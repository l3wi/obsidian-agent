import * as React from 'react';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChatMessage, ApprovalRequest, ToolResponse } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import ObsidianChatAssistant from '../main';
import { Notice } from 'obsidian';
import { ToolRouter } from '../core/ToolRouter';
import { ApprovalManager } from '../managers/ApprovalManager';

interface ChatInterfaceProps {
	plugin: ObsidianChatAssistant;
}

export const ChatInterface = forwardRef<any, ChatInterfaceProps>(({ plugin }, ref) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	
	// Initialize tool router and approval manager
	const approvalManager = useRef<ApprovalManager>(
		new ApprovalManager(plugin.app, plugin.settings.approvalRequired)
	);
	const toolRouter = useRef<ToolRouter>(
		new ToolRouter(plugin.app, approvalManager.current)
	);

	// Update approval manager when settings change
	useEffect(() => {
		approvalManager.current.setApprovalRequired(plugin.settings.approvalRequired);
	}, [plugin.settings.approvalRequired]);

	// Expose processCommand method to parent
	useImperativeHandle(ref, () => ({
		processCommand: async (command: string, input: string) => {
			// Create a user message showing the command
			const userMessage: ChatMessage = {
				id: Date.now().toString(),
				role: 'user',
				content: `/${command} ${input}`,
				timestamp: Date.now(),
				status: 'complete'
			};
			setMessages(prev => [...prev, userMessage]);
			setIsProcessing(true);

			try {
				// Process the specific command
				let result;
				switch (command) {
					case 'analyse':
						result = await processAnalyseCommand(input);
						break;
					case 'research':
						result = await processResearchCommand(input);
						break;
					case 'tidy':
						result = await processTidyCommand(input);
						break;
					default:
						result = { success: false, message: `Unknown command: ${command}` };
				}

				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: result.message,
					timestamp: Date.now(),
					status: result.success ? 'complete' : 'error',
					error: result.success ? undefined : result.message,
					approvalRequest: result.requiresApproval ? result.approvalData : undefined,
					approvalStatus: result.requiresApproval ? 'pending' : undefined
				};
				setMessages(prev => [...prev, assistantMessage]);
			} catch (error) {
				console.error('Error processing command:', error);
				const errorMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: `Error: ${error.message}`,
					timestamp: Date.now(),
					status: 'error',
					error: error.message
				};
				setMessages(prev => [...prev, errorMessage]);
			} finally {
				setIsProcessing(false);
			}
		}
	}));

	// Command processing functions
	const processAnalyseCommand = async (input: string): Promise<ToolResponse> => {
		// For now, return a placeholder - will be implemented with AI integration
		return {
			success: true,
			message: `Analyzing documents: "${input}"\n\nDocument analysis will be implemented with AI integration. The analysis will examine the specified documents and provide insights.`
		};
	};

	const processResearchCommand = async (input: string): Promise<ToolResponse> => {
		// For now, return a placeholder - will be implemented with o3 model and Exa
		return {
			success: true,
			message: `Researching topic: "${input}"\n\nResearch functionality with o3 model and Exa integration will be implemented soon. This will search and compile comprehensive information on the topic.`
		};
	};

	const processTidyCommand = async (input: string): Promise<ToolResponse> => {
		// Demonstrate the approval system with a sample operation
		const approvalRequest: ApprovalRequest = {
			id: Date.now().toString(),
			type: 'edit',
			description: `Organize files based on: "${input}"`,
			content: `Sample operations that would be performed:
- Move untitled notes to "Inbox" folder
- Rename files with timestamps
- Create folder structure based on tags`,
			filePath: 'Multiple files'
		};

		// Return a message that requires approval
		return {
			success: true,
			message: 'I\'ve analyzed your vault structure. The following operations require your approval:',
			requiresApproval: true,
			approvalData: approvalRequest
		};
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSendMessage = async (content: string) => {
		if (!content.trim()) return;

		// Check if API key is set
		if (!plugin.settings.openaiApiKey) {
			new Notice('Please set your OpenAI API key in settings');
			return;
		}

		// Add user message
		const userMessage: ChatMessage = {
			id: Date.now().toString(),
			role: 'user',
			content,
			timestamp: Date.now(),
			status: 'complete'
		};

		setMessages(prev => [...prev, userMessage]);
		setIsProcessing(true);

		// Process the message
		try {
			// Regular chat message - for MVP, just echo back
			const assistantMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: 'Natural language chat processing will be implemented with OpenAI integration. For now, please use the command palette (Cmd/Ctrl+P) to access commands.',
				timestamp: Date.now(),
				status: 'complete'
			};
			setMessages(prev => [...prev, assistantMessage]);
		} catch (error) {
			console.error('Error processing message:', error);
			const errorMessage: ChatMessage = {
				id: (Date.now() + 1).toString(),
				role: 'assistant',
				content: `Error: ${error.message}`,
				timestamp: Date.now(),
				status: 'error',
				error: error.message
			};
			setMessages(prev => [...prev, errorMessage]);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleApprove = async (messageId: string) => {
		// Update the message status
		setMessages(prev => prev.map(msg => 
			msg.id === messageId 
				? { ...msg, approvalStatus: 'approved' as const }
				: msg
		));

		// Find the message and execute the approved action
		const message = messages.find(m => m.id === messageId);
		if (message?.approvalRequest) {
			// Execute the approved operation through ApprovalManager
			const result = await approvalManager.current.executeApprovedOperation(message.approvalRequest);
			
			// Add a follow-up message with the result
			const resultMessage: ChatMessage = {
				id: Date.now().toString(),
				role: 'assistant',
				content: result.message,
				timestamp: Date.now(),
				status: result.success ? 'complete' : 'error'
			};
			setMessages(prev => [...prev, resultMessage]);
		}
	};

	const handleReject = async (messageId: string) => {
		// Update the message status
		setMessages(prev => prev.map(msg => 
			msg.id === messageId 
				? { ...msg, approvalStatus: 'rejected' as const }
				: msg
		));

		// Add a follow-up message
		const resultMessage: ChatMessage = {
			id: Date.now().toString(),
			role: 'assistant',
			content: 'Operation cancelled.',
			timestamp: Date.now(),
			status: 'complete'
		};
		setMessages(prev => [...prev, resultMessage]);
	};

	const handleClearChat = () => {
		setMessages([]);
	};

	return (
		<div className="chat-assistant-interface">
			<div className="chat-header">
				<h3>Chat Assistant</h3>
				<button 
					className="chat-clear-button"
					onClick={handleClearChat}
					title="Clear chat"
				>
					Clear
				</button>
			</div>
			<div className="chat-messages">
				{messages.length === 0 && (
					<div className="chat-welcome">
						<p>Welcome to Chat Assistant!</p>
						<p>Use the Command Palette (Cmd/Ctrl+P) to access:</p>
						<ul>
							<li><strong>Analyse documents</strong> - AI-powered document analysis</li>
							<li><strong>Research topic</strong> - Research with o3 model and web search</li>
							<li><strong>Tidy files</strong> - Organize your vault structure</li>
						</ul>
						<p>Natural language chat coming soon!</p>
					</div>
				)}
				{messages.map((message) => (
					<MessageBubble 
						key={message.id} 
						message={message}
						onApprove={handleApprove}
						onReject={handleReject}
					/>
				))}
				{isProcessing && <ThinkingIndicator />}
				<div ref={messagesEndRef} />
			</div>
			<ChatInput 
				onSendMessage={handleSendMessage}
				isProcessing={isProcessing}
			/>
		</div>
	);
});