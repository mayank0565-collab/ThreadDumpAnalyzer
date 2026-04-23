function normalizeState(rawState) {
  if (!rawState) {
    return "UNKNOWN";
  }
  return rawState.trim().replace(/\s+/g, "_").toUpperCase();
}

function getMatchGroup(match, index) {
  return match && match[index] ? match[index] : null;
}

function stateLabel(state) {
  return (state || "UNKNOWN").replace(/_/g, " ");
}

function trimNumericSuffix(value) {
  if (!value) {
    return "Unknown Pool";
  }
  return value.replace(/-\d+$/, "");
}

function isThreadHeaderLine(line) {
  return /^".*"/.test(line || "");
}

function isSnapshotSeparatorLine(line) {
  return /^\s*=+\s*SNAPSHOT\s*=+\s*$/.test(line || "");
}

function detectBoundaryLabel(line) {
  var trimmed = (line || "").trim();
  var timestampMatch;

  if (!trimmed) {
    return null;
  }

  timestampMatch = trimmed.match(/(\d{4}-\d{2}-\d{2}[T ][0-9:.+\-Z]+(?:\s*[A-Z]+)?)/);
  if (!timestampMatch) {
    timestampMatch = trimmed.match(/^([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+[0-9:]{8}\s+\d{4})/);
  }

  if (
    /full thread dump/i.test(trimmed) ||
    /found one java-level deadlock/i.test(trimmed) ||
    /\bjstack\b/i.test(trimmed) ||
    /\bthread dump\b/i.test(trimmed) ||
    /kill -3/i.test(trimmed)
  ) {
    return timestampMatch ? timestampMatch[1] : trimmed.slice(0, 80);
  }

  if (timestampMatch) {
    return timestampMatch[1];
  }

  return null;
}

function extractThreadBlocks(text) {
  var normalized = text.replace(/\r\n/g, "\n");
  var matches = [];
  var pattern = /^".*$/gm;
  var match;

  while ((match = pattern.exec(normalized)) !== null) {
    matches.push(match);
  }

  if (!matches.length) {
    return [];
  }

  return matches.map(function buildBlock(entry, index) {
    var start = entry.index;
    var end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    return normalized.slice(start, end).trim();
  });
}

function finalizeDetectedSnapshot(snapshots, lines, label) {
  var text = lines.join("\n").trim();
  if (!text) {
    return;
  }
  if (!extractThreadBlocks(text).length) {
    return;
  }

  snapshots.push({
    id: "snapshot-" + (snapshots.length + 1),
    label: label ? "Snapshot " + (snapshots.length + 1) + " - " + label : "Snapshot " + (snapshots.length + 1),
    rawLabel: label || "",
    text: text,
  });
}

function detectSnapshotsFromText(text) {
  var normalized = (text || "").replace(/\r\n/g, "\n").trim();
  var lines;
  var snapshots = [];
  var currentLines = [];
  var currentLabel = "";
  var hasThreadBlocks = false;

  if (!normalized) {
    return [];
  }

  if (/^\s*=+\s*SNAPSHOT\s*=+\s*$/im.test(normalized)) {
    return normalized
      .split(/^\s*=+\s*SNAPSHOT\s*=+\s*$/im)
      .map(function trimChunk(chunk) {
        return chunk.trim();
      })
      .filter(Boolean)
      .map(function mapChunk(chunk, index) {
        return {
          id: "snapshot-" + (index + 1),
          label: "Snapshot " + (index + 1),
          rawLabel: "",
          text: chunk,
        };
      });
  }

  lines = normalized.split("\n");

  lines.forEach(function consumeLine(line) {
    var boundaryLabel = detectBoundaryLabel(line);

    if (isSnapshotSeparatorLine(line)) {
      finalizeDetectedSnapshot(snapshots, currentLines, currentLabel);
      currentLines = [];
      currentLabel = "";
      hasThreadBlocks = false;
      return;
    }

    if (boundaryLabel && hasThreadBlocks) {
      finalizeDetectedSnapshot(snapshots, currentLines, currentLabel);
      currentLines = [line];
      currentLabel = boundaryLabel;
      hasThreadBlocks = false;
      return;
    }

    if (boundaryLabel && !currentLines.length) {
      currentLabel = boundaryLabel;
    } else if (boundaryLabel && !hasThreadBlocks) {
      currentLabel = boundaryLabel;
    }

    if (isThreadHeaderLine(line)) {
      hasThreadBlocks = true;
    }

    currentLines.push(line);
  });

  finalizeDetectedSnapshot(snapshots, currentLines, currentLabel);

  if (!snapshots.length) {
    return [
      {
        id: "snapshot-1",
        label: "Snapshot 1",
        rawLabel: "",
        text: normalized,
      },
    ];
  }

  return snapshots;
}

function parseThread(block) {
  var lines = block.split("\n");
  var header = lines[0] || "";
  var nameMatch = header.match(/^"([^"]+)"/);
  var daemon = /\bdaemon\b/.test(header);
  var prio = getMatchGroup(header.match(/\bprio=(\d+)/), 1);
  var tid = getMatchGroup(header.match(/\btid=([^\s]+)/), 1);
  var nid = getMatchGroup(header.match(/\bnid=([^\s]+)/), 1);
  var osPrio = getMatchGroup(header.match(/\bos_prio=(\d+)/), 1);
  var javaState = "UNKNOWN";
  var stack = [];
  var lockedMonitors = [];
  var waitingOn = [];
  var parkingToWaitFor = [];
  var rawSynchronizers = [];

  lines.slice(1).forEach(function consumeLine(line) {
    var trimmed = line.trim();
    var stateMatch;
    var ownedMonitorMatch;
    var waitingMonitorMatch;
    var waitingOnMatch;
    var parkingMatch;
    var synchronizerMatch;

    if (!trimmed) {
      return;
    }

    stateMatch = trimmed.match(/^java\.lang\.Thread\.State:\s+(.+)$/);
    if (stateMatch) {
      javaState = normalizeState(stateMatch[1]);
      return;
    }

    if (trimmed.indexOf("at ") === 0) {
      stack.push(trimmed);
      return;
    }

    ownedMonitorMatch = trimmed.match(/^- locked <([^>]+)>/);
    if (ownedMonitorMatch) {
      lockedMonitors.push(ownedMonitorMatch[1]);
      return;
    }

    waitingMonitorMatch = trimmed.match(/^- waiting to lock <([^>]+)>/);
    if (waitingMonitorMatch) {
      waitingOn.push(waitingMonitorMatch[1]);
      return;
    }

    waitingOnMatch = trimmed.match(/^- waiting on <([^>]+)>/);
    if (waitingOnMatch) {
      waitingOn.push(waitingOnMatch[1]);
      return;
    }

    parkingMatch = trimmed.match(/^- parking to wait for <([^>]+)>/);
    if (parkingMatch) {
      parkingToWaitFor.push(parkingMatch[1]);
      return;
    }

    synchronizerMatch = trimmed.match(/^- <([^>]+)>/);
    if (synchronizerMatch) {
      rawSynchronizers.push(synchronizerMatch[1]);
    }
  });

  return {
    name: getMatchGroup(nameMatch, 1) || "Unknown Thread",
    header: header,
    daemon: daemon,
    prio: prio,
    osPrio: osPrio,
    tid: tid,
    nid: nid,
    state: javaState,
    stateLabel: stateLabel(javaState),
    stack: stack,
    topFrame: stack[0] || "No Java stack frame captured",
    lockedMonitors: lockedMonitors,
    waitingOn: waitingOn,
    parkingToWaitFor: parkingToWaitFor,
    rawSynchronizers: rawSynchronizers,
    fingerprint: stack.slice(0, 8).join("\n"),
  };
}

