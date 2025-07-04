import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { ChatMessage, MessageSegment } from "../types";
import { MarkdownRenderer, Component } from "obsidian";
import { EnhancedToolApproval } from "./EnhancedToolApproval";

interface MessageBubbleProps {
	message: ChatMessage;
	onApprove?: (messageId: string) => void;
	onReject?: (messageId: string) => void;
	onToolApproval?: (
		messageId: string,
		approvals: Map<string, boolean>
	) => void;
	isThinking?: boolean;
	toolName?: string;
	toolHistory?: string[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
	message,
	onApprove,
	onReject,
	onToolApproval,
	isThinking,
	toolName,
	toolHistory,
}) => {
	const [isCopied, setIsCopied] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	// Get human-readable status message for tools
	const getToolStatusMessage = (tool: string): string => {
		// Check if tool includes filename (format: "tool_name: filename")
		if (tool.includes(': ')) {
			const [toolName, fileName] = tool.split(': ');
			const toolMessages: Record<string, string> = {
				create_note: `Creating note "${fileName}"...`,
				modify_note: `Modifying note "${fileName}"...`,
				delete_file: `Deleting file "${fileName}"...`,
				create_folder: `Creating folder "${fileName}"...`,
				copy_file: `Copying file "${fileName}"...`,
			};
			return toolMessages[toolName] || `Using ${tool}...`;
		}
		
		// Fallback for tools without filenames
		const toolMessages: Record<string, string> = {
			create_note: "Creating note...",
			modify_note: "Modifying note...",
			delete_file: "Deleting file...",
			create_folder: "Creating folder...",
			copy_file: "Copying file...",
			search_vault: "Searching vault...",
			web_search: "Searching the web...",
			code_interpreter: "Running code analysis...",
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
			// Clean up tool name - handle both formats
			let displayName = tool;
			if (tool.includes(': ')) {
				// Extract just the action and filename
				const [toolName, fileName] = tool.split(': ');
				displayName = `${toolName.replace(/_/g, " ")} ${fileName}`;
			} else {
				displayName = tool.replace(/_/g, " ");
			}
			
			if (count > 1) {
				summaryParts.push(`${displayName} (${count}x)`);
			} else {
				summaryParts.push(displayName);
			}
		});

		if (summaryParts.length === 0) return null;
		return `Actions: ${summaryParts.join(", ")}`;
	};

	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.content);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	// Render markdown content for a given text
	const renderMarkdownContent = (text: string, targetElement: HTMLElement) => {
		const tempComponent = new Component();
		targetElement.innerHTML = "";
		MarkdownRenderer.renderMarkdown(
			text,
			targetElement,
			"",
			tempComponent
		);
		return tempComponent;
	};

	useEffect(() => {
		const components: Component[] = [];

		// Render main content if no segments
		if (!message.segments || message.segments.length === 0) {
			if (contentRef.current && message.content) {
				const component = renderMarkdownContent(message.content, contentRef.current);
				components.push(component);
			}
		}

		// Cleanup
		return () => {
			components.forEach(c => c.unload());
		};
	}, [message.content, message.segments]);

	// Check if this is a tool-only message (no content, just approvals)
	const isToolOnlyMessage = !message.content && (
		(message.streamResult?.interruptions && message.streamResult.interruptions.length > 0) ||
		message.approvalRequest
	);

	// Don't render anything if there's no content and no approval info
	if (!message.content && !message.streamResult?.interruptions?.length && !message.approvalRequest) {
		return null;
	}

	// Render a single segment
	const renderSegment = (segment: MessageSegment) => {
		if (segment.type === 'text' || segment.type === 'continuation') {
			return (
				<div key={segment.id} className="message-segment text-segment">
					<div 
						className="segment-content" 
						ref={(el) => {
							if (el && segment.content) {
								renderMarkdownContent(segment.content, el);
							}
						}}
					/>
				</div>
			);
		} else if (segment.type === 'tool-approval' && segment.metadata) {
			const isPending = segment.metadata.approvalStatus === 'pending';
			const isApproved = segment.metadata.approvalStatus === 'approved';
			const isRejected = segment.metadata.approvalStatus === 'rejected';
			
			return (
				<div key={segment.id} className="message-segment tool-approval-segment">
					{segment.metadata.interruptions && (
						<EnhancedToolApproval
							interruptions={segment.metadata.interruptions}
							onApprove={isPending && onToolApproval ? 
								(approvals) => onToolApproval(message.id, approvals) : 
								() => {}
							}
							onRejectAll={isPending && onReject ? 
								() => onReject(message.id) : 
								() => {}
							}
							showStatus={isApproved ? 'approved' : isRejected ? 'rejected' : undefined}
						/>
					)}
				</div>
			);
		}
		return null;
	};

	return (
		<div className={`message-bubble message-${message.role} ${isToolOnlyMessage ? 'tool-only' : ''}`}>
			<div className="message-content-wrapper">
				{/* Render segments if available */}
				{message.segments && message.segments.length > 0 ? (
					<div className="message-segments">
						{message.segments.map(segment => renderSegment(segment))}
					</div>
				) : (
					/* Otherwise render content normally */
					message.content && (
						<div className="message-text" ref={contentRef}>
							{/* Markdown content will be rendered here */}
						</div>
					)
				)}
				
				{/* Show streaming indicator */}
				{message.status === "streaming" && isThinking && (
					<div className="thinking-indicator">
						<div className="thinking-status">
							{toolName
								? getToolStatusMessage(toolName)
								: "Thinking..."}
						</div>
						{getActionSummary() && (
							<div className="thinking-summary">
								{getActionSummary()}
							</div>
						)}
					</div>
				)}
				
				{/* Legacy approval handling for messages without segments */}
				{!message.segments && message.streamResult?.interruptions &&
					message.streamResult.interruptions.length > 0 &&
					message.approvalStatus === "pending" &&
					onToolApproval && (
						<EnhancedToolApproval
							interruptions={message.streamResult.interruptions}
							onApprove={(approvals) => {
								console.log('[MessageBubble] ToolApprovalBubble onApprove callback triggered:', {
									messageId: message.id,
									approvals: Array.from(approvals.entries()),
									hasOnToolApproval: !!onToolApproval
								});
								onToolApproval(message.id, approvals);
							}}
							onRejectAll={() => onReject && onReject(message.id)}
						/>
					)}
			</div>

			<div className="message-metadata">
				<span className="message-time">
					{formatTimestamp(message.timestamp)}
				</span>
				{message.status === "error" && (
					<span className="message-status error">• Error</span>
				)}
				{message.status === "streaming" && (
					<span className="message-status streaming">
						• Streaming
					</span>
				)}
				<button
					className={`message-copy-button ${
						isCopied ? "copied" : ""
					}`}
					onClick={handleCopy}
					title={isCopied ? "Copied!" : "Copy message"}
				>
					{isCopied ? (
						<svg
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M13.5 4.5L6 12L2.5 8.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					) : (
						<svg
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect
								x="6"
								y="6"
								width="8"
								height="8"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.2"
							/>
							<rect
								x="2"
								y="2"
								width="8"
								height="8"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.2"
								fill="none"
							/>
						</svg>
					)}
				</button>
			</div>
		</div>
	);
};
