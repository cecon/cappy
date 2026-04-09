#!/usr/bin/env node

/**
 * Simple architecture documentation generator for the Cappy project.
 * It scans the repository tree and creates a markdown file `ARCHITECTURE.md`
 * with a brief description of top‑level directories and the list of available
 * commands (found under `src/commands`).
 */

const fs = require('fs');
const path = require('path');

// Root of the repository (assume script is run from project root or from within .agents)
const repoRoot = path.resolve(__dirname, '../../../');

// Helper to list immediate sub‑directories (excluding common ignored folders)
function listTopLevelDirs(root) {
  const ignore = new Set(['.git', 'node_modules', '.agents', '.tmp-openclaude', 'dist', 'out', 'build']);
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !ignore.has(dirent.name))
    .map(dirent => dirent.name);
}

// Helper to list command files under src/commands (ts/tsx files)
function listCommands() {
  const commandsPath = path.join(repoRoot, 'src', 'commands');
  if (!fs.existsSync(commandsPath)) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(tsx?|js)$/.test(entry.name)) {
        // Derive command name from relative path inside src/commands
        const rel = path.relative(commandsPath, full);
        const cmd = rel.replace(/\.(tsx?|js)$/, '');
        files.push(cmd);
      }
    }
  };
  walk(commandsPath);
  return files;
}

function generate() {
  const dirs = listTopLevelDirs(repoRoot);
  const commands = listCommands();

  const lines = [];
  lines.push('# Arquitetura do Projeto Cappy');
  lines.push('');
  lines.push('## Estrutura de Diretórios Principais');
  lines.push('');
  dirs.forEach(dir => {
    lines.push(`- **${dir}** – ${describeDir(dir)}`);
  });
  lines.push('');
  lines.push('## Comandos Disponíveis');
  lines.push('');
  if (commands.length) {
    commands.sort();
    commands.forEach(cmd => {
      lines.push(`- \`cappy ${cmd}\``);
    });
  } else {
    lines.push('_Nenhum comando encontrado._');
  }
  lines.push('');
  lines.push('_Este documento foi gerado automaticamente pelo skill `architecture-doc`._');

  const outPath = path.join(repoRoot, 'ARCHITECTURE.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Documento de arquitetura criado em ${outPath}`);
}

/**
 * Simple heuristic description based on known top‑level folder names.
 */
function describeDir(name) {
  const map = {
    '.agents': 'Contém skills e agentes personalizados.',
    '.github': 'Workflows e ações do GitHub.',
    'src': 'Código fonte principal da aplicação (TypeScript/React).',
    'public': 'Recursos estáticos servidos pela aplicação.',
    'scripts': 'Scripts auxiliares de build e manutenção.',
    'docs': 'Documentação do projeto.',
    'test': 'Testes unitários e de integração.',
    'dist': 'Arquivos compilados / build de produção.',
  };
  return map[name] || 'Diretório do projeto.';
}

generate();
