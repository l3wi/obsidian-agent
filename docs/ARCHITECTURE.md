# Obsidian Agent Plugin Architecture

## Overview

The Obsidian Agent is an AI-powered chat assistant plugin that enables users to interact with their Obsidian vault using natural language. Built with TypeScript and React, it leverages OpenAI's Agents SDK to provide intelligent note management capabilities with a strong emphasis on user control and approval workflows.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Obsidian Plugin System                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│              ObsidianChatAssistant (main.ts)                     │
│  - Plugin lifecycle management                                   │
│  - Settings and configuration                                    │
│  - Command registration                                          │
│  - View management                                               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    ChatView (React App)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   ChatInterface                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ContextBadges│  │MessageBubble │  │   ChatInput     │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│               AgentOrchestrator                                  │
│  - OpenAI Agents SDK integration                                │
│  - Message streaming                                             │
│  - Tool execution                                                │
│  - Approval handling                                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Tool System                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │   NoteTool  │  │ApprovalManager│  │  CommandParser     │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Plugin Entry Point (`main.ts`)

The main plugin class that extends Obsidian's `Plugin` class:

```typescript
export default class ObsidianChatAssistant extends Plugin {
    settings: ChatAssistantSettings;
    chatView: ChatView | null;
    
    async onload() {
        // Load settings
        // Register views
        // Add commands
        // Setup ribbon icon
    }
}
```

**Responsibilities:**
- Initialize plugin infrastructure
- Manage plugin lifecycle
- Register chat view with Obsidian
- Handle settings persistence
- Register commands in command palette

### 2. Chat View System

#### ChatView (`src/views/ChatView.tsx`)
Extends Obsidian's `ItemView` to create a dockable chat interface:
- Manages React application lifecycle
- Handles view activation/deactivation
- Integrates with Obsidian's workspace system

#### ChatInterface (`src/components/ChatInterface.tsx`)
The main React component managing the chat experience:
- Message state management
- Command processing
- Integration with AgentOrchestrator
- Context file management
- Approval flow coordination

### 3. Agent System

#### AgentOrchestrator (`src/agents/AgentOrchestrator.ts`)
Central AI orchestration component:

```typescript
export class AgentOrchestrator {
    private agent: Agent;
    private currentRun: AgentRun | null;
    
    async processCommandStream(
        command: string,
        input: string,
        onChunk: (chunk: string) => void,
        onToolCall?: (toolName: string, args: any) => void,
        onInterrupt?: (interruptions: any[]) => void
    ): Promise<AgentResponse>
}
```

**Features:**
- Manages OpenAI Agents SDK integration
- Configures "Conductor" agent with custom personality
- Handles streaming responses
- Processes tool calls and interruptions
- Maintains conversation context

### 4. Tool System

#### Built-in Tools

**OpenAI SDK Tools:**
- `web_search`: Search the web for information
- `code_interpreter`: Analyze and process data

**Custom Vault Tools:**
- `create_note`: Create new notes in the vault
- `modify_note`: Edit existing notes
- `delete_file`: Move files to trash
- `create_folder`: Create directories
- `copy_file`: Duplicate files or folders

#### Tool Registration
Tools are registered with the Conductor agent using OpenAI's function calling:

```typescript
const tools = [
    {
        type: "function",
        function: {
            name: "create_note",
            description: "Create a new note in the vault",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    content: { type: "string" }
                },
                required: ["path", "content"]
            }
        },
        needsApproval: true
    }
];
```

### 5. Approval System

#### ApprovalManager (`src/managers/ApprovalManager.ts`)
Manages the human-in-the-loop approval workflow:

```typescript
export class ApprovalManager {
    private pendingApprovals: Map<string, PendingApproval>;
    
    async requestApproval(operation: ApprovalRequest): Promise<boolean>
    async executeApprovedOperation(request: ApprovalRequest): Promise<ToolResponse>
}
```

**Workflow:**
1. Tool execution triggers approval request
2. UI displays approval dialog/bubble
3. User approves/rejects operation
4. Approved operations execute through NoteTool
5. Results return to chat interface

### 6. UI Components

