import * as React from 'react';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChatMessage, ApprovalRequest, ToolResponse } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ToolApprovalBubble } from './ToolApprovalBubble';
import ObsidianChatAssistant from '../main';
import { Notice } from 'obsidian';
import { ToolRouter } from '../core/ToolRouter';
import { ApprovalManager } from '../managers/ApprovalManager';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';

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
	
	// Initialize agent orchestrator
	const agentOrchestrator = useRef<AgentOrchestrator | null>(null);
	
	useEffect(() => {
		if (plugin.settings.openaiApiKey) {
			agentOrchestrator.current = new AgentOrchestrator(plugin.app, plugin.settings.openaiApiKey, plugin.settings.model);
		}
	}, [plugin.settings.openaiApiKey, plugin.settings.model]);

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
		if (!agentOrchestrator.current) {
			return {
				success: false,
				message: 'Please set your OpenAI API key in settings to use AI features.'
			};
		}

		try {
			// For commands, we'll collect the full response before returning
			let fullResponse = '';
			const result = await agentOrchestrator.current.processCommandStream(
				'analyse', 
				input,
				(chunk) => {
					fullResponse += chunk;
					// Could update a temporary message here if needed
				}
			);
			return {
				success: true,
				message: result.response,
				requiresApproval: result.requiresApproval,
				approvalData: result.approvalData
			};
		} catch (error) {
			return {
				success: false,
				message: `Error: ${error.message}`
			};
		}
	};

	const processResearchCommand = async (input: string): Promise<ToolResponse> => {
		if (!agentOrchestrator.current) {
			return {
				success: false,
				message: 'Please set your OpenAI API key in settings to use AI features.'
			};
		}

		try {
			let fullResponse = '';
			const result = await agentOrchestrator.current.processCommandStream(
				'research', 
				input,
				(chunk) => {
					fullResponse += chunk;
				}
			);
			return {
				success: true,
				message: result.response,
				requiresApproval: result.requiresApproval,
				approvalData: result.approvalData
			};
		} catch (error) {
			return {
				success: false,
				message: `Error: ${error.message}`
			};
		}
	};

	const processTidyCommand = async (input: string): Promise<ToolResponse> => {
		if (!agentOrchestrator.current) {
			return {
				success: false,
				message: 'Please set your OpenAI API key in settings to use AI features.'
			};
		}

		try {
			let fullResponse = '';
			const result = await agentOrchestrator.current.processCommandStream(
				'tidy', 
				input,
				(chunk) => {
					fullResponse += chunk;
				}
			);
			return {
				success: true,
				message: result.response,
				requiresApproval: result.requiresApproval,
				approvalData: result.approvalData
			};
		} catch (error) {
			return {
				success: false,
				message: `Error: ${error.message}`
			};
		}
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
			if (!agentOrchestrator.current) {
				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: 'Please set your OpenAI API key in settings to use chat features.',
					timestamp: Date.now(),
					status: 'complete'
				};
				setMessages(prev => [...prev, assistantMessage]);
				return;
			}

			// Create assistant message with streaming status
			const assistantMessageId = (Date.now() + 1).toString();
			const assistantMessage: ChatMessage = {
				id: assistantMessageId,
				role: 'assistant',
				content: '',
				timestamp: Date.now(),
				status: 'streaming'
			};
			setMessages(prev => [...prev, assistantMessage]);

			// Get all messages including the current user message
			const allMessages = [...messages, userMessage];
			
			// Process through agent orchestrator with streaming, including history
			const result = await agentOrchestrator.current.processMessagesWithHistoryStream(
				allMessages,
				(chunk) => {
					// Update message content as chunks arrive
					setMessages(prev => prev.map(msg => 
						msg.id === assistantMessageId 
							? { ...msg, content: msg.content + chunk }
							: msg
					));
				},
				(toolName, args) => {
					// Optional: Handle tool calls (e.g., show which tool is being used)
					console.log(`Using tool: ${toolName}`, args);
				}
			);
			
			// Update final message with complete status and approval data
			setMessages(prev => prev.map(msg => 
				msg.id === assistantMessageId 
					? { 
						...msg, 
						content: result.response,
						status: 'complete',
						approvalRequest: result.approvalData,
						approvalStatus: result.requiresApproval ? 'pending' : undefined,
						streamResult: result.stream
					}
					: msg
			));
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

	const handleToolApproval = async (messageId: string, approvals: Map<string, boolean>) => {
		// Update the message status
		setMessages(prev => prev.map(msg => 
			msg.id === messageId 
				? { ...msg, approvalStatus: 'approved' as const }
				: msg
		));

		// Find the message with the stream result
		const message = messages.find(m => m.id === messageId);
		if (message?.streamResult && agentOrchestrator.current) {
			setIsProcessing(true);
			try {
				// Create a new message for the resumed response
				const resumedMessageId = Date.now().toString();
				const resumedMessage: ChatMessage = {
					id: resumedMessageId,
					role: 'assistant',
					content: '',
					timestamp: Date.now(),
					status: 'streaming'
				};
				setMessages(prev => [...prev, resumedMessage]);

				// Handle the approval with streaming
				const result = await agentOrchestrator.current.handleStreamApproval(
					message.streamResult,
					approvals,
					(chunk) => {
						// Update message content as chunks arrive
						setMessages(prev => prev.map(msg => 
							msg.id === resumedMessageId 
								? { ...msg, content: msg.content + chunk }
								: msg
						));
					}
				);

				// Update final message
				setMessages(prev => prev.map(msg => 
					msg.id === resumedMessageId 
						? { 
							...msg, 
							content: result.response,
							status: 'complete',
							approvalRequest: result.approvalData,
							approvalStatus: result.requiresApproval ? 'pending' : undefined,
							streamResult: result.stream
						}
						: msg
				));
			} catch (error) {
				console.error('Error handling tool approval:', error);
				new Notice('Error processing tool approval');
			} finally {
				setIsProcessing(false);
			}
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
		if (message?.approvalRequest && agentOrchestrator.current) {
			try {
				const result = await agentOrchestrator.current.handleApproval(true, message.approvalRequest);
				
				const resultMessage: ChatMessage = {
					id: Date.now().toString(),
					role: 'assistant',
					content: result,
					timestamp: Date.now(),
					status: 'complete'
				};
				setMessages(prev => [...prev, resultMessage]);
			} catch (error) {
				// Fallback to approval manager
				const result = await approvalManager.current.executeApprovedOperation(message.approvalRequest);
				
				const resultMessage: ChatMessage = {
					id: Date.now().toString(),
					role: 'assistant',
					content: result.message,
					timestamp: Date.now(),
					status: result.success ? 'complete' : 'error'
				};
				setMessages(prev => [...prev, resultMessage]);
			}
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
						<p>Welcome to Obsidian Chat Assistant!</p>
						<p>I'm Alex, your AI conductor. I can help you with:</p>
						<ul>
							<li><strong>Research</strong> - Search your vault and the web for information</li>
							<li><strong>Analysis</strong> - Analyze documents and provide insights</li>
							<li><strong>Organization</strong> - Create, edit, and organize your notes</li>
						</ul>
						<p>You can chat naturally with me or use the Command Palette (Cmd/Ctrl+P) for specific tasks.</p>
						<p className="chat-welcome-note">Make sure to set your OpenAI API key in settings to get started!</p>
					</div>
				)}
				{messages.map((message) => (
					<MessageBubble 
						key={message.id} 
						message={message}
						onApprove={handleApprove}
						onReject={handleReject}
						onToolApproval={handleToolApproval}
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