import { App, TFile, TFolder, TAbstractFile } from 'obsidian';

export interface VaultStructure {
	totalFiles: number;
	totalFolders: number;
	filesByExtension: Map<string, number>;
	folderPatterns: FolderPattern[];
	commonPaths: string[];
	organizationInsights: OrganizationInsight[];
}

export interface FolderPattern {
	path: string;
	type: 'daily' | 'periodic' | 'category' | 'project' | 'archive' | 'template' | 'attachment' | 'general';
	fileCount: number;
	lastModified: number;
	contentTypes: Set<string>;
}

export interface OrganizationInsight {
	type: 'naming_pattern' | 'folder_structure' | 'content_type' | 'date_based';
	pattern: string;
	confidence: number;
	examples: string[];
	suggestion?: string;
}

export interface FileClassification {
	suggestedPath: string;
	reasoning: string;
	confidence: number;
	alternativePaths?: string[];
}

export class VaultAnalyzer {
	private app: App;
	private structure: VaultStructure | null = null;
	private lastAnalysis: number = 0;
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Analyze the vault structure and organization patterns
	 */
	async analyzeVault(force = false): Promise<VaultStructure> {
		// Use cache if available and not forced
		if (!force && this.structure && Date.now() - this.lastAnalysis < this.CACHE_DURATION) {
			return this.structure;
		}

		const structure: VaultStructure = {
			totalFiles: 0,
			totalFolders: 0,
			filesByExtension: new Map(),
			folderPatterns: [],
			commonPaths: [],
			organizationInsights: []
		};

		// Get all files and folders
		const allFiles = this.app.vault.getFiles();
		const allFolders = this.getAllFolders();

		structure.totalFiles = allFiles.length;
		structure.totalFolders = allFolders.length;

		// Analyze file extensions
		for (const file of allFiles) {
			const ext = file.extension;
			structure.filesByExtension.set(ext, (structure.filesByExtension.get(ext) || 0) + 1);
		}

		// Analyze folder patterns
		for (const folder of allFolders) {
			const pattern = this.analyzeFolderPattern(folder, allFiles);
			if (pattern) {
				structure.folderPatterns.push(pattern);
			}
		}

		// Find common paths
		structure.commonPaths = this.findCommonPaths(allFiles);

		// Generate organization insights
		structure.organizationInsights = this.generateInsights(allFiles, structure.folderPatterns);

		this.structure = structure;
		this.lastAnalysis = Date.now();

		return structure;
	}

	/**
	 * Suggest a path for a new file based on its content and name
	 */
	async suggestPath(fileName: string, content: string, fileType?: string): Promise<FileClassification> {
		// Ensure we have recent vault analysis
		const structure = await this.analyzeVault();

		// Extract features from the file
		const features = this.extractFileFeatures(fileName, content, fileType);

		// Score each folder based on similarity
		const folderScores = new Map<string, number>();
		let reasoning = '';

		// Check for date-based patterns
		if (features.hasDate) {
			const dateFolder = this.findDateBasedFolder(features.date!, structure.folderPatterns);
			if (dateFolder) {
				folderScores.set(dateFolder.path, 0.8);
				reasoning = `Date-based content matches pattern in ${dateFolder.path}`;
			}
		}

		// Check for content type patterns
		if (features.contentType) {
			const contentFolders = structure.folderPatterns.filter(fp => 
				fp.contentTypes.has(features.contentType!)
			);
			
			for (const folder of contentFolders) {
				const currentScore = folderScores.get(folder.path) || 0;
				folderScores.set(folder.path, Math.max(currentScore, 0.7));
				
				if (!reasoning) {
					reasoning = `Content type "${features.contentType}" commonly found in ${folder.path}`;
				}
			}
		}

		// Check for naming patterns
		const namingMatches = this.findNamingPatternMatches(fileName, structure.folderPatterns);
		for (const match of namingMatches) {
			const currentScore = folderScores.get(match.path) || 0;
			folderScores.set(match.path, Math.max(currentScore, 0.6));
		}

		// Default to root if no matches
		if (folderScores.size === 0) {
			return {
				suggestedPath: fileName,
				reasoning: 'No matching organizational patterns found, suggesting root directory',
				confidence: 0.3
			};
		}

		// Sort folders by score
		const sortedFolders = Array.from(folderScores.entries())
			.sort((a, b) => b[1] - a[1]);

		const topFolder = sortedFolders[0];
		const suggestedPath = `${topFolder[0]}/${fileName}`;

		// Get alternative paths
		const alternativePaths = sortedFolders
			.slice(1, 4)
			.map(([folder]) => `${folder}/${fileName}`);

		return {
			suggestedPath,
			reasoning,
			confidence: topFolder[1],
			alternativePaths: alternativePaths.length > 0 ? alternativePaths : undefined
		};
	}

