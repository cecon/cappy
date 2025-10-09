// Tool para executar comandos no terminal com interação do usuário
import { exec } from 'child_process';

export interface TerminalCommandOptions {
  command: string;
  onData?: (data: string) => void;
  onClose?: (code: number) => void;
}

export function runTerminalCommand(options: TerminalCommandOptions) {
  const process = exec(options.command);

  process.stdout?.on('data', (data) => {
    if (options.onData) options.onData(data);
  });

  process.stderr?.on('data', (data) => {
    if (options.onData) options.onData(data);
  });

  process.on('close', (code) => {
    if (options.onClose) options.onClose(code ?? 0);
  });

  return process;
}

// Exemplo de uso:
// runTerminalCommand({
//   command: 'dir',
//   onData: (data) => {
//     // Aqui pode pedir interação do usuário, ex: prompt para continuar
//     console.log('Saída:', data);
//   },
//   onClose: (code) => {
//     console.log('Processo finalizado com código', code);
//   }
// });