function groupCounts(items) {
  return Array.from(items.entries())
    .sort(function sortCounts(left, right) {
      return right[1] - left[1];
    })
    .map(function mapCount(entry) {
      return { label: entry[0], count: entry[1] };
    });
}

function buildThreadMap(threads) {
  return new Map(
    threads.map(function mapThread(thread) {
      return [thread.name, thread];
    }),
  );
}

function buildMonitorSummaries(threads) {
  var monitors = new Map();

  threads.forEach(function consumeThread(thread) {
    var waitsFor = thread.waitingOn.concat(thread.parkingToWaitFor);
    waitsFor.forEach(function addWait(monitor) {
      if (!monitors.has(monitor)) {
        monitors.set(monitor, { monitor: monitor, owners: [], waiters: [] });
      }
      monitors.get(monitor).waiters.push(thread.name);
    });

    thread.lockedMonitors.concat(thread.rawSynchronizers).forEach(function addOwner(monitor) {
      if (!monitors.has(monitor)) {
        monitors.set(monitor, { monitor: monitor, owners: [], waiters: [] });
      }
      monitors.get(monitor).owners.push(thread.name);
    });
  });

  return {
    map: monitors,
    list: Array.from(monitors.values()).sort(function sortMonitors(left, right) {
      if (right.waiters.length !== left.waiters.length) {
        return right.waiters.length - left.waiters.length;
      }
      return right.owners.length - left.owners.length;
    }),
  };
}

function buildOwnerMap(monitorData) {
  var ownerMap = new Map();
  monitorData.list.forEach(function addOwners(monitor) {
    if (monitor.owners.length) {
      ownerMap.set(monitor.monitor, monitor.owners.slice());
    }
  });
  return ownerMap;
}

function detectDeadlockCycles(waitGraph) {
  var cycles = [];
  var visited = new Set();

  function dfs(node, path) {
    var next = waitGraph.get(node) || [];

    if (path.indexOf(node) >= 0) {
      var cycleStart = path.indexOf(node);
      var cycle = path.slice(cycleStart);
      var normalized = cycle.slice().sort().join("|");
      if (!visited.has(normalized)) {
        visited.add(normalized);
        cycles.push(cycle);
      }
      return;
    }

    next.forEach(function walkNeighbor(neighbor) {
      dfs(neighbor, path.concat(node));
    });
  }

  Array.from(waitGraph.keys()).forEach(function walkNode(node) {
    dfs(node, []);
  });

  return cycles;
}

