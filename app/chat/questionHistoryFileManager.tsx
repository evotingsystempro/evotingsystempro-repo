/**
 * questionHistoryFileManager.ts
 *
 * Cloud-backed question history persistence using Firestore.
 *
 * Why Firestore over local files / AsyncStorage?
 *  ✅ Survives app uninstall           (data lives in the cloud)
 *  ✅ Survives cache/data clears       (never touches device storage)
 *  ✅ Works on iOS, Android AND Web    (no native modules needed)
 *  ✅ Syncs across devices             (same account = same history)
 *  ✅ Tamper-proof                     (users cannot edit Firestore directly)
 *  ✅ Already in the project           (zero new dependencies)
 *
 * Firestore data layout:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Collection : QUESTION_HISTORY                                  │
 * │  Document   : {userId}          ← one doc per user             │
 * │  Fields     : {                                                 │
 * │    [topicKey]: {                                                │
 * │      questions : string[],  ← normalised (trim+lowercase)      │
 * │      raw       : string[],  ← original text                    │
 * │      updatedAt : number     ← epoch ms                         │
 * │    },                                                           │
 * │    ...one field per topic                                       │
 * │  }                                                              │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Performance strategy:
 *  • One Firestore document per user — a single getDoc/setDoc covers
 *    every topic. No per-topic reads.
 *  • In-memory Set per topic — O(1) duplicate lookups after first load.
 *    Firestore is only hit once per session per user (cold load), then
 *    all subsequent checks are pure in-memory.
 *  • Debounced writes (300 ms) — rapid persist calls are coalesced into
 *    a single setDoc, preventing unnecessary Firestore write operations.
 *  • merge: true on every write — other topic fields are never clobbered.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/* ══════════════════════════════════════════════════════════════
 *  CONSTANTS
 * ══════════════════════════════════════════════════════════════ */

/** Firestore collection that holds all user question histories */
const COLLECTION = "QUESTION_HISTORY";

/**
 * Cap on stored questions per topic.
 * At 6 questions per round → ~83 rounds before eviction begins.
 * Keeps Firestore documents from growing to excessive size.
 */
const MAX_STORED_PER_TOPIC = 500;

/**
 * Debounce window for Firestore writes (ms).
 * Coalesces multiple rapid persist() calls into one write operation.
 */
const WRITE_DEBOUNCE_MS = 300;

/* ══════════════════════════════════════════════════════════════
 *  TYPES
 * ══════════════════════════════════════════════════════════════ */

type TopicRecord = {
  questions: string[]; // normalised (trim + lowercase)
  raw: string[];       // original question text
  updatedAt: number;   // epoch ms
};

type UserHistoryDoc = Record<string, TopicRecord>;

/* ══════════════════════════════════════════════════════════════
 *  IN-MEMORY CACHES
 *
 *  All cache keys use the composite  `${userId}::${topicKey}`
 *  pattern so multiple users on the same device in the same
 *  session never share or pollute each other's history.
 * ══════════════════════════════════════════════════════════════ */

/** Normalised question strings per topic — O(1) duplicate lookup */
const memoryCache = new Map<string, Set<string>>();

/** Original question text per topic — preserved for debugging/display */
const rawCache = new Map<string, string[]>();

/** Debounce timer handles — one per active topic write */
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Tracks which users' Firestore docs have been fetched this session.
 * One cold-load per user covers ALL topics — no per-topic network reads.
 */
const docLoadedForUser = new Set<string>();

/* ══════════════════════════════════════════════════════════════
 *  INTERNAL HELPERS
 * ══════════════════════════════════════════════════════════════ */

/** Lowercase + trim for consistent duplicate detection */
const normalise = (q: string): string => q.trim().toLowerCase();

/** Composite cache key — prevents cross-user collisions */
const ck = (userId: string, topicKey: string): string =>
  `${userId}::${topicKey}`;

/** Firestore document reference for a user's full history */
const userDocRef = (userId: string) => doc(db, COLLECTION, userId);

/* ── Cold load ──────────────────────────────────────────────── */
/**
 * Fetches the entire user document from Firestore ONCE per session,
 * populating the in-memory cache for every topic found in that document.
 * Subsequent calls for the same user are no-ops (guarded by docLoadedForUser).
 */
