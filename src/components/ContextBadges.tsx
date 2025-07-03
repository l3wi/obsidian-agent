import * as React from 'react';
import { TFile } from 'obsidian';

interface ContextBadgesProps {
	files: TFile[];
	onRemoveFile: (file: TFile) => void;
}

export const ContextBadges: React.FC<ContextBadgesProps> = ({ files, onRemoveFile }) => {
	if (files.length === 0) {
		return null;
	}

	return (
		<div className="context-badges-container">
			{files.map(file => (
				<div key={file.path} className="context-badge">
					<span className="context-badge-name">{file.name}</span>
					<button
						className="context-badge-remove"
						onClick={() => onRemoveFile(file)}
						title="Remove from context"
					>
						×
					</button>
				</div>
			))}
		</div>
	);
};