function summarizeHotspots(threads) {
  var groups = new Map();

  threads.forEach(function groupThread(thread) {
    if (!thread.fingerprint) {
      return;
    }
    if (!groups.has(thread.fingerprint)) {
      groups.set(thread.fingerprint, []);
    }
    groups.get(thread.fingerprint).push(thread);
  });

  return Array.from(groups.values())
    .filter(function filterGroups(group) {
      return group.length > 1;
    })
    .sort(function sortGroups(left, right) {
      return right.length - left.length;
    })
    .map(function mapHotspot(group) {
      return {
        size: group.length,
        topFrame: group[0].topFrame,
        state: group[0].state,
        names: group.map(function mapName(thread) {
          return thread.name;
        }),
      };
    });
}

function detectPool(thread) {
  var name = thread.name || "Unknown Thread";
  var topFrame = thread.topFrame || "";
  var match;
  var systemThreadPattern = /^(Reference Handler|Finalizer|Signal Dispatcher|Attach Listener|Service Thread|VM Thread|Monitor Deflation Thread|Notification Thread|Common-Cleaner|Sweeper thread|C1 CompilerThread|C2 CompilerThread|GC Thread)/;

  match = name.match(/^(http-[^-]+-\d+-exec)-\d+$/);
  if (match) {
    return { name: match[1], category: "HTTP Request Pool" };
  }

  match = name.match(/^(ForkJoinPool\.[^-]+-worker)-\d+$/);
  if (match) {
    return { name: match[1], category: "ForkJoin Pool" };
  }

  match = name.match(/^(pool-\d+-thread)-\d+$/);
  if (match) {
    return { name: match[1], category: "Generic Executor" };
  }

  match = name.match(/^(HikariPool-\d+)/);
  if (match) {
    return { name: match[1], category: "JDBC Connection Pool" };
  }

  if (/kafka|consumer|producer|streamthread/i.test(name)) {
    return { name: trimNumericSuffix(name), category: "Messaging Threads" };
  }

  if (/scheduler|scheduled|timer/i.test(name) || /ScheduledThreadPoolExecutor|DelayedWorkQueue/.test(topFrame)) {
    return { name: trimNumericSuffix(name), category: "Scheduler" };
  }

  if (systemThreadPattern.test(name)) {
    return { name: name, category: "JVM System Threads" };
  }

  if (/CompilerThread|GC|G1|ZGC|Shenandoah/i.test(name)) {
    return { name: trimNumericSuffix(name), category: "JVM System Threads" };
  }

  return { name: trimNumericSuffix(name), category: "Custom Threads" };
}

function summarizePools(threads) {
  var pools = new Map();

  threads.forEach(function addThread(thread) {
    var pool = detectPool(thread);
    var group;

    thread.poolName = pool.name;
    thread.poolCategory = pool.category;

    if (!pools.has(pool.name)) {
      pools.set(pool.name, {
        name: pool.name,
        category: pool.category,
        threads: [],
        stateCounts: new Map(),
        topFrames: new Map(),
      });
    }

    group = pools.get(pool.name);
    group.threads.push(thread);
    group.stateCounts.set(thread.state, (group.stateCounts.get(thread.state) || 0) + 1);
    group.topFrames.set(thread.topFrame, (group.topFrames.get(thread.topFrame) || 0) + 1);
  });

  return Array.from(pools.values())
    .map(function mapPool(pool) {
      var dominantFrame = "";
      var dominantFrameCount = 0;
      var signals = [];
      var threadCount = pool.threads.length;
      var blockedCount = pool.stateCounts.get("BLOCKED") || 0;
      var waitingCount = (pool.stateCounts.get("WAITING") || 0) + (pool.stateCounts.get("TIMED_WAITING") || 0);
      var runnableCount = pool.stateCounts.get("RUNNABLE") || 0;

      pool.topFrames.forEach(function countFrame(count, frame) {
        if (count > dominantFrameCount) {
          dominantFrameCount = count;
          dominantFrame = frame;
        }
      });

      if (blockedCount >= 2) {
        signals.push(blockedCount + " threads are blocked in this pool.");
      }

      if (dominantFrameCount >= Math.max(2, Math.ceil(threadCount * 0.6))) {
        signals.push(dominantFrameCount + " threads share " + dominantFrame + ".");
      }

      if (waitingCount === threadCount && threadCount > 1) {
        signals.push("All visible threads in this pool are parked or waiting.");
      }

      if (runnableCount === threadCount && threadCount >= 3 && dominantFrameCount >= 2) {
        signals.push("All visible threads are runnable, which may indicate CPU saturation or busy looping.");
      }

      return {
        name: pool.name,
        category: pool.category,
        threadCount: threadCount,
        blockedCount: blockedCount,
        waitingCount: waitingCount,
        runnableCount: runnableCount,
        dominantFrame: dominantFrame || "No dominant frame",
        dominantFrameCount: dominantFrameCount,
        signals: signals,
        threads: pool.threads.map(function mapPoolThread(thread) {
          return {
            name: thread.name,
            state: thread.state,
            topFrame: thread.topFrame,
          };
        }),
      };
    })
    .sort(function sortPools(left, right) {
      if (right.blockedCount !== left.blockedCount) {
        return right.blockedCount - left.blockedCount;
      }
      return right.threadCount - left.threadCount;
    });
}

