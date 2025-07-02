# Product Requirements Document (PRD)

## Product Name

**Obsidian Chat-Assistant Plugin**

## Author

\[Your Name]

## Last Updated

2025-07-02

---

## Summary

The Obsidian Chat-Assistant is a native plugin for Obsidian.md that provides an interactive, AI-powered chat interface to manage and grow a personal knowledge base. It leverages the OpenAI Agents SDK to interpret user input into actions like creating notes, searching content, and conducting external research. The assistant operates through a dockable or bottom-sheet chat view within the Obsidian app, designed for both desktop and mobile.

All note modifications are strictly controlled through user approvals. This plugin does not automate Git commits or background syncs to preserve transparency and data sovereignty.

---

## Goals

-   Add natural-language capture and retrieval of notes.
-   Allow querying and editing of notes via an agentic interface.
-   Enable lightweight web research integration.
-   Maintain full user control over vault changes.
-   Ensure mobile and desktop compatibility.
-   Keep performance high via deferred loading and lazy evaluation.

---

## Non-Goals

-   No background Git automation.
-   No zero-click AI note generation or deletion.
-   No cloud-based note syncing.

---

## Waterfall Feature Roadmap

### MVP

-   Scaffold base plugin structure
-   Register deferred chat view (`ItemView`)
-   Implement slash commands: `/note`, `/search`
-   Add approval modal before file modifications
-   Add plugin settings tab for API keys, UI toggles

### Version 1

-   Integrate OpenAI Agents SDK in Web Worker
-   Implement `/research` via Exa Web Search API
-   Add streaming chat bubbles with cancel and approve controls

### Version 2

-   Implement Whisper-powered voice note transcription
-   Handle image attachments and file linking
-   Optimize mobile interface (FAB, bottom sheets)
-   Add plugin API for third-party tool registration

---

## Tech Stack

-   **Language**: TypeScript
-   **UI Framework**: React (via Obsidian wrapper)
-   **Bundler**: Rollup / esbuild
-   **Obsidian APIs**: Vault, Editor, MetadataCache, Workspace
-   **External SDKs**: OpenAI Agents SDK, Exa Web Search
-   **Testing**: Vitest, obsidian-mock, Playwright (for mobile)

---

## Architecture Overview

```
┌────── Obsidian Core ───────┐
│ Vault  │ MetadataCache     │
└──┬─────┴───────────┬───────┘
   │  events         │
┌──▼───────┐  ┌──────▼────┐
│ ChatView │  │ Approval  │
│ (React)  │  │ Manager   │
└──┬───────┘  └──────┬────┘
   │ msg / tools     │
┌──▼─────────────────▼──┐
│ Agent Orchestrator    │
│  • tool router        │
│  • OpenAI Agents SDK  │
└──┬─────────────┬──────┘
   │ local       │ remote
┌──▼────┐       ┌▼──────┐
│ Vault │       │  Exa  │
│ Tools │       │ Tool  │
└───────┘       └───────┘
```

---

## Modules / Components

### main.ts

-   Register commands and views
-   Load/unload lifecycle

### ChatView\.tsx

-   Renders the chat interface
-   Parses slash commands
-   Streams responses from tools

### ApprovalManager.tsx

-   Displays modal for approving vault changes
-   Renders diff/summary of changes

### ToolRouter.ts

-   Maps agent tool calls to actual handlers
-   Handles result piping and tool fallback

### VaultTools.ts

-   File and editor operations
-   Uses Vault & Editor APIs (create, read, modify, delete)

### ExaTool.ts

-   Calls Exa Web Search API
-   Parses and formats Markdown output

### SettingsTab.tsx

-   Allows user configuration
-   API keys, UI toggles, model selectors

### MobileAdapter.ts

-   Floating Action Button (FAB) logic
-   Mobile-only UX hooks

---

## Key Considerations

-   **Security**: Never write or delete without explicit user approval
-   **Performance**: Use deferred views and load tools lazily
-   **Mobile-first**: Ensure all UI scales to touch interfaces
-   **Extensibility**: Third-party plugins can register tools via exposed API
-   **Offline support**: All vault-based tools work without connectivity

---

## Documentation Links

-   Build a plugin: [https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
-   Anatomy of a plugin: [https://docs.obsidian.md/Plugins/Getting+started/Anatomy+of+a+plugin](https://docs.obsidian.md/Plugins/Getting+started/Anatomy+of+a+plugin)
-   Understanding deferred views: [https://docs.obsidian.md/Plugins/Guides/Understanding+deferred+views](https://docs.obsidian.md/Plugins/Guides/Understanding+deferred+views)
-   Vault API: [https://docs.obsidian.md/Plugins/Vault](https://docs.obsidian.md/Plugins/Vault)
-   Editor API: [https://docs.obsidian.md/Plugins/Editor/Editor](https://docs.obsidian.md/Plugins/Editor/Editor)
-   User interface: [https://docs.obsidian.md/Plugins/User+interface/About+user+interface](https://docs.obsidian.md/Plugins/User+interface/About+user+interface)
-   Mobile development: [https://docs.obsidian.md/Plugins/Getting+started/Mobile+development](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)
-   OpenAI Agents SDK: [https://github.com/openai/openai-agents-js](https://github.com/openai/openai-agents-js)
-   Exa Search API: [https://docs.exa.ai](https://docs.exa.ai)
-   Whisper STT: [https://platform.openai.com/docs/guides/speech-to-text](https://platform.openai.com/docs/guides/speech-to-text)

---

## Next Steps

1. Scaffold plugin and settings tab
2. Implement `ChatView` and slash command routing
3. Build `/note` tool and Approval modal
4. Add streaming response and chat history UI
5. Integrate Agents SDK and external tool support
