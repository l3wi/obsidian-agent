import * as React from "react";

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
	const handleApproveAll = () => {
		const allApproved = new Map<string, boolean>();
		interruptions.forEach((interruption) => {
			allApproved.set(interruption.id, true);
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
					// Handle both manually created interruptions and SDK interruptions
					let toolName = "Unknown tool";
					let args: any = {};
					
					if (interruption.rawItem) {
						// Manually created interruption from ChatInterface
						toolName = interruption.rawItem.name;
						// Parse arguments if they're a JSON string
						const rawArgs = interruption.rawItem.arguments;
						if (typeof rawArgs === 'string') {
							try {
								args = JSON.parse(rawArgs);
							} catch {
								args = { raw: rawArgs };
							}
						} else {
							args = rawArgs || {};
						}
					} else if (interruption.item) {
						// SDK interruption structure
						toolName = interruption.item.name || "Unknown tool";
						const rawArgs = interruption.item.arguments;
						if (typeof rawArgs === 'string') {
							try {
								args = JSON.parse(rawArgs);
							} catch {
								args = { raw: rawArgs };
							}
						} else {
							args = rawArgs || {};
						}
					} else if (interruption.name) {
						// Direct structure
						toolName = interruption.name;
						const rawArgs = interruption.arguments;
						if (typeof rawArgs === 'string') {
							try {
								args = JSON.parse(rawArgs);
							} catch {
								args = { raw: rawArgs };
							}
						} else {
							args = rawArgs || {};
						}
					}

					return (
						<div
							key={interruption.id}
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
