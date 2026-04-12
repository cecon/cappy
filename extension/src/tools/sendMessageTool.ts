import {
  receiveMessages,
  sendSwarmMessage,
} from "../agent/agentMailbox";
import type { SwarmMessage, SwarmMessageType } from "../agent/agentMailbox";
import type { ToolDefinition } from "./toolTypes";

interface SendMessageParams {
  /** Target agentId, or "*" to broadcast to all registered agents except sender. */
  to: string;
  /** The agentId of the sending agent. */
  from: string;
  /** Message body — free-form text or JSON string. */
  payload: string;
  /** Message semantics (default: "message"). */
  type?: SwarmMessageType;
}

interface SendMessageResult {
  /** Number of mailboxes the message was delivered to. */
  delivered_to: number;
  /** Messages waiting in the sender's own mailbox after this send. */
  my_pending_messages: SwarmMessage[];
}

/**
 * Sends a message to a specific agent or broadcasts to all agents in the swarm.
 * Also drains and returns any messages waiting in the sender's own mailbox,
 * so the caller can react to replies in a single round-trip.
 */
export const sendMessageTool: ToolDefinition<SendMessageParams, SendMessageResult> = {
  name: "SendMessage",
  description:
    "Sends a message to a specific agent (by agentId) or broadcasts to all agents (to: \"*\"). " +
    "Also returns any messages waiting in the sender's mailbox. " +
    "Message types: message | plan_approval_request | plan_approval_response | shutdown_request | shutdown_response.",
  parameters: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Target agentId or \"*\" for broadcast to all agents except the sender.",
      },
      from: {
        type: "string",
        description: "agentId of the sending agent.",
      },
      payload: {
        type: "string",
        description: "Message content — free-form text, JSON, or a structured command.",
      },
      type: {
        type: "string",
        enum: [
          "message",
          "plan_approval_request",
          "plan_approval_response",
          "shutdown_request",
          "shutdown_response",
        ],
        description: "Semantic type of the message. Default: \"message\".",
      },
    },
    required: ["to", "from", "payload"],
    additionalProperties: false,
  },

  async execute(params) {
    const msgType: SwarmMessageType = params.type ?? "message";

    const deliveredTo = sendSwarmMessage({
      to: params.to,
      from: params.from,
      payload: params.payload,
      type: msgType,
    });

    const myPending = receiveMessages(params.from);

    return {
      delivered_to: deliveredTo,
      my_pending_messages: myPending,
    };
  },
};