	/**
	 * Find similar files in the vault
	 */
	findSimilarFiles(fileName: string, content?: string, limit = 5): TFile[] {
		const allFiles = this.app.vault.getFiles();
		const similarities: Array<{ file: TFile; score: number }> = [];

		for (const file of allFiles) {
			let score = 0;

			// Name similarity
			const nameSimilarity = this.calculateStringSimilarity(
				fileName.toLowerCase(), 
				file.basename.toLowerCase()
			);
			score += nameSimilarity * 0.5;

			// Path similarity
			const pathSimilarity = this.calculateStringSimilarity(
				fileName.toLowerCase(),
				file.path.toLowerCase()
			);
			score += pathSimilarity * 0.3;

			// Extension match
			if (file.extension === fileName.split('.').pop()) {
				score += 0.2;
			}

			similarities.push({ file, score });
		}

		// Sort by score and return top matches
		return similarities
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(item => item.file);
	}

	/**
	 * Get organization suggestions for the vault
	 */
	getOrganizationSuggestions(): string[] {
		if (!this.structure) {
			return [];
		}

		const suggestions: string[] = [];

		// Check for files in root
		const rootFiles = this.app.vault.getFiles().filter(f => !f.path.includes('/'));
		if (rootFiles.length > 10) {
			suggestions.push(`Consider organizing ${rootFiles.length} files in the root directory into folders`);
		}

		// Check for deep nesting
		const deepPaths = this.structure.folderPatterns.filter(fp => 
			fp.path.split('/').length > 4
		);
		if (deepPaths.length > 0) {
			suggestions.push('Some folders are deeply nested (>4 levels). Consider flattening the structure');
		}

		// Check for similar folder names
		const folderNames = this.structure.folderPatterns.map(fp => fp.path.split('/').pop()!);
		const duplicates = folderNames.filter((name, index) => 
			folderNames.indexOf(name) !== index
		);
		if (duplicates.length > 0) {
			suggestions.push(`Found duplicate folder names: ${[...new Set(duplicates)].join(', ')}`);
		}

		// Check for inconsistent naming
		const hasSpaces = this.structure.folderPatterns.some(fp => fp.path.includes(' '));
		const hasDashes = this.structure.folderPatterns.some(fp => fp.path.includes('-'));
		const hasUnderscores = this.structure.folderPatterns.some(fp => fp.path.includes('_'));
		
		if ([hasSpaces, hasDashes, hasUnderscores].filter(Boolean).length > 1) {
			suggestions.push('Inconsistent folder naming conventions detected (spaces, dashes, underscores)');
		}

		return suggestions;
	}

	// Private helper methods

	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		const rootFolder = this.app.vault.getRoot();
		
