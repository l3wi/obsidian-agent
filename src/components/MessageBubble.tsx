import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { ApprovalBubble } from './ApprovalBubble';
import { MarkdownRenderer, Component } from 'obsidian';
import { ToolApprovalBubble } from './ToolApprovalBubble';
import { FileChangesList } from './FileChangesList';

interface MessageBubbleProps {
	message: ChatMessage;
	onApprove?: (messageId: string) => void;
	onReject?: (messageId: string) => void;
	onToolApproval?: (messageId: string, approvals: Map<string, boolean>) => void;
	isThinking?: boolean;
	toolName?: string;
	toolHistory?: string[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onApprove, onReject, onToolApproval, isThinking, toolName, toolHistory }) => {
	const [isHovered, setIsHovered] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	// Get human-readable status message for tools
	const getToolStatusMessage = (tool: string): string => {
		const toolMessages: Record<string, string> = {
			'create_note': 'Creating note...',
			'modify_note': 'Modifying note...',
			'delete_file': 'Deleting file...',
			'create_folder': 'Creating folder...',
			'copy_file': 'Copying file...',
			'search_vault': 'Searching vault...',
			'web_search': 'Searching the web...',
			'code_interpreter': 'Running code analysis...'
		};
		return toolMessages[tool] || `Using ${tool}...`;
	};

	// Get action summary from tool history
	const getActionSummary = (): string | null => {
		if (!toolHistory || toolHistory.length === 0) return null;
		
		// Count occurrences of each tool
		const toolCounts = toolHistory.reduce((acc, tool) => {
			acc[tool] = (acc[tool] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);
		
		// Generate summary
		const summaryParts: string[] = [];
		Object.entries(toolCounts).forEach(([tool, count]) => {
			const toolName = tool.replace(/_/g, ' ');
			if (count > 1) {
				summaryParts.push(`${toolName} (${count}x)`);
			} else {
				summaryParts.push(toolName);
			}
		});
		
		if (summaryParts.length === 0) return null;
		return `Actions: ${summaryParts.join(', ')}`;
	};

	// Extract file changes from approved tools
	const getFileChanges = () => {
		if (!message.streamResult?.interruptions || message.approvalStatus !== 'approved') {
			return [];
		}

		const changes: any[] = [];
		message.streamResult.interruptions.forEach((interruption: any) => {
			const toolName = interruption.rawItem?.name;
			const args = interruption.rawItem?.arguments || {};

			switch (toolName) {
				case 'create_note':
					changes.push({
						type: 'create',
						path: args.path
					});
					break;
				case 'modify_note':
					changes.push({
						type: 'modify',
						path: args.path
					});
					break;
				case 'delete_file':
					changes.push({
						type: 'delete',
						path: args.path
					});
					break;
				case 'create_folder':
					changes.push({
						type: 'create_folder',
						path: args.path
					});
					break;
				case 'copy_file':
					changes.push({
						type: 'copy',
						path: args.sourcePath,
						destinationPath: args.destinationPath
					});
					break;
			}
		});

		return changes;
	};

	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	};

	useEffect(() => {
		if (contentRef.current) {
			// Clear existing content
			contentRef.current.innerHTML = '';
			
			// Create a temporary component for rendering
			const tempComponent = new Component();
			
			// Render markdown
			MarkdownRenderer.renderMarkdown(
				message.content,
				contentRef.current,
				'',
				tempComponent
			);
			
			// Cleanup
			return () => {
				tempComponent.unload();
			};
		}
	}, [message.content]);

	return (
		<div 
			className={`message-bubble message-${message.role}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{isThinking ? (
				<div className="thinking-indicator">
					<div className="thinking-status">
						{toolName ? getToolStatusMessage(toolName) : 'Thinking...'}
					</div>
					{getActionSummary() && (
						<div className="thinking-summary">
							{getActionSummary()}
						</div>
					)}
					<div className="thinking-dots">
						<div className="thinking-dot"></div>
						<div className="thinking-dot"></div>
						<div className="thinking-dot"></div>
					</div>
				</div>
			) : (
				<div className="message-content" ref={contentRef}>
					{/* Markdown content will be rendered here */}
				</div>
			)}
			{message.streamResult?.interruptions && message.streamResult.interruptions.length > 0 && 
			 message.approvalStatus === 'pending' && onToolApproval && (
				<ToolApprovalBubble
					interruptions={message.streamResult.interruptions}
					onApprove={(approvals) => onToolApproval(message.id, approvals)}
					onRejectAll={() => onReject && onReject(message.id)}
				/>
			)}
			{message.approvalRequest && message.approvalStatus === 'pending' && onApprove && onReject && 
			 (!message.streamResult || !message.streamResult.interruptions) && (
				<ApprovalBubble
					message={message.approvalRequest.description}
					details={message.approvalRequest.content}
					onApprove={() => onApprove(message.id)}
					onReject={() => onReject(message.id)}
				/>
			)}
			{message.approvalStatus && message.approvalStatus !== 'pending' && (
				message.approvalStatus === 'approved' && getFileChanges().length > 0 ? (
					<FileChangesList changes={getFileChanges()} />
				) : (
					<div className={`approval-status-indicator ${message.approvalStatus}`}>
						{message.approvalStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
					</div>
				)
			)}
			<div className="message-metadata">
				<span className="message-time">{formatTimestamp(message.timestamp)}</span>
				{message.status === 'error' && (
					<span className="message-status error">• Error</span>
				)}
				{message.status === 'streaming' && (
					<span className="message-status streaming">• Streaming</span>
				)}
				<button
					className={`message-copy-button ${isCopied ? 'copied' : ''}`}
					onClick={handleCopy}
					title={isCopied ? 'Copied!' : 'Copy message'}
				>
					{isCopied ? (
						<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					) : (
						<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<rect x="5.5" y="5.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
							<path d="M3.5 10.5V2.5C3.5 1.94772 3.94772 1.5 4.5 1.5H12.5C13.0523 1.5 13.5 1.94772 13.5 2.5V3.5" stroke="currentColor" strokeWidth="1"/>
						</svg>
					)}
				</button>
			</div>
		</div>
	);
};