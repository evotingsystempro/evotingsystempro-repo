import { useContext, useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  getDoc,
  doc,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserStorageKeys } from "./storageKeys";
import { GlobalContext } from "@/context";

/* ------------------------------------------------------------
 🧩 TYPE DEFINITIONS
------------------------------------------------------------ */
export type SmartScoreItem = {
  id: string;
  sub?: string;
  user: string;
  totalScore: string;
  email?: string;
  contact?: string;
  userPhotoUrl?: string;
  image?: string | null;
  imageCaption?: string;
  status?: "sending" | "sent" | "offline";
  timestamp?: number;
  serverTime?: number;
  likes?: number;
  dislikes?: number;
  hearts?: number;
  likesPressed?: boolean;
  dislikesPressed?: boolean;
  heartsPressed?: boolean;
};

/* ------------------------------------------------------------
 🔥 HOOK: useSmartScoreboard
------------------------------------------------------------ */
export function useSmartScoreboard() {
  const [scoreboard, setScoreboard] = useState<SmartScoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const { userId } = useContext(GlobalContext);

  useEffect(() => {
    if (!userId) {
      setScoreboard([]);
      setLastDoc(null);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let isMounted = true;

    const SCOREBOARD_CACHE_KEY =
      UserStorageKeys.smartlearners_scoreboard_cache(userId);
    const LAST_DOC_KEY =
      UserStorageKeys.smartlearners_last_doc(userId);

    const COLLECTION_NAME = "SCOREBOARD_V4";

    const fetchData = async () => {
      try {
        /* Load cached scoreboard */
        const cached = await AsyncStorage.getItem(SCOREBOARD_CACHE_KEY);
        if (cached && isMounted) {
          setScoreboard(JSON.parse(cached));
        }

        /* Restore pagination cursor */
        const cachedLastId = await AsyncStorage.getItem(LAST_DOC_KEY);
        let restoredLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

        if (cachedLastId) {
          const snap = await getDoc(doc(db, COLLECTION_NAME, cachedLastId));
          if (snap.exists()) {
            restoredLastDoc = snap as QueryDocumentSnapshot<DocumentData>;
            setLastDoc(restoredLastDoc);
          }
        }

        /* Firestore live subscription */
        const colRef = collection(db, COLLECTION_NAME);
        const q = restoredLastDoc
          ? query(
            colRef,
            orderBy("serverTime", "desc"),
            startAfter(restoredLastDoc),
            limit(50)
          )
          : query(colRef, orderBy("serverTime", "desc"), limit(50));

        unsubscribe = onSnapshot(q, async (snap) => {
          if (!isMounted || snap.empty) return;

          const freshScores = snap.docs.map(
            (d) =>
            ({
              id: d.id,
              ...d.data(),
            } as SmartScoreItem)
          );

          setScoreboard((prev) => {
            const map = new Map<string, SmartScoreItem>();
            [...prev, ...freshScores].forEach((item) =>
              map.set(item.id, item)
            );

            return Array.from(map.values()).sort(
              (a, b) => Number(b.totalScore) - Number(a.totalScore)
            );
          });

          /* Persist cache */
          await AsyncStorage.setItem(
            SCOREBOARD_CACHE_KEY,
            JSON.stringify(freshScores)
          );

          /* Save pagination cursor */
          const lastVisible = snap.docs[snap.docs.length - 1];
          if (lastVisible) {
            setLastDoc(lastVisible);
            await AsyncStorage.setItem(LAST_DOC_KEY, lastVisible.id);
          }

          setLoading(false);
        });
      } catch (error) {
        console.error("[useSmartScoreboard] Error:", error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [userId]); // critical dependency

  return { scoreboard, loading };
}
