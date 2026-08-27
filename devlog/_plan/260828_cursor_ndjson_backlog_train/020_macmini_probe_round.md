# 020 — wp3: macmini-cf live probe round (NDJSON empiricism)

Host: macmini-cf (junny). Proxy: ~/opencodex, launchd com.opencodex.proxy,
port 10100. Codex CLI: /Users/junny/.bun/bin/codex.

## Procedure

1. Sync: git -C ~/opencodex fetch origin dev + fetch the wp2 branch from
   origin; check out a probe worktree or reset dev checkout to
   origin/dev + cherry of wp2 branch head (repo checkout is clean; keep a
   pre-state ref snapshot). Restart launchd service; verify /healthz version.
2. Probe matrix (codex exec --json -m cursor/grok-4.6 unless noted), scratch
   cwds under mktemp -d, transcripts + NDJSON to ~/ocx-probe-260828/:
   - N1 5-step chain (090 S4 shape): mkdir/write/read/compute/verify — the
     empty-tool-result trigger scenario. >=6 runs to chase the intermittent
     empty delivery; capture codex exec --json event stream per run.
   - N2 deep checkpoint session: >=8 tool rounds same thread (exercises
     checkpoint suffix path request-builder.ts:472).
   - N3 zero-stdout commands (true; mkdir; export) — defect #3 activation.
   - N4 stalled-consumer live check for wp2 (curl -N | slow reader).
   - N5 usage.jsonl integrity tail — schema + usageStatus after rounds.
   - Controls: same probes via xai/grok-4.6 where defect could be
     model-class.
3. Evidence per probe: command, exit, NDJSON line excerpts (event types,
   call ids, output byte counts), usage.jsonl rows, PASS/FAIL vs expected.

## Decision gate feeding wp4

- Empty result reproduced with NDJSON showing nonempty local result but
  model-visible blank -> adapter boundary per 002 #1 -> wp4 instrumentation
  phase targets the implicated stage.
- Not reproduced in >=6 N1 runs + N2 -> defect #1 downgraded to WATCH with
  bounds recorded; wp4 ships #3 fix + instrumentation only.
