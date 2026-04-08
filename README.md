# Cappy

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Autonomous AI coding companion for VS Code with multi-agent workflows and human-in-the-loop tool execution.

<!-- Screenshot placeholder: add a screenshot or GIF of the Cappy chat panel here -->

## Features

- Multi-agent workflow with `coder`, `planner`, and `reviewer` roles
- Human-in-the-loop (HITL) approval flow for tool calls
- OpenRouter-powered model access
- MCP server support for extending available tools
- VS Code sidebar chat experience with local development support

## Requirements

- Node.js 20+
- `ripgrep` installed and available in `PATH`
- OpenRouter API key

## Installation

### Via Marketplace

Install **Cappy** from the VS Code Marketplace.

### Via VSIX (manual)

Open VS Code, go to **Extensions**, click the `...` menu, then choose **Install from VSIX...**.

## Configuration

### Get an OpenRouter API key

1. Create an account at [OpenRouter](https://openrouter.ai/).
2. Generate an API key in your account settings.
3. Keep the key private.

### Configure in the Cappy Config panel

1. Open the Cappy view in VS Code.
2. Open the **Config** panel.
3. Fill in your OpenRouter key and model settings.
4. Save the configuration.

### `.cappy/config.json` structure

```json
{
  "openrouterApiKey": "or-xxxxxxxxxxxxxxxx",
  "model": "openrouter/auto",
  "agent": "coder",
  "mcpServers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "."
      ]
    }
  ],
  "hitl": {
    "enabled": true
  }
}
```

## Usage

- Open the Cappy chat from the Activity Bar (`Cappy` icon) or command palette.
- Switch agents in the UI between `coder`, `planner`, and `reviewer`.
- Approve or reject tool calls when prompted by HITL.
- Add MCP servers in configuration to extend capabilities.

## Local Development

1. Clone the repository.
2. Install dependencies:

```powershell
npm install
```

3. Run browser development mode with `cli-mock`:

```powershell
npm run dev
```

4. Test inside VS Code:
   - Open the project in VS Code
   - Press `F5` to launch an Extension Development Host
   - Open Cappy and validate the main workflows

## Architecture

High-level monorepo layout:

```text
cappy/
|- extension/   # VS Code extension host (commands, agent loop, tool bridge)
|- webview/     # React/Vite chat UI
|- cli-mock/    # Local mock server for browser/dev mode
`- .cappy/      # User-local config (not committed)
```

Runtime flow:

```text
VS Code UI (webview) <-> extension host <-> models/tools (OpenRouter + MCP)
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