function firstWaitMonitor(thread) {
  var waitsFor = thread.waitingOn.concat(thread.parkingToWaitFor);
  return waitsFor.length ? waitsFor[0] : null;
}

function lockChainSegmentLabel(segment) {
  if (segment.type === "waiters") {
    return segment.waiterCount + " waiter" + (segment.waiterCount === 1 ? "" : "s") + " (" + segment.preview.join(", ") + ")";
  }
  if (segment.type === "monitor") {
    return "<" + segment.monitor + ">";
  }
  if (segment.type === "thread") {
    return segment.name + " (" + stateLabel(segment.state) + ")";
  }
  return segment.label;
}

function buildLockChains(threads, ownerMap, monitorData) {
  var threadByName = buildThreadMap(threads);

  function followOwner(ownerName, visited, segments, depth) {
    var ownerThread = threadByName.get(ownerName);
    var nextMonitor;
    var nextOwners;

    if (!ownerThread) {
      segments.push({ type: "thread", name: ownerName, state: "UNKNOWN" });
      return { cycle: false, rootOwner: ownerName, rootState: "UNKNOWN" };
    }

    segments.push({ type: "thread", name: ownerThread.name, state: ownerThread.state });
    nextMonitor = firstWaitMonitor(ownerThread);
    if (!nextMonitor || depth >= 5) {
      return { cycle: false, rootOwner: ownerThread.name, rootState: ownerThread.state };
    }

    segments.push({ type: "monitor", monitor: nextMonitor });
    nextOwners = ownerMap.get(nextMonitor) || [];
    if (!nextOwners.length) {
      segments.push({ type: "terminal", label: "No visible owner" });
      return { cycle: false, rootOwner: ownerThread.name, rootState: ownerThread.state };
    }

    if (visited[nextOwners[0]]) {
      var cycleThread = threadByName.get(nextOwners[0]);
      segments.push({
        type: "thread",
        name: nextOwners[0],
        state: cycleThread ? cycleThread.state : "UNKNOWN",
      });
      return {
        cycle: true,
        rootOwner: nextOwners[0],
        rootState: cycleThread ? cycleThread.state : "UNKNOWN",
      };
    }

    visited[nextOwners[0]] = true;
    return followOwner(nextOwners[0], visited, segments, depth + 1);
  }

  return monitorData.list
    .filter(function filterContendedMonitors(monitor) {
      return monitor.waiters.length > 0;
    })
    .map(function mapChain(monitor) {
      var segments = [
        {
          type: "waiters",
          waiterCount: monitor.waiters.length,
          preview: monitor.waiters.slice(0, 3),
        },
        { type: "monitor", monitor: monitor.monitor },
      ];
      var resolution;

      if (!monitor.owners.length) {
        segments.push({ type: "terminal", label: "No visible owner" });
        resolution = { cycle: false, rootOwner: "No visible owner", rootState: "UNKNOWN" };
      } else {
        resolution = followOwner(monitor.owners[0], { [monitor.owners[0]]: true }, segments, 0);
      }

      return {
        monitor: monitor.monitor,
        waiterCount: monitor.waiters.length,
        waiters: monitor.waiters.slice(),
        owners: monitor.owners.slice(),
        cycle: resolution.cycle,
        rootOwner: resolution.rootOwner,
        rootState: resolution.rootState,
        depth: segments.filter(function countSegments(segment) {
          return segment.type === "thread" || segment.type === "monitor";
        }).length,
        segments: segments,
        summary: segments.map(lockChainSegmentLabel).join(" -> "),
      };
    })
    .sort(function sortChains(left, right) {
      if (left.cycle !== right.cycle) {
        return left.cycle ? -1 : 1;
      }
      if (right.waiterCount !== left.waiterCount) {
        return right.waiterCount - left.waiterCount;
      }
      return right.depth - left.depth;
    });
}