		const traverse = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					traverse(child);
				}
			}
		};
		
		// Don't include root, start with its children
		for (const child of rootFolder.children) {
			if (child instanceof TFolder) {
				traverse(child);
			}
		}
		
		return folders;
	}

	private analyzeFolderPattern(folder: TFolder, allFiles: TFile[]): FolderPattern | null {
		const folderFiles = allFiles.filter(f => f.path.startsWith(folder.path + '/'));
		
		if (folderFiles.length === 0) {
			return null;
		}

		const contentTypes = new Set<string>();
		let lastModified = 0;

		for (const file of folderFiles) {
			// Determine content type based on name and path
			const contentType = this.detectContentType(file);
			if (contentType) {
				contentTypes.add(contentType);
			}
			
			lastModified = Math.max(lastModified, file.stat.mtime);
		}

		// Determine folder type
		const folderType = this.detectFolderType(folder.path, folderFiles);

		return {
			path: folder.path,
			type: folderType,
			fileCount: folderFiles.length,
			lastModified,
			contentTypes
		};
	}

	private detectContentType(file: TFile): string {
		const name = file.basename.toLowerCase();
		const path = file.path.toLowerCase();

		// Meeting notes
		if (name.includes('meeting') || path.includes('meetings/')) {
			return 'meeting';
		}
		
		// Daily notes
		if (/\d{4}-\d{2}-\d{2}/.test(name) || path.includes('daily/')) {
			return 'daily';
		}
		
		// Project files
		if (path.includes('project') || name.startsWith('prj-')) {
			return 'project';
		}
		
		// Tasks/TODOs
		if (name.includes('todo') || name.includes('task') || path.includes('tasks/')) {
			return 'task';
		}
		
		// Journal entries
		if (path.includes('journal') || name.includes('journal')) {
			return 'journal';
		}
		
		// Templates
		if (path.includes('template') || name.includes('template')) {
			return 'template';
		}
		
		// Literature/Reading notes
		if (path.includes('reading') || path.includes('literature') || path.includes('books')) {
			return 'literature';
		}
		
		// Archive
		if (path.includes('archive') || path.includes('_old')) {
			return 'archive';
		}

		return 'general';
	}

	private detectFolderType(path: string, files: TFile[]): FolderPattern['type'] {
		const lowerPath = path.toLowerCase();
		
		// Check path-based patterns
		if (lowerPath.includes('daily') || lowerPath.includes('journal')) {
			return 'daily';
		}
		
		if (lowerPath.includes('template')) {
			return 'template';
		}
		
		if (lowerPath.includes('archive') || lowerPath.includes('_old')) {
			return 'archive';
		}
		
		if (lowerPath.includes('attachment') || lowerPath.includes('assets') || lowerPath.includes('images')) {
			return 'attachment';
		}
		
		if (lowerPath.includes('project')) {
			return 'project';
		}
		
		// Check file patterns
		const dateFiles = files.filter(f => /\d{4}-\d{2}-\d{2}/.test(f.basename));
		if (dateFiles.length > files.length * 0.7) {
			return 'daily';
		}
		
		// Check if mostly contains periodic notes (weekly, monthly)
		const periodicPatterns = [/week-\d+/, /\d{4}-\d{2}/, /w\d{2}/, /month-/];
		const periodicFiles = files.filter(f => 
			periodicPatterns.some(pattern => pattern.test(f.basename))
		);
		if (periodicFiles.length > files.length * 0.5) {
			return 'periodic';
		}
		
		// If folder has subfolders with similar names, likely a category
		if (path.split('/').length <= 2 && files.length > 5) {
			return 'category';
		}
		
		return 'general';
	}

	private findCommonPaths(files: TFile[]): string[] {
		const pathCounts = new Map<string, number>();
		
		for (const file of files) {
			const parts = file.path.split('/');
			if (parts.length > 1) {
				const folderPath = parts.slice(0, -1).join('/');
				pathCounts.set(folderPath, (pathCounts.get(folderPath) || 0) + 1);
			}
		}
		
		// Return paths used by more than 5% of files
		const threshold = files.length * 0.05;
		return Array.from(pathCounts.entries())
			.filter(([_, count]) => count > threshold)
			.sort((a, b) => b[1] - a[1])
			.map(([path]) => path);
	}

	private generateInsights(files: TFile[], patterns: FolderPattern[]): OrganizationInsight[] {
		const insights: OrganizationInsight[] = [];
		
		// Check for date-based organization
		const datePattern = /(\d{4})-(\d{2})-(\d{2})/;
		const dateFiles = files.filter(f => datePattern.test(f.basename));
		if (dateFiles.length > files.length * 0.1) {
			insights.push({
				type: 'date_based',
				pattern: 'YYYY-MM-DD',
				confidence: 0.9,
				examples: dateFiles.slice(0, 3).map(f => f.path),
				suggestion: 'Vault uses date-based naming for many files'
			});
		}
		
		// Check folder structure patterns
		const depthCounts = new Map<number, number>();
		for (const file of files) {
			const depth = file.path.split('/').length - 1;
			depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
		}
		
		const avgDepth = Array.from(depthCounts.entries())
			.reduce((sum, [depth, count]) => sum + depth * count, 0) / files.length;
		
		if (avgDepth < 1.5) {
			insights.push({
				type: 'folder_structure',
				pattern: 'flat',
				confidence: 0.8,
				examples: [],
				suggestion: 'Vault has a flat structure - most files are in root or first-level folders'
			});
		} else if (avgDepth > 3) {
			insights.push({
				type: 'folder_structure',
				pattern: 'deep',
				confidence: 0.8,
				examples: [],
				suggestion: 'Vault has deep folder nesting - consider flattening some structures'
			});
		}
		
		return insights;
	}

	private extractFileFeatures(fileName: string, content: string, fileType?: string) {
		const features: any = {
			hasDate: false,
			date: null,
			contentType: fileType || 'general',
			keywords: []
		};
		
		// Check for date in filename
		const dateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
		if (dateMatch) {
			features.hasDate = true;
			features.date = new Date(dateMatch[0]);
		}
		
		// Extract keywords from content
		const words = content.toLowerCase().split(/\s+/);
		const keywordMap = new Map<string, number>();
		
		for (const word of words) {
			if (word.length > 4) {
				keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
			}
		}
		
		// Get top keywords
		features.keywords = Array.from(keywordMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([word]) => word);
		
		// Detect content type from content
		if (!fileType) {
			if (content.includes('## Meeting') || content.includes('# Meeting')) {
				features.contentType = 'meeting';
			} else if (content.includes('TODO') || content.includes('- [ ]')) {
				features.contentType = 'task';
			} else if (content.match(/^# \d{4}-\d{2}-\d{2}/m)) {
				features.contentType = 'daily';
			}
		}
		
		return features;
	}

	private findDateBasedFolder(date: Date, patterns: FolderPattern[]): FolderPattern | null {
		// Look for daily note folders
		const dailyFolders = patterns.filter(p => p.type === 'daily' || p.type === 'periodic');
		
		if (dailyFolders.length > 0) {
			// Prefer folders with more recent activity
			return dailyFolders.sort((a, b) => b.lastModified - a.lastModified)[0];
		}
		
		return null;
	}

	private findNamingPatternMatches(fileName: string, patterns: FolderPattern[]): FolderPattern[] {
		const matches: FolderPattern[] = [];
		const nameWords = fileName.toLowerCase().split(/[-_\s]+/);
		
		for (const pattern of patterns) {
			const folderWords = pattern.path.toLowerCase().split('/').pop()!.split(/[-_\s]+/);
			
			// Check for word overlap
			const overlap = nameWords.filter(w => folderWords.includes(w)).length;
			if (overlap > 0) {
				matches.push(pattern);
			}
		}
		
		return matches;
	}

	private calculateStringSimilarity(str1: string, str2: string): number {
		const longer = str1.length > str2.length ? str1 : str2;
		const shorter = str1.length > str2.length ? str2 : str1;
		
		if (longer.length === 0) {
			return 1.0;
		}
		
		const editDistance = this.levenshteinDistance(longer, shorter);
		return (longer.length - editDistance) / longer.length;
	}

	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = [];
		
		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}
		
		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}
		
		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}
		
		return matrix[str2.length][str1.length];
	}
}