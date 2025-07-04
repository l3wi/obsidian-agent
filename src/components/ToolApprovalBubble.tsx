import * as React from "react";
import { ToolCallIdGenerator } from "../tools/utils/ToolCallIdGenerator";

interface ToolApprovalProps {
	interruptions: any[];
	onApprove: (approvals: Map<string, boolean>) => void;
	onRejectAll: () => void;
	showStatus?: 'approved' | 'rejected';
}

export const ToolApprovalBubble: React.FC<ToolApprovalProps> = ({
	interruptions,
	onApprove,
	onRejectAll,
	showStatus,
}) => {
	// Debug log to see the structure
	console.log('ToolApprovalBubble interruptions:', interruptions);
	const handleApproveAll = () => {
		console.log('[ToolApprovalBubble] handleApproveAll clicked');
		console.log('[ToolApprovalBubble] interruptions:', interruptions);
		
		const allApproved = new Map<string, boolean>();
		interruptions.forEach((interruption) => {
			// Use standardized ID extraction
			const id = ToolCallIdGenerator.extractFromInterruption(interruption);
			
			console.log('[ToolApprovalBubble] Processing interruption for approval:', {
				id,
				hasId: !!id,
				interruptionType: interruption.type,
				rawItemName: interruption.rawItem?.name
			});
			
			if (id) {
				allApproved.set(id, true);
			} else {
				console.error('Failed to extract ID from interruption:', interruption);
			}
		});
		
		console.log('[ToolApprovalBubble] Calling onApprove with approvals:', {
			approvalCount: allApproved.size,
			approvals: Array.from(allApproved.entries())
		});
		
		onApprove(allApproved);
	};

	// Format tool names for display
	const formatToolName = (toolName: string): string => {
		const nameMap: Record<string, string> = {
			create_note: "Create",
			modify_note: "Modify",
			delete_file: "Delete",
			create_folder: "Create Folder",
			copy_file: "Copy",
			search_vault: "Search",
			write_file: "Write",
		};
		return nameMap[toolName] || toolName;
	};

	return (
		<div className="tool-approval-bubble">
			<div className="tool-approval-header">
				<strong>{showStatus ? 'Tool Execution Summary' : 'Tool Approval Required'}</strong>
			</div>
			<div className="tool-approval-list">
				{interruptions.map((interruption) => {
					// Use standardized extraction methods
					const toolName = ToolCallIdGenerator.extractToolName(interruption) || "Unknown tool";
					const args = ToolCallIdGenerator.extractArguments(interruption);
					
					// Log to understand structure
					console.log('Processing interruption:', interruption);
					
					// Get the ID for the key using standardized extraction
					const interruptionId = ToolCallIdGenerator.extractFromInterruption(interruption) || 
						Math.random().toString();

					return (
						<div
							key={interruptionId}
							className="tool-approval-item"
						>
							<div className="tool-approval-info">
								<strong>{formatToolName(toolName)}</strong>
							</div>
							<div className="tool-approval-details">
								{(toolName === "write_file" || 
								  toolName === "create_note" || 
								  toolName === "modify_note" || 
								  toolName === "delete_file" || 
								  toolName === "create_folder" || 
								  toolName === "copy_file") && args.path && (
									<div>Path: {args.path}</div>
								)}
								{toolName === "copy_file" && args.destinationPath && (
									<div>Destination: {args.destinationPath}</div>
								)}
								{toolName === "search_vault" && args.query && (
									<div>Query: {args.query}</div>
								)}
								{(toolName === "modify_note" || toolName === "create_note") && args.content && (
									<div className="tool-approval-content-preview">
										<div>Content preview:</div>
										<pre>{args.content.substring(0, 200)}{args.content.length > 200 ? '...' : ''}</pre>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
			{showStatus ? (
				<div className="tool-approval-status">
					<div className={`approval-status-badge ${showStatus}`}>
						{showStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
					</div>
				</div>
			) : (
				<div className="tool-approval-actions">
					<button
						className="approval-button approve"
						onClick={handleApproveAll}
					>
						Approve All
					</button>
					<button
						className="approval-button reject"
						onClick={onRejectAll}
					>
						Reject All
					</button>
				</div>
			)}
		</div>
	);
};
