# 030 — wp4: cursor fixes from probe evidence (stacked)

Branch: codex/cursor-empty-result-trace (stack root: dev, or wp2 branch only
if run-turn-queue files overlap — expected NOT to overlap).

## PR B1: correlated empty-result instrumentation + native zero-stdout marker

### 1. MODIFY src/adapters/cursor/native-exec-shell.ts

- shellExec success with stdout === "" and stderr === "" -> stdout becomes
  "(command completed with no output; exit 0)" — mirrors the bridge-side
  empty-result explanation (tool-result-normalize.ts:108) so the model never
  sees an unexplained blank on the native channel. Guard: only when exit
  code 0 and both streams empty; non-zero exits keep real streams.
- shellStreamExec: when no stdout frame was emitted, emit one synthetic
  stdout frame with the same marker before exit/shellResult/streamClose.

### 2. ADD debug trace (env-gated OCX_CURSOR_TRACE_TOOL_RESULTS=1)

- tool-result-normalize.ts: log requestId, tool name, pre/post byte counts,
  changed, isError (no content bodies — privacy:scan constraint).
- protobuf-request.ts suffix path: continuationMode, coveredCount,
  suffixStart, per-blob byte count + sha256 prefix.
- native-exec.ts getBlobArgs: served byte count + integrity result already
  exists — extend log line with digest prefix.

### 3. Tests

- NEW tests near existing cursor native-exec tests: zero-stdout marker on
  both exec paths; non-zero exit untouched; marker absent when stdout
  nonempty.
- Trace lines: focused test asserting no content bytes are logged (privacy).

## PR B2 (conditional): the boundary fix probe evidence proves

Written after wp3; candidates per 002 #1: checkpoint reserialization of
inherited empty results / alias coverage / replay fidelity. Diff spec added
here as 031 before build (P-phase amendment of the next cycle).

## Accept criteria

bun test <each focused file> exit 0; macmini-cf re-probe shows marker
arriving upstream (N3 re-run); privacy scan of touched files via focused
check; PR template complete.
