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
			>
				{isProcessing ? '...' : 'Send'}
			</button>
		</div>
	);
};