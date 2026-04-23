# ThreadScope

ThreadScope is a privacy-first Java thread dump analyzer that runs entirely in the browser. It is designed for GitHub Pages hosting and for inspecting sensitive production dumps without sending any dump content to a backend, analytics service, or external API.

## Privacy

All processing happens locally in your browser. No data is uploaded.

- Thread dumps are parsed in client-side JavaScript.
- Sample data is bundled locally in the repo.
- Exports are generated in-browser as downloadable files.
- `server.js` is only an optional local static-file helper and is not required for the analyzer itself.

## What It Does

- Paste a single dump or upload a `.txt`, `.log`, or `.out` file
- Detect multiple snapshots from explicit separators or log-style thread dump boundaries
- Parse common HotSpot / `jstack` thread dump structures
- Summarize thread states, pool groupings, lock ownership, and wait relationships
- Detect likely deadlock cycles and contention chains
- Highlight repeated stack hotspots and persistent blocked threads across snapshots
- Compare snapshot pairs and inspect per-thread history over time
- Export results as Markdown, HTML, or JSON

## Runtime Model

- `index.html` loads `src/analyzer.js` and `src/app.js` directly
- `src/analyzer.js` contains snapshot extraction, parsing, lock modeling, and comparison logic
- `src/app.js` handles browser UI, local file reading, rendering, and export
- `styles.css` provides the static visual design
- `server.js` serves the static files for local convenience only

Because the app uses relative asset paths and no backend APIs, it remains compatible with GitHub Pages static hosting.

## Running Locally

You can open `index.html` directly in a browser, or serve the repository with any static file server.

If Node.js is available locally:

```bash
node server.js
```

Then open `http://127.0.0.1:4173`.

## Validation

If Node.js is available locally:

```bash
npm test
```

Available scripts:

- `npm test` runs analyzer assertions plus the DOM smoke test
- `npm run smoke` runs the UI smoke test only

## Sample Inputs

The repository includes deterministic sample inputs under `data/`:

- `sample-single-dump.txt`
- `sample-multi-snapshots.txt`
- `sample-snapshot-1.txt`
- `sample-snapshot-2.txt`
- `sample-snapshot-3.txt`

The in-app sample button uses bundled sample snapshots so the demo works offline and on GitHub Pages.

## Supported Input Patterns

ThreadScope is tuned for common JVM dump formats, including:

- standard quoted thread headers from `jstack`
- `java.lang.Thread.State` lines
- monitor waits such as `- waiting to lock <...>`
- monitor ownership such as `- locked <...>`
- parked lock waits such as `- parking to wait for <...>`
- ownable synchronizer sections
- repeated dumps embedded in log files

Malformed or partial dumps are handled defensively where possible, and the UI surfaces parse notes when details had to be inferred.

## Limitations

- Deadlock detection is inferred from visible ownership and wait edges in the captured dump
- Missing thread identifiers or truncated dumps reduce matching accuracy across snapshots
- JVM-specific and vendor-specific formats outside common HotSpot-style dumps may require further parser tuning
- Very large dumps still incur client-side parsing and rendering cost, although the UI now limits initial thread rendering to stay responsive

## Project Structure

- `index.html`: static UI shell
- `styles.css`: layout and visual styling
- `src/analyzer.js`: parser and analysis engine
- `src/app.js`: browser interactions and rendering
- `scripts/analyzer-test.js`: analyzer-level assertions
- `scripts/smoke-test.js`: UI smoke test
- `server.js`: optional local static server

## Follow-Up Ideas

- Move parsing and analysis to a Web Worker for even better large-dump responsiveness
- Add more vendor-specific parser fixtures and regression tests
- Expand lock modeling for additional AQS and JVM-specific synchronizer patterns
