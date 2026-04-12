import { existsSync, unlinkSync } from "node:fs";
import net from "node:net";

import { sendSwarmMessage, receiveMessages } from "./agentMailbox";
import type { SwarmMessage } from "./agentMailbox";

/**
 * A simple JSON-newline framing codec for the UDS stream.
 */
function createFrameDecoder(onMessage: (msg: SwarmMessage) => SwarmMessage[]): (chunk: Buffer) => Buffer {
  let buffer = "";
  return (chunk: Buffer): Buffer => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const msg = JSON.parse(trimmed) as SwarmMessage;
        onMessage(msg);
      } catch {
        // Ignore malformed frames
      }
    }
    return Buffer.alloc(0);
  };
}

/**
 * Unix Domain Socket server that bridges cross-session swarm communication.
 *
 * Any process can connect to the socket, send a SwarmMessage as JSON + newline,
 * and receive the sender's pending messages as a JSON array + newline in reply.
 *
 * Socket path: /tmp/cappy-swarm-{sessionId}.sock
 */
export class SwarmSocketServer {
  private server: net.Server | null = null;
  readonly socketPath: string;

  constructor(sessionId: string) {
    this.socketPath = `/tmp/cappy-swarm-${sessionId}.sock`;
  }

  start(): void {
    if (this.server !== null) {
      return;
    }

    // Remove stale socket file from a previous crashed session
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    this.server = net.createServer((socket) => {
      const decode = createFrameDecoder((msg) => {
        sendSwarmMessage({
          from: msg.from,
          to: msg.to,
          payload: msg.payload,
          type: msg.type ?? "message",
        });
        const pending = receiveMessages(msg.from);
        const response = JSON.stringify(pending) + "\n";
        socket.write(response, "utf8");
        return pending;
      });

      socket.on("data", (chunk: Buffer) => {
        decode(chunk);
      });

      socket.on("error", () => {
        socket.destroy();
      });
    });

    this.server.listen(this.socketPath);
  }

  stop(): void {
    if (this.server === null) {
      return;
    }
    this.server.close();
    this.server = null;
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch {
        // Best-effort cleanup
      }
    }
  }
}
