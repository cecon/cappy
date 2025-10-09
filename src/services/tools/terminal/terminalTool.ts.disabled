import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, ChildProcess } from "child_process";

// Schema para o input da tool
const terminalToolInput = z.object({
  command: z.string().describe("O comando para executar no terminal"),
  workingDirectory: z.string().optional().describe("Diretório de trabalho (opcional)"),
  waitForInput: z.boolean().optional().describe("Se deve aguardar input do usuário")
});

export class TerminalTool extends DynamicStructuredTool {
  constructor() {
    super({
      name: "terminal_executor",
      description: "Executa comandos no terminal e permite interação com o usuário",
      schema: terminalToolInput,
      func: async ({ command, workingDirectory, waitForInput = false }) => {
        return new Promise<string>((resolve, reject) => {
          const childProcess: ChildProcess = spawn(command, [], {
            shell: true,
            cwd: workingDirectory || process.cwd(),
            stdio: waitForInput ? 'inherit' : 'pipe'
          });

          let output = '';
          let errorOutput = '';

          if (!waitForInput) {
            childProcess.stdout?.on('data', (data: Buffer) => {
              output += data.toString();
            });

            childProcess.stderr?.on('data', (data: Buffer) => {
              errorOutput += data.toString();
            });
          }

          childProcess.on('close', (code: number | null) => {
            if (code === 0) {
              resolve(waitForInput ? 
                `Comando executado com sucesso: ${command}` : 
                output || 'Comando executado sem saída'
              );
            } else {
              reject(new Error(`Comando falhou com código ${code}: ${errorOutput}`));
            }
          });

          childProcess.on('error', (error: Error) => {
            reject(new Error(`Erro ao executar comando: ${error.message}`));
          });
        });
      }
    });
  }
}

// Exemplo de uso da tool
export const terminalTool = new TerminalTool();