//useScoreboard.ts
import {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from "react";

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/firebase";
import { GlobalContext } from "@/context";
import { useNetworkStatus } from "../useNetworkStatus";

/* ---------------- CONSTANTS ---------------- */

const PAGE_SIZE = 30;
const CACHE_KEY = "SCOREBOARD_CACHE_V5";

/* ---------------- TYPES ---------------- */

type ScoreboardItem = {
  sub: string;
  user: string;
  email: string;
  userPhotoUrl: string;
  currentCorrectScore: number;
  totalScore: number;
  totalWrongScore: number;
  estimatedTotalScore: number;
  likes?: number;
  dislikes?: number;
  hearts?: number;
  status?: string;
  timestamp?: number;
  createdAt?: number;
};

/* ---------------- HELPERS ---------------- */

const normalizeTime = (val: any): number | undefined => {
  if (!val) return undefined;
  if (typeof val === "number") return val;
  if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
  if (typeof val?.toMillis === "function") return val.toMillis();
  if (typeof val?.seconds === "number")
    return val.seconds * 1000 + Math.floor((val.nanoseconds ?? 0) / 1e6);
  return undefined;
};

/* ---------------- HOOK ---------------- */

export const useScoreboard = () => {
  const { userId } = useContext(GlobalContext);
  const isConnectedNET = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreboardData, setScoreboardData] =
    useState<Record<string, ScoreboardItem>>({});

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const fetchingRef = useRef(false);
  const finishedRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | undefined>();

  /* ---------------- DATA PARSER ---------------- */

  const parseDoc = (data: DocumentData): ScoreboardItem => ({
    sub: data.sub ?? "",
    user: data.user ?? "",
    email: data.email ?? "",
    userPhotoUrl: data.userPhotoUrl ?? "",
    currentCorrectScore: Number(data.currentCorrectScore ?? 0),
    totalScore: Number(data.totalScore ?? 0),
    totalWrongScore: Number(data.totalWrongScore ?? 0),
    estimatedTotalScore: Number(data.estimatedTotalScore ?? 0),
    likes: data.likes ?? 0,
    dislikes: data.dislikes ?? 0,
    hearts: data.hearts ?? 0,
    status: data.status ?? "unknown",
    timestamp: normalizeTime(data.timestamp),
    createdAt: normalizeTime(data.createdAt),
  });

  /* ---------------- CACHE ---------------- */

  const saveCache = async (data: Record<string, ScoreboardItem>) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("saveCache failed:", e);
    }
  };

  const loadCache = async (): Promise<Record<string, ScoreboardItem> | null> => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn("loadCache failed:", e);
      return null;
    }
  };

  /* ---------------- REALTIME LISTENER ---------------- */

  const startRealtimeListener = useCallback(() => {
    if (unsubscribeRef.current) return;

    // ✅ order by `timestamp` — the field quiz.tsx actually writes
    const q = query(
      collection(db, "SCOREBOARD_V5"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const updates: Record<string, ScoreboardItem> = {};

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added" && change.type !== "modified") return;
          const payload = parseDoc(change.doc.data());
          if (!payload.sub) return;
          updates[payload.sub] = payload;
        });

        if (!Object.keys(updates).length) return;

        setScoreboardData((prev) => {
          const merged = { ...prev, ...updates };
          saveCache(merged);
          return merged;
        });
      },
      (err) => {
        console.error("Realtime listener error:", err);
      }
    );
  }, []);

  /* ---------------- PAGINATION ---------------- */

  const fetchNextPage = useCallback(
    async (firstLoad = false) => {
      if (!isConnectedNET) return;
      if (fetchingRef.current) return;
      if (finishedRef.current && !firstLoad) return;

      try {
        fetchingRef.current = true;

        // ✅ order by `timestamp` — matches what quiz.tsx writes (Date.now())
        const q = lastDocRef.current
          ? query(
            collection(db, "SCOREBOARD_V5"),
            orderBy("timestamp", "desc"),
            startAfter(lastDocRef.current),
            limit(PAGE_SIZE)
          )
          : query(
            collection(db, "SCOREBOARD_V5"),
            orderBy("timestamp", "desc"),
            limit(PAGE_SIZE)
          );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          finishedRef.current = true;
          startRealtimeListener();
          return;
        }

        const batch: Record<string, ScoreboardItem> = {};

        snapshot.forEach((doc) => {
          const payload = parseDoc(doc.data());
          if (!payload.sub) return;
          batch[payload.sub] = payload;
        });

        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];

        setScoreboardData((prev) => {
          const merged = { ...prev, ...batch };
          saveCache(merged);
          return merged;
        });

        if (snapshot.size < PAGE_SIZE) {
          finishedRef.current = true;
          startRealtimeListener();
        }
      } catch (e: any) {
        console.error("fetchNextPage error:", e);
        setError(e?.message ?? "Pagination error");
      } finally {
        fetchingRef.current = false;
      }
    },
    [isConnectedNET, startRealtimeListener]
  );

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      try {
        setLoading(true);

        const cached = await loadCache();
        if (cached) {
          setScoreboardData(cached);
        }

        if (!isConnectedNET) return;

        lastDocRef.current = null;
        fetchingRef.current = false;
        finishedRef.current = false;

        await fetchNextPage(true);
      } catch (e: any) {
        console.error("init error:", e);
        setError(e?.message);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
    };
  }, [userId, isConnectedNET]);

  /* ---------------- RETURN ---------------- */

  return {
    scoreboardData,
    setScoreboardData,
    fetchNextPage,
    loading,
    error,
  };
};
