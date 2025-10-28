import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Port: Interface para handlers HTTP
 */
export interface IHTTPHandler {
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

/**
 * Port: Roteador HTTP
 */
export interface IHTTPRouter {
  register(pattern: string, handler: IHTTPHandler): void;
  route(url: string, req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}
