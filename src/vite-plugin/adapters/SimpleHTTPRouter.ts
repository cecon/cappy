import type { IncomingMessage, ServerResponse } from "node:http";
import type { IHTTPHandler, IHTTPRouter } from "../ports/IHTTPHandler";

/**
 * Adapter: Roteador HTTP simples
 */
export class SimpleHTTPRouter implements IHTTPRouter {
  private routes = new Map<string, IHTTPHandler>();

  register(pattern: string, handler: IHTTPHandler): void {
    this.routes.set(pattern, handler);
  }

  async route(url: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    for (const [pattern, handler] of this.routes) {
      if (url.startsWith(pattern)) {
        await handler.handle(req, res);
        return true;
      }
    }
    return false;
  }
}
