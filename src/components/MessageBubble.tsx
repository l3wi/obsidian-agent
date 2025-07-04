import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import { ApprovalBubble } from "./ApprovalBubble";
import { MarkdownRenderer, Component } from "obsidian";
import { ToolApprovalBubble } from "./ToolApprovalBubble";

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

	useEffect(() => {
		if (contentRef.current) {
			// Clear existing content
			contentRef.current.innerHTML = "";

			// Create a temporary component for rendering
			const tempComponent = new Component();

			// Render markdown
			MarkdownRenderer.renderMarkdown(
				message.content,
				contentRef.current,
				"",
				tempComponent
			);

			// Cleanup
			return () => {
				tempComponent.unload();
			};
		}
	}, [message.content]);

	// Check if this is a tool-only message (no content, just approvals)
	const isToolOnlyMessage = !message.content && (
		(message.streamResult?.interruptions && message.streamResult.interruptions.length > 0) ||
		message.approvalRequest
	);

	// Don't render anything if there's no content and no approval info
	if (!message.content && !message.streamResult?.interruptions?.length && !message.approvalRequest) {
		return null;
	}

	return (
		<div className={`message-bubble message-${message.role} ${isToolOnlyMessage ? 'tool-only' : ''}`}>
			<div className="message-content-wrapper">
				{message.content && (
					<div className="message-text" ref={contentRef}>
						{/* Markdown content will be rendered here */}
					</div>
				)}
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
				{message.streamResult?.interruptions &&
					message.streamResult.interruptions.length > 0 &&
					message.approvalStatus === "pending" &&
					onToolApproval && (
						<ToolApprovalBubble
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
				{message.approvalRequest &&
					message.approvalStatus === "pending" &&
					onApprove &&
					onReject &&
					(!message.streamResult ||
						!message.streamResult.interruptions) && (
						<ApprovalBubble
							message={message.approvalRequest.description}
							details={message.approvalRequest.content}
							onApprove={() => onApprove(message.id)}
							onReject={() => onReject(message.id)}
						/>
					)}
				{message.approvalStatus &&
					message.approvalStatus !== "pending" &&
					message.streamResult?.interruptions &&
					message.streamResult.interruptions.length > 0 && (
						<ToolApprovalBubble
							interruptions={message.streamResult.interruptions}
							onApprove={() => {}} // No-op for display only
							onRejectAll={() => {}} // No-op for display only
							showStatus={message.approvalStatus}
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
