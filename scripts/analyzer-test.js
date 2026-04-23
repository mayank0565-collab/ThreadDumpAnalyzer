import fs from "node:fs";
import vm from "node:vm";

function fail(message) {
  throw new Error(message);
}

function loadAnalyzerApi() {
  const context = {
    console,
    window: null,
  };

  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../src/analyzer.js", import.meta.url), "utf8"), context);

  if (!context.ThreadScopeAnalyzer) {
    fail("Analyzer API failed to load.");
  }

  return context.ThreadScopeAnalyzer;
}

function readDataFile(name) {
  return fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8");
}

const analyzer = loadAnalyzerApi();

const singleDump = readDataFile("sample-single-dump.txt");
const singleAnalysis = analyzer.analyzeThreadDump(singleDump);

if (!singleAnalysis.parsed) {
  fail("Sample single dump did not parse.");
}

if (singleAnalysis.threadCount !== 8) {
  fail(`Expected 8 threads in sample single dump, received ${singleAnalysis.threadCount}.`);
}

if ((singleAnalysis.stateCounts.find((item) => item.label === "BLOCKED") || { count: 0 }).count !== 4) {
  fail("Sample single dump should report 4 blocked threads.");
}

if (singleAnalysis.deadlockCycles.length !== 1) {
  fail(`Expected exactly one deadlock cycle, received ${singleAnalysis.deadlockCycles.length}.`);
}

if (!singleAnalysis.deadlockDetails.length || !/deadlock-left/.test(singleAnalysis.deadlockDetails[0].explanation)) {
  fail("Deadlock explanation did not include expected thread names.");
}

if (!singleAnalysis.lockChains.length) {
  fail("Single dump should produce at least one lock chain.");
}

const multiSnapshotText = readDataFile("sample-multi-snapshots.txt");
const snapshots = analyzer.detectSnapshotsFromText(multiSnapshotText);

if (snapshots.length !== 3) {
  fail(`Expected 3 snapshots from sample multi-snapshot input, received ${snapshots.length}.`);
}

const comparison = analyzer.compareThreadDumpSnapshots(snapshots);

if (!comparison.comparable) {
  fail("Snapshot comparison should be comparable for the sample multi-snapshot input.");
}

if (comparison.persistentBlocked.length < 2) {
  fail("Expected repeated blocked threads across snapshots.");
}

if (!comparison.recurringHotspots.length) {
  fail("Expected recurring hotspots across sample snapshots.");
}

const noIdLeft = {
  id: "left",
  label: "Left",
  analysis: analyzer.analyzeThreadDump(`"worker-a"
   java.lang.Thread.State: WAITING (parking)
        at com.example.Foo.one(Foo.java:10)`),
};

const noIdRight = {
  id: "right",
  label: "Right",
  analysis: analyzer.analyzeThreadDump(`"worker-a"
   java.lang.Thread.State: RUNNABLE
        at com.example.Foo.two(Foo.java:22)`),
};

const noIdDiff = analyzer.buildSnapshotDiff(noIdLeft, noIdRight);

if (!noIdDiff.comparable) {
  fail("Expected no-id snapshot diff to be comparable.");
}

if (noIdDiff.changedThreads.length !== 1 || noIdDiff.newThreads.length !== 0 || noIdDiff.vanishedThreads.length !== 0) {
  fail("Stable fallback thread identity failed for dumps without tid/nid fields.");
}

const partialDump = analyzer.analyzeThreadDump(`"async-worker" #1 prio=5 tid=0x1 nid=0x2 runnable
        at com.example.Worker.run(Worker.java:11)
        - parking to wait for <0x0000000000000001> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)`);

if (!partialDump.parsed) {
  fail("Partial dump with a missing state line should still parse.");
}

if (partialDump.threads[0].state !== "RUNNABLE") {
  fail(`Expected state inference to produce RUNNABLE, received ${partialDump.threads[0].state}.`);
}

if (!partialDump.parseNotes.length) {
  fail("Partial dump should record at least one parse note.");
}

console.log("ThreadScope analyzer tests passed.");
