import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ToolCallIdGenerator } from '../tools/utils/ToolCallIdGenerator';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface EnhancedToolApprovalProps {
	interruptions: any[];
	onApprove: (approvals: Map<string, boolean>) => void;
	onRejectAll: () => void;
	showStatus?: 'approved' | 'rejected';
}

export const EnhancedToolApproval: React.FC<EnhancedToolApprovalProps> = ({
	interruptions,
	onApprove,
	onRejectAll,
	showStatus,
}) => {
	const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
	const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
	const [focusedIndex, setFocusedIndex] = useState<number>(0);
	
	// Initialize with all tools selected
	useEffect(() => {
		const toolIds = interruptions.map(i => 
			ToolCallIdGenerator.extractFromInterruption(i) || Math.random().toString()
		);
		setSelectedTools(new Set(toolIds));
	}, [interruptions]);
	
	// Format tool names for display
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
	
	// Get icon for tool
	const getToolIcon = (toolName: string): string => {
		const iconMap: Record<string, string> = {
			create_note: "📄",
			modify_note: "📝",
			delete_file: "🗑️",
			create_folder: "📁",
			copy_file: "📋",
			search_vault: "🔍",
			write_file: "💾",
		};
		return iconMap[toolName] || "🔧";
	};
	
	const selectAll = () => {
		const toolIds = interruptions.map(i => 
			ToolCallIdGenerator.extractFromInterruption(i) || Math.random().toString()
		);
		setSelectedTools(new Set(toolIds));
	};
	
	const deselectAll = () => {
		setSelectedTools(new Set());
	};
	
	const toggleTool = (id: string) => {
		const newSelected = new Set(selectedTools);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedTools(newSelected);
	};
	
	const toggleExpanded = (id: string) => {
		const newExpanded = new Set(expandedTools);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		setExpandedTools(newExpanded);
	};
	
	const handleApprove = () => {
		const approvals = new Map<string, boolean>();
		interruptions.forEach(interruption => {
			const id = ToolCallIdGenerator.extractFromInterruption(interruption);
			if (id) {
				approvals.set(id, selectedTools.has(id));
			}
		});
		onApprove(approvals);
	};
	
	// Keyboard navigation functions
	const toggleCurrentTool = () => {
		if (interruptions.length === 0) return;
		const currentId = ToolCallIdGenerator.extractFromInterruption(interruptions[focusedIndex]);
		if (currentId) {
			toggleTool(currentId);
		}
	};
	
	const moveFocusUp = () => {
		setFocusedIndex(prev => Math.max(0, prev - 1));
	};
	
	const moveFocusDown = () => {
		setFocusedIndex(prev => Math.min(interruptions.length - 1, prev + 1));
	};
	
	// Set up keyboard shortcuts
	useKeyboardShortcuts({
		'cmd+a': selectAll,
		'cmd+shift+a': deselectAll,
		'cmd+enter': handleApprove,
		'escape': onRejectAll,
		'space': toggleCurrentTool,
		'up': moveFocusUp,
		'down': moveFocusDown,
	});
	
	const renderToolPreview = (interruption: any, index: number) => {
		const toolName = ToolCallIdGenerator.extractToolName(interruption) || "Unknown tool";
		const args = ToolCallIdGenerator.extractArguments(interruption);
		const id = ToolCallIdGenerator.extractFromInterruption(interruption) || Math.random().toString();
		const isExpanded = expandedTools.has(id);
		const isSelected = selectedTools.has(id);
		const isFocused = index === focusedIndex;
		
		return (
			<div key={id} className={`enhanced-tool-item ${isFocused ? 'focused' : ''}`}>
				<div className="tool-header">
					<input
						type="checkbox"
						checked={isSelected}
						onChange={() => toggleTool(id)}
						className="tool-checkbox"
						id={`tool-${id}`}
					/>
					<label htmlFor={`tool-${id}`} className="tool-label">
						<span className="tool-icon">{getToolIcon(toolName)}</span>
						<span className="tool-name">{formatToolName(toolName)}</span>
					</label>
					{args.path && <span className="tool-path">{args.path}</span>}
					<button
						className="tool-expand"
						onClick={() => toggleExpanded(id)}
						aria-label={isExpanded ? "Collapse" : "Expand"}
					>
						{isExpanded ? '▼' : '▶'}
					</button>
				</div>
				
				{isExpanded && (
					<div className="tool-details">
						{renderToolSpecificDetails(toolName, args)}
					</div>
				)}
			</div>
		);
	};
	
	const renderToolSpecificDetails = (toolName: string, args: any) => {
		switch (toolName) {
			case 'create_note':
			case 'modify_note':
				return (
					<div className="preview-content">
						{args.content && (
							<>
								<div className="detail-label">Content preview:</div>
								<pre className="content-preview">
									{args.content.substring(0, 300)}
									{args.content.length > 300 ? '...' : ''}
								</pre>
							</>
						)}
					</div>
				);
			
			case 'delete_file':
				return (
					<div className="preview-delete">
						<div className="warning-message">
							⚠️ This will permanently delete the file
						</div>
					</div>
				);
			
			case 'copy_file':
				return (
					<div className="preview-copy">
						{args.destinationPath && (
							<div className="detail-item">
								<span className="detail-label">Destination:</span> {args.destinationPath}
							</div>
						)}
					</div>
				);
			
			case 'search_vault':
				return (
					<div className="preview-search">
						{args.query && (
							<div className="detail-item">
								<span className="detail-label">Search query:</span> {args.query}
							</div>
						)}
					</div>
				);
			
			default:
				return (
					<div className="preview-generic">
						<pre className="args-preview">
							{JSON.stringify(args, null, 2)}
						</pre>
					</div>
				);
		}
	};
	
	if (showStatus) {
		return (
			<div className="enhanced-tool-approval status-view">
				<div className="tool-approval-list">
					{interruptions.map((interruption, index) => renderToolPreview(interruption, index))}
				</div>
				<div className="tool-approval-status">
					<div className={`approval-status-badge ${showStatus}`}>
						{showStatus === 'approved' ? '✓ Approved' : '✗ Rejected'}
					</div>
				</div>
			</div>
		);
	}
	
	return (
		<div className="enhanced-tool-approval">
			<div className="tool-approval-header">
				<span>Review Operations</span>
				<div className="approval-controls">
					<button className="control-btn" onClick={selectAll}>
						Select All
					</button>
					<button className="control-btn" onClick={deselectAll}>
						Deselect All
					</button>
				</div>
			</div>
			
			<div className="tool-approval-list">
				{interruptions.map((interruption, index) => renderToolPreview(interruption, index))}
			</div>
			
			<div className="tool-approval-footer">
				<div className="approval-summary">
					{selectedTools.size} of {interruptions.length} operations selected
				</div>
				<div className="approval-actions">
					<button
						className="approval-button reject"
						onClick={onRejectAll}
					>
						Reject All
					</button>
					<button
						className="approval-button approve"
						onClick={handleApprove}
						disabled={selectedTools.size === 0}
					>
						Approve Selected ({selectedTools.size})
					</button>
				</div>
			</div>
			
			<div className="approval-shortcuts">
				<div className="shortcut-hint">
					<kbd>Space</kbd> Toggle selection
				</div>
				<div className="shortcut-hint">
					<kbd>⌘A</kbd> Select all
				</div>
				<div className="shortcut-hint">
					<kbd>⌘⇧A</kbd> Deselect all
				</div>
				<div className="shortcut-hint">
					<kbd>⌘↵</kbd> Approve
				</div>
				<div className="shortcut-hint">
					<kbd>Esc</kbd> Reject
				</div>
			</div>
		</div>
	);
};