function buildFindings(threads, deadlockCycles, ownerMap, hotspots, poolGroups, lockChains) {
  var findings = [];
  var blocked = threads.filter(function filterBlocked(thread) {
    return thread.state === "BLOCKED";
  });
  var waiting = threads.filter(function filterWaiting(thread) {
    return thread.state === "WAITING" || thread.state === "TIMED_WAITING";
  });
  var runnable = threads.filter(function filterRunnable(thread) {
    return thread.state === "RUNNABLE";
  });
  var unownedWaits = threads
    .map(function mapWaits(thread) {
      return thread.waitingOn.concat(thread.parkingToWaitFor).map(function mapMonitor(monitor) {
        return { thread: thread.name, monitor: monitor };
      });
    })
    .reduce(function flatten(all, monitors) {
      return all.concat(monitors);
    }, [])
    .filter(function filterWaits(entry) {
      return !ownerMap.has(entry.monitor);
    });

  deadlockCycles.forEach(function addDeadlock(cycle) {
    findings.push({
      severity: "high",
      title: "Potential deadlock cycle detected",
      body: "Threads waiting on one another form a cycle: " + cycle.join(" -> ") + ".",
    });
  });

  if (blocked.length) {
    findings.push({
      severity: blocked.length >= 3 ? "high" : "medium",
      title: blocked.length + " blocked thread" + (blocked.length === 1 ? "" : "s"),
      body: "Blocked threads are waiting for a monitor or synchronizer. Review the lock chains and monitor owners to locate the choke point.",
    });
  }

  if (lockChains.length && lockChains[0].waiterCount >= 2) {
    findings.push({
      severity: lockChains[0].cycle || lockChains[0].waiterCount >= 3 ? "high" : "medium",
      title: "Contention chain impacting multiple waiters",
      body: lockChains[0].summary + ".",
    });
  }

  if (hotspots.length) {
    findings.push({
      severity: hotspots[0].size >= 5 ? "medium" : "low",
      title: "Repeated stack hotspot",
      body:
        hotspots[0].size +
        " threads share the same leading stack frames near " +
        hotspots[0].topFrame +
        ". This often points to pool saturation or a lock convoy.",
    });
  }

  if (poolGroups.length && poolGroups[0].signals.length) {
    findings.push({
      severity: poolGroups[0].blockedCount >= 2 ? "medium" : "low",
      title: "Pool-level signal in " + poolGroups[0].name,
      body: poolGroups[0].signals[0],
    });
  }

  if (unownedWaits.length) {
    findings.push({
      severity: "low",
      title: "Wait targets without visible owner",
      body:
        unownedWaits.length +
        " waiting relationship" +
        (unownedWaits.length === 1 ? "" : "s") +
        " reference a monitor whose owner is not visible in this dump.",
    });
  }

  if (!blocked.length && waiting.length > threads.length * 0.6) {
    findings.push({
      severity: "low",
      title: "Mostly parked or waiting threads",
      body: "A large share of threads are in WAITING or TIMED_WAITING. That can be healthy for idle services, but pool summaries will show whether a whole executor is stalled.",
    });
  }

  if (runnable.length > threads.length * 0.7 && threads.length > 6) {
    findings.push({
      severity: "medium",
      title: "High runnable concentration",
      body: "Most threads are RUNNABLE. That pattern can reflect CPU pressure, spin loops, or active GC/JIT work depending on the stack frames.",
    });
  }

  if (!findings.length) {
    findings.push({
      severity: "low",
      title: "No critical patterns detected",
      body: "The dump parsed cleanly, but a single snapshot can miss transient lock issues. Compare multiple dumps over time for stronger conclusions.",
    });
  }

  return findings.sort(function sortFindings(left, right) {
    var order = { high: 0, medium: 1, low: 2 };
    return order[left.severity] - order[right.severity];
  });
}

function analyzeThreadDump(text) {
  var blocks = extractThreadBlocks(text);
  var threads = blocks.map(parseThread).filter(function filterThread(thread) {
    return !!thread.name;
  });
  var stateCounts = new Map();
  var waitGraph = new Map();
  var monitorData;
  var ownerMap;
  var hotspots;
  var poolGroups;
  var lockChains;
  var findings;

  threads.forEach(function attachPool(thread) {
    var pool = detectPool(thread);
    thread.poolName = pool.name;
    thread.poolCategory = pool.category;
    stateCounts.set(thread.state, (stateCounts.get(thread.state) || 0) + 1);
  });

  monitorData = buildMonitorSummaries(threads);
  ownerMap = buildOwnerMap(monitorData);

  threads.forEach(function buildWaitEdges(thread) {
    thread.waitingOn.concat(thread.parkingToWaitFor).forEach(function addEdge(monitor) {
      var owners = ownerMap.get(monitor) || [];
      if (!owners.length) {
        return;
      }
      if (!waitGraph.has(thread.name)) {
        waitGraph.set(thread.name, []);
      }
      waitGraph.get(thread.name).push.apply(waitGraph.get(thread.name), owners);
    });
  });

  hotspots = summarizeHotspots(threads);
  poolGroups = summarizePools(threads);
  lockChains = buildLockChains(threads, ownerMap, monitorData);
  findings = buildFindings(threads, detectDeadlockCycles(waitGraph), ownerMap, hotspots, poolGroups, lockChains);

  return {
    parsed: threads.length > 0,
    threadCount: threads.length,
    threads: threads,
    findings: findings,
    deadlockCycles: detectDeadlockCycles(waitGraph),
    hotspots: hotspots,
    stateCounts: groupCounts(stateCounts),
    monitors: monitorData.list,
    poolGroups: poolGroups,
    lockChains: lockChains,
  };
}

function getThreadKey(thread) {
  if (thread.tid) {
    return "tid:" + thread.tid;
  }
  if (thread.nid) {
    return "nid:" + thread.nid;
  }
  return "name:" + thread.name;
}

