# 010 — wp2: backlog-abort fix (stack base A, PR vs dev)

Branch: codex/runturn-backlog-coalesce (from origin/dev). One PR.

## Diff-level changes

### 1. MODIFY src/adapters/run-turn-queue.ts — push-time coalescing

In createAdapterEventQueue push(): when no reader is waiting and the queue
tail exists:
- tail.type === "text_delta" && event.type === "text_delta" && same phase ->
  replace tail with { type:"text_delta", text: tail.text + event.text,
  phase: tail.phase } (do NOT mutate the original object; queued events may
  be shared).
- tail.type === "thinking_delta" && event.type === "thinking_delta" ->
  merge thinking strings likewise.
- event.type === "heartbeat" && tail.type === "heartbeat" -> drop event
  (one pending heartbeat is enough).
- All other types append as today. Never merge across a non-delta boundary;
  tool_call_delta is NOT coalesced (argument chunk order is load-bearing for
  JSON reassembly but adjacent-merge would be safe — still excluded from
  this PR to keep the diff minimal and provably safe).
- Backlog check unchanged (queued.length >= maxBacklog), but with coalescing
  the count now approximates buffered ITEMS not tokens.

### 2. MODIFY src/adapters/run-turn-queue.ts — honest overflow message

Error message becomes "consumer stalled: adapter event backlog exceeded —
turn aborted" and the pushed error gains status/retryable hints untouched
(plain message error as today). Update the two tests asserting the string.

### 3. Tests — MODIFY tests/run-turn-queue.test.ts

- NEW: 5000 alternating-text deltas with no reader -> backlog stays 1 merged
  text item (+ terminal), no overflow, collect() returns concatenated text.
- NEW: heartbeat collapse — 50 heartbeats no reader -> 1 queued heartbeat.
- NEW: interleaved text/tool/text does not merge across the tool event.
- NEW: phase-boundary text deltas (phase change) do not merge.
- KEEP: overflow still fires for 1024+ DISTINCT non-coalescible events
  (e.g. tool_call_start floods) and message updated.

### 4. MODIFY tests/abort-race.test.ts — message string sync.

## Accept criteria + activation

1. bun test tests/run-turn-queue.test.ts exit 0 (activation: coalesce tests
   drive push path with no reader — the exact incident shape).
2. bun test tests/abort-race.test.ts exit 0.
3. Live: macmini-cf proxy on this branch survives a deliberately stalled
   consumer (curl -N piped to sleep-heavy reader) for >60s of grok-4.6
   token streaming without turn abort; verified in wp3 probe round.

## Out of scope

Bun disconnect-latency itself (runtime-level), byte-based caps, bridge HWM.
