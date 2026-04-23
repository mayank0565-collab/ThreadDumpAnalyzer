(function () {
  var analyzerApi = window.ThreadScopeAnalyzer || {};
  var analyzeDump = analyzerApi.analyzeThreadDump;
  var compareSnapshots = analyzerApi.compareThreadDumpSnapshots;
  var detectSnapshots = analyzerApi.detectSnapshotsFromText;
  var buildSnapshotDiff = analyzerApi.buildSnapshotDiff;
  var lastExportUrl = "";
  var TOOL_NAME = "ThreadScope";
  var TOOL_AUTHOR = "Mayank Vashishtha";
  var TOOL_ROLE = "Author and Owner";
  var THREAD_RENDER_BATCH = 80;

  if (!analyzeDump || !compareSnapshots || !detectSnapshots || !buildSnapshotDiff) {
    window.console.error("ThreadScope analyzer API was not loaded correctly.");
    return;
  }

  var sampleSnapshotOne = `"http-nio-8080-exec-17" #112 daemon prio=5 os_prio=31 tid=0x0000000124aa1000 nid=0x7103 waiting for monitor entry [0x00000001711a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.checkout.InventoryService.reserve(InventoryService.java:118)
        - waiting to lock <0x000000076b221100> (a java.lang.Object)
        at com.acme.checkout.OrderService.placeOrder(OrderService.java:67)

"http-nio-8080-exec-18" #113 daemon prio=5 os_prio=31 tid=0x0000000124aa1800 nid=0x7104 waiting for monitor entry [0x00000001712a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.checkout.InventoryService.reserve(InventoryService.java:118)
        - waiting to lock <0x000000076b221100> (a java.lang.Object)
        at com.acme.checkout.OrderService.placeOrder(OrderService.java:67)

"inventory-rebuild-job" #121 prio=5 os_prio=31 tid=0x0000000124aa2000 nid=0x7105 runnable [0x00000001713a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.checkout.InventoryService.reserve(InventoryService.java:116)
        - locked <0x000000076b221100> (a java.lang.Object)
        at com.acme.jobs.InventoryRebuildJob.run(InventoryRebuildJob.java:22)

"HikariPool-1 housekeeper" #131 daemon prio=5 os_prio=31 tid=0x0000000124aa2800 nid=0x7106 waiting on condition [0x00000001714a3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b991100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"kafka-consumer-1" #133 daemon prio=5 os_prio=31 tid=0x0000000124aa2850 nid=0x7107 waiting on condition [0x00000001714b3000]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b992100> (a java.util.concurrent.CompletableFuture$Signaller)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)

"scheduler-1" #140 daemon prio=5 os_prio=31 tid=0x0000000124aa2900 nid=0x7108 waiting on condition [0x00000001714c3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b993100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"deadlock-left" #141 prio=5 os_prio=31 tid=0x0000000124aa3000 nid=0x7109 waiting for monitor entry [0x00000001715a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.LeftRightService.transfer(LeftRightService.java:55)
        - waiting to lock <0x000000076b333000> (a java.lang.Object)
        - locked <0x000000076b333100> (a java.lang.Object)

"deadlock-right" #142 prio=5 os_prio=31 tid=0x0000000124aa3800 nid=0x7110 waiting for monitor entry [0x00000001716a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.RightLeftService.transfer(RightLeftService.java:48)
        - waiting to lock <0x000000076b333100> (a java.lang.Object)
        - locked <0x000000076b333000> (a java.lang.Object)

"ForkJoinPool.commonPool-worker-1" #151 daemon prio=5 os_prio=31 tid=0x0000000124aa4000 nid=0x7111 runnable [0x00000001717a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)

"ForkJoinPool.commonPool-worker-2" #152 daemon prio=5 os_prio=31 tid=0x0000000124aa4800 nid=0x7112 runnable [0x00000001718a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)`;

  var sampleSnapshotTwo = `"http-nio-8080-exec-17" #112 daemon prio=5 os_prio=31 tid=0x0000000124aa1000 nid=0x7103 waiting for monitor entry [0x00000001711a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.checkout.InventoryService.reserve(InventoryService.java:118)
        - waiting to lock <0x000000076b221100> (a java.lang.Object)
        at com.acme.checkout.OrderService.placeOrder(OrderService.java:67)

"http-nio-8080-exec-18" #113 daemon prio=5 os_prio=31 tid=0x0000000124aa1800 nid=0x7104 waiting for monitor entry [0x00000001712a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.checkout.InventoryService.reserve(InventoryService.java:118)
        - waiting to lock <0x000000076b221100> (a java.lang.Object)
        at com.acme.checkout.OrderService.placeOrder(OrderService.java:67)

"inventory-rebuild-job" #121 prio=5 os_prio=31 tid=0x0000000124aa2000 nid=0x7105 waiting for monitor entry [0x00000001713a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.jobs.InventoryRebuildJob.run(InventoryRebuildJob.java:23)
        - waiting to lock <0x000000076b444100> (a java.lang.Object)
        - locked <0x000000076b221100> (a java.lang.Object)

"HikariPool-1 housekeeper" #131 daemon prio=5 os_prio=31 tid=0x0000000124aa2800 nid=0x7106 waiting on condition [0x00000001714a3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b991100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"HikariPool-1 connection-adder" #132 daemon prio=5 os_prio=31 tid=0x0000000124aa2810 nid=0x7107 waiting on condition [0x00000001714a5000]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b991500> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)

"kafka-consumer-1" #133 daemon prio=5 os_prio=31 tid=0x0000000124aa2850 nid=0x7108 runnable [0x00000001714b3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.messaging.KafkaConsumerLoop.poll(KafkaConsumerLoop.java:144)
        at com.acme.messaging.KafkaConsumerLoop.run(KafkaConsumerLoop.java:62)

"scheduler-1" #140 daemon prio=5 os_prio=31 tid=0x0000000124aa2900 nid=0x7109 waiting on condition [0x00000001714c3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b993100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"deadlock-left" #141 prio=5 os_prio=31 tid=0x0000000124aa3000 nid=0x7110 waiting for monitor entry [0x00000001715a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.LeftRightService.transfer(LeftRightService.java:55)
        - waiting to lock <0x000000076b333000> (a java.lang.Object)
        - locked <0x000000076b333100> (a java.lang.Object)

"deadlock-right" #142 prio=5 os_prio=31 tid=0x0000000124aa3800 nid=0x7111 waiting for monitor entry [0x00000001716a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.RightLeftService.transfer(RightLeftService.java:48)
        - waiting to lock <0x000000076b333100> (a java.lang.Object)
        - locked <0x000000076b333000> (a java.lang.Object)

"ForkJoinPool.commonPool-worker-1" #151 daemon prio=5 os_prio=31 tid=0x0000000124aa4000 nid=0x7112 runnable [0x00000001717a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)

"ForkJoinPool.commonPool-worker-2" #152 daemon prio=5 os_prio=31 tid=0x0000000124aa4800 nid=0x7113 runnable [0x00000001718a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)

"ForkJoinPool.commonPool-worker-3" #153 daemon prio=5 os_prio=31 tid=0x0000000124aa5000 nid=0x7114 runnable [0x00000001719a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)`;

  var sampleSnapshotThree = `"http-nio-8080-exec-17" #112 daemon prio=5 os_prio=31 tid=0x0000000124aa1000 nid=0x7103 runnable [0x00000001711a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.checkout.PaymentService.capture(PaymentService.java:72)
        at com.acme.checkout.OrderService.placeOrder(OrderService.java:71)

"http-nio-8080-exec-18" #113 daemon prio=5 os_prio=31 tid=0x0000000124aa1800 nid=0x7104 waiting on condition [0x00000001712a3000]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b551100> (a java.util.concurrent.CompletableFuture$Signaller)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)

"inventory-rebuild-job" #121 prio=5 os_prio=31 tid=0x0000000124aa2000 nid=0x7105 runnable [0x00000001713a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.jobs.InventoryRebuildJob.run(InventoryRebuildJob.java:34)
        at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1136)

"HikariPool-1 housekeeper" #131 daemon prio=5 os_prio=31 tid=0x0000000124aa2800 nid=0x7106 waiting on condition [0x00000001714a3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b991100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"kafka-consumer-1" #133 daemon prio=5 os_prio=31 tid=0x0000000124aa2850 nid=0x7108 waiting on condition [0x00000001714b3000]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b992100> (a java.util.concurrent.CompletableFuture$Signaller)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)

"scheduler-1" #140 daemon prio=5 os_prio=31 tid=0x0000000124aa2900 nid=0x7109 waiting on condition [0x00000001714c3000]
   java.lang.Thread.State: TIMED_WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for <0x000000076b993100> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:252)

"deadlock-left" #141 prio=5 os_prio=31 tid=0x0000000124aa3000 nid=0x7110 waiting for monitor entry [0x00000001715a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.LeftRightService.transfer(LeftRightService.java:55)
        - waiting to lock <0x000000076b333000> (a java.lang.Object)
        - locked <0x000000076b333100> (a java.lang.Object)

"deadlock-right" #142 prio=5 os_prio=31 tid=0x0000000124aa3800 nid=0x7111 waiting for monitor entry [0x00000001716a3000]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.acme.locking.RightLeftService.transfer(RightLeftService.java:48)
        - waiting to lock <0x000000076b333100> (a java.lang.Object)
        - locked <0x000000076b333000> (a java.lang.Object)

"ForkJoinPool.commonPool-worker-1" #151 daemon prio=5 os_prio=31 tid=0x0000000124aa4000 nid=0x7112 runnable [0x00000001717a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)

"ForkJoinPool.commonPool-worker-2" #152 daemon prio=5 os_prio=31 tid=0x0000000124aa4800 nid=0x7113 runnable [0x00000001718a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)

"ForkJoinPool.commonPool-worker-3" #153 daemon prio=5 os_prio=31 tid=0x0000000124aa5000 nid=0x7114 runnable [0x00000001719a3000]
   java.lang.Thread.State: RUNNABLE
        at com.acme.search.IndexBuilder.reindex(IndexBuilder.java:88)
        at com.acme.search.IndexBuilder.lambda$run$1(IndexBuilder.java:42)`;

  function buildSampleLogText() {
    return [
      "2026-04-22T10:00:00.000Z INFO Full thread dump OpenJDK 64-Bit Server VM",
      sampleSnapshotOne,
      "JNI global refs: 982",
      "",
      "2026-04-22T10:00:10.000Z INFO Full thread dump OpenJDK 64-Bit Server VM",
      sampleSnapshotTwo,
      "JNI global refs: 991",
      "",
      "2026-04-22T10:00:20.000Z INFO Full thread dump OpenJDK 64-Bit Server VM",
      sampleSnapshotThree,
      "JNI global refs: 1004",
    ].join("\n");
  }

  var sampleLogText = buildSampleLogText();

  var dumpInput = document.querySelector("#dumpInput");
  var analyzeBtn = document.querySelector("#analyzeBtn");
  var clearBtn = document.querySelector("#clearBtn");
  var sampleBtn = document.querySelector("#sampleBtn");
  var fileInput = document.querySelector("#fileInput");
  var multiFileInput = document.querySelector("#multiFileInput");
  var dropZone = document.querySelector("#dropZone");
  var statusText = document.querySelector("#statusText");
  var heroStats = document.querySelector("#heroStats");
  var summaryGrid = document.querySelector("#summaryGrid");
  var findingsEl = document.querySelector("#findings");
  var lockGraphEl = document.querySelector("#lockGraph");
  var poolPanel = document.querySelector("#poolPanel");
  var lockChainsPanel = document.querySelector("#lockChainsPanel");
  var comparisonPanel = document.querySelector("#comparisonPanel");
  var timelinePanel = document.querySelector("#timelinePanel");
  var historyThreadSelect = document.querySelector("#historyThreadSelect");
  var threadHistoryPanel = document.querySelector("#threadHistoryPanel");
  var leftSnapshotSelect = document.querySelector("#leftSnapshotSelect");
  var rightSnapshotSelect = document.querySelector("#rightSnapshotSelect");
  var snapshotDiffPanel = document.querySelector("#snapshotDiffPanel");
  var exportFormatSelect = document.querySelector("#exportFormatSelect");
  var exportBtn = document.querySelector("#exportBtn");
  var exportStatus = document.querySelector("#exportStatus");
  var ownershipPanel = document.querySelector("#ownershipPanel");
  var threadListSummary = document.querySelector("#threadListSummary");
  var loadMoreThreadsBtn = document.querySelector("#loadMoreThreadsBtn");
  var threadListEl = document.querySelector("#threadList");
  var threadSearch = document.querySelector("#threadSearch");
  var stateFilter = document.querySelector("#stateFilter");

  var currentAnalysis = null;
  var currentComparison = null;
  var currentSnapshots = [];
  var selectedHistoryKey = "";
  var selectedDiffLeftId = "";
  var selectedDiffRightId = "";
  var analysisRequestSerial = 0;
  var visibleThreadCount = THREAD_RENDER_BATCH;
  var isBusy = false;
  var isDropZoneActive = false;

  function setStatus(message) {
    statusText.textContent = message;
  }

  function setExportStatus(message) {
    exportStatus.textContent = message;
  }

  function updateClassFlag(element, className, enabled) {
    var current;
    var parts;

    if (!element) {
      return;
    }

    current = element.className || "";
    parts = current ? current.split(/\s+/).filter(Boolean) : [];

    if (enabled && parts.indexOf(className) < 0) {
      parts.push(className);
    }

    if (!enabled) {
      parts = parts.filter(function filterPart(part) {
        return part !== className;
      });
    }

    element.className = parts.join(" ");
  }

  function renderDropZoneState() {
    if (!dropZone) {
      return;
    }
    dropZone.className = "drop-zone" + (isDropZoneActive ? " is-dragover" : "") + (isBusy ? " is-busy" : "");
  }

  function setBusy(nextBusy, message) {
    isBusy = nextBusy;
    updateClassFlag(document.body || {}, "is-busy", nextBusy);
    analyzeBtn.disabled = nextBusy;
    sampleBtn.disabled = nextBusy;
    clearBtn.disabled = nextBusy;
    exportBtn.disabled = nextBusy || !currentAnalysis || !currentAnalysis.parsed;
    loadMoreThreadsBtn.disabled = nextBusy;
    renderDropZoneState();
    if (message) {
      setStatus(message);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function stateToCss(state) {
    return (state || "UNKNOWN").toLowerCase();
  }

  function formatState(state) {
    return (state || "UNKNOWN").replace(/_/g, " ");
  }

  function sortThreadsForDisplay(threads) {
    var stateOrder = {
      BLOCKED: 0,
      RUNNABLE: 1,
      WAITING: 2,
      TIMED_WAITING: 3,
      UNKNOWN: 4,
    };

    return threads.slice().sort(function sortThreads(left, right) {
      var leftRank = stateOrder[left.state] !== undefined ? stateOrder[left.state] : 5;
      var rightRank = stateOrder[right.state] !== undefined ? stateOrder[right.state] : 5;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.name.localeCompare(right.name);
    });
  }

  function resetVisibleThreadCount() {
    visibleThreadCount = THREAD_RENDER_BATCH;
  }

  function updateThreadListControls(total, shown) {
    if (!threadListSummary || !loadMoreThreadsBtn) {
      return;
    }

    if (!currentAnalysis || !currentAnalysis.parsed) {
      threadListSummary.textContent = "No thread data yet.";
      loadMoreThreadsBtn.hidden = true;
      return;
    }

    if (!total) {
      threadListSummary.textContent = "No threads match the current filter.";
      loadMoreThreadsBtn.hidden = true;
      return;
    }

    threadListSummary.textContent = "Showing " + shown + " of " + total + " matching threads.";
    loadMoreThreadsBtn.hidden = shown >= total;
    if (!loadMoreThreadsBtn.hidden) {
      loadMoreThreadsBtn.textContent = "Show " + Math.min(THREAD_RENDER_BATCH, total - shown) + " more threads";
    }
  }

  function formatParseNoteSuffix(analysis, connector) {
    if (!analysis || !analysis.parseNotes.length) {
      return ".";
    }
    return " " + connector + " " + analysis.parseNotes.length + " parse note" + (analysis.parseNotes.length === 1 ? "" : "s") + ".";
  }

  function getStateCount(analysis, state) {
    var match;
    if (!analysis) {
      return 0;
    }
    match = analysis.stateCounts.find(function findState(item) {
      return item.label === state;
    });
    return match ? match.count : 0;
  }

  function getParsedComparisonEntries(comparison) {
    if (!comparison || !comparison.analyses) {
      return [];
    }
    return comparison.analyses.filter(function filterEntry(entry) {
      return entry.analysis && entry.analysis.parsed;
    });
  }

  function renderOwnershipView(analysis, comparison) {
    var parsedEntries;
    var currentMode;
    var latestSnapshotLabel;
    var latestPools;
    var latestChains;

    parsedEntries = getParsedComparisonEntries(comparison);
    currentMode = parsedEntries.length > 1 ? "Multi-snapshot comparison" : analysis && analysis.parsed ? "Single snapshot analysis" : "Idle";
    latestSnapshotLabel = parsedEntries.length ? parsedEntries[parsedEntries.length - 1].label : "No snapshot loaded";
    latestPools = analysis && analysis.parsed ? analysis.poolGroups.length : 0;
    latestChains = analysis && analysis.parsed ? analysis.lockChains.length : 0;

    ownershipPanel.className = "ownership-grid";
    ownershipPanel.innerHTML = `
      <article class="ownership-card">
        <div class="card-head">
          <div>
            <h3>${TOOL_NAME}</h3>
            <div class="pill-row">
              <span class="pill">${TOOL_ROLE}</span>
              <span class="pill">Author ${TOOL_AUTHOR}</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div><strong>Owned by:</strong> ${TOOL_AUTHOR}</div>
          <div><strong>Purpose:</strong> Java thread dump analysis, comparison, and reporting</div>
          <div><strong>Current mode:</strong> ${currentMode}</div>
        </div>
      </article>
      <article class="ownership-card">
        <div class="card-head"><h3>Current Session</h3></div>
        <div class="comparison-list">
          <div class="comparison-item"><strong>Latest snapshot:</strong> ${escapeHtml(latestSnapshotLabel)}</div>
          <div class="comparison-item"><strong>Snapshots in session:</strong> ${currentSnapshots.length}</div>
          <div class="comparison-item"><strong>Visible pool groups:</strong> ${latestPools}</div>
          <div class="comparison-item"><strong>Visible lock chains:</strong> ${latestChains}</div>
        </div>
      </article>
      <article class="ownership-card">
        <div class="card-head"><h3>Report Ownership</h3></div>
        <div class="comparison-list">
          <div class="comparison-item"><strong>Report author stamp:</strong> ${TOOL_AUTHOR}</div>
          <div class="comparison-item"><strong>Tool identity:</strong> ${TOOL_NAME}</div>
          <div class="comparison-item"><strong>Included in exports:</strong> Markdown, HTML, and JSON</div>
        </div>
      </article>
    `;
  }

  function renderHeroStats(analysis) {
    var counts = {
      threads: analysis ? analysis.threadCount : 0,
      blocked: analysis ? getStateCount(analysis, "BLOCKED") : 0,
      deadlocks: analysis ? analysis.deadlockCycles.length : 0,
    };

    heroStats.innerHTML = `
      <div class="stat-card accent">
        <span class="stat-label">Threads</span>
        <strong class="stat-value">${counts.threads}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Blocked</span>
        <strong class="stat-value">${counts.blocked}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Deadlocks</span>
        <strong class="stat-value">${counts.deadlocks}</strong>
      </div>
    `;
  }

  function renderSummary(analysis) {
    var metrics;

    if (!analysis || !analysis.parsed) {
      summaryGrid.innerHTML = `<div class="empty-state">Paste a dump to populate summary metrics.</div>`;
      return;
    }

    metrics = [
      ["Parsed threads", analysis.threadCount],
      ["Snapshots", currentSnapshots.length],
      ["Blocked", getStateCount(analysis, "BLOCKED")],
      ["Waiting", getStateCount(analysis, "WAITING") + getStateCount(analysis, "TIMED_WAITING")],
      ["Runnable", getStateCount(analysis, "RUNNABLE")],
      ["Pools", analysis.poolGroups.length],
      ["Lock chains", analysis.lockChains.length],
      ["Contended monitors", analysis.monitors.filter(function filterMonitor(monitor) { return monitor.waiters.length > 0; }).length],
      ["Parse notes", analysis.parseNotes.length],
    ];

    summaryGrid.innerHTML = metrics
      .map(function mapMetric(metric) {
        return `
          <article class="metric-card">
            <span class="metric-label">${metric[0]}</span>
            <strong class="metric-value">${metric[1]}</strong>
          </article>
        `;
      })
      .join("");
  }

  function renderFindings(analysis) {
    if (!analysis || !analysis.parsed) {
      findingsEl.className = "stack-list empty-state";
      findingsEl.textContent = "Run an analysis to see prioritized findings.";
      return;
    }

    findingsEl.className = "stack-list";
    findingsEl.innerHTML = analysis.findings
      .map(function mapFinding(finding) {
        return `
          <article class="finding-card severity-${finding.severity}">
            <div class="card-head">
              <div>
                <h3>${finding.title}</h3>
                <div class="pill-row">
                  <span class="pill">${finding.severity.toUpperCase()}</span>
                </div>
              </div>
            </div>
            <p class="card-body">${escapeHtml(finding.body)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderLockGraph(analysis) {
    var contended;

    if (!analysis || !analysis.parsed) {
      lockGraphEl.className = "stack-list empty-state";
      lockGraphEl.textContent = "Waiting and ownership relationships will appear here.";
      return;
    }

    contended = analysis.monitors.filter(function filterMonitors(monitor) {
      return monitor.owners.length || monitor.waiters.length;
    });

    if (!contended.length) {
      lockGraphEl.className = "stack-list empty-state";
      lockGraphEl.textContent = "No monitor ownership or wait relationships were recognized in this dump.";
      return;
    }

    lockGraphEl.className = "stack-list";
    lockGraphEl.innerHTML = contended
      .slice(0, 20)
      .map(function mapMonitor(monitor) {
        var monitorType = monitor.types && monitor.types.length ? monitor.types[0] : "";
        return `
          <article class="graph-card">
            <div class="card-head">
              <div>
                <h3>${monitor.monitor}</h3>
                <div class="pill-row">
                  <span class="pill">Owners: ${monitor.owners.length || 0}</span>
                  <span class="pill">Waiters: ${monitor.waiters.length || 0}</span>
                  ${monitorType ? `<span class="pill">${escapeHtml(monitorType)}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="card-body">
              <div><strong>Owned by:</strong> ${monitor.owners.length ? escapeHtml(monitor.owners.join(", ")) : "No visible owner"}</div>
              <div><strong>Waited on by:</strong> ${monitor.waiters.length ? escapeHtml(monitor.waiters.join(", ")) : "No waiters"}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPoolInsights(analysis) {
    if (!analysis || !analysis.parsed) {
      poolPanel.className = "pool-grid empty-state";
      poolPanel.textContent = "Pool summaries will appear after analysis.";
      return;
    }

    poolPanel.className = "pool-grid";
    poolPanel.innerHTML = analysis.poolGroups
      .slice(0, 12)
      .map(function mapPool(pool) {
        var signals = pool.signals.length
          ? pool.signals
              .map(function mapSignal(signal) {
                return `<div class="comparison-item">${escapeHtml(signal)}</div>`;
              })
              .join("")
          : `<div class="comparison-item">No elevated pool-level signals were detected.</div>`;

        return `
          <article class="pool-card">
            <div class="card-head">
              <div>
                <h3>${escapeHtml(pool.name)}</h3>
                <div class="pill-row">
                  <span class="pill">${escapeHtml(pool.category)}</span>
                  <span class="pill">Threads ${pool.threadCount}</span>
                  <span class="pill">Blocked ${pool.blockedCount}</span>
                  <span class="pill">Waiting ${pool.waitingCount}</span>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div><strong>Dominant frame:</strong> ${escapeHtml(pool.dominantFrame)}</div>
              <div><strong>Shared by:</strong> ${pool.dominantFrameCount} thread${pool.dominantFrameCount === 1 ? "" : "s"}</div>
            </div>
            <div class="comparison-list">${signals}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderLockChains(analysis) {
    if (!analysis || !analysis.parsed) {
      lockChainsPanel.className = "stack-list empty-state";
      lockChainsPanel.textContent = "Root-cause lock chains will appear after analysis.";
      return;
    }

    if (!analysis.lockChains.length) {
      lockChainsPanel.className = "stack-list empty-state";
      lockChainsPanel.textContent = "No contention chains were detected from the visible monitor ownership data.";
      return;
    }

    lockChainsPanel.className = "stack-list";
    lockChainsPanel.innerHTML = analysis.lockChains
      .slice(0, 12)
      .map(function mapChain(chain) {
        var explanation = chain.cycle
          ? "Threads in this chain are waiting on one another in a closed loop, which is a strong deadlock signal."
          : "Follow the waiter count and root owner to find the thread currently blocking the rest of the chain.";
        return `
          <article class="chain-card ${chain.cycle ? "cycle-chain" : ""}">
            <div class="card-head">
              <div>
                <h3>${chain.cycle ? "Cycle in lock chain" : "Lock chain"}</h3>
                <div class="pill-row">
                  <span class="pill">Waiters ${chain.waiterCount}</span>
                  <span class="pill">Root owner ${escapeHtml(chain.rootOwner)}</span>
                  <span class="pill">${escapeHtml(formatState(chain.rootState))}</span>
                </div>
              </div>
            </div>
            <div class="card-body">${escapeHtml(chain.summary)}</div>
            <div class="comparison-list">
              <div class="comparison-item">${escapeHtml(explanation)}</div>
              <div class="comparison-item"><strong>Waiters:</strong> ${escapeHtml(chain.waiters.join(", "))}</div>
              <div class="comparison-item"><strong>Owners:</strong> ${chain.owners.length ? escapeHtml(chain.owners.join(", ")) : "No visible owner"}</div>
              <div class="comparison-item"><strong>Monitor:</strong> ${escapeHtml(chain.monitor)}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderComparison(comparison) {
    if (!comparison || !comparison.comparable) {
      comparisonPanel.className = "comparison-grid empty-state";
      comparisonPanel.textContent = "Analyze multiple snapshots to compare state shifts and persistent contention.";
      return;
    }

    comparisonPanel.className = "comparison-grid";
    comparisonPanel.innerHTML = `
      <article class="comparison-card">
        <div class="card-head"><h3>Cross-Snapshot Findings</h3></div>
        <div class="comparison-list">
          ${
            comparison.findings.length
              ? comparison.findings
                  .map(function mapFinding(finding) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(finding.title)}</strong><br />
                        ${escapeHtml(finding.body)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No elevated cross-snapshot findings yet.</div>`
          }
        </div>
      </article>
      <article class="comparison-card">
        <div class="card-head"><h3>Snapshot Rollup</h3></div>
        <div class="comparison-list">
          ${getParsedComparisonEntries(comparison)
            .map(function mapEntry(entry) {
              return `
                <div class="comparison-item">
                  <strong>${escapeHtml(entry.label)}</strong><br />
                  ${entry.analysis.threadCount} threads, ${getStateCount(entry.analysis, "BLOCKED")} blocked, ${entry.analysis.deadlockCycles.length} deadlock cycle${entry.analysis.deadlockCycles.length === 1 ? "" : "s"}
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
      <article class="comparison-card">
        <div class="card-head"><h3>Persistent Blocked Threads</h3></div>
        <div class="comparison-list">
          ${
            comparison.persistentBlocked.length
              ? comparison.persistentBlocked
                  .map(function mapBlocked(item) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(item.thread)}</strong> stayed blocked across ${item.streak} consecutive comparison step${item.streak === 1 ? "" : "s"}.
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No threads were repeatedly blocked across consecutive snapshots.</div>`
          }
        </div>
      </article>
      <article class="comparison-card">
        <div class="card-head"><h3>Recurring Hotspots</h3></div>
        <div class="comparison-list">
          ${
            comparison.recurringHotspots.length
              ? comparison.recurringHotspots
                  .map(function mapHotspot(item) {
                    var hotspotState = item.state && item.state !== "UNKNOWN" ? " Dominant state: " + formatState(item.state) + "." : "";
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(item.topFrame)}</strong> reappeared in ${item.appearances} snapshots, peaking at ${item.maxSize} matching thread${item.maxSize === 1 ? "" : "s"}.${escapeHtml(hotspotState)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No recurring multi-thread hotspot groups were detected.</div>`
          }
        </div>
      </article>
    `;
  }

  function renderTimeline(comparison) {
    if (!comparison || !comparison.comparable) {
      timelinePanel.className = "timeline-grid empty-state";
      timelinePanel.textContent = "Analyze multiple snapshots to see state movement over time.";
      return;
    }

    timelinePanel.className = "timeline-grid";
    timelinePanel.innerHTML = `
      <article class="timeline-card">
        <div class="card-head"><h3>State Timelines</h3></div>
        <div class="timeline-rows">
          ${comparison.timelineRows
            .map(function mapRow(row) {
              return `
                <div class="timeline-row">
                  <strong>${formatState(row.state)}</strong>
                  <div class="timeline-bar" style="--segments: ${row.points.length}">
                    ${row.points
                      .map(function mapPoint(point) {
                        return `
                          <div class="timeline-segment segment-${stateToCss(row.state)}" title="${escapeHtml(point.label)}: ${point.count}">
                            ${point.count}
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                  <div class="timeline-meta">
                    ${row.points
                      .map(function mapPoint(point) {
                        return `<span class="pill">${escapeHtml(point.label)} ${point.count}</span>`;
                      })
                      .join("")}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
      <article class="timeline-card">
        <div class="card-head"><h3>Snapshot Sequence</h3></div>
        <div class="timeline-rows">
          ${getParsedComparisonEntries(comparison)
            .map(function mapEntry(entry) {
              return `
                <div class="timeline-row">
                  <strong>${escapeHtml(entry.label)}</strong><br />
                  ${entry.analysis.threadCount} threads, ${entry.analysis.poolGroups.length} pools, ${entry.analysis.lockChains.length} lock chains
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
    `;
  }

  function renderHistorySelector(comparison) {
    if (!comparison || !comparison.comparable || !comparison.threadHistories.length) {
      historyThreadSelect.innerHTML = `<option value="">Choose a thread history</option>`;
      selectedHistoryKey = "";
      return;
    }

    if (
      !comparison.threadHistories.some(function hasKey(history) {
        return history.key === selectedHistoryKey;
      })
    ) {
      selectedHistoryKey = comparison.threadHistories[0].key;
    }

    historyThreadSelect.innerHTML = `
      <option value="">Choose a thread history</option>
      ${comparison.threadHistories
        .map(function mapHistory(history) {
          return `
            <option value="${history.key}" ${history.key === selectedHistoryKey ? "selected" : ""}>
              ${escapeHtml(history.name)} (${history.appearances}/${getParsedComparisonEntries(comparison).length} snapshots)
            </option>
          `;
        })
        .join("")}
    `;
  }

  function renderThreadHistory(comparison) {
    var history;

    if (!comparison || !comparison.comparable || !comparison.threadHistories.length) {
      threadHistoryPanel.className = "thread-history empty-state";
      threadHistoryPanel.textContent = "Select a thread that appears across snapshots to inspect its path over time.";
      return;
    }

    history =
      comparison.threadHistories.find(function findHistory(item) {
        return item.key === selectedHistoryKey;
      }) || comparison.threadHistories[0];

    if (!history) {
      threadHistoryPanel.className = "thread-history empty-state";
      threadHistoryPanel.textContent = "No repeated threads were found across snapshots.";
      return;
    }

    selectedHistoryKey = history.key;
    threadHistoryPanel.className = "thread-history";
    threadHistoryPanel.innerHTML = `
      <article class="history-card">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(history.name)}</h3>
            <div class="pill-row">
              <span class="pill">Snapshots ${history.appearances}</span>
              <span class="pill">Blocked ${history.blockedCount}</span>
              <span class="pill">State changes ${history.transitionsCount}</span>
            </div>
          </div>
        </div>
        <div class="history-state-flow" style="--segments: ${history.fullPath.length}">
          ${history.fullPath
            .map(function mapStep(step) {
              return `
                <div class="history-step state-${stateToCss(step.state)}">
                  <small>${escapeHtml(step.label)}</small>
                  <strong>${formatState(step.state)}</strong>
                  <div>${escapeHtml(step.topFrame)}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
      <article class="history-card">
        <div class="card-head"><h3>Detailed Steps</h3></div>
        <div class="history-rows">
          ${history.fullPath
            .map(function mapStep(step) {
              return `
                <div class="history-row">
                  <strong>${escapeHtml(step.label)}</strong><br />
                  State: ${formatState(step.state)}<br />
                  Pool: ${escapeHtml(step.poolName || "No pool")}<br />
                  Top frame: ${escapeHtml(step.topFrame)}<br />
                  Waiting on: ${step.waitingOn.length ? escapeHtml(step.waitingOn.join(", ")) : "None detected"}<br />
                  Locked: ${step.lockedMonitors.length ? escapeHtml(step.lockedMonitors.join(", ")) : "None detected"}
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
    `;
  }

  function syncDiffSelectors(comparison) {
    var entries = getParsedComparisonEntries(comparison);
    var validIds;

    if (!comparison || !comparison.comparable || entries.length < 2) {
      leftSnapshotSelect.innerHTML = `<option value="">Left snapshot</option>`;
      rightSnapshotSelect.innerHTML = `<option value="">Right snapshot</option>`;
      selectedDiffLeftId = "";
      selectedDiffRightId = "";
      return;
    }

    validIds = entries.map(function mapEntry(entry) {
      return entry.id;
    });

    if (validIds.indexOf(selectedDiffRightId) < 0) {
      selectedDiffRightId = comparison.defaultRightId || entries[entries.length - 1].id;
    }

    if (validIds.indexOf(selectedDiffLeftId) < 0) {
      selectedDiffLeftId = comparison.defaultLeftId || entries[0].id;
    }

    if (selectedDiffLeftId === selectedDiffRightId) {
      selectedDiffLeftId = comparison.defaultLeftId || entries[0].id;
      if (selectedDiffLeftId === selectedDiffRightId && entries.length > 1) {
        selectedDiffLeftId = entries[entries.length - 2].id;
      }
    }

    leftSnapshotSelect.innerHTML = entries
      .map(function mapEntry(entry) {
        return `<option value="${entry.id}" ${entry.id === selectedDiffLeftId ? "selected" : ""}>${escapeHtml(entry.label)}</option>`;
      })
      .join("");

    rightSnapshotSelect.innerHTML = entries
      .map(function mapEntry(entry) {
        return `<option value="${entry.id}" ${entry.id === selectedDiffRightId ? "selected" : ""}>${escapeHtml(entry.label)}</option>`;
      })
      .join("");
  }

  function getSelectedDiff(comparison) {
    var entries = getParsedComparisonEntries(comparison);
    var leftEntry = entries.find(function findEntry(entry) {
      return entry.id === selectedDiffLeftId;
    });
    var rightEntry = entries.find(function findEntry(entry) {
      return entry.id === selectedDiffRightId;
    });

    if (!leftEntry || !rightEntry || leftEntry.id === rightEntry.id) {
      return { comparable: false };
    }

    return buildSnapshotDiff(leftEntry, rightEntry);
  }

  function renderSnapshotDiff(comparison) {
    var diff;

    if (!comparison || !comparison.comparable) {
      snapshotDiffPanel.className = "diff-grid empty-state";
      snapshotDiffPanel.textContent = "Pick two snapshots to compare changes side by side.";
      return;
    }

    diff = getSelectedDiff(comparison);
    if (!diff.comparable) {
      snapshotDiffPanel.className = "diff-grid empty-state";
      snapshotDiffPanel.textContent = "Select two different parsed snapshots to compare.";
      return;
    }

    snapshotDiffPanel.className = "diff-grid";
    snapshotDiffPanel.innerHTML = `
      <article class="diff-card">
        <div class="card-head"><h3>Diff Findings</h3></div>
        <div class="comparison-list">
          ${
            diff.findings.length
              ? diff.findings
                  .map(function mapFinding(finding) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(finding.title)}</strong><br />
                        ${escapeHtml(finding.body)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No elevated diff findings for this pair.</div>`
          }
        </div>
      </article>
      <article class="diff-card">
        <div class="card-head"><h3>State Delta</h3></div>
        <div class="comparison-list">
          ${diff.stateDelta
            .map(function mapState(item) {
              return `
                <div class="comparison-item">
                  <strong>${formatState(item.state)}</strong>: ${item.previous} -> ${item.current} (${item.delta >= 0 ? "+" : ""}${item.delta})
                </div>
              `;
            })
            .join("")}
        </div>
      </article>
      <article class="diff-card">
        <div class="card-head"><h3>Pool Delta</h3></div>
        <div class="comparison-list">
          ${
            diff.poolDelta.length
              ? diff.poolDelta
                  .map(function mapPool(pool) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(pool.name)}</strong>: ${pool.leftCount} -> ${pool.rightCount} (${pool.delta >= 0 ? "+" : ""}${pool.delta}), blocked ${pool.leftBlocked} -> ${pool.rightBlocked} (${pool.blockedDelta >= 0 ? "+" : ""}${pool.blockedDelta})
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No pool count changes between these snapshots.</div>`
          }
        </div>
      </article>
      <article class="diff-card">
        <div class="card-head"><h3>Changed Threads</h3></div>
        <div class="comparison-list">
          ${
            diff.changedThreads.length
              ? diff.changedThreads
                  .map(function mapThread(thread) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(thread.name)}</strong><br />
                        ${formatState(thread.fromState)} -> ${formatState(thread.toState)}<br />
                        Wait: ${escapeHtml(thread.fromWait)} -> ${escapeHtml(thread.toWait)}<br />
                        Pool: ${escapeHtml(thread.fromPool)} -> ${escapeHtml(thread.toPool)}<br />
                        ${escapeHtml(thread.fromFrame)}<br />
                        to<br />
                        ${escapeHtml(thread.toFrame)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No thread state, frame, or wait changes were detected for matching threads.</div>`
          }
        </div>
      </article>
      <article class="diff-card">
        <div class="card-head"><h3>New Threads</h3></div>
        <div class="comparison-list">
          ${
            diff.newThreads.length
              ? diff.newThreads
                  .map(function mapThread(thread) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(thread.name)}</strong><br />
                        ${formatState(thread.state)} in ${escapeHtml(thread.poolName)}<br />
                        ${escapeHtml(thread.topFrame)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No new threads appeared in the right snapshot.</div>`
          }
        </div>
      </article>
      <article class="diff-card">
        <div class="card-head"><h3>Vanished Threads</h3></div>
        <div class="comparison-list">
          ${
            diff.vanishedThreads.length
              ? diff.vanishedThreads
                  .map(function mapThread(thread) {
                    return `
                      <div class="comparison-item">
                        <strong>${escapeHtml(thread.name)}</strong><br />
                        Last seen ${formatState(thread.state)} in ${escapeHtml(thread.poolName)}
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="comparison-item">No threads disappeared between the selected snapshots.</div>`
          }
        </div>
      </article>
    `;
  }

  function renderStateFilter(analysis) {
    var threads = analysis ? analysis.threads : [];
    var states = Array.from(
      new Set(
        threads.map(function mapThread(thread) {
          return thread.state;
        }),
      ),
    ).sort();

    stateFilter.innerHTML = `
      <option value="ALL">All states</option>
      ${states
        .map(function mapState(state) {
          return `<option value="${state}">${formatState(state)}</option>`;
        })
        .join("")}
    `;
  }

  function renderThreads(analysis) {
    var query;
    var state;
    var filtered;
    var visible;

    if (!analysis || !analysis.parsed) {
      threadListEl.className = "thread-list empty-state";
      threadListEl.textContent = "No thread data yet.";
      updateThreadListControls(0, 0);
      return;
    }

    query = threadSearch.value.trim().toLowerCase();
    state = stateFilter.value;

    filtered = sortThreadsForDisplay(analysis.threads).filter(function filterThread(thread) {
      var waits = thread.waitingOn.concat(thread.parkingToWaitFor).join(" ").toLowerCase();
      var held = thread.lockedMonitors.concat(thread.rawSynchronizers).join(" ").toLowerCase();
      var matchesQuery =
        !query ||
        thread.name.toLowerCase().indexOf(query) >= 0 ||
        thread.topFrame.toLowerCase().indexOf(query) >= 0 ||
        thread.header.toLowerCase().indexOf(query) >= 0 ||
        thread.poolName.toLowerCase().indexOf(query) >= 0 ||
        waits.indexOf(query) >= 0 ||
        held.indexOf(query) >= 0;
      var matchesState = state === "ALL" || thread.state === state;
      return matchesQuery && matchesState;
    });

    if (!filtered.length) {
      threadListEl.className = "thread-list empty-state";
      threadListEl.textContent = "No threads match the current filter.";
      updateThreadListControls(0, 0);
      return;
    }

    visible = filtered.slice(0, visibleThreadCount);
    threadListEl.className = "thread-list";
    threadListEl.innerHTML = visible
      .map(function mapThread(thread) {
        var waited = thread.waitingOn.concat(thread.parkingToWaitFor);
        var held = thread.lockedMonitors.concat(thread.rawSynchronizers);
        return `
          <article class="thread-card state-${thread.state}">
            <div class="card-head">
              <div>
                <h3>${escapeHtml(thread.name)}</h3>
                <div class="thread-meta">
                  <span class="pill state-${stateToCss(thread.state)}">${formatState(thread.state)}</span>
                  <span class="pill">${escapeHtml(thread.poolName)}</span>
                  <span class="pill">${escapeHtml(thread.poolCategory)}</span>
                  ${thread.daemon ? `<span class="pill">daemon</span>` : ""}
                  ${thread.prio ? `<span class="pill">prio ${thread.prio}</span>` : ""}
                  ${thread.nid ? `<span class="pill">nid ${escapeHtml(thread.nid)}</span>` : ""}
                  ${thread.stateInferredFromHeader ? `<span class="pill">state inferred</span>` : ""}
                </div>
              </div>
            </div>
            <div class="card-body">
              <div><strong>Top frame:</strong> ${escapeHtml(thread.topFrame)}</div>
              <div><strong>Waiting on:</strong> ${waited.length ? escapeHtml(waited.join(", ")) : "None detected"}</div>
              <div><strong>Locked monitors:</strong> ${held.length ? escapeHtml(held.join(", ")) : "None detected"}</div>
            </div>
            <details class="thread-stack-wrap">
              <summary>Stack ${thread.stack.length ? "(" + thread.stack.length + " frame" + (thread.stack.length === 1 ? "" : "s") + ")" : ""}</summary>
              <pre class="thread-stack">${escapeHtml(thread.stack.join("\n") || "No Java frames captured")}</pre>
            </details>
          </article>
        `;
      })
      .join("");
    updateThreadListControls(filtered.length, visible.length);
  }

  function buildExportPayload() {
    var diff = currentComparison && currentComparison.comparable ? getSelectedDiff(currentComparison) : null;
    return {
      generatedAt: new Date().toISOString(),
      ownership: {
        toolName: TOOL_NAME,
        author: TOOL_AUTHOR,
        role: TOOL_ROLE,
      },
      snapshotCount: currentSnapshots.length,
      snapshots: currentSnapshots.map(function mapSnapshot(snapshot) {
        return {
          id: snapshot.id,
          label: snapshot.label,
        };
      }),
      latestSnapshot: currentSnapshots.length ? currentSnapshots[currentSnapshots.length - 1].label : "Snapshot 1",
      latestAnalysis: currentAnalysis,
      comparison: currentComparison && currentComparison.comparable ? currentComparison : null,
      selectedDiff: diff && diff.comparable ? diff : null,
    };
  }

  function buildMarkdownReport(payload) {
    var lines = [];
    var latest = payload.latestAnalysis;

    lines.push("# ThreadScope Report");
    lines.push("");
    lines.push("- Generated at: " + payload.generatedAt);
    lines.push("- Tool: " + payload.ownership.toolName);
    lines.push("- Author: " + payload.ownership.author);
    lines.push("- Snapshots: " + payload.snapshotCount);
    lines.push("- Latest snapshot: " + payload.latestSnapshot);
    lines.push("- Parsed threads: " + (latest ? latest.threadCount : 0));
    lines.push("");
    lines.push("## Findings");
    lines.push("");
    if (latest && latest.findings.length) {
      latest.findings.forEach(function addFinding(finding) {
        lines.push("- [" + finding.severity.toUpperCase() + "] " + finding.title + ": " + finding.body);
      });
    } else {
      lines.push("- No findings.");
    }
    lines.push("");
    lines.push("## Pool Insights");
    lines.push("");
    if (latest && latest.poolGroups.length) {
      latest.poolGroups.forEach(function addPool(pool) {
        lines.push("- " + pool.name + " (" + pool.category + "): " + pool.threadCount + " threads, " + pool.blockedCount + " blocked, dominant frame " + pool.dominantFrame);
      });
    } else {
      lines.push("- No pool insights.");
    }
    lines.push("");
    lines.push("## Lock Chains");
    lines.push("");
    if (latest && latest.lockChains.length) {
      latest.lockChains.slice(0, 10).forEach(function addChain(chain) {
        lines.push("- " + chain.summary);
      });
    } else {
      lines.push("- No lock chains.");
    }
    lines.push("");
    lines.push("## Selected Snapshot Diff");
    lines.push("");
    if (payload.selectedDiff) {
      payload.selectedDiff.findings.forEach(function addDiffFinding(finding) {
        lines.push("- " + finding.title + ": " + finding.body);
      });
      if (!payload.selectedDiff.findings.length) {
        lines.push("- No elevated diff findings.");
      }
    } else {
      lines.push("- No snapshot diff selected.");
    }

    return lines.join("\n");
  }

  function buildHtmlReport(payload) {
    var latest = payload.latestAnalysis;
    var diff = payload.selectedDiff;
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>ThreadScope Report</title>
    <style>
      body { font-family: Avenir Next, Segoe UI, sans-serif; margin: 40px; color: #21160f; }
      h1, h2 { margin-bottom: 12px; }
      .card { border: 1px solid rgba(72,48,31,0.12); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
      .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #f0e7d9; margin-right: 8px; margin-bottom: 8px; }
      ul { padding-left: 20px; }
      code { font-family: SFMono-Regular, Consolas, monospace; }
    </style>
  </head>
  <body>
    <h1>ThreadScope Report</h1>
    <div class="card">
      <div><strong>Generated at:</strong> ${escapeHtml(payload.generatedAt)}</div>
      <div><strong>Tool:</strong> ${escapeHtml(payload.ownership.toolName)}</div>
      <div><strong>Author:</strong> ${escapeHtml(payload.ownership.author)}</div>
      <div><strong>Snapshots:</strong> ${payload.snapshotCount}</div>
      <div><strong>Latest snapshot:</strong> ${escapeHtml(payload.latestSnapshot)}</div>
      <div><strong>Parsed threads:</strong> ${latest ? latest.threadCount : 0}</div>
    </div>
    <h2>Findings</h2>
    <div class="card">
      ${
        latest && latest.findings.length
          ? "<ul>" +
            latest.findings
              .map(function mapFinding(finding) {
                return "<li><strong>" + escapeHtml(finding.title) + "</strong>: " + escapeHtml(finding.body) + "</li>";
              })
              .join("") +
            "</ul>"
          : "<div>No findings.</div>"
      }
    </div>
    <h2>Pool Insights</h2>
    <div class="card">
      ${
        latest && latest.poolGroups.length
          ? latest.poolGroups
              .map(function mapPool(pool) {
                return "<div><span class=\"pill\">" + escapeHtml(pool.name) + "</span>" + pool.threadCount + " threads, " + pool.blockedCount + " blocked, dominant frame <code>" + escapeHtml(pool.dominantFrame) + "</code></div>";
              })
              .join("")
          : "<div>No pool insights.</div>"
      }
    </div>
    <h2>Selected Snapshot Diff</h2>
    <div class="card">
      ${
        diff && diff.comparable
          ? "<div><strong>" +
            escapeHtml(diff.leftLabel) +
            "</strong> vs <strong>" +
            escapeHtml(diff.rightLabel) +
            "</strong></div>" +
            (diff.findings.length
              ? "<ul>" +
                diff.findings
                  .map(function mapFinding(finding) {
                    return "<li><strong>" + escapeHtml(finding.title) + "</strong>: " + escapeHtml(finding.body) + "</li>";
                  })
                  .join("") +
                "</ul>"
              : "<div>No elevated diff findings.</div>")
          : "<div>No snapshot diff selected.</div>"
      }
    </div>
  </body>
</html>`;
  }

  function buildDownloadPayload(format, payload) {
    if (format === "json") {
      return {
        filename: "threadscope-report.json",
        mimeType: "application/json",
        content: JSON.stringify(payload, null, 2),
      };
    }
    if (format === "html") {
      return {
        filename: "threadscope-report.html",
        mimeType: "text/html",
        content: buildHtmlReport(payload),
      };
    }
    return {
      filename: "threadscope-report.md",
      mimeType: "text/markdown",
      content: buildMarkdownReport(payload),
    };
  }

  function downloadContent(filename, mimeType, content) {
    var link = document.createElement("a");
    var href;

    if (lastExportUrl && window.URL && window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL(lastExportUrl);
      lastExportUrl = "";
    }

    if (window.Blob && window.URL && window.URL.createObjectURL) {
      href = window.URL.createObjectURL(new Blob([content], { type: mimeType }));
      lastExportUrl = href;
    } else {
      href = "data:" + mimeType + ";charset=utf-8," + encodeURIComponent(content);
    }

    link.href = href;
    link.download = filename;
    link.style.display = "none";
    if (document.body && document.body.appendChild) {
      document.body.appendChild(link);
    }
    link.click();
    if (document.body && document.body.removeChild) {
      document.body.removeChild(link);
    }
  }

  function handleExportReport() {
    var payload;
    var download;

    if (!currentAnalysis || !currentAnalysis.parsed) {
      setExportStatus("Run an analysis before exporting a report.");
      return;
    }

    payload = buildExportPayload();
    download = buildDownloadPayload(exportFormatSelect.value, payload);
    downloadContent(download.filename, download.mimeType, download.content);
    setExportStatus("Exported " + exportFormatSelect.value.toUpperCase() + " report with the current analysis snapshot.");
  }

  function renderAnalysisViews() {
    renderHeroStats(currentAnalysis);
    renderSummary(currentAnalysis);
    renderFindings(currentAnalysis);
    renderLockGraph(currentAnalysis);
    renderPoolInsights(currentAnalysis);
    renderLockChains(currentAnalysis);
    renderComparison(currentComparison);
    renderTimeline(currentComparison);
    renderOwnershipView(currentAnalysis, currentComparison);
    renderHistorySelector(currentComparison);
    renderThreadHistory(currentComparison);
    syncDiffSelectors(currentComparison);
    renderSnapshotDiff(currentComparison);
    renderStateFilter(currentAnalysis);
    renderThreads(currentAnalysis);
  }

  function resetView() {
    analysisRequestSerial += 1;
    currentAnalysis = null;
    currentComparison = null;
    currentSnapshots = [];
    selectedHistoryKey = "";
    selectedDiffLeftId = "";
    selectedDiffRightId = "";
    resetVisibleThreadCount();
    setBusy(false);
    renderAnalysisViews();
    updateThreadListControls(0, 0);
    setExportStatus("Export the current analysis as Markdown, HTML, or JSON.");
  }

  function setAnalysisError(message) {
    findingsEl.className = "stack-list";
    findingsEl.innerHTML = `
      <article class="finding-card severity-high">
        <div class="card-head">
          <div>
            <h3>Analysis error</h3>
            <div class="pill-row">
              <span class="pill">Input issue</span>
            </div>
          </div>
        </div>
        <p class="card-body">${escapeHtml(message)}</p>
      </article>
    `;
  }

  function runAnalysisNow(input) {
    var usedExplicitSeparator = /^\s*=+\s*SNAPSHOT\s*=+\s*$/im.test(input);

    currentSnapshots = detectSnapshots(input);
    currentAnalysis = analyzeDump(currentSnapshots[currentSnapshots.length - 1].text);
    currentComparison = compareSnapshots(currentSnapshots);

    renderAnalysisViews();
    setExportStatus("Export the current analysis as Markdown, HTML, or JSON.");

    if (!currentAnalysis.parsed) {
      setStatus("No recognizable thread headers were found.");
      return;
    }

    if (currentComparison.comparable && !usedExplicitSeparator) {
      setStatus(
        "Auto-detected " +
          currentSnapshots.length +
          " snapshots from log-style input and parsed " +
          currentAnalysis.threadCount +
          " threads in the latest dump" +
          formatParseNoteSuffix(currentAnalysis, "with"),
      );
      return;
    }

    if (currentComparison.comparable) {
      setStatus(
        "Compared " +
          currentSnapshots.length +
          " snapshots and parsed " +
          currentAnalysis.threadCount +
          " threads in the latest dump" +
          formatParseNoteSuffix(currentAnalysis, "with"),
      );
      return;
    }

    setStatus(
      "Parsed " +
        currentAnalysis.threadCount +
        " threads with " +
        currentAnalysis.findings.length +
        " prioritized finding" +
        (currentAnalysis.findings.length === 1 ? "" : "s") +
        formatParseNoteSuffix(currentAnalysis, "and"),
    );
  }

  function queueAnalysis(input) {
    var trimmed = (input || "").trim();
    var requestId;

    if (!trimmed) {
      resetView();
      setStatus("Paste or upload a thread dump to begin.");
      return;
    }

    requestId = analysisRequestSerial + 1;
    analysisRequestSerial = requestId;
    resetVisibleThreadCount();
    setBusy(true, "Analyzing locally in your browser...");

    setTimeout(function executeQueuedAnalysis() {
      if (requestId !== analysisRequestSerial) {
        return;
      }

      try {
        runAnalysisNow(trimmed);
      } catch (error) {
        resetView();
        setAnalysisError(error && error.message ? error.message : "Unexpected failure while parsing the dump.");
        setStatus("Analysis failed. Review the input format and try again.");
      }

      setBusy(false);
    }, 0);
  }

  function loadTextIntoAnalyzer(text) {
    dumpInput.value = text;
    queueAnalysis(text);
  }

  function handleFileReadError(error) {
    setBusy(false);
    if (!currentAnalysis || !currentAnalysis.parsed) {
      setAnalysisError(error && error.message ? error.message : "The browser could not read the selected file.");
    }
    setStatus("Unable to read the selected file locally.");
  }

  function loadSingleFile(file) {
    if (!file) {
      return;
    }

    setBusy(true, "Reading " + (file.name || "thread dump") + " locally...");
    file
      .text()
      .then(function applyFileText(text) {
        setBusy(false);
        loadTextIntoAnalyzer(text);
      })
      .catch(handleFileReadError);
  }

  function loadMultipleFiles(files) {
    if (!files.length) {
      return;
    }

    setBusy(true, "Reading " + files.length + " files locally...");
    Promise.all(
      files.map(function mapFile(file, index) {
        return file.text().then(function mapText(text) {
          return {
            label: file.name || "Snapshot " + (index + 1),
            text: text,
          };
        });
      }),
    )
      .then(function applySnapshots(snapshots) {
        var combinedText = snapshots
          .map(function mapSnapshot(snapshot) {
            return snapshot.text.trim();
          })
          .join("\n\n===== SNAPSHOT =====\n\n");

        setBusy(false);
        loadTextIntoAnalyzer(combinedText);
      })
      .catch(handleFileReadError);
  }

  function handleDroppedData(event) {
    var transfer = event.dataTransfer || {};
    var files = Array.prototype.slice.call(transfer.files || []);
    var text = transfer.getData ? transfer.getData("text/plain") : "";

    if (event.preventDefault) {
      event.preventDefault();
    }

    isDropZoneActive = false;
    renderDropZoneState();

    if (files.length > 1) {
      loadMultipleFiles(files);
      return;
    }

    if (files.length === 1) {
      loadSingleFile(files[0]);
      return;
    }

    if (text && text.trim()) {
      loadTextIntoAnalyzer(text);
    }
  }

  sampleBtn.addEventListener("click", function loadSample() {
    loadTextIntoAnalyzer(sampleLogText);
  });

  analyzeBtn.addEventListener("click", function analyzeCurrentInput() {
    queueAnalysis(dumpInput.value);
  });

  clearBtn.addEventListener("click", function clearAll() {
    dumpInput.value = "";
    threadSearch.value = "";
    stateFilter.value = "ALL";
    resetView();
    setStatus("Ready");
  });

  threadSearch.addEventListener("input", function rerenderThreads() {
    resetVisibleThreadCount();
    renderThreads(currentAnalysis);
  });

  stateFilter.addEventListener("change", function rerenderThreads() {
    resetVisibleThreadCount();
    renderThreads(currentAnalysis);
  });

  historyThreadSelect.addEventListener("change", function changeHistory(event) {
    selectedHistoryKey = event.target.value;
    renderThreadHistory(currentComparison);
  });

  leftSnapshotSelect.addEventListener("change", function changeLeft(event) {
    selectedDiffLeftId = event.target.value;
    if (selectedDiffLeftId === selectedDiffRightId && getParsedComparisonEntries(currentComparison).length > 1) {
      selectedDiffRightId = getParsedComparisonEntries(currentComparison)[getParsedComparisonEntries(currentComparison).length - 1].id;
      syncDiffSelectors(currentComparison);
    }
    renderSnapshotDiff(currentComparison);
  });

  rightSnapshotSelect.addEventListener("change", function changeRight(event) {
    selectedDiffRightId = event.target.value;
    if (selectedDiffLeftId === selectedDiffRightId && getParsedComparisonEntries(currentComparison).length > 1) {
      selectedDiffLeftId = getParsedComparisonEntries(currentComparison)[0].id;
      if (selectedDiffLeftId === selectedDiffRightId && getParsedComparisonEntries(currentComparison).length > 1) {
        selectedDiffLeftId = getParsedComparisonEntries(currentComparison)[getParsedComparisonEntries(currentComparison).length - 2].id;
      }
      syncDiffSelectors(currentComparison);
    }
    renderSnapshotDiff(currentComparison);
  });

  exportBtn.addEventListener("click", handleExportReport);
  loadMoreThreadsBtn.addEventListener("click", function showMoreThreads() {
    visibleThreadCount += THREAD_RENDER_BATCH;
    renderThreads(currentAnalysis);
  });

  fileInput.addEventListener("change", function handleSingleFile(event) {
    loadSingleFile(event.target.files && event.target.files[0]);
  });

  multiFileInput.addEventListener("change", function handleMultipleFiles(event) {
    loadMultipleFiles(Array.prototype.slice.call(event.target.files || []));
  });

  if (dropZone) {
    ["dragenter", "dragover"].forEach(function bindDrag(type) {
      dropZone.addEventListener(type, function activateDropZone(event) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        isDropZoneActive = true;
        renderDropZoneState();
      });
    });

    ["dragleave", "dragend"].forEach(function bindDragEnd(type) {
      dropZone.addEventListener(type, function deactivateDropZone(event) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        isDropZoneActive = false;
        renderDropZoneState();
      });
    });

    dropZone.addEventListener("drop", handleDroppedData);
  }

  resetView();
  renderDropZoneState();
  setStatus("Ready");
})();
