import * as React from 'react';

export const ThinkingIndicator: React.FC = () => {
	return (
		<div className="message-bubble message-assistant">
			<div className="thinking-indicator">
				<div className="thinking-dots">
					<div className="thinking-dot"></div>
					<div className="thinking-dot"></div>
					<div className="thinking-dot"></div>
				</div>
			</div>
		</div>
	);
};