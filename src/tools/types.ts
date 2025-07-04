import { z } from 'zod/v3';
import { App } from 'obsidian';
import { ChatAssistantSettings } from '../types';

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: 'vault' | 'web' | 'analysis' | 'utility';
  icon?: string;
  requiresApproval: boolean;
  experimental?: boolean;
}

export interface Tool<TArgs = any, TResult = any> {
  metadata: ToolMetadata;
  schema: z.ZodSchema<TArgs>;
  execute: (args: TArgs, context: ToolContext) => Promise<TResult>;
  validate?: (args: TArgs, context: ToolContext) => Promise<ValidationResult>;
}

export interface ToolContext {
  app: App;
  apiKey?: string;
  settings: ChatAssistantSettings;
  userId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}