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
			create_note: "Create Note",
			modify_note: "Modify Note",
			delete_file: "Delete File",
			create_folder: "Create Folder",
			copy_file: "Copy File",
			search_vault: "Search Vault",
			write_file: "Write File",
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
					const toolName =
						interruption.rawItem?.name || "Unknown tool";
					const args = interruption.rawItem?.arguments || {};

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