const coldLoadUser = async (userId: string): Promise<void> => {
  if (docLoadedForUser.has(userId)) return; // already loaded this session

  try {
    const snap = await getDoc(userDocRef(userId));

    if (snap.exists()) {
      const data = snap.data() as UserHistoryDoc;

      for (const [topicKey, record] of Object.entries(data)) {
        // Guard against malformed / legacy fields in the document
        if (
          !record ||
          typeof record !== "object" ||
          !Array.isArray(record.questions) ||
          !Array.isArray(record.raw)
        ) {
          continue;
        }

        const key = ck(userId, topicKey);

        // Don't overwrite if a concurrent warm-up already populated this key
        if (!memoryCache.has(key)) {
          memoryCache.set(key, new Set<string>(record.questions));
          rawCache.set(key, record.raw);
        }
      }

      console.log(
        `[QH] Cold-loaded Firestore history for user "${userId}" — ` +
        `${Object.keys(data).length} topic(s)`
      );
    } else {
      // No document yet — perfectly normal for a new user
      console.log(`[QH] No history document yet for user "${userId}"`);
    }
  } catch (err) {
    // Network failure on load — safe to continue with an empty cache.
    // The only consequence is that questions from previous sessions may
    // be repeated for the current session only. History is not lost.
    console.warn("[QH] coldLoadUser failed (continuing with empty cache):", err);
  }

  // Mark loaded regardless of success to prevent retry storms
  docLoadedForUser.add(userId);
};

/* ── Firestore write ────────────────────────────────────────── */
/**
 * Writes a single topic's record to Firestore.
 * Uses merge: true so every other topic field in the document is untouched.
 */
const writeTopicToFirestore = async (
  userId: string,
  topicKey: string,
  record: TopicRecord
): Promise<void> => {
  try {
    await setDoc(
      userDocRef(userId),
      { [topicKey]: record },
      { merge: true }
    );
    console.log(
      `[QH] Firestore write OK: "${topicKey}" → ` +
      `${record.questions.length} question(s) for user "${userId}"`
    );
  } catch (err) {
    // Non-fatal — in-memory cache stays accurate for this session.
    // Next session will re-fetch from Firestore (which may have older data).
    console.warn("[QH] Firestore write failed:", err);
  }
};

/* ══════════════════════════════════════════════════════════════
 *  PUBLIC API
 * ══════════════════════════════════════════════════════════════ */

/**
 * loadTopicHistory
 *
 * Returns the in-memory Set of normalised question strings for a topic.
 *
 * On the first call for a user it triggers a single Firestore getDoc that
 * populates the cache for ALL of that user's topics simultaneously.
 * Every subsequent call — for any topic — is a pure in-memory lookup
 * with zero network overhead.
 *
 * Call this as early as possible (e.g. when the topic resolves) to
 * pre-warm the cache before the player taps "Start Game".
 *
 * @param userId   Firestore user identifier (email / UID)
 * @param topicKey The quiz topic name used as the Firestore field key
 */
export const loadTopicHistory = async (
  userId: string,
  topicKey: string
): Promise<Set<string>> => {
  // One network read warms the cache for every topic this user has
  await coldLoadUser(userId);

  const key = ck(userId, topicKey);

  // Topic not yet seen — initialise an empty cache entry
  if (!memoryCache.has(key)) {
    memoryCache.set(key, new Set<string>());
    rawCache.set(key, []);
  }

  return memoryCache.get(key)!;
};

/**
 * isDuplicate
 *
 * Returns true if the given question already exists in the stored history
 * for this user + topic combination. Uses an O(1) Set lookup.
 *
 * @param userId   Firestore user identifier
 * @param topicKey Quiz topic name
 * @param question Raw question text (normalisation applied internally)
 */
export const isDuplicate = async (
  userId: string,
  topicKey: string,
  question: string
): Promise<boolean> => {
  const set = await loadTopicHistory(userId, topicKey);
  return set.has(normalise(question));
};

/**
 * persistNewQuestions
 *
 * Adds unique questions to the in-memory cache and schedules a debounced
 * Firestore write. Already-seen questions are silently ignored (idempotent).
 * Questions beyond MAX_STORED_PER_TOPIC evict the oldest entries first.
 *
 * The 300 ms debounce means burst calls during regeneration loops result
 * in a single Firestore write rather than one write per attempt.
 *
 * @param userId          Firestore user identifier
 * @param topicKey        Quiz topic name
 * @param newRawQuestions Array of raw question strings to store
 */
export const persistNewQuestions = async (
  userId: string,
  topicKey: string,
  newRawQuestions: string[]
): Promise<void> => {
  const set = await loadTopicHistory(userId, topicKey);
  const key = ck(userId, topicKey);
  const raw = rawCache.get(key) ?? [];

  let added = 0;
  for (const q of newRawQuestions) {
    const norm = normalise(q);
    if (!set.has(norm)) {
      set.add(norm);
      raw.push(q);
      added++;
    }
  }

  if (added === 0) {
    console.log(`[QH] Nothing new to persist for "${topicKey}" (all duplicates)`);
    return;
  }

  // Enforce the cap — keep the most recent MAX_STORED_PER_TOPIC entries
  const allNorm = Array.from(set);
  const cappedNorm =
    allNorm.length > MAX_STORED_PER_TOPIC
      ? allNorm.slice(allNorm.length - MAX_STORED_PER_TOPIC)
      : allNorm;

  const cappedRaw =
    raw.length > MAX_STORED_PER_TOPIC
      ? raw.slice(raw.length - MAX_STORED_PER_TOPIC)
      : raw;

  // Keep in-memory state aligned with capped arrays
  memoryCache.set(key, new Set<string>(cappedNorm));
  rawCache.set(key, cappedRaw);

  // Debounce — cancel any pending write for this topic
  const existing = writeTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    writeTimers.delete(key);
    writeTopicToFirestore(userId, topicKey, {
      questions: cappedNorm,
      raw: cappedRaw,
      updatedAt: Date.now(),
    });
  }, WRITE_DEBOUNCE_MS);

  writeTimers.set(key, timer);
};

/**
 * deduplicateWithRegeneration
 *
 * Core deduplication engine consumed by generateGeminiQuestions in quiz.tsx.
 *
 * Algorithm:
 *  1. Filter `candidates` against the Firestore-backed history Set.
 *  2. If fewer than `needed` unique questions remain, invoke `generator`
 *     to fetch a fresh batch from Gemini and filter that too.
 *  3. Repeat up to `maxRetries` times.
 *  4. If the quota still isn't met, return what was collected —
 *     graceful degradation: never throws, never infinite-loops.
 *
 * @param userId     Firestore user identifier
 * @param topicKey   Quiz topic name
 * @param candidates Initial AI-generated batch (may contain duplicates)
 * @param needed     Target number of unique questions to return
 * @param generator  Async fn that produces a fresh candidate batch
 * @param maxRetries Safety cap on regeneration loops (default: 5)
 */
export const deduplicateWithRegeneration = async <T extends { question: string }>(
  userId: string,
  topicKey: string,
  candidates: T[],
  needed: number,
  generator: () => Promise<T[]>,
  maxRetries: number = 5
): Promise<T[]> => {
  const historySet = await loadTopicHistory(userId, topicKey);
  const unique: T[] = [];

  // Track what we've accepted THIS round to block intra-batch duplicates
  const seenThisRound = new Set<string>();

  const isNew = (q: T): boolean => {
    const norm = normalise(q.question);
    return !historySet.has(norm) && !seenThisRound.has(norm);
  };

  // Pass 1 — filter the initial candidate batch
  for (const q of candidates) {
    if (unique.length >= needed) break;
    if (isNew(q)) {
      unique.push(q);
      seenThisRound.add(normalise(q.question));
    }
  }

  // Pass 2+ — regenerate until quota met or retries exhausted
  let attempts = 0;
  while (unique.length < needed && attempts < maxRetries) {
    attempts++;
    console.log(
      `[QH] Need ${needed - unique.length} more unique question(s) — ` +
      `regeneration attempt ${attempts}/${maxRetries}`
    );

    try {
      const fresh = await generator();
      for (const q of fresh) {
        if (unique.length >= needed) break;
        if (isNew(q)) {
          unique.push(q);
          seenThisRound.add(normalise(q.question));
        }
      }
    } catch (err) {
      // Generator itself failed — stop looping rather than spinning
      console.warn(`[QH] Generator error on attempt ${attempts}:`, err);
      break;
    }
  }

  if (unique.length < needed) {
    console.warn(
      `[QH] Quota unmet: ${unique.length}/${needed} unique questions collected ` +
      `after ${attempts} regeneration attempt(s). Proceeding with partial set.`
    );
  }

  return unique;
};

/**
 * clearTopicHistory
 *
 * Removes a topic's history from both the in-memory cache and Firestore.
 * Cancels any pending debounced write first to prevent a queued write
 * from re-populating data immediately after the clear.
 *
 * Use for admin resets, testing, or a user-facing "clear history" feature.
 *
 * @param userId   Firestore user identifier
 * @param topicKey Quiz topic name to clear
 */
export const clearTopicHistory = async (
  userId: string,
  topicKey: string
): Promise<void> => {
  const key = ck(userId, topicKey);

  // Cancel any queued write so it cannot overwrite the clear
  const existing = writeTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    writeTimers.delete(key);
  }

  // Clear in-memory
  memoryCache.delete(key);
  rawCache.delete(key);

  // Write an empty record to Firestore (merge preserves other topics)
  try {
    await setDoc(
      userDocRef(userId),
      {
        [topicKey]: {
          questions: [],
          raw: [],
          updatedAt: Date.now(),
        },
      },
      { merge: true }
    );
    console.log(
      `[QH] Cleared Firestore history for "${topicKey}" (user: "${userId}")`
    );
  } catch (err) {
    console.warn("[QH] clearTopicHistory Firestore write failed:", err);
  }
};

/**
 * getTopicHistoryStats
 *
 * Returns diagnostic information about a topic's stored history.
 * Useful for admin screens, debugging, or analytics.
 *
 * @param userId   Firestore user identifier
 * @param topicKey Quiz topic name
 */
export const getTopicHistoryStats = async (
  userId: string,
  topicKey: string
): Promise<{
  count: number;
  firestorePath: string;
  userId: string;
  topicKey: string;
}> => {
  const set = await loadTopicHistory(userId, topicKey);
  return {
    count: set.size,
    firestorePath: `${COLLECTION}/${userId}`,
    userId,
    topicKey,
  };
};
