## Contributing to Cappy

Thanks for helping improve Cappy. This guide keeps contributions consistent and easy to review.

## Development Environment Setup

1. Fork and clone the repository.
2. Install dependencies from the monorepo root:

```powershell
npm install
```

3. Start local development mode:

```powershell
npm run dev
```

4. For extension debugging, open the project in VS Code and press `F5`.

## Monorepo Structure

- `extension/`: VS Code extension host (commands, agent loop, tool execution bridge)
- `webview/`: React + Vite UI used inside VS Code

## Code Conventions

- Use strict TypeScript.
- Do not introduce `any` (use explicit types, unions, or generics).
- Use CSS Modules for component styling.
- Keep modules focused and prefer small, composable functions.

## Type Checking

Run typecheck from the root before opening a PR:

```powershell
npm run typecheck
```

Expected result: no TypeScript errors in any package.

## Pull Request Guidelines

- **Branch naming:** `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>`
- **Commit message style:** Conventional Commits, for example:
  - `feat(extension): add agent selector state sync`
  - `fix(webview): handle empty tool-call response`
  - `chore(repo): update docs and ignore rules`
- Keep PRs focused on a single concern whenever possible.
- Include a clear description, motivation, and test steps in the PR body.

## Reporting Bugs

Open an issue at [GitHub Issues](https://github.com/eduardocecon/cappy/issues) with:

- what you expected to happen
- what actually happened
- steps to reproduce
- environment details (OS, VS Code version, extension version)
- logs or screenshots when relevant
