import type { IncomingMessage, ServerResponse } from "node:http";
import type { IHTTPHandler } from "../ports/IHTTPHandler";
import { LLMSelector } from '../../nivel2/infrastructure/services/llm-selector';

/**
 * Use Case: API de Chat
 */
export class ChatAPIHandler implements IHTTPHandler {
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "";

    if (url === "/chat/send") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const message = JSON.parse(body);
          console.log("💬 [ChatAPI] Received message:", message.text);

          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          try {
            const vscode = await import("vscode");

            // Use best available model (Claude Sonnet 4.5, GPT-4o, etc)
            const model = await LLMSelector.selectBestModel();

            if (!model) {
              throw new Error("No language model available");
            }

            console.log("🤖 [ChatAPI] Using model:", model.name);

            const messages: Array<import("vscode").LanguageModelChatMessage> = [];

            if (message.history && Array.isArray(message.history)) {
              for (const msg of message.history) {
                messages.push(vscode.LanguageModelChatMessage.User(msg.content));
              }
            }

            messages.push(vscode.LanguageModelChatMessage.User(message.text));

            const stream = await model.sendRequest(
              messages,
              {},
              new vscode.CancellationTokenSource().token
            );

            for await (const chunk of stream.text) {
              const data = JSON.stringify({ type: "textDelta", text: chunk });
              res.write(`data: ${data}\n\n`);
            }

            const doneData = JSON.stringify({ type: "done" });
            res.write(`data: ${doneData}\n\n`);
            res.end();
          } catch (vscodeError) {
            console.warn("⚠️ [ChatAPI] VS Code API not available, using fallback:", vscodeError);

            const responses = [
              "Olá! ",
              "Sou o Cappy rodando ",
              "no modo de desenvolvimento. ",
              `\n\nVocê disse: "${message.text || ""}"\n\n`,
              "Não consegui acessar o Copilot. ",
              "Certifique-se de que está rodando dentro do VS Code. 🎭",
            ];

            for (const text of responses) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              const data = JSON.stringify({ type: "textDelta", text });
              res.write(`data: ${data}\n\n`);
            }

            const doneData = JSON.stringify({ type: "done" });
            res.write(`data: ${doneData}\n\n`);
            res.end();
          }
        } catch (error) {
          console.error("❌ [ChatAPI] Error:", error);
          const errorData = JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          });
          res.write(`data: ${errorData}\n\n`);
          res.end();
        }
      });

      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Chat endpoint not found" }));
  }
}
