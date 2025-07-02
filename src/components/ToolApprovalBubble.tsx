import * as React from 'react';

interface ToolApprovalProps {
	interruptions: any[];
	onApprove: (approvals: Map<string, boolean>) => void;
	onRejectAll: () => void;
}

export const ToolApprovalBubble: React.FC<ToolApprovalProps> = ({ 
	interruptions, 
	onApprove, 
	onRejectAll 
}) => {
	const [approvals, setApprovals] = React.useState<Map<string, boolean>>(new Map());

	const handleToggle = (id: string) => {
		const newApprovals = new Map(approvals);
		newApprovals.set(id, !newApprovals.get(id));
		setApprovals(newApprovals);
	};

	const handleSubmit = () => {
		// Set any unset approvals to false
		const finalApprovals = new Map(approvals);
		interruptions.forEach(interruption => {
			if (!finalApprovals.has(interruption.id)) {
				finalApprovals.set(interruption.id, false);
			}
		});
		onApprove(finalApprovals);
	};

	const handleApproveAll = () => {
		const allApproved = new Map<string, boolean>();
		interruptions.forEach(interruption => {
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
					const toolName = interruption.rawItem?.name || 'Unknown tool';
					const args = interruption.rawItem?.arguments || {};
					const isApproved = approvals.get(interruption.id) ?? false;
					
					return (
						<div key={interruption.id} className="tool-approval-item">
							<div className="tool-approval-toggle">
								<input
									type="checkbox"
									id={`approval-${interruption.id}`}
									checked={isApproved}
									onChange={() => handleToggle(interruption.id)}
								/>
								<label htmlFor={`approval-${interruption.id}`}>
									<strong>{toolName}</strong>
								</label>
							</div>
							<div className="tool-approval-details">
								{toolName === 'create_note' && (
									<>
										<div>Path: {args.path}</div>
										<div>Content preview: {args.content?.substring(0, 100)}...</div>
									</>
								)}
								{toolName === 'modify_note' && (
									<>
										<div>Path: {args.path}</div>
										<div>New content preview: {args.content?.substring(0, 100)}...</div>
									</>
								)}
								{toolName === 'search_vault' && (
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
					className="approval-button"
					onClick={handleSubmit}
				>
					Submit Selected
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