#### MessageBubble (`src/components/MessageBubble.tsx`)
Renders individual chat messages with:
- Markdown rendering using Obsidian's MarkdownRenderer
- Streaming indicators for AI thinking
- Tool usage display
- Approval UI integration
- Copy message functionality

#### ToolApprovalBubble (`src/components/ToolApprovalBubble.tsx`)
Batch approval interface for multiple tool calls:
- Displays tool details and parameters
- Allows selective approval/rejection
- Shows file paths and operations

#### ContextBadges (`src/components/ContextBadges.tsx`)
Shows files currently in context:
- Visual indicators for context files
- Remove files from context
- Improves AI response relevance

### 7. Command System

#### CommandParser (`src/commands/CommandParser.ts`)
Parses user input for slash commands:
- Validates command syntax
- Extracts command and arguments
- Handles quoted strings
- Provides command help

#### ToolRouter (`src/core/ToolRouter.ts`)
Routes parsed commands to appropriate handlers:
- Maps commands to tool implementations
- Integrates with approval system
- Formats tool responses

### 8. Type System

Comprehensive TypeScript types define the data flow:

```typescript
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    status?: 'pending' | 'streaming' | 'complete' | 'error';
    approvalRequest?: ApprovalRequest;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    streamResult?: StreamResult;
}

interface ToolResponse {
    success: boolean;
    message: string;
    requiresApproval?: boolean;
    approvalData?: ApprovalRequest;
}
```

## Data Flow

### 1. User Input Flow
```
User Input → ChatInput → ChatInterface → AgentOrchestrator → OpenAI API
```

### 2. Response Flow
```
OpenAI Stream → AgentOrchestrator → ChatInterface → MessageBubble → User
```

### 3. Tool Execution Flow
```
Tool Call → Approval Request → User Decision → Tool Execution → Vault Operation
```

### 4. Context Enhancement Flow
```
Context Files → System Message → Agent Context → Enhanced Responses
```

## Security Model

### Approval-First Design
- All vault modifications require explicit user approval
- Approval can be disabled in settings for power users
- Each operation has a unique ID for tracking
- Visual indicators show operation status

### Safe Defaults
- Approval required by default
- Operations clearly described before execution
- Batch operations allow reviewing multiple changes
- Rejected operations are cleanly cancelled

## Integration Points

### Obsidian APIs
- **Vault API**: File/folder operations
- **Workspace API**: View management
- **MetadataCache**: Note searching
- **MarkdownRenderer**: Content rendering
- **Plugin API**: Settings, commands, lifecycle

### External Services
- **OpenAI API**: AI model access
- **Web Search**: Information retrieval
- **Future**: Voice input, web research

## Performance Considerations

### Streaming Architecture
- Real-time UI updates during AI processing
- Chunk-based message rendering
- Non-blocking tool execution
- Efficient state updates

### Resource Management
- Lazy loading of React components
- Deferred view initialization
- Cleanup on unmount
- API key validation

## Extensibility

### Adding New Tools
1. Define tool schema in AgentOrchestrator
2. Implement tool logic in NoteTool
3. Add approval handling if needed
4. Register with Conductor agent

### Adding New Commands
1. Update CommandParser for new syntax
2. Add handler in ChatInterface
3. Implement command logic
4. Update help documentation

## Technology Stack

- **TypeScript**: Type-safe development
- **React 19**: Modern UI framework
- **OpenAI Agents SDK**: AI orchestration
- **Zod**: Runtime validation
- **ESBuild**: Fast bundling
- **Obsidian API**: Native integration

## Future Architecture Considerations

The codebase is structured to support:
- Voice input integration
- Plugin API for third-party tools
- Advanced web research capabilities
- Mobile-optimized interfaces
- Performance optimizations with Web Workers
- Extended AI model support

## Best Practices

1. **Type Safety**: Use TypeScript types throughout
2. **Error Handling**: Graceful degradation with user feedback
3. **User Control**: Explicit approval for all modifications
4. **Reactive UI**: Real-time updates during operations
5. **Clean Architecture**: Separation of concerns
6. **Documentation**: Inline comments and type definitions