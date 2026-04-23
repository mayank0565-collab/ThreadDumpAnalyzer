# ThreadScope

ThreadScope is a dependency-free browser application for detailed Java thread dump analysis.

## Features

- Paste or upload thread dumps directly in the browser
- Compare multiple snapshots by uploading several dump files or separating pasted dumps with `===== SNAPSHOT =====`
- Auto-detect multiple snapshots from raw log files that contain repeated thread dumps
- Summarize thread state distribution and contention metrics
- Highlight blocked threads, repeated stack hotspots, and likely deadlock cycles
- Surface cross-snapshot trends such as persistent blocked threads, state deltas, and recurring hotspots
- Group threads into pools such as HTTP executors, ForkJoin pools, Hikari, schedulers, Kafka, and JVM system threads
- Trace root-cause lock chains from waiters to owners and onward to the next blocking dependency
- Visualize state movement with timeline-style snapshot views
- Drill into the same thread across snapshots to follow state, top frame, waits, and held locks over time
- Compare any two snapshots side by side and export the current analysis as Markdown, HTML, or JSON
- Show monitor ownership and waiter relationships
- Filter and inspect per-thread stack traces

## Run

```bash
node server.js
```

Then open `http://localhost:4173`.

## Verify

```bash
npm run smoke
```

## Notes

- The parser is designed for common HotSpot-style thread dumps
- Deadlock detection is inferred from visible lock ownership and waiting edges in the dump
- A single dump is useful for snapshot analysis, but repeated dumps over time provide stronger diagnosis
