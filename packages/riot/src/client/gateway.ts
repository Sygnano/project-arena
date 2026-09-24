import { RiotApiError } from "../errors.js";
import type { Priority } from "../priority.js";
import {
  GATEWAY_PRIORITY_HEADER,
  GATEWAY_SECRET_HEADER,
  type GatewayEvent,
  type GatewayFailure,
  type GatewayHold,
} from "../protocol.js";
import { RiotClient } from "./riotClient.js";
import { readEvents } from "./sse.js";

export interface RiotGatewayOptions {
  /** The gateway's address, e.g. `http://localhost:3002`. */
  url: string;
  /** Its `RIOT_GATEWAY_SECRET`, when it has one. */
  secret?: string;
  /** Tries per request while the gateway can't be reached. Default 5. */
  maxAttempts?: number;
  /** Nothing from the gateway for this long means the connection is dead.
   * It sends a heartbeat every 15s while a request waits. Default 45s. */
  idleTimeoutMs?: number;
}

export interface GatewayRequestOptions {
  priority: Priority;
  /** Called with each hold while the request waits at the gateway, and with
   * null once it no longer does (answered, failed or given up on). */
  onHold?: (hold: GatewayHold | null) => void;
}

/** Where one try ended. `retry` is the gateway's fault, never Riot's. */
type Attempt =
  | { kind: "ok"; data: unknown }
  | { kind: "failure"; failure: GatewayFailure }
  | { kind: "retry"; reason: string; afterMs?: number };

/** 2s, 4s, 8s, ... capped at 30s. */
function backoffMs(attempt: number) {
  return Math.min(2000 * 2 ** (attempt - 1), 30_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeNetworkError(err: unknown) {
  if (!(err instanceof Error)) return String(err);
  const code = (err.cause as { code?: string } | undefined)?.code;
  return code ? `${err.message} (${code})` : err.message;
}

/**
 * The way to Riot for every process but the gateway itself: each request
 * goes to the Riot gateway (apps/riot-gateway), which holds the key, rate
 * limits per Riot host and runs requests by priority, and streams back
 * Riot's answer (see protocol.ts).
 *
 * Riot's own 429s, 5xx and network failures are retried by the gateway;
 * this only retries reaching the gateway (connection refused, a stream cut
 * before its answer, a 5xx from the gateway), with backoff. A request
 * waiting its turn is never timed out: only silence (no heartbeat) is. Use `client(priority)` for the typed endpoints.
 */
export class RiotGateway {
  private readonly baseUrl: string;
  private readonly maxAttempts: number;
  private readonly idleTimeoutMs: number;

  constructor(private readonly options: RiotGatewayOptions) {
    this.baseUrl = options.url.replace(/\/+$/, "");
    this.maxAttempts = options.maxAttempts ?? 5;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 45_000;
  }

  /** The Riot endpoints, every call in this bucket. `onHold` as in `request`. */
  client(priority: Priority, options: { onHold?: GatewayRequestOptions["onHold"] } = {}): RiotClient {
    return new RiotClient(this, { priority, onHold: options.onHold });
  }

  /**
   * One Riot request through the gateway: `path` from `gatewayPaths`,
   * `describe` names it in errors. Resolves with Riot's parsed body; throws
   * `RiotApiError` with Riot's status when Riot refused it or kept failing,
   * or with status 0 when the gateway stayed out of reach.
   */
  async request<T>(
    path: string,
    query: Record<string, string | number | undefined> | undefined,
    describe: string,
    options: GatewayRequestOptions,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let held = false;
    const onHold = (hold: GatewayHold) => {
      held = true;
      options.onHold?.(hold);
    };
    try {
      for (let attempt = 1; ; attempt++) {
        let result: Attempt;
        try {
          result = await this.attempt(url, options.priority, onHold);
        } catch (err) {
          result = { kind: "retry", reason: describeNetworkError(err) };
        }
        if (result.kind === "ok") return result.data as T;
        if (result.kind === "failure") {
          const { status, message, fatal } = result.failure;
          throw new RiotApiError(status, `${message} [${describe}]`, fatal);
        }
        if (attempt >= this.maxAttempts) {
          throw new RiotApiError(
            0,
            `Riot gateway at ${this.baseUrl} failed ${attempt} times: ${result.reason} [${describe}]`,
          );
        }
        await sleep(result.afterMs ?? backoffMs(attempt));
      }
    } finally {
      if (held) options.onHold?.(null);
    }
  }

  /** One try: the request, then its event stream until the answer. */
  private async attempt(url: URL, priority: Priority, onHold: (hold: GatewayHold) => void): Promise<Attempt> {
    const controller = new AbortController();
    let idle: ReturnType<typeof setTimeout> | undefined;
    const resetIdle = () => {
      clearTimeout(idle);
      idle = setTimeout(
        () => controller.abort(new Error(`no data for ${this.idleTimeoutMs / 1000}s`)),
        this.idleTimeoutMs,
      );
    };
    resetIdle();
    try {
      const headers: Record<string, string> = { accept: "text/event-stream", [GATEWAY_PRIORITY_HEADER]: priority };
      if (this.options.secret) headers[GATEWAY_SECRET_HEADER] = this.options.secret;
      const res = await fetch(url, { headers, signal: controller.signal });

      if (res.status >= 500) {
        await res.body?.cancel();
        return { kind: "retry", reason: `gateway answered ${res.status}` };
      }
      if (res.status === 403) {
        await res.body?.cancel();
        return {
          kind: "failure",
          failure: {
            status: 403,
            message: "Riot gateway refused the request: RIOT_GATEWAY_SECRET differs from the gateway's",
            fatal: true,
          },
        };
      }
      if (!res.ok || !res.body) {
        const body = await res.text();
        return {
          kind: "failure",
          failure: {
            status: res.status,
            message: `Riot gateway answered ${res.status}: ${body.slice(0, 200)}`,
            fatal: false,
          },
        };
      }

      for await (const event of readEvents(res.body, resetIdle)) {
        const message = event as GatewayEvent;
        if (message.event === "hold") onHold(message.data);
        else if (message.event === "response") return { kind: "ok", data: message.data };
        else if (message.event === "error") return { kind: "failure", failure: message.data };
      }
      return { kind: "retry", reason: "stream ended before an answer" };
    } finally {
      clearTimeout(idle);
    }
  }
}
