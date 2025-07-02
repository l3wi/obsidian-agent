import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import ObsidianChatAssistant from '../main';
import { Notice } from 'obsidian';
import { ToolRouter } from '../core/ToolRouter';
import { ApprovalManager } from '../managers/ApprovalManager';

interface ChatInterfaceProps {
	plugin: ObsidianChatAssistant;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ plugin }) => {
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
			// Check if it's a command
			if (content.startsWith('/')) {
				// Route the command through ToolRouter
				const result = await toolRouter.current.routeCommand(content);
				
				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: result.message,
					timestamp: Date.now(),
					status: result.success ? 'complete' : 'error',
					error: result.success ? undefined : result.message
				};
				setMessages(prev => [...prev, assistantMessage]);
			} else {
				// Regular chat message - for MVP, just echo back
				const assistantMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: 'Chat processing will be implemented in Version 1 with OpenAI integration.',
					timestamp: Date.now(),
					status: 'complete'
				};
				setMessages(prev => [...prev, assistantMessage]);
			}
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
						<p>Try these commands:</p>
						<ul>
							<li><code>/note My New Note</code> - Create a note</li>
							<li><code>/search keyword</code> - Search your vault</li>
							<li><code>/help</code> - Show all commands</li>
						</ul>
					</div>
				)}
				{messages.map((message) => (
					<MessageBubble key={message.id} message={message} />
				))}
				<div ref={messagesEndRef} />
			</div>
			<ChatInput 
				onSendMessage={handleSendMessage}
				isProcessing={isProcessing}
			/>
		</div>
	);
};