function compactState(state) {
  return state || "UNKNOWN";
}

function countStates(analysis) {
  var counts = new Map();
  analysis.stateCounts.forEach(function addState(item) {
    counts.set(item.label, item.count);
  });
  return counts;
}

function summarizeDelta(previousCounts, currentCounts) {
  var states = Array.from(new Set(Array.from(previousCounts.keys()).concat(Array.from(currentCounts.keys())))).sort();
  return states
    .map(function mapState(state) {
      return {
        state: state,
        previous: previousCounts.get(state) || 0,
        current: currentCounts.get(state) || 0,
        delta: (currentCounts.get(state) || 0) - (previousCounts.get(state) || 0),
      };
    })
    .filter(function filterState(item) {
      return item.previous || item.current;
    });
}

function summarizePoolDelta(leftPools, rightPools) {
  var leftMap = new Map();
  var rightMap = new Map();
  var names;

  leftPools.forEach(function addLeft(pool) {
    leftMap.set(pool.name, pool);
  });
  rightPools.forEach(function addRight(pool) {
    rightMap.set(pool.name, pool);
  });

  names = Array.from(new Set(Array.from(leftMap.keys()).concat(Array.from(rightMap.keys()))));

  return names
    .map(function mapPool(name) {
      var left = leftMap.get(name);
      var right = rightMap.get(name);
      return {
        name: name,
        category: (right && right.category) || (left && left.category) || "Unknown",
        leftCount: left ? left.threadCount : 0,
        rightCount: right ? right.threadCount : 0,
        delta: (right ? right.threadCount : 0) - (left ? left.threadCount : 0),
        leftBlocked: left ? left.blockedCount : 0,
        rightBlocked: right ? right.blockedCount : 0,
        blockedDelta: (right ? right.blockedCount : 0) - (left ? left.blockedCount : 0),
      };
    })
    .filter(function filterDelta(pool) {
      return pool.delta !== 0 || pool.blockedDelta !== 0;
    })
    .sort(function sortDelta(left, right) {
      if (Math.abs(right.blockedDelta) !== Math.abs(left.blockedDelta)) {
        return Math.abs(right.blockedDelta) - Math.abs(left.blockedDelta);
      }
      return Math.abs(right.delta) - Math.abs(left.delta);
    });
}

function buildSnapshotDiff(leftEntry, rightEntry) {
  var leftAnalysis;
  var rightAnalysis;
  var leftThreads;
  var rightThreads;
  var changedThreads = [];
  var newThreads = [];
  var vanishedThreads = [];
  var findings = [];
  var stateDelta;
  var poolDelta;

  if (!leftEntry || !rightEntry) {
    return { comparable: false };
  }

  leftAnalysis = leftEntry.analysis;
  rightAnalysis = rightEntry.analysis;

  if (!leftAnalysis.parsed || !rightAnalysis.parsed) {
    return { comparable: false };
  }

  leftThreads = new Map(
    leftAnalysis.threads.map(function mapThread(thread) {
      return [getThreadKey(thread), thread];
    }),
  );
  rightThreads = new Map(
    rightAnalysis.threads.map(function mapThread(thread) {
      return [getThreadKey(thread), thread];
    }),
  );

  rightAnalysis.threads.forEach(function diffRight(thread) {
    var previous = leftThreads.get(getThreadKey(thread));
    if (!previous) {
      newThreads.push({
        name: thread.name,
        state: thread.state,
        topFrame: thread.topFrame,
        poolName: thread.poolName,
      });
      return;
    }

    if (
      previous.state !== thread.state ||
      previous.topFrame !== thread.topFrame ||
      firstWaitMonitor(previous) !== firstWaitMonitor(thread) ||
      previous.poolName !== thread.poolName
    ) {
      changedThreads.push({
        name: thread.name,
        fromState: previous.state,
        toState: thread.state,
        fromFrame: previous.topFrame,
        toFrame: thread.topFrame,
        fromWait: firstWaitMonitor(previous) || "None",
        toWait: firstWaitMonitor(thread) || "None",
        fromPool: previous.poolName,
        toPool: thread.poolName,
      });
    }
  });

  leftAnalysis.threads.forEach(function diffLeft(thread) {
    if (!rightThreads.has(getThreadKey(thread))) {
      vanishedThreads.push({
        name: thread.name,
        state: thread.state,
        topFrame: thread.topFrame,
        poolName: thread.poolName,
      });
    }
  });

  changedThreads.sort(function sortChanged(left, right) {
    if (left.fromState !== left.toState && right.fromState === right.toState) {
      return -1;
    }
    if (right.fromState !== right.toState && left.fromState === left.toState) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });

  stateDelta = summarizeDelta(countStates(leftAnalysis), countStates(rightAnalysis));
  poolDelta = summarizePoolDelta(leftAnalysis.poolGroups, rightAnalysis.poolGroups);

  if ((rightAnalysis.stateCounts.find(function findBlocked(item) { return item.label === "BLOCKED"; }) || { count: 0 }).count >
      (leftAnalysis.stateCounts.find(function findBlocked(item) { return item.label === "BLOCKED"; }) || { count: 0 }).count) {
    findings.push({
      severity: "medium",
      title: "Blocked threads increased",
      body: "The right snapshot contains more blocked threads than the left snapshot.",
    });
  }

  if (rightAnalysis.deadlockCycles.length > leftAnalysis.deadlockCycles.length) {
    findings.push({
      severity: "high",
      title: "Deadlock signal worsened",
      body: "Additional deadlock cycles appear in the right snapshot.",
    });
  }

  if (poolDelta.length && poolDelta[0].blockedDelta > 0) {
    findings.push({
      severity: "medium",
      title: "Pool contention increased in " + poolDelta[0].name,
      body: "Blocked threads rose inside this pool between the selected snapshots.",
    });
  }

  return {
    comparable: true,
    leftId: leftEntry.id,
    leftLabel: leftEntry.label,
    rightId: rightEntry.id,
    rightLabel: rightEntry.label,
    findings: findings,
    stateDelta: stateDelta,
    poolDelta: poolDelta,
    changedThreads: changedThreads.slice(0, 30),
    newThreads: newThreads.slice(0, 20),
    vanishedThreads: vanishedThreads.slice(0, 20),
  };
}

