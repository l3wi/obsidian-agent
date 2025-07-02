import * as React from 'react';
import { useState } from 'react';

interface ApprovalBubbleProps {
	message: string;
	details?: string;
	onApprove: () => void;
	onReject: () => void;
}

export const ApprovalBubble: React.FC<ApprovalBubbleProps> = ({
	message,
	details,
	onApprove,
	onReject
}) => {
	const [isProcessing, setIsProcessing] = useState(false);
	const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);

	const handleApprove = async () => {
		setIsProcessing(true);
		setDecision('approved');
		await onApprove();
		setIsProcessing(false);
	};

	const handleReject = async () => {
		setIsProcessing(true);
		setDecision('rejected');
		await onReject();
		setIsProcessing(false);
	};

	if (decision) {
		return (
			<div className={`approval-bubble ${decision}`}>
				<div className="approval-status">
					{decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
				</div>
			</div>
		);
	}

	return (
		<div className="approval-bubble pending">
			<div className="approval-message">{message}</div>
			{details && (
				<div className="approval-details">
					<pre>{details}</pre>
				</div>
			)}
			<div className="approval-actions">
				<button
					className="approval-button approve"
					onClick={handleApprove}
					disabled={isProcessing}
				>
					{isProcessing ? '...' : 'Approve'}
				</button>
				<button
					className="approval-button reject"
					onClick={handleReject}
					disabled={isProcessing}
				>
					{isProcessing ? '...' : 'Reject'}
				</button>
			</div>
		</div>
	);
};