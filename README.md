# Obsidian Chat Assistant

An AI-powered chat interface plugin for Obsidian that helps you manage and grow your personal knowledge base using natural language commands.

## Features (MVP)

- **Chat Interface**: Dockable chat view that integrates seamlessly with Obsidian
- **Slash Commands**:
  - `/note <title> [content]` - Create or edit notes
  - `/search <query>` - Search your vault
  - `/help` - Show available commands
- **Approval System**: All vault modifications require explicit user approval
- **Settings**: Configure API key, model selection, and approval preferences

## Installation

### From Release
1. Download the latest release from the releases page
2. Extract the files to your vault's `.obsidian/plugins/obsidian-chat-assistant/` folder
3. Enable the plugin in Obsidian's settings
4. Configure your OpenAI API key in the plugin settings

### Manual Installation
1. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/obsidian-chat-assistant/` folder
2. Enable the plugin in Obsidian's settings
3. Configure your OpenAI API key in the plugin settings

## Development

### Prerequisites
- Node.js 16+ (`node --version`)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-chat-assistant.git

# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build
```

### Hot Reload Support
This plugin supports hot reloading during development. Make sure you have the [Hot Reload plugin](https://github.com/pjeby/hot-reload) installed in your Obsidian vault for the best development experience.

### Project Structure
```
src/
├── commands/       # Command parsing logic
├── components/     # React components for UI
├── core/          # Core routing and integration
├── managers/      # Approval and state management
├── modals/        # Obsidian modal components
├── settings/      # Plugin settings
├── tools/         # Command implementations
├── types/         # TypeScript type definitions
└── views/         # Obsidian view components
```

## Usage

1. Open the Chat Assistant by clicking the ribbon icon or using the command palette
2. Type slash commands to interact with your vault:
   - `/note "My New Note"` - Creates a new note
   - `/note "Existing Note" Additional content` - Adds content to an existing note
   - `/search obsidian plugins` - Searches your vault for relevant notes
   - `/help` - Shows all available commands

3. All modifications require approval (can be disabled in settings)

## Configuration

Access plugin settings through Obsidian's settings panel:

- **OpenAI API Key**: Required for AI features (coming in v1)
- **AI Model**: Choose between GPT-4 Turbo, GPT-4, or GPT-3.5 Turbo
- **Max Tokens**: Set the maximum response length
- **Require Approval**: Toggle approval requirement for vault modifications

## Roadmap

### Version 1
- OpenAI Agents SDK integration for intelligent responses
- Web research with Exa API (`/research` command)
- Streaming responses with real-time updates

### Version 2
- Voice note transcription with Whisper
- Image attachments and file linking
- Mobile-optimized interface (FAB, bottom sheets)
- Plugin API for third-party tool registration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

If you find this plugin useful, consider supporting its development:
- [GitHub Sponsors](https://github.com/sponsors/yourusername)
- [Buy Me a Coffee](https://buymeacoffee.com/yourusername)