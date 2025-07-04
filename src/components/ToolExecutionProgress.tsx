import * as React from 'react';
import { useEffect, useState } from 'react';
import { useToolStore } from '../stores/toolStore';
import { ToolExecution } from '../stores/toolStore';

interface ToolExecutionProgressProps {
	executionIds: string[];
	onComplete?: () => void;
}

export const ToolExecutionProgress: React.FC<ToolExecutionProgressProps> = ({
	executionIds,
	onComplete,
}) => {
	const { toolHistory } = useToolStore();
	const [executions, setExecutions] = useState<ToolExecution[]>([]);
	
	useEffect(() => {
		const relevant = toolHistory.filter(t => executionIds.includes(t.id));
		setExecutions(relevant);
		
		// Check if all executions are complete
		const allComplete = relevant.length > 0 && relevant.every(e => 
			['completed', 'failed', 'rejected'].includes(e.status)
		);
		
		if (allComplete && onComplete) {
			onComplete();
		}
	}, [toolHistory, executionIds, onComplete]);
	
	const getStatusIcon = (status: ToolExecution['status']) => {
		switch (status) {
			case 'pending': return '⏳';
			case 'approved': return '✅';
			case 'rejected': return '❌';
			case 'executing': return '🔄';
			case 'completed': return '✓';
			case 'failed': return '⚠️';
			default: return '•';
		}
	};
	
	const getProgressPercentage = () => {
		if (executions.length === 0) return 0;
		const completed = executions.filter(e => 
			['completed', 'failed', 'rejected'].includes(e.status)
		).length;
		return (completed / executions.length) * 100;
	};
	
	const formatToolName = (toolName: string): string => {
		const nameMap: Record<string, string> = {
			create_note: "Create Note",
			modify_note: "Modify Note",
			delete_file: "Delete File",
			create_folder: "Create Folder",
			copy_file: "Copy File",
			search_vault: "Search Vault",
			write_file: "Write File",
		};
		return nameMap[toolName] || toolName;
	};
	
	if (executions.length === 0) {
		return null;
	}
	
	return (
		<div className="tool-execution-progress">
			<div className="progress-header">
				<span className="progress-title">Executing operations...</span>
				<span className="progress-count">
					{executions.filter(e => ['completed', 'failed'].includes(e.status)).length} / {executions.length}
				</span>
			</div>
			
			<div className="progress-bar">
				<div
					className="progress-fill"
					style={{ width: `${getProgressPercentage()}%` }}
				/>
			</div>
			
			<div className="execution-list">
				{executions.map(execution => (
					<div
						key={execution.id}
						className={`execution-item status-${execution.status}`}
					>
						<span className="status-icon">
							{getStatusIcon(execution.status)}
						</span>
						<span className="tool-name">
							{formatToolName(execution.toolName)}
						</span>
						{execution.args?.path && (
							<span className="tool-path">{execution.args.path}</span>
						)}
						{execution.status === 'executing' && (
							<span className="executing-spinner">
								<LoadingSpinner />
							</span>
						)}
						{execution.status === 'failed' && execution.error && (
							<span className="error-message" title={execution.error}>
								ⓘ
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

// Simple loading spinner component
const LoadingSpinner: React.FC = () => (
	<svg className="spinner" viewBox="0 0 24 24">
		<circle
			className="spinner-circle"
			cx="12"
			cy="12"
			r="10"
			fill="none"
			strokeWidth="3"
		/>
	</svg>
);