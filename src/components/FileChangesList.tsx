import * as React from 'react';

interface FileChange {
	type: 'create' | 'modify' | 'delete' | 'create_folder' | 'copy';
	path: string;
	destinationPath?: string;
	additions?: number;
	deletions?: number;
}

interface FileChangesListProps {
	changes: FileChange[];
}

export const FileChangesList: React.FC<FileChangesListProps> = ({ changes }) => {
	const getChangeIcon = (type: FileChange['type']) => {
		switch (type) {
			case 'create':
				return '➕';
			case 'modify':
				return '✏️';
			case 'delete':
				return '🗑️';
			case 'create_folder':
				return '📁';
			case 'copy':
				return '📋';
			default:
				return '•';
		}
	};

	const getChangeDescription = (change: FileChange) => {
		switch (change.type) {
			case 'create':
				return `New file: ${change.path}`;
			case 'modify':
				if (change.additions !== undefined || change.deletions !== undefined) {
					const parts = [`Modified: ${change.path}`];
					if (change.additions) parts.push(`+${change.additions}`);
					if (change.deletions) parts.push(`-${change.deletions}`);
					return parts.join(' ');
				}
				return `Modified: ${change.path}`;
			case 'delete':
				return `Removed: ${change.path}`;
			case 'create_folder':
				return `New folder: ${change.path}`;
			case 'copy':
				return `Copied: ${change.path} → ${change.destinationPath}`;
			default:
				return change.path;
		}
	};

	if (!changes || changes.length === 0) {
		return null;
	}

	return (
		<div className="file-changes-list">
			<div className="file-changes-header">Vault Changes</div>
			<ul className="file-changes-items">
				{changes.map((change, index) => (
					<li key={index} className={`file-change-item file-change-${change.type}`}>
						<span className="file-change-icon">{getChangeIcon(change.type)}</span>
						<span className="file-change-description">{getChangeDescription(change)}</span>
					</li>
				))}
			</ul>
		</div>
	);
};