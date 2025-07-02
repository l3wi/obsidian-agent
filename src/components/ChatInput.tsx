import * as React from 'react';
import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
	onSendMessage: (message: string) => void;
	isProcessing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isProcessing }) => {
	const [input, setInput] = useState('');
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		if (input.trim() && !isProcessing) {
			onSendMessage(input);
			setInput('');
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const adjustTextareaHeight = () => {
		const textarea = inputRef.current;
		if (textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
		}
	};

	React.useEffect(() => {
		adjustTextareaHeight();
	}, [input]);

	return (
		<div className="chat-input-container">
			<textarea
				ref={inputRef}
				className="chat-input"
				placeholder="Type a message or command (e.g., /help)..."
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				disabled={isProcessing}
				rows={1}
			/>
			<button
				className="chat-send-button"
				onClick={handleSend}
				disabled={isProcessing || !input.trim()}
				title="Send message"
			>
				{isProcessing ? (
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2">
							<animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
						</circle>
					</svg>
				) : (
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M2 10L17 2L13 10L17 18L2 10Z" fill="currentColor" />
					</svg>
				)}
			</button>
		</div>
	);
};