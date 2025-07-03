# Obsidian Chat-Assistant Plugin MVP Implementation Plan

Based on the PRD, this document outlines the detailed implementation plan for the MVP features.

## Phase 1: Plugin Structure & Settings

### 1.1 Rename Plugin Classes and Interfaces
- Rename `MyPlugin` to `ObsidianChatAssistant`
- Update `MyPluginSettings` to `ChatAssistantSettings` with:
  - `openaiApiKey: string`
  - `chatViewEnabled: boolean`
  - `approvalRequired: boolean` (default: true)

### 1.2 Update Plugin Metadata
- Update manifest.json with correct plugin name and description
- Update package.json with proper name and description

### 1.3 Create Settings Tab
- Implement proper settings UI for API key input
- Add toggle for chat view enable/disable
- Add toggle for approval requirement

## Phase 2: Chat View Implementation

### 2.1 Create ChatView Component (`src/views/ChatView.tsx`)
- Extend ItemView for dockable/bottom-sheet interface
- Implement deferred loading pattern
- Add React wrapper for UI components

### 2.2 Create Chat UI Components
- Message bubbles (user/assistant)
- Input field with slash command support
- Streaming response display
- Message history container

### 2.3 Register Chat View in Main Plugin
- Add view type constant
- Register view on plugin load
- Add command to open chat view
- Add ribbon icon for quick access

## Phase 3: Slash Commands

### 3.1 Create Command Parser (`src/commands/CommandParser.ts`)
- Parse `/note` command with arguments
- Parse `/search` command with query
- Handle invalid commands gracefully

### 3.2 Implement `/note` Command (`src/tools/NoteTool.ts`)
- Create new notes with title and content
- Edit existing notes
- Handle folder paths

### 3.3 Implement `/search` Command (`src/tools/SearchTool.ts`)
- Use MetadataCache API for content search
- Search by title, tags, and content
- Return formatted results

## Phase 4: Approval System

### 4.1 Create ApprovalModal (`src/modals/ApprovalModal.tsx`)
- Display proposed changes clearly
- Show diff view for edits
- Approve/Reject buttons
- Remember choice option

### 4.2 Create ApprovalManager (`src/managers/ApprovalManager.ts`)
- Queue pending operations
- Handle approval flow
- Execute approved operations
- Cancel rejected operations

## Phase 5: Core Integration

### 5.1 Create ToolRouter (`src/core/ToolRouter.ts`)
- Route commands to appropriate tools
- Handle tool responses
- Format responses for chat display

### 5.2 Create VaultOperations (`src/core/VaultOperations.ts`)
- Wrapper for Obsidian Vault API
- Integrate with approval system
- Handle file operations safely

## Phase 6: Testing & Polish

### 6.1 Add Basic Error Handling
- API key validation
- Network error handling
- Invalid command feedback

### 6.2 Implement Chat Persistence
- Save chat history to plugin data
- Load previous conversations
- Clear history option

### 6.3 Mobile UI Adjustments
- Responsive chat view
- Touch-friendly controls
- Keyboard handling

## File Structure

```
obsidian-agent/
├── src/
│   ├── main.ts (renamed from root)
│   ├── settings/
│   │   └── SettingsTab.tsx
│   ├── views/
│   │   └── ChatView.tsx
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatInterface.tsx
│   │   └── ThinkingIndicator.tsx
│   ├── commands/
│   │   └── CommandParser.ts
│   ├── tools/
│   │   ├── NoteTool.ts
│   │   └── SearchTool.ts
│   ├── modals/
│   │   └── ApprovalModal.tsx
│   ├── managers/
│   │   └── ApprovalManager.ts
│   ├── core/
│   │   ├── ToolRouter.ts
│   │   └── VaultOperations.ts
│   └── types/
│       └── index.ts
├── styles.css
└── [other config files]
```

## Dependencies to Add
- React & React-DOM for UI components
- @types/react & @types/react-dom
- Optional: Zustand for state management

## Implementation Status

### ✅ Completed Features
1. **Plugin Structure & Settings** - All phases completed
2. **Chat View Implementation** - Fully implemented with React
3. **Slash Commands** - Parser and both /note and /search commands implemented (Note: /search removed in favor of AI agents)
4. **Approval System** - Modal and manager fully functional with human-in-the-loop
5. **Core Integration** - ToolRouter connects all components
6. **Chat UI Enhancements** - Modern styling with proper layout
7. **AI Agent Integration** - OpenAI-based agents with tool use
8. **Streaming Responses** - Real-time message streaming with thinking indicators
9. **Context Files** - File context system with badges display
10. **Advanced Search** - AI-powered search replacing basic /search command

### 🚧 Future Enhancements (Post-MVP)
- Chat persistence and history
- Advanced error handling with recovery
- Plugin API for third-party tools
- Voice input support
- Web research integration

## Key Design Decisions

1. **React Integration**: Used React for the chat interface to enable complex UI interactions and state management
2. **Modular Architecture**: Separated concerns into tools, managers, and routers for maintainability
3. **Approval-First Design**: All vault modifications require explicit user approval by default
4. **TypeScript Throughout**: Ensures type safety and better development experience
5. **Obsidian Design Language**: UI follows Obsidian's CSS variables and design patterns

This plan establishes the foundation for future versions while keeping the MVP scope manageable and focused on core functionality.