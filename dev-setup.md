# Development Setup Guide

## Quick Start

1. **Install Hot-Reload Plugin**
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone https://github.com/pjeby/hot-reload.git
   ```

2. **Link Your Development Plugin**
   ```bash
   # Option 1: Symlink (recommended)
   ln -s /Users/lewi/Documents/projects/obsidian-agent /path/to/your/vault/.obsidian/plugins/obsidian-chat-assistant

   # Option 2: Copy files
   cp -r /Users/lewi/Documents/projects/obsidian-agent /path/to/your/vault/.obsidian/plugins/obsidian-chat-assistant
   ```

3. **Enable Plugins in Obsidian**
   - Settings → Community plugins → Enable "Hot Reload"
   - Settings → Community plugins → Enable "Obsidian Chat Assistant"

4. **Start Development**
   ```bash
   npm run dev
   ```

## How It Works

- The `.hotreload` file marks your plugin as hot-reloadable
- When `main.js` changes, the plugin automatically reloads
- No need to manually reload Obsidian or toggle the plugin

## Troubleshooting

### Plugin Not Reloading?
1. Check that `.hotreload` file exists in your plugin root
2. Ensure both plugins are enabled in Obsidian
3. Check console for any errors (Ctrl/Cmd + Shift + I)

### Changes Not Showing?
1. Make sure `npm run dev` is running
2. Check that esbuild is compiling successfully
3. Try manually disabling/enabling the plugin once

### Performance Issues?
- The hot-reload plugin checks for changes every 200ms
- If you experience lag, you can temporarily disable hot-reload

## Development Tips

1. **Keep the console open** (Ctrl/Cmd + Shift + I) to see errors
2. **Use console.log** for debugging - outputs appear in the console
3. **React DevTools** work with Obsidian - install the browser extension
4. **Test on mobile** using Obsidian Sync or manual file transfer