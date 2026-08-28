import { describe, expect, test } from "bun:test";
import { createOllamaNativeAdapter } from "../src/adapters/ollama-native";
import { createTestTranslatorBudget } from "./helpers/translator-budget";
import { REASONING_EFFORT_OMIT_SENTINEL } from "../src/reasoning-effort";
import type { AdapterEvent } from "../src/types";
import type { OcxParsedRequest, OcxProviderConfig } from "../src/types";

function provider(overrides: Partial<OcxProviderConfig> = {}): OcxProviderConfig {
  return {
    adapter: "ollama-native",
    baseUrl: "https://ollama.com/v1",
    authMode: "key",
    apiKey: "test-key-not-a-real-credential",
    liveModels: false,
    models: ["glm-5.3-flash"],
    ...overrides,
  } as OcxProviderConfig;
}

function parsedWith(options: Record<string, unknown> = {}, modelId = "glm-5.3-flash"): OcxParsedRequest {
  return { modelId, stream: true, options, context: { messages: [{ role: "user", content: "hi" }] } } as unknown as OcxParsedRequest;
}

/**
 * V4 corrections: EOF accounting parity and boundary-first omit semantics.
 */

describe("ollama-native — EOF vs newline accounting parity", () => {
  /** One buffered terminal record: `textSize` content + one tool call with `argSize` of arguments. */
  function record(textSize: number, argSize: number): Record<string, unknown> {
    return {
      model: "m",
      message: {
        role: "assistant",
        content: "r".repeat(textSize),
        tool_calls: [{
          index: 0, type: "function", id: "c0",
          function: { name: "ns_x__f", arguments: { blob: "a".repeat(argSize) } },
        }],
      },
      done: true,
      done_reason: "stop",
      prompt_eval_count: 1,
      eval_count: 1,
    };
  }

  async function run(rec: unknown, eof: boolean) {
    const adapter = createOllamaNativeAdapter(provider());
    const budget = createTestTranslatorBudget();
    const text = JSON.stringify(rec) + (eof ? "" : "\n");
    const response = new Response(new TextEncoder().encode(text), {
      headers: { "content-type": "application/x-ndjson" },
    });
    const events: AdapterEvent[] = [];
    for await (const event of adapter.parseStream(response, budget)) events.push(event);
    return { events, snapshot: budget.snapshot() };
  }

  test("small terminal record: identical events and identical outcome for both terminators", async () => {
    const rec = record(4 * 1024 * 1024, 1024 * 1024);
    const nl = await run(rec, false);
    const eof = await run(rec, true);
    expect(eof.events.map(e => e.type)).toEqual(nl.events.map(e => e.type));
    expect(nl.events.some(e => e.type === "tool_call_start")).toBe(true);
    expect(eof.events.at(-1)?.type).toBe("done");
    expect(eof.snapshot.highWaterBytes).toBe(nl.snapshot.highWaterBytes);
  });

  test("near-limit record with substantial tool arguments: same budget outcome for both terminators", async () => {
    // Record itself fits under the per-record ceiling, but parsing it charges the record AND its
    // ~2.5 MiB tool arguments concurrently, which exceeds the 32 MiB turn cap. The
    // newline-terminated path always paid that; an EOF path that released the record early would
    // under-count and admit what the newline path rejects.
    const rec = record(28 * 1024 * 1024, 2.5 * 1024 * 1024);
    const nl = await run(rec, false);
    const eof = await run(rec, true);
    expect(nl.events).toHaveLength(1);
    expect(nl.events[0]).toMatchObject({ type: "error", code: "translation_buffer_limit" });
    expect(eof.events).toHaveLength(1);
    expect(eof.events[0]).toMatchObject({ type: "error", code: "translation_buffer_limit" });
  });
});

describe("ollama-native — omit sentinel under the ultra boundary", () => {
  test("ultra→__omit__ with max→high must CLAMP, not omit (boundary-first)", async () => {
    const adapter = createOllamaNativeAdapter({
      ...provider(),
      models: ["glm-5.3-flash"],
      modelReasoningEfforts: { "glm-5.3-flash": ["low", "medium", "high"] },
      modelReasoningEffortMap: {
        "glm-5.3-flash": { ultra: REASONING_EFFORT_OMIT_SENTINEL, max: "high" },
      },
    } as never);
    const { body } = await adapter.buildRequest(parsedWith({ reasoning: "ultra" }));
    expect(JSON.parse(String(body)).think).toBe("high");
  });

  test("max→__omit__ is honoured (inverse control)", async () => {
    const adapter = createOllamaNativeAdapter({
      ...provider(),
      modelReasoningEffortMap: { "glm-5.3-flash": { max: REASONING_EFFORT_OMIT_SENTINEL } },
    } as never);
    const { body } = await adapter.buildRequest(parsedWith({ reasoning: "max" }));
    expect(JSON.parse(String(body))).not.toHaveProperty("think");
  });

  test("none→__omit__ omits: the explicit mapping outranks the native none=>false fallback", async () => {
    const adapter = createOllamaNativeAdapter({
      ...provider(),
      modelReasoningEffortMap: { "glm-5.3-flash": { none: REASONING_EFFORT_OMIT_SENTINEL } },
    } as never);
    const { body } = await adapter.buildRequest(parsedWith({ reasoning: "none" }));
    expect(JSON.parse(String(body))).not.toHaveProperty("think");
  });

  test("none without an omit mapping still serializes think:false", async () => {
    const adapter = createOllamaNativeAdapter(provider());
    const { body } = await adapter.buildRequest(parsedWith({ reasoning: "none" }));
    expect(JSON.parse(String(body)).think).toBe(false);
  });
});
