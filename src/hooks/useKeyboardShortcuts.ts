import { useEffect, useCallback } from 'react';

type KeyboardShortcuts = Record<string, () => void>;

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts) => {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Build the key combination string
			const keys: string[] = [];
			
			if (event.metaKey || event.ctrlKey) keys.push('cmd');
			if (event.shiftKey) keys.push('shift');
			if (event.altKey) keys.push('alt');
			
			// Handle special keys
			let key = event.key.toLowerCase();
			if (key === 'enter') key = 'enter';
			else if (key === 'escape') key = 'escape';
			else if (key === ' ') key = 'space';
			else if (key === 'arrowup') key = 'up';
			else if (key === 'arrowdown') key = 'down';
			
			keys.push(key);
			
			const keyCombo = keys.join('+');
			
			// Check if we have a handler for this key combination
			if (shortcuts[keyCombo]) {
				event.preventDefault();
				event.stopPropagation();
				shortcuts[keyCombo]();
			}
		},
		[shortcuts]
	);
	
	useEffect(() => {
		// Add event listener
		document.addEventListener('keydown', handleKeyDown);
		
		// Cleanup
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [handleKeyDown]);
};