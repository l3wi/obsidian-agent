import * as React from "react";

interface ToolApprovalProps {
	interruptions: any[];
	onApprove: (approvals: Map<string, boolean>) => void;
	onRejectAll: () => void;
}

export const ToolApprovalBubble: React.FC<ToolApprovalProps> = ({
	interruptions,
	onApprove,
	onRejectAll,
}) => {
	const handleApproveAll = () => {
		const allApproved = new Map<string, boolean>();
		interruptions.forEach((interruption) => {
			allApproved.set(interruption.id, true);
		});
		onApprove(allApproved);
	};

	return (
		<div className="tool-approval-bubble">
			<div className="tool-approval-header">
				<strong>Tool Approval Required</strong>
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
								<strong>{toolName}</strong>
							</div>
							<div className="tool-approval-details">
								{toolName === "write_file" && (
									<>
										<div>Path: {args.path}</div>
										<div>
											Content preview:{" "}
											{args.content?.substring(0, 100)}...
										</div>
									</>
								)}
								{toolName === "modify_note" && (
									<>
										<div>Path: {args.path}</div>
										<div>
											New content preview:{" "}
											{args.content?.substring(0, 100)}...
										</div>
									</>
								)}
								{toolName === "search_vault" && (
									<div>Query: {args.query}</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
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
		</div>
	);
};
