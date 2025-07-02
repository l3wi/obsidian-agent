import * as React from 'react';
import { ChatMessage } from '../types';
import { ApprovalBubble } from './ApprovalBubble';

interface MessageBubbleProps {
	message: ChatMessage;
	onApprove?: (messageId: string) => void;
	onReject?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onApprove, onReject }) => {
	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className={`message-bubble message-${message.role}`}>
			<div className="message-content">
				{message.content.split('\n').map((line, i) => (
					<React.Fragment key={i}>
						{line}
						{i < message.content.split('\n').length - 1 && <br />}
					</React.Fragment>
				))}
			</div>
			{message.approvalRequest && message.approvalStatus === 'pending' && onApprove && onReject && (
				<ApprovalBubble
					message={message.approvalRequest.description}
					details={message.approvalRequest.content}
					onApprove={() => onApprove(message.id)}
					onReject={() => onReject(message.id)}
				/>
			)}
			{message.approvalStatus && message.approvalStatus !== 'pending' && (
				<div className={`approval-status-indicator ${message.approvalStatus}`}>
					{message.approvalStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
				</div>
			)}
			<div className="message-metadata">
				<span className="message-time">{formatTimestamp(message.timestamp)}</span>
				{message.status === 'error' && (
					<span className="message-status error">• Error</span>
				)}
				{message.status === 'streaming' && (
					<span className="message-status streaming">• Streaming</span>
				)}
			</div>
		</div>
	);
};