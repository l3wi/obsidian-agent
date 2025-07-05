import { Agent } from '@openai/agents';
import { App } from 'obsidian';

export interface AgentMetadata {
	id: string;
	name: string;
	description: string;
	capabilities: string[];
	specialization: 'general' | 'files' | 'research' | 'analysis' | 'organization';
	priority: number; // Higher priority agents are preferred for their specialization
}

export interface RegisteredAgent {
	agent: Agent<any>;
	metadata: AgentMetadata;
	isActive: boolean;
}

export class AgentRegistry {
	private agents: Map<string, RegisteredAgent> = new Map();
	private app: App;
	private defaultAgentId: string | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Register an agent with the registry
	 */
	registerAgent(agent: Agent<any>, metadata: AgentMetadata): void {
		if (this.agents.has(metadata.id)) {
			console.warn(`Agent with id ${metadata.id} is already registered. Overwriting.`);
		}

		this.agents.set(metadata.id, {
			agent,
			metadata,
			isActive: true
		});

		// Set as default if it's the first agent
		if (!this.defaultAgentId) {
			this.defaultAgentId = metadata.id;
		}

		console.log(`[AgentRegistry] Registered agent: ${metadata.name} (${metadata.id})`);
	}

	/**
	 * Get an agent by ID
	 */
	getAgent(id: string): RegisteredAgent | undefined {
		return this.agents.get(id);
	}

	/**
	 * Get the default agent
	 */
	getDefaultAgent(): RegisteredAgent | undefined {
		if (!this.defaultAgentId) {
			return undefined;
		}
		return this.agents.get(this.defaultAgentId);
	}

	/**
	 * Set the default agent
	 */
	setDefaultAgent(id: string): boolean {
		if (!this.agents.has(id)) {
			console.error(`Cannot set default agent: ${id} not found`);
			return false;
		}
		this.defaultAgentId = id;
		return true;
	}

	/**
	 * Find the best agent for a given task
	 */
	findBestAgentForTask(task: string, context?: any): RegisteredAgent | undefined {
		// Analyze the task to determine the best specialization
		const taskSpecialization = this.analyzeTaskSpecialization(task, context);
		
		// Find agents with matching specialization
		const matchingAgents = Array.from(this.agents.values())
			.filter(reg => reg.isActive && reg.metadata.specialization === taskSpecialization)
			.sort((a, b) => b.metadata.priority - a.metadata.priority);

		if (matchingAgents.length > 0) {
			return matchingAgents[0];
		}

		// Fallback to general agents
		const generalAgents = Array.from(this.agents.values())
			.filter(reg => reg.isActive && reg.metadata.specialization === 'general')
			.sort((a, b) => b.metadata.priority - a.metadata.priority);

		if (generalAgents.length > 0) {
			return generalAgents[0];
		}

		// Final fallback to default agent
		return this.getDefaultAgent();
	}

	/**
	 * Analyze task to determine specialization needed
	 */
	private analyzeTaskSpecialization(task: string, context?: any): AgentMetadata['specialization'] {
		const lowerTask = task.toLowerCase();

		// File operations
		if (lowerTask.includes('create') || 
			lowerTask.includes('modify') || 
			lowerTask.includes('append') ||
			lowerTask.includes('delete') ||
			lowerTask.includes('move') ||
			lowerTask.includes('rename') ||
			lowerTask.includes('file') ||
			lowerTask.includes('note') ||
			lowerTask.includes('folder')) {
			return 'files';
		}

		// Research operations
		if (lowerTask.includes('search') ||
			lowerTask.includes('find') ||
			lowerTask.includes('research') ||
			lowerTask.includes('lookup') ||
			lowerTask.includes('query')) {
			return 'research';
		}

		// Analysis operations
		if (lowerTask.includes('analyze') ||
			lowerTask.includes('summarize') ||
			lowerTask.includes('extract') ||
			lowerTask.includes('review') ||
			lowerTask.includes('examine')) {
			return 'analysis';
		}

		// Organization operations
		if (lowerTask.includes('organize') ||
			lowerTask.includes('structure') ||
			lowerTask.includes('categorize') ||
			lowerTask.includes('sort') ||
			lowerTask.includes('clean')) {
			return 'organization';
		}

		// Default to general
		return 'general';
	}

	/**
	 * Get all agents with a specific capability
	 */
	getAgentsWithCapability(capability: string): RegisteredAgent[] {
		return Array.from(this.agents.values())
			.filter(reg => 
				reg.isActive && 
				reg.metadata.capabilities.includes(capability)
			)
			.sort((a, b) => b.metadata.priority - a.metadata.priority);
	}

	/**
	 * Get all registered agents
	 */
	getAllAgents(): RegisteredAgent[] {
		return Array.from(this.agents.values());
	}

	/**
	 * Get active agents
	 */
	getActiveAgents(): RegisteredAgent[] {
		return Array.from(this.agents.values()).filter(reg => reg.isActive);
	}

	/**
	 * Enable/disable an agent
	 */
	setAgentActive(id: string, active: boolean): boolean {
		const agent = this.agents.get(id);
		if (!agent) {
			return false;
		}
		agent.isActive = active;
		return true;
	}

	/**
	 * Remove an agent from the registry
	 */
	unregisterAgent(id: string): boolean {
		if (this.defaultAgentId === id) {
			// Find a new default agent
			const otherAgents = Array.from(this.agents.keys()).filter(agentId => agentId !== id);
			this.defaultAgentId = otherAgents.length > 0 ? otherAgents[0] : null;
		}
		return this.agents.delete(id);
	}

	/**
	 * Get agent recommendations for a task
	 */
	getAgentRecommendations(task: string, context?: any): {
		primary: RegisteredAgent | undefined;
		alternatives: RegisteredAgent[];
		reasoning: string;
	} {
		const specialization = this.analyzeTaskSpecialization(task, context);
		const primary = this.findBestAgentForTask(task, context);
		
		// Get alternatives
		const alternatives = Array.from(this.agents.values())
			.filter(reg => 
				reg.isActive && 
				reg.metadata.id !== primary?.metadata.id &&
				(reg.metadata.specialization === specialization || 
				 reg.metadata.specialization === 'general')
			)
			.sort((a, b) => b.metadata.priority - a.metadata.priority)
			.slice(0, 2);

		const reasoning = primary 
			? `Selected ${primary.metadata.name} (${primary.metadata.specialization} specialist) based on task requiring ${specialization} capabilities.`
			: 'No suitable agent found for the task.';

		return {
			primary,
			alternatives,
			reasoning
		};
	}

	/**
	 * Get statistics about registered agents
	 */
	getStatistics(): {
		total: number;
		active: number;
		bySpecialization: Map<string, number>;
	} {
		const stats = {
			total: this.agents.size,
			active: 0,
			bySpecialization: new Map<string, number>()
		};

		for (const reg of this.agents.values()) {
			if (reg.isActive) {
				stats.active++;
			}
			
			const spec = reg.metadata.specialization;
			stats.bySpecialization.set(spec, (stats.bySpecialization.get(spec) || 0) + 1);
		}

		return stats;
	}
}