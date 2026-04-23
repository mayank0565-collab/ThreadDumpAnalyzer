import fs from "node:fs";
import vm from "node:vm";

function makeElement(id) {
  return {
    id,
    value: "",
    innerHTML: "",
    textContent: "",
    className: "",
    files: [],
    style: {},
    listeners: {},
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    },
    click() {
      if (this.listeners.click) {
        this.listeners.click({ target: this });
      }
    },
  };
}

const ids = [
  "dumpInput",
  "analyzeBtn",
  "clearBtn",
  "sampleBtn",
  "fileInput",
  "multiFileInput",
  "statusText",
  "heroStats",
  "summaryGrid",
  "findings",
  "lockGraph",
  "poolPanel",
  "lockChainsPanel",
  "comparisonPanel",
  "timelinePanel",
  "historyThreadSelect",
  "threadHistoryPanel",
  "leftSnapshotSelect",
  "rightSnapshotSelect",
  "snapshotDiffPanel",
  "exportFormatSelect",
  "exportBtn",
  "exportStatus",
  "ownershipPanel",
  "threadList",
  "threadSearch",
  "stateFilter",
];

const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
let downloaded = null;

elements.stateFilter.value = "ALL";
elements.historyThreadSelect.value = "";
elements.exportFormatSelect.value = "json";

const document = {
  body: {
    appendChild() {},
    removeChild() {},
  },
  querySelector(selector) {
    if (!selector.startsWith("#")) {
      throw new Error(`Unsupported selector ${selector}`);
    }
    if (!elements[selector.slice(1)]) {
      throw new Error(`Missing element ${selector}`);
    }
    return elements[selector.slice(1)];
  },
  createElement(tag) {
    if (tag !== "a") {
      throw new Error(`Unsupported element ${tag}`);
    }
    return {
      href: "",
      download: "",
      style: {},
      click() {
        downloaded = { href: this.href, download: this.download };
      },
    };
  },
};

const context = {
  Blob,
  URL: {
    createObjectURL(blob) {
      return `blob://threadscope/${blob.size}`;
    },
    revokeObjectURL() {},
  },
  clearTimeout,
  console,
  document,
  setTimeout,
  window: null,
};

context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../src/analyzer.js", import.meta.url), "utf8"), context);
vm.runInContext(fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8"), context);

if (!elements.sampleBtn.listeners.click) {
  throw new Error("sample button listener missing");
}

elements.sampleBtn.listeners.click({ target: elements.sampleBtn });

if (!/Auto-detected 3 snapshots/.test(elements.statusText.textContent)) {
  throw new Error(`Unexpected sample-load status: ${elements.statusText.textContent}`);
}

if (!/pool-card/.test(elements.poolPanel.innerHTML)) {
  throw new Error("Pool panel did not render.");
}

if (!/chain-card/.test(elements.lockChainsPanel.innerHTML)) {
  throw new Error("Lock chain panel did not render.");
}

if (!/Mayank Vashishtha/.test(elements.ownershipPanel.innerHTML)) {
  throw new Error("Ownership panel did not render the author metadata.");
}

if (!/comparison-card/.test(elements.comparisonPanel.innerHTML)) {
  throw new Error("Comparison panel did not render.");
}

if (!/timeline-card/.test(elements.timelinePanel.innerHTML)) {
  throw new Error("Timeline panel did not render.");
}

if (!/history-card/.test(elements.threadHistoryPanel.innerHTML)) {
  throw new Error("Thread history panel did not render.");
}

if (!/diff-card/.test(elements.snapshotDiffPanel.innerHTML)) {
  throw new Error("Snapshot diff panel did not render.");
}

elements.exportBtn.listeners.click({ target: elements.exportBtn });

if (!downloaded || downloaded.download !== "threadscope-report.json") {
  throw new Error("Export did not trigger a JSON report download.");
}

if (!/Exported JSON report/.test(elements.exportStatus.textContent)) {
  throw new Error(`Unexpected export status: ${elements.exportStatus.textContent}`);
}

elements.threadSearch.value = "deadlock";
elements.threadSearch.listeners.input({ target: elements.threadSearch });

if (!/deadlock-left/.test(elements.threadList.innerHTML)) {
  throw new Error("Thread filter did not render expected deadlock thread.");
}

elements.clearBtn.listeners.click({ target: elements.clearBtn });

if (elements.statusText.textContent !== "Ready") {
  throw new Error("Clear action did not reset the app state.");
}

console.log("ThreadScope smoke test passed.");
