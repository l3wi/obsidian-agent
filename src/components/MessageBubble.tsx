import * as React from 'react';
import { ChatMessage } from '../types';

interface MessageBubbleProps {
	message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	return (
		<div className={`message-bubble message-${message.role}`}>
			<div className="message-content">
				{message.content}
			</div>
			<div className="message-metadata">
				<span className="message-time">{formatTimestamp(message.timestamp)}</span>
				{message.status === 'error' && (
					<span className="message-status error">Error</span>
				)}
				{message.status === 'streaming' && (
					<span className="message-status streaming">...</span>
				)}
			</div>
		</div>
	);
};