# 020 — wp3: macmini-cf live probe round (NDJSON empiricism)

Host: macmini-cf (junny). Proxy: ~/opencodex, launchd com.opencodex.proxy,
port 10100. Codex CLI: /Users/junny/.bun/bin/codex.

## Procedure

1. Sync (A-gate blockers 11/12 folded):
   - Environment: /Users/junny/.bun/bin/codex shebang is "env node" and the
     host has NO node on PATH — every probe command must prepend a node
     shim (export PATH with bun's node alias, or "bun x codex"). VERIFY
     "codex --version" works in the actual probe shell BEFORE claiming any
     probe ran; a login-shell (ssh -t or zsh -lc) may differ from plain ssh.
   - The user's ~/opencodex dev checkout is NEVER reset or cherry-picked.
     Mandatory: dedicated probe worktree (git -C ~/opencodex worktree add
     ~/ocx-probe-260828/wt <ref> from fetched refs).
   - Deployment: launchd (com.opencodex.proxy) runs the PRIMARY checkout,
     so the probe proxy runs from the WORKTREE on a separate port (e.g.
     10199) as a foreground/background process started via ssh, leaving the
     launchd service untouched. Record pre-state (git -C ~/opencodex
     status/branch/sha) before and prove identical after (restoration
     proof). Probe codex CLI points at port 10199 via its own
     OPENAI_BASE_URL/config override, never the shared config.
2. Probe matrix (codex exec --json -m cursor/grok-4.6 unless noted), scratch
   cwds under mktemp -d, transcripts + NDJSON to ~/ocx-probe-260828/:
   - N1 5-step chain (090 S4 shape): mkdir/write/read/compute/verify — the
     empty-tool-result trigger scenario. >=6 runs to chase the intermittent
     empty delivery; capture codex exec --json event stream per run.
   - N2 deep checkpoint session: >=8 tool rounds same thread (exercises
     checkpoint suffix path request-builder.ts:472).
   - N3 zero-stdout commands (true; mkdir; export) — defect #3 activation.
     N3 FIRST records how Cursor renders/forwards empty stdout on both the
     unary and streaming channel; the 030 marker ships ONLY if this
     evidence shows the model receives an unexplained blank (A-gate
     blocker 9 — no pre-committed fix).
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
