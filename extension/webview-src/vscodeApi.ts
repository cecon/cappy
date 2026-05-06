import type { HostToWebview, WebviewToHost } from "../src/chat/protocol.js";

interface VsCodeApi {
  postMessage(msg: WebviewToHost): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let cached: VsCodeApi | undefined;

function api(): VsCodeApi {
  if (!cached) {
    cached = acquireVsCodeApi();
  }
  return cached;
}

export function postToHost(msg: WebviewToHost): void {
  api().postMessage(msg);
}

export function onHostMessage(handler: (msg: HostToWebview) => void): () => void {
  const listener = (event: MessageEvent<HostToWebview>): void => {
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function persistState<T>(state: T): void {
  api().setState(state);
}

export function readState<T>(): T | undefined {
  return api().getState<T>();
}