function compareThreadDumpSnapshots(snapshots) {
  var analyses = snapshots.map(function mapSnapshot(snapshot, index) {
    return {
      id: snapshot.id || "snapshot-" + (index + 1),
      label: snapshot.label || "Snapshot " + (index + 1),
      rawLabel: snapshot.rawLabel || "",
      analysis: analyzeThreadDump(snapshot.text),
    };
  });
  var parsedAnalyses = analyses.filter(function filterParsed(entry) {
    return entry.analysis.parsed;
  });
  var transitions = [];
  var persistentBlocked = new Map();
  var recurringHotspots = new Map();
  var timelineByState = new Map();
  var threadHistoryMap = new Map();
  var adjacentDiffs = [];
  var findings = [];
  var deltaByState;
  var timelineRows;
  var threadHistories;

  if (parsedAnalyses.length < 2) {
    return {
      comparable: false,
      analyses: analyses,
      findings: [],
      transitions: [],
      persistentBlocked: [],
      recurringHotspots: [],
      adjacentDiffs: [],
      defaultLeftId: "",
      defaultRightId: "",
    };
  }

  parsedAnalyses.forEach(function accumulate(entry) {
    entry.analysis.stateCounts.forEach(function addStateCount(stateCount) {
      if (!timelineByState.has(stateCount.label)) {
        timelineByState.set(stateCount.label, []);
      }
      timelineByState.get(stateCount.label).push({
        label: entry.label,
        count: stateCount.count,
      });
    });

    entry.analysis.threads.forEach(function addHistory(thread) {
      var key = getThreadKey(thread);
      if (!threadHistoryMap.has(key)) {
        threadHistoryMap.set(key, {
          key: key,
          name: thread.name,
          appearances: [],
        });
      }
      threadHistoryMap.get(key).appearances.push({
        label: entry.label,
        state: compactState(thread.state),
        topFrame: thread.topFrame,
        waitingOn: thread.waitingOn.concat(thread.parkingToWaitFor),
        lockedMonitors: thread.lockedMonitors.concat(thread.rawSynchronizers),
        poolName: thread.poolName,
        stack: thread.stack,
      });
    });

    entry.analysis.hotspots.forEach(function accumulateHotspot(hotspot) {
      var hotspotKey = hotspot.topFrame + "::" + hotspot.state;
      var existing = recurringHotspots.get(hotspotKey);

      if (!existing) {
        recurringHotspots.set(hotspotKey, {
          topFrame: hotspot.topFrame,
          state: hotspot.state,
          appearances: 1,
          maxSize: hotspot.size,
        });
        return;
      }

      existing.appearances += 1;
      existing.maxSize = Math.max(existing.maxSize, hotspot.size);
    });
  });

  for (var index = 1; index < parsedAnalyses.length; index += 1) {
    var previous = parsedAnalyses[index - 1];
    var current = parsedAnalyses[index];
    var previousThreads = new Map(
      previous.analysis.threads.map(function mapThread(thread) {
        return [getThreadKey(thread), thread];
      }),
    );
    var currentThreads = new Map(
      current.analysis.threads.map(function mapThread(thread) {
        return [getThreadKey(thread), thread];
      }),
    );

    adjacentDiffs.push(buildSnapshotDiff(previous, current));

    currentThreads.forEach(function compareThread(currentThread, key) {
      var previousThread = previousThreads.get(key);
      if (!previousThread) {
        return;
      }

      if (previousThread.state !== currentThread.state || previousThread.topFrame !== currentThread.topFrame) {
        transitions.push({
          thread: currentThread.name,
          fromLabel: previous.label,
          toLabel: current.label,
          fromState: previousThread.state,
          toState: currentThread.state,
          fromFrame: previousThread.topFrame,
          toFrame: currentThread.topFrame,
        });
      }

      if (previousThread.state === "BLOCKED" && currentThread.state === "BLOCKED") {
        persistentBlocked.set(currentThread.name, (persistentBlocked.get(currentThread.name) || 0) + 1);
      }
    });
  }

  deltaByState = summarizeDelta(countStates(parsedAnalyses[0].analysis), countStates(parsedAnalyses[parsedAnalyses.length - 1].analysis));

  if (parsedAnalyses.filter(function filterDeadlocks(entry) { return entry.analysis.deadlockCycles.length > 0; }).length > 1) {
    findings.push({
      severity: "high",
      title: "Deadlock signal persists across snapshots",
      body: "Potential deadlock cycles appear in more than one snapshot, which is much stronger evidence than a single dump.",
    });
  }

  if (persistentBlocked.size) {
    findings.push({
      severity: "medium",
      title: "Blocked threads persisted between snapshots",
      body: persistentBlocked.size + " threads stayed blocked across consecutive snapshots.",
    });
  }

  if (recurringHotspots.size) {
    findings.push({
      severity: "medium",
      title: "Recurring stack hotspot across time",
      body: "The same leading stack frames reappear across snapshots, which often indicates a stable bottleneck rather than a momentary spike.",
    });
  }

  timelineRows = Array.from(timelineByState.entries())
    .map(function mapTimeline(entry) {
      return {
        state: entry[0],
        points: parsedAnalyses.map(function fillPoint(snapshotEntry) {
          var matched = entry[1].find(function findPoint(point) {
            return point.label === snapshotEntry.label;
          });
          return {
            label: snapshotEntry.label,
            count: matched ? matched.count : 0,
          };
        }),
      };
    })
    .sort(function sortTimeline(left, right) {
      var leftTotal = left.points.reduce(function sum(total, point) {
        return total + point.count;
      }, 0);
      var rightTotal = right.points.reduce(function sum(total, point) {
        return total + point.count;
      }, 0);
      return rightTotal - leftTotal;
    });

  threadHistories = Array.from(threadHistoryMap.values())
    .map(function mapHistory(history) {
      var appearanceMap = new Map(
        history.appearances.map(function mapAppearance(appearance) {
          return [appearance.label, appearance];
        }),
      );
      var fullPath = parsedAnalyses.map(function buildPath(entry) {
        return (
          appearanceMap.get(entry.label) || {
            label: entry.label,
            state: "TERMINATED",
            topFrame: "Thread not visible in this snapshot",
            waitingOn: [],
            lockedMonitors: [],
            poolName: "No pool",
            stack: [],
          }
        );
      });
      var transitionsCount = fullPath.reduce(function countTransitions(total, appearance, pathIndex) {
        if (pathIndex === 0) {
          return total;
        }
        return total + (appearance.state !== fullPath[pathIndex - 1].state ? 1 : 0);
      }, 0);
      var blockedCount = fullPath.filter(function filterBlocked(appearance) {
        return appearance.state === "BLOCKED";
      }).length;

      return {
        key: history.key,
        name: history.name,
        fullPath: fullPath,
        appearances: history.appearances.length,
        transitionsCount: transitionsCount,
        blockedCount: blockedCount,
      };
    })
    .filter(function filterHistory(history) {
      return history.appearances > 1;
    })
    .sort(function sortHistory(left, right) {
      if (right.blockedCount !== left.blockedCount) {
        return right.blockedCount - left.blockedCount;
      }
      if (right.transitionsCount !== left.transitionsCount) {
        return right.transitionsCount - left.transitionsCount;
      }
      return right.appearances - left.appearances;
    });

  return {
    comparable: true,
    analyses: analyses,
    findings: findings,
    transitions: transitions.slice(0, 25),
    persistentBlocked: Array.from(persistentBlocked.entries())
      .sort(function sortBlocked(left, right) {
        return right[1] - left[1];
      })
      .map(function mapBlocked(entry) {
        return { thread: entry[0], streak: entry[1] };
      })
      .slice(0, 20),
    recurringHotspots: Array.from(recurringHotspots.values())
      .filter(function filterRecurring(item) {
        return item.appearances > 1;
      })
      .sort(function sortRecurring(left, right) {
        if (right.appearances !== left.appearances) {
          return right.appearances - left.appearances;
        }
        return right.maxSize - left.maxSize;
      })
      .slice(0, 10),
    deltaByState: deltaByState,
    timelineRows: timelineRows,
    threadHistories: threadHistories,
    adjacentDiffs: adjacentDiffs,
    defaultLeftId: parsedAnalyses[parsedAnalyses.length - 2].id,
    defaultRightId: parsedAnalyses[parsedAnalyses.length - 1].id,
  };
}

window.ThreadScopeAnalyzer = {
  analyzeThreadDump: analyzeThreadDump,
  buildSnapshotDiff: buildSnapshotDiff,
  compareThreadDumpSnapshots: compareThreadDumpSnapshots,
  detectSnapshotsFromText: detectSnapshotsFromText,
};
