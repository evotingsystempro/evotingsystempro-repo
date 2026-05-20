// quiz.tsx
import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { GlobalContext } from "@/context";
import { Ionicons } from "@expo/vector-icons";
import ReusableScreen from "@/components/ReusableScreen";
import BottomNavQuiz from "@/components/BottomNavQuiz";
//import { General_questions_on_computing } from "@/DATASET/General_questions_on_computing";
import { General_questions_on_football } from "@/DATASET/General_questions_on_football";
import { General_questions_on_science } from "@/DATASET/General_questions_on_science";
import { General_questions_on_mathematics } from "@/DATASET/General_questions_on_mathematics";
import { General_questions_on_general_knowledge } from "@/DATASET/General_questions_on_general_knowledge";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  getDocs,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
} from "firebase/firestore";
import { useScoreboard } from "@/hooks/ScoreboardScreenHooks/useScoreboard";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { db } from "@/firebase";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PupupMenuForScoreReset from "@/components/PupupMenuForScoreReset";
import { MenuProvider } from "react-native-popup-menu";
import AppAlert from "@/components/Alert_for_score_rest";
import { General_questions_on_english } from "@/DATASET/General_questions_on_english";
import { General_questions_on_computing } from "@/DATASET/General_questions_on_computing";
import ChatBanner from "@/components/ChatBanner";

/* ── Gemini setup ───────────────────────────────────────── */
const API_KEY = "";

const genAI = new GoogleGenerativeAI(API_KEY);
const chatModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

/* ── Constants ──────────────────────────────────────────── */
/* const WALLET_DB = "WALLET_DB";
const TRANSACTION_WALLET_DB = "TRANSACTION_WALLET_DB"; */

const WALLET_DB = "WALLET_DB";
const SCOREBOARD_DB = "SCOREBOARD_V5"; // add this
const TRANSACTION_WALLET_DB = "TRANSACTION_WALLET_DB";

const Quiz_reward_amount = 50; // GHS value awarded on a perfect win
const TIME_PENALTY_THRESHOLD = 30;

/* ── Unified dataset map ────────────────────────────────── */
type GenericTopics = Record<string, string[]>;
const DATASET_MAP: Record<string, GenericTopics> = {
  computing: General_questions_on_computing.topics as GenericTopics,
  football: General_questions_on_football.topics as GenericTopics,
  science: General_questions_on_science.topics as GenericTopics,
  mathematics: General_questions_on_mathematics.topics as GenericTopics,
  general_knowledge: General_questions_on_general_knowledge.topics as GenericTopics,
  english: General_questions_on_english.topics as GenericTopics, // ← add this
};

/* ── Storage keys ───────────────────────────────────────── */
const PICK_TOPIC_STORAGE_KEY = "pickTopic_persistedSelection";
const TOPIC_PLAY_COUNTS_KEY = "topicPlayCounts";
const QUIZ_PARAMS_STORAGE_KEY = "quizParams_persisted";

type PersistedQuizParams = {
  topic: string;
  dataset: string;
  topic_category: string;
};

const readPersistedQuizParams = async (): Promise<PersistedQuizParams | null> => {
  try {
    const raw = await AsyncStorage.getItem(QUIZ_PARAMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writePersistedQuizParams = async (params: PersistedQuizParams): Promise<void> => {
  try {
    await AsyncStorage.setItem(QUIZ_PARAMS_STORAGE_KEY, JSON.stringify(params));
  } catch (err) {
    console.warn("writePersistedQuizParams failed:", err);
  }
};

const getTopicPlayLimit = (category: string): number => {
  const limited = ["Africa", "Asia", "Europe", "America"];
  const limitedMaths = [
    "Numbers & Algebra",
    "Geometry & Measure",
    "Statistics & Probability",
    "Calculus",
    "Financial Mathematics",
  ];
  return limited.includes(category) ? 10 : limitedMaths.includes(category) ? 5 : 2;
};

/* ── Topic play count helpers ───────────────────────────── */
const buildTopicCountKey = (email: string, topicName: string): string =>
  `${email}::${topicName}`;

const readTopicPlayCounts = async (): Promise<Record<string, number>> => {
  try {
    const raw = await AsyncStorage.getItem(TOPIC_PLAY_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getTopicPlayCount = async (email: string, topicName: string): Promise<number> => {
  const counts = await readTopicPlayCounts();
  return counts[buildTopicCountKey(email, topicName)] ?? 0;
};

const incrementTopicPlayCount = async (
  email: string,
  topicName: string
): Promise<number> => {
  const counts = await readTopicPlayCounts();
  const key = buildTopicCountKey(email, topicName);
  const newCount = (counts[key] ?? 0) + 1;
  counts[key] = newCount;
  await AsyncStorage.setItem(TOPIC_PLAY_COUNTS_KEY, JSON.stringify(counts));
  syncTopicPlayCountToFirebase(email, topicName, newCount).catch((err) =>
    console.warn("Background Firebase sync failed:", err)
  );
  return newCount;
};

const syncTopicPlayCountToFirebase = async (
  email: string,
  topicName: string,
  count: number
): Promise<void> => {
  const ref = doc(db, "TOPIC_PLAY_COUNTS", email);
  await setDoc(ref, { [topicName]: count }, { merge: true });
};

/* ── Helpers ────────────────────────────────────────────── */
const generateRef = (prefix = "TXN"): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `${prefix}_${rand}`;
};

const formatGHS = (val: number) =>
  val.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const awardWinReward = async (userId: string): Promise<void> => {
  try {
    // ✅ Use doc() directly — document ID is the email
    const walletRef = doc(db, WALLET_DB, userId);
    const walletSnap = await getDoc(walletRef);

    const Previous_balance: number = walletSnap.exists()
      ? (Number(walletSnap.data().current_balance) || 0)
      : 0;

    const Current_balance = Previous_balance + Quiz_reward_amount;
    const txRef = generateRef(userId.slice(0, 6).toUpperCase());

    // In awardWinReward(), just rename "status" → "transaction_status":

    await addDoc(collection(db, TRANSACTION_WALLET_DB), {
      transaction_id: txRef,
      userId: userId,
      email: userId,
      transaction_type: "credit_quiz_reward",        // ✅ keep as-is
      transaction_amount: Quiz_reward_amount,
      previous_balance: Previous_balance,
      current_balance: Current_balance,
      currency: "GHS",
      payment_method: "system transfer",
      transaction_status: "completed", // ← was "status" (wrong key, fix this)
      note: `Quiz win reward: +GHS ${formatGHS(Quiz_reward_amount)}`,
      external_transaction_id: "none",
      createdAt: serverTimestamp(),
    });

    // ✅ Update the existing document directly
    await setDoc(walletRef, { current_balance: Current_balance }, { merge: true });

    console.log(
      `>>> Win reward: +GHS ${Quiz_reward_amount} | ` +
      `Previous: GHS ${Previous_balance} → Current: GHS ${Current_balance} ` +
      `for ${userId}`
    );
  } catch (err) {
    console.warn("awardWinReward failed:", err);
  }
};

/* ── Question type ──────────────────────────────────────── */
type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  answer: string;
  generatedFromTopic: string;
};

/* ── Gemini question fetcher ────────────────────────────── */
const fetchQuestionsFromGemini = async (
  randomTopic: string,
  questionCount: number
): Promise<QuizQuestion[]> => {
  const prompt = `
You are an expert quiz designer. Your only job is to generate well-crafted multiple choice questions.

TASK:
Generate exactly ${questionCount} multiple choice questions on the topic: "${randomTopic}".

DIFFICULTY:
- If the topic: "${randomTopic}" is mathematics related: Then the questions should be extremly simple for young learners (ages 14–18).
- If the topic: "${randomTopic}" is english related: Then the questions should be extremly simple for young learners (ages 18–24).
- All other topics: make questions challenging — test deeper understanding, not surface recall.

QUESTION RULES:
- Each question must be distinct — no repeated concepts or rephrased duplicates.
- Questions must be clear, unambiguous, and self-contained.
- Each question must have exactly 4 answer options.
- Exactly one option must be correct; the other three must be plausible but clearly wrong and must not be more than 15 words.
- Do not include hints or clues in the question text that give away the answer.
- Use a variety of question formats (e.g., direct questions, "which of the following", "true/false with explanation", etc.) to keep it engaging.

OUTPUT FORMAT:
- Return ONLY a raw JSON array. No markdown, no explanation, no extra text.
- The answer field must be an exact copy of the correct option string.

[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Exact correct option"
  }
]
`;

  const result = await chatModel.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/gi, "").replace(/\n/g, " ").trim();
  let parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) throw new Error("Invalid format from Gemini AI");
  if (parsed.length > questionCount) parsed = parsed.slice(0, questionCount);

  const shuffleArray = (arr: any[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  return parsed.map((q: any, index: number) => {
    const shuffledOptions = shuffleArray(q.options || []);
    return {
      id: index + 1,
      question: q.question,
      options: shuffledOptions,
      answer: shuffledOptions.find((opt: string) => opt === q.answer) ?? q.answer,
      generatedFromTopic: randomTopic,
    };
  });
};

/* ── Main question generator ────────────────────────────── */
const generateGeminiQuestions = async (
  userId: string,
  dataset: string,
  topicName: string,
  questionCount: number = 5
): Promise<QuizQuestion[]> => {
  const parts = dataset.split("__");
  const subjectKey = parts[0];
  const categoryKey = parts[1];

  const subjectTopics = DATASET_MAP[subjectKey];
  if (!subjectTopics) throw new Error(`Unknown subject dataset: "${subjectKey}"`);

  let topicsArray: string[];
  if (categoryKey && subjectTopics[categoryKey]) {
    topicsArray = subjectTopics[categoryKey];
  } else {
    topicsArray = Object.values(subjectTopics).flat();
  }

  if (!topicsArray || topicsArray.length === 0)
    throw new Error(`No topics found for dataset: "${dataset}"`);

  const randomTopic = topicsArray[Math.floor(Math.random() * topicsArray.length)];

  console.log(`[Quiz] Calling Gemini for topic: "${randomTopic}"`);

  try {
    const questions = await fetchQuestionsFromGemini(randomTopic, questionCount);
    return questions.map((q, idx) => ({ ...q, id: idx + 1 }));
  } catch (error) {
    console.error("❌ Gemini fetch failed:", error);
    throw new Error("Failed to generate quiz questions. Please try again.");
  }
};

/* ════════════════════════════════════════════════════════ */
export default function QuizScreen() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const {
    addAttempt,
    setDetectChangeInQuizResult,
    userId,
    scoresCleared,
    setScoresCleared,
    estimatedTotalTOT,
    currentScore,
    correctScoreTOT,
    wrongCountTOT,
    setEstimatedTotalTOT,
    setCurrentScore,
    setCorrectScoreTOT,
    setWrongCountTOT,
    userName,
    userPhotoUrl,
    taskStartingTime,
    walletFieldsContext,
    setTaskStartingTime,
  } = useContext(GlobalContext);

  useFocusEffect(
    useCallback(() => {
      if (!userName) router.replace("/");
    }, [userName])
  );

  const {
    email,
    free_reset_credit,
    pay_as_you_go_credits,
    pay_as_you_go,
    monthly_subscription_plan: {
      expires_at,
      is_active,
      is_suspended,
      last_purchased_at,
      started_at,
      suspension_started_at,
      total_purchases,
    } = {
      expires_at: null,
      is_active: false,
      is_suspended: false,
      last_purchased_at: null,
      started_at: null,
      suspension_started_at: null,
      total_purchases: 0,
    },
    plan_id,
    transaction_type,
    previous_balance,
    current_balance,
    transaction_amount,
    currency,
    payment_method,
    createdAt,
  } = walletFieldsContext ?? {};

  /* ── Resolved topic, dataset & category ──────────────── */
  const [resolvedTopic, setResolvedTopic] = useState<string>("");
  const [resolvedDataset, setResolvedDataset] = useState<string>("");
  const [resolvedCategory, setResolvedCategory] = useState<string>("");
  const [topicHydrated, setTopicHydrated] = useState(false);

  const TOPIC_PLAY_LIMIT = getTopicPlayLimit(resolvedCategory);

  /* ── Topic play-count state ── */
  const [topicPlayCount, setTopicPlayCount] = useState<number>(0);
  const [topicLimitReached, setTopicLimitReached] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState(false);

  /* ── Win state ── */
  const [lastRoundWon, setLastRoundWon] = useState<boolean>(false);

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [maxReached, setMaxReached] = useState(0);
  const [saveScore, setSaveScore] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tapDisabled, setTapDisabled] = useState(false);
  const [refreshHandle, setRefreshHandle] = useState(Date.now());
  const [geminiError, setGeminiError] = useState("");
  const [liveTotalWrongScore, setLiveTotalWrongScore] = useState<number>(0);
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);

  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef({ inProgress: false, completed: false });

  const isConnectedNET = useNetworkStatus();
  const optionLabels = ["A.", "B.", "C.", "D."];
  const { scoreboardData, setScoreboardData } = useScoreboard();

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    buttons?: { label: string; onPress: () => void; style?: "default" | "cancel" | "destructive" }[];
  }>({ visible: false, title: "", message: "" });

  const showAlert = (
    type: "info" | "success" | "warning" | "error",
    title: string,
    message: string,
    buttons?: { label: string; onPress: () => void; style?: "default" | "cancel" | "destructive" }[]
  ) => setAlertConfig({ visible: true, type, title, message, buttons });

  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

  const liveValuesRef = useRef({
    userId,
    isConnectedNET,
    taskStartingTime,
    scoreboardData,
    userName,
    userPhotoUrl,
  });

  useEffect(() => {
    liveValuesRef.current = {
      userId,
      isConnectedNET,
      taskStartingTime,
      scoreboardData,
      userName,
      userPhotoUrl,
    };
  });

  /* ── Hydrate topic, dataset & category ─────────────────── */
  useEffect(() => {
    (async () => {
      const paramTopic =
        typeof params.topic === "string" ? params.topic.trim() : "";
      const paramDataset =
        typeof params.dataset === "string" ? params.dataset.trim() : "";
      const paramCategory =
        typeof params.topic_category === "string"
          ? params.topic_category.trim()
          : "";

      if (paramTopic && paramDataset) {
        setResolvedTopic(paramTopic);
        setResolvedDataset(paramDataset);
        setResolvedCategory(paramCategory);
        await writePersistedQuizParams({
          topic: paramTopic,
          dataset: paramDataset,
          topic_category: paramCategory,
        });
      } else {
        const persisted = await readPersistedQuizParams();
        if (persisted?.topic && persisted?.dataset) {
          setResolvedTopic(persisted.topic);
          setResolvedDataset(persisted.dataset);
          setResolvedCategory(persisted.topic_category ?? "");
        } else {
          try {
            const raw = await AsyncStorage.getItem(PICK_TOPIC_STORAGE_KEY);
            if (raw) {
              const saved = JSON.parse(raw);
              if (saved?.selected?.title) setResolvedTopic(saved.selected.title);
              if (saved?.selected?.dataset)
                setResolvedDataset(saved.selected.dataset);
            }
          } catch (_) {
            /* silently ignore */
          }
        }
      }
      setTopicHydrated(true);
    })();
  }, [params.topic, params.dataset, params.topic_category]);

  /* ── Sync topicPlayCount ── */
  useEffect(() => {
    if (!resolvedTopic || !userId) return;
    (async () => {
      const count = await getTopicPlayCount(userId, resolvedTopic);
      setTopicPlayCount(count);
      setTopicLimitReached(count >= TOPIC_PLAY_LIMIT);
    })();
  }, [resolvedTopic, userId, TOPIC_PLAY_LIMIT]);

  useEffect(() => {
    if (!userId) return;
    const myData = scoreboardData?.[userId];
    const parsed = Number(myData?.totalWrongScore ?? 0);
    setLiveTotalWrongScore(isNaN(parsed) ? 0 : parsed);
  }, [scoreboardData, userId]);

  const canStartGame = liveTotalWrongScore === 0;

  /* ── Timer ── */
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (taskStartingTime) {
      setElapsedSecs(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSecs(
          parseFloat(((Date.now() - taskStartingTime) / 1000).toFixed(1))
        );
      }, 1000);
    } else {
      setElapsedSecs(0);
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [taskStartingTime]);

  /* ── Network loss guard ── */
  useEffect(() => {
    if (
      !isConnectedNET &&
      gameStateRef.current.inProgress &&
      !gameStateRef.current.completed &&
      questions.length > 0
    ) {
      gameStateRef.current.inProgress = false;
      gameStateRef.current.completed = false;
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = null;
      }
      setQuestions([]);
      setCurrentQ(0);
      setAnswers([]);
      setMaxReached(0);
      setShowReview(false);
      setSaveScore("");
      setTapDisabled(false);
      setTaskStartingTime(null);
      setGeminiError("Connection lost. Please reconnect and try again.");
    }
  }, [isConnectedNET, questions.length]);

  /* ── Early exit penalty on screen blur ── */
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (gameStateRef.current.inProgress && !gameStateRef.current.completed) {
          gameStateRef.current.inProgress = false;
          if (liveValuesRef.current.isConnectedNET)
            uploadEarlyExitPenaltyFun();
        }
      };
    }, [])
  );

  /* ── Score init ── */
  useEffect(() => {
    const initializeScores = async () => {
      try {
        if (scoresCleared) {
          setScoresCleared(false);
          setCurrentScore(0);
          setEstimatedTotalTOT(0);
          setCorrectScoreTOT(0);
          setWrongCountTOT(0);
          await AsyncStorage.multiSet([
            ["currentScore", JSON.stringify(0)],
            ["estimatedTotalTOT", JSON.stringify(0)],
            ["correctScoreTOT", JSON.stringify(0)],
            ["wrongCountTOT", JSON.stringify(0)],
          ]);
        }
        await loadInitial();
      } catch (error) {
        console.warn("Score initialization failed:", error);
      }
    };
    initializeScores();
  }, [
    refreshHandle,
    estimatedTotalTOT,
    currentScore,
    correctScoreTOT,
    wrongCountTOT,
  ]);

  const loadInitial = async () => {
    try {
      const values = await AsyncStorage.multiGet([
        "currentScore",
        "correctScoreTOT",
        "estimatedTotalTOT",
        "wrongCountTOT",
      ]);
      const data = Object.fromEntries(values);
      if (data.currentScore) setCurrentScore(JSON.parse(data.currentScore));
      if (data.correctScoreTOT)
        setCorrectScoreTOT(JSON.parse(data.correctScoreTOT));
      if (data.estimatedTotalTOT)
        setEstimatedTotalTOT(JSON.parse(data.estimatedTotalTOT));
      if (data.wrongCountTOT) setWrongCountTOT(JSON.parse(data.wrongCountTOT));
    } catch (error) {
      console.warn("Failed to load scores:", error);
    }
  };

  /* ── Start Game ── */
  const startGame = async () => {
    if (!isConnectedNET || !canStartGame) return;
    if (questions.length > 0 && !showReview) return;

    const latestCount = await getTopicPlayCount(userId, resolvedTopic);
    if (latestCount >= TOPIC_PLAY_LIMIT) {
      setTopicPlayCount(latestCount);
      setTopicLimitReached(true);
      return;
    }

    setGeminiError("");
    setLastRoundWon(false);
    gameStateRef.current.inProgress = false;
    gameStateRef.current.completed = false;
    setLoading(true);
    setQuestions([]);
    setCurrentQ(0);
    setAnswers([]);
    setMaxReached(0);
    setShowReview(false);
    setSaveScore("");

    const activeDataset = resolvedDataset || "computing__ComponentsOfComputers";

    try {
      const aiQuestions = await generateGeminiQuestions(
        userId,
        activeDataset,
        resolvedTopic
      );
      const newCount = await incrementTopicPlayCount(userId, resolvedTopic);
      setTopicPlayCount(newCount);
      setTopicLimitReached(newCount >= TOPIC_PLAY_LIMIT);
      gameStateRef.current.inProgress = true;
      setQuestions(aiQuestions);
      setTaskStartingTime(Date.now());
    } catch (error) {
      console.warn("Gemini failed:", error);
      gameStateRef.current.inProgress = false;
      gameStateRef.current.completed = false;
      setTaskStartingTime(null);
      setGeminiError(
        "Failed to generate questions. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Upload Score ── */
  const uploadScoresFun = async (
    freshEstimatedTotal: number,
    freshWrongCount: number,
    freshCorrectScore: number,
    totalQuestions: number
  ) => {
    const {
      taskStartingTime: liveStartTime,
      userId: liveUserId,
      isConnectedNET: liveNet,
      scoreboardData: liveBoard,
      userName: liveUserName,
      userPhotoUrl: livePhoto,
    } = liveValuesRef.current;

    const taskCompletionTime = Date.now();
    const timeUsedInPerformingTask = parseFloat(
      (
        (taskCompletionTime - (liveStartTime ?? taskCompletionTime)) /
        1000
      ).toFixed(1)
    );

    setTaskStartingTime(null);
    if (!liveUserId || !liveNet) return;

    const safeNum = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };
    const estimated = safeNum(freshEstimatedTotal);
    const wrong = safeNum(freshWrongCount);
    if (estimated <= 0) return;

    try {
      const ref = doc(db, SCOREBOARD_DB, liveUserId);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? snap.data() : {};

      const wrongAdded =
        timeUsedInPerformingTask > TIME_PENALTY_THRESHOLD ? 1 : 0;
      const totalWrongRes =
        safeNum(prev.totalWrongScore) + wrong + wrongAdded;
      const estimatedTotalRes =
        safeNum(prev.estimatedTotalScore) + estimated;

      const playerWon =
        freshCorrectScore === totalQuestions &&
        wrong === 0 &&
        wrongAdded === 0;

      if (playerWon) {
        setLastRoundWon(true);
        awardWinReward(liveUserId).catch((err) =>
          console.warn("Win reward background task failed:", err)
        );
      } else {
        setLastRoundWon(false);
      }

      const payload = {
        sub: liveUserId,
        user: liveUserName || "Unknown",
        email: liveUserId,
        userPhotoUrl: livePhoto,
        currentCorrectScore: String(freshCorrectScore),
        totalScore: String(timeUsedInPerformingTask),
        totalWrongScore: String(totalWrongRes),
        estimatedTotalScore: String(estimatedTotalRes),
        likes: liveBoard[liveUserId]?.likes ?? 0,
        dislikes: liveBoard[liveUserId]?.dislikes ?? 0,
        hearts: liveBoard[liveUserId]?.hearts ?? 0,
        status: "online",
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      };

      setScoreboardData((prevState: any) => ({
        ...prevState,
        [liveUserId]: {
          ...(prevState[liveUserId] ?? {}),
          ...payload,
          timestamp: Date.now(),
        },
      }));

      await setDoc(ref, payload, { merge: true });
      await AsyncStorage.multiRemove([
        "currentScore",
        "estimatedTotalTOT",
        "correctScoreTOT",
        "wrongCountTOT",
      ]);
      setCurrentScore(0);
      setEstimatedTotalTOT(0);
      setCorrectScoreTOT(0);
      setWrongCountTOT(0);
      setScoresCleared(true);
      console.log(">>> Score uploaded successfully");
    } catch (error) {
      console.warn("Failed to upload score:", error);
    }
  };

  /* ── Upload Early-Exit Penalty ── */
  const uploadEarlyExitPenaltyFun = async () => {
    const {
      userId: liveUserId,
      isConnectedNET: liveNet,
      taskStartingTime: liveStartTime,
      scoreboardData: liveBoard,
      userName: liveUserName,
      userPhotoUrl: livePhoto,
    } = liveValuesRef.current;

    if (!liveUserId || !liveNet) return;

    const taskCompletionTime = Date.now();
    const timeUsedInPerformingTask = parseFloat(
      (
        (taskCompletionTime - (liveStartTime ?? taskCompletionTime)) /
        1000
      ).toFixed(1)
    );

    try {
      const ref = doc(db, SCOREBOARD_DB, liveUserId);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? snap.data() : {};
      const safeNum = (v: any) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };
      const totalWrongRes = safeNum(prev.totalWrongScore) + 1;

      const payload = {
        sub: liveUserId,
        user: liveUserName || "Unknown",
        email: liveUserId,
        userPhotoUrl: livePhoto,
        currentCorrectScore: String(0),
        totalScore: String(timeUsedInPerformingTask),
        totalWrongScore: String(totalWrongRes),
        estimatedTotalScore: String(prev.estimatedTotalScore ?? 0),
        likes: liveBoard[liveUserId]?.likes ?? 0,
        dislikes: liveBoard[liveUserId]?.dislikes ?? 0,
        hearts: liveBoard[liveUserId]?.hearts ?? 0,
        status: "online",
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      };

      setScoreboardData((prevState: any) => ({
        ...prevState,
        [liveUserId]: {
          ...(prevState[liveUserId] ?? {}),
          ...payload,
          timestamp: Date.now(),
        },
      }));

      await setDoc(ref, payload, { merge: true });
      await AsyncStorage.multiRemove([
        "currentScore",
        "estimatedTotalTOT",
        "correctScoreTOT",
        "wrongCountTOT",
      ]);
      setCurrentScore(0);
      setEstimatedTotalTOT(0);
      setCorrectScoreTOT(0);
      setWrongCountTOT(0);
      setScoresCleared(true);
      setTaskStartingTime(null);
      console.log(">>> Early exit penalty uploaded");
    } catch (error) {
      console.warn("Failed to upload early exit penalty:", error);
    }
  };

  /* ── Answer Handler ── */
  const handleAnswer = (option: string, label: string) => {
    if (!isConnectedNET) return;
    if (!questions[currentQ] || moveTimeoutRef.current || tapDisabled) return;

    setTapDisabled(true);

    const isCorrect = option === questions[currentQ].answer;
    const updatedAnswers = [...answers];
    const existingIndex = updatedAnswers.findIndex((a) => a.qIndex === currentQ);
    const answerEntry = {
      qIndex: currentQ,
      answer: option,
      correct: questions[currentQ].answer,
      isCorrect,
      label,
    };

    if (existingIndex !== -1) updatedAnswers[existingIndex] = answerEntry;
    else updatedAnswers.push(answerEntry);

    setAnswers(updatedAnswers);

    const isLastQuestion = currentQ + 1 >= questions.length;
    if (isLastQuestion) {
      gameStateRef.current.inProgress = false;
      gameStateRef.current.completed = true;
    }

    moveTimeoutRef.current = setTimeout(async () => {
      clearTimeout(moveTimeoutRef.current!);
      moveTimeoutRef.current = null;
      setTapDisabled(false);

      if (!questions[currentQ]) return;

      if (!isLastQuestion) {
        setCurrentQ((prev) => prev + 1);
        setMaxReached((prev) => Math.max(prev, currentQ + 1));
      } else {
        const currentCorrectScore = updatedAnswers.filter(
          (a) => a.isCorrect
        ).length;
        const wrongCount = questions.length - currentCorrectScore;

        addAttempt(currentCorrectScore, questions.length);
        setShowReview(true);
        setSaveScore(`${currentCorrectScore}`);
        setDetectChangeInQuizResult(true);

        const freshEstimatedTotal =
          currentCorrectScore + (Number(estimatedTotalTOT) ?? 0);
        const freshWrongCount = wrongCount + (Number(wrongCountTOT) ?? 0);

        try {
          await AsyncStorage.multiSet([
            ["currentScore", JSON.stringify(currentCorrectScore)],
            ["estimatedTotalTOT", JSON.stringify(freshEstimatedTotal)],
            ["correctScoreTOT", JSON.stringify(freshEstimatedTotal)],
            ["wrongCountTOT", JSON.stringify(freshWrongCount)],
          ]);
          setRefreshHandle(Date.now());
          await uploadScoresFun(
            freshEstimatedTotal,
            freshWrongCount,
            currentCorrectScore,
            questions.length
          );
        } catch (err) {
          console.warn("Failed to save/upload score:", err);
        }
      }
    }, 800);
  };

  const PupupMenuBuyResetCreditFun = (email: string) => {
    if (!email) {
      alert("Unable to open purchase screen. Email not found.");
      return;
    }
    router.navigate({
      pathname: "/chat/buy_reset_credit_screen",
      params: { email },
    });
  };

  // const userData = scoreboardData?.[userId] ?? {};

  const monthlyPlan = walletFieldsContext?.monthly_subscription_plan?.total_purchases ?? 0;
  const PupupMenuForScoreResetFun = async (
    credit_type: "free_reset_credit" | "pay_as_you_go" | "monthly_subscription_plan",
    email: string
  ) => {
    if (!email) {
      showAlert("warning", "Not Ready", "User data not loaded yet. Please try again.");
      return;
    }
    if (!isConnectedNET) {
      showAlert("warning", "You're Offline", "An internet connection is required to reset your score.");
      return;
    }

    // ── Show "Resetting…" immediately ──────────────────────────
    setIsResetting(true);
    showAlert("info", "Resetting…", "Please wait while your score is being reset.");

    try {
      const scoreRef = doc(db, "SCOREBOARD_V5", email);
      const walletRef = doc(db, "WALLET_DB", email);

      const [scoreSnap, walletSnap] = await Promise.all([
        getDoc(scoreRef),
        getDoc(walletRef),
      ]);

      if (!scoreSnap.exists() || !walletSnap.exists()) {
        showAlert("error", "User Not Found", "We couldn't find your data. Please try again.");
        return;
      }

      const scoreData = scoreSnap.data();
      const walletData = walletSnap.data();

      const alreadyClean = Number(scoreData.totalWrongScore ?? 0) === 0;
      if (alreadyClean) {
        showAlert("success", "All Good!", "Your score is already clean — no reset needed. Keep going!");
        return;
      }

      let currentCredit = 0;

      if (credit_type === "free_reset_credit") {
        currentCredit = Number(walletData.free_reset_credit ?? 0);
      } else if (credit_type === "pay_as_you_go") {
        currentCredit = Number(walletData.pay_as_you_go_credits ?? 0);
      } else if (credit_type === "monthly_subscription_plan") {
        const plan = walletData.monthly_subscription_plan ?? {};
        const isActive = plan.is_active === true;
        const isSuspended = plan.is_suspended === true;
        const expiresAt = plan.expires_at ?? null;
        const isValid = isActive && !isSuspended && expiresAt !== null && Date.now() < expiresAt;

        if (!isValid) {
          showAlert(
            "error",
            "Subscription Inactive",
            "Your monthly plan is inactive or expired. Please renew to continue.",
            [
              { label: "Buy Plan", onPress: () => { hideAlert(); PupupMenuBuyResetCreditFun(email); }, style: "default" },
              { label: "Cancel", onPress: hideAlert, style: "cancel" },
            ]
          );
          return;
        }
        currentCredit = 1;
      }

      if (currentCredit <= 0) {
        showAlert(
          "warning",
          "Insufficient Credits",
          "You don't have enough credits to reset your score. Please purchase more.",
          [
            { label: "Buy Credits", onPress: () => { hideAlert(); PupupMenuBuyResetCreditFun(email); }, style: "default" },
            { label: "Cancel", onPress: hideAlert, style: "cancel" },
          ]
        );
        return;
      }

      if (credit_type === "free_reset_credit") {
        await updateDoc(walletRef, { free_reset_credit: currentCredit - 1 });
      } else if (credit_type === "pay_as_you_go") {
        await updateDoc(walletRef, { pay_as_you_go_credits: currentCredit - 1 });
      }

      await updateDoc(scoreRef, { totalWrongScore: "0" });

      setScoreboardData((prev: any) => ({
        ...prev,
        [email]: { ...(prev[email] ?? {}), totalWrongScore: "0" },
      }));

      if (email === userId) {
        setWrongCountTOT(0);
        await AsyncStorage.multiRemove(["wrongCountTOT"]);
        setScoresCleared(true);
      }

      // ── ✅ Only shown AFTER everything succeeds ──────────────
      showAlert("success", "Score Reset Successful!", "Your score has been successfully reset. You may continue with the task. Good luck!");
      console.log(`✅ Score reset via [${credit_type}] for ${email}`);

    } catch (error) {
      console.error("❌ Score reset failed:", error);
      showAlert(
        "error",
        "Reset Failed",
        "Something went wrong while resetting your score. Please check your connection and try again.",
        [
          { label: "Try Again", onPress: () => { hideAlert(); PupupMenuForScoreResetFun(credit_type, email); }, style: "destructive" },
          { label: "Cancel", onPress: hideAlert, style: "cancel" },
        ]
      );
    } finally {
      // ── Always clear loading state ───────────────────────────
      setIsResetting(false);
    }
  };

  const handleBackArrow = () => {
    if (currentQ > 0) setCurrentQ((prev) => prev - 1);
  };
  const handleForwardArrow = () => {
    if (currentQ < maxReached && currentQ + 1 < questions.length)
      setCurrentQ((prev) => prev + 1);
  };

  const progress = questions.length
    ? ((currentQ + 1) / questions.length) * 100
    : 0;
  const gameInProgress = questions.length > 0 && !showReview;

  const startButtonDisabled =
    !topicHydrated ||
    !isConnectedNET ||
    loading ||
    !canStartGame ||
    gameInProgress ||
    topicLimitReached;

  /* ── Render ── */
  return (
    <ReusableScreen>
      <MenuProvider>
        <View style={{ flex: 1 }}>
          <ChatBanner />

          <AppAlert
            visible={alertConfig.visible}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.message}
            buttons={alertConfig.buttons}
            onDismiss={hideAlert}
          />
          <View style={styles.screen}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() =>
                  router.navigate({ pathname: "/chat/pickTopic" })
                }
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={22} color="#333" />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.timeUsedToPerformTask,
                  {
                    color:
                      elapsedSecs > TIME_PENALTY_THRESHOLD
                        ? "#f80808ff"
                        : "#0e9e06ff",
                  },
                ]}
              >
                {taskStartingTime ? `${elapsedSecs} secs` : "0 secs"}
              </Text>

              <Text style={styles.scoreText}>
                Reward: ${Quiz_reward_amount / 10}
              </Text>
            </View>

            {/* Content */}
            {loading || questions.length === 0 ? (
              <View style={styles.centerBox}>
                {loading ? (
                  <>
                    <ActivityIndicator size="large" color="#1976d2" />
                    <Text style={styles.loadingText}>
                      Preparing task on: {resolvedTopic}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.infoText,
                        { fontSize: width < 380 ? 15 : 17 },
                      ]}
                    >
                      {!isConnectedNET
                        ? "You are offline. Connect to play."
                        : resolvedTopic
                          ? `Task: ${resolvedTopic}`
                          : "Tap Start Game to begin."}
                    </Text>

                    {resolvedTopic && !params.topic && topicHydrated && (
                      <View style={styles.persistedHint}>
                        <Ionicons
                          name="bookmark-outline"
                          size={13}
                          color="#f97316"
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.persistedHintText}>
                          Continuing your last topic.{" "}
                          <Text
                            style={{ color: "#f97316", fontWeight: "700" }}
                            onPress={() => router.replace("./pickTopic")}
                          >
                            Change?
                          </Text>
                        </Text>
                      </View>
                    )}

                    {resolvedCategory ? (
                      <View style={styles.categoryBadge}>
                        <Ionicons
                          name="pricetag-outline"
                          size={13}
                          color="#0ea5e9"
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.categoryBadgeText}>
                          Category:{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {resolvedCategory}
                          </Text>
                          {"  "}·{"  "}Limit:{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {TOPIC_PLAY_LIMIT} plays
                          </Text>
                        </Text>
                      </View>
                    ) : null}

                    {topicLimitReached && isConnectedNET && (
                      <View style={styles.topicLimitNotice}>
                        <Ionicons
                          name="ban"
                          size={18}
                          color="#7b1fa2"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.topicLimitText}>
                          Sorry, select another topic.{"\n"}
                          <Text style={{ fontWeight: "600" }}>
                            {resolvedTopic}
                          </Text>{" "}
                          has been played{" "}
                          <Text style={{ fontWeight: "800" }}>
                            {topicPlayCount}
                          </Text>{" "}
                          times (limit: {TOPIC_PLAY_LIMIT}).
                        </Text>
                      </View>
                    )}

                    {!canStartGame && isConnectedNET && (
                      <View style={styles.lockNotice}>
                        <Ionicons
                          name="lock-closed"
                          size={18}
                          color="#d32f2f"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.lockNoticeText}>
                          You have{" "}
                          <Text style={{ fontWeight: "800" }}>
                            {liveTotalWrongScore}
                          </Text>{" "}
                          wrong
                          {liveTotalWrongScore === 1
                            ? " answer"
                            : " answers"}
                          .{"\n"}Reset your score to continue ...
                        </Text>
                      </View>
                    )}

                    {geminiError ? (
                      <Text style={styles.errorText}>{geminiError}</Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                {!showReview ? (
                  <View style={styles.card}>
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${progress}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {currentQ + 1} of {questions.length}
                    </Text>

                    {!isConnectedNET && (
                      <Text style={styles.offlineBanner}>
                        ⚠️ Connection lost — game stopped.
                      </Text>
                    )}

                    <Text style={styles.question}>
                      {questions[currentQ].question}
                    </Text>

                    {questions[currentQ].options.map(
                      (option: string, i: number) => {
                        const answered =
                          answers.find((a) => a.qIndex === currentQ)
                            ?.answer === option;
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[
                              styles.option,
                              answered && {
                                backgroundColor: "#d1e7dd",
                              },
                              (tapDisabled || !isConnectedNET) && {
                                opacity: 0.4,
                              },
                            ]}
                            onPress={() =>
                              handleAnswer(option, optionLabels[i])
                            }
                            disabled={tapDisabled || !isConnectedNET}
                          >
                            <Text style={styles.optionText}>
                              {optionLabels[i]} {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}

                    <View style={styles.arrowsContainer}>
                      <TouchableOpacity
                        onPress={handleBackArrow}
                        disabled={currentQ === 0}
                      >
                        <Ionicons
                          name="arrow-back-circle"
                          size={38}
                          color={currentQ === 0 ? "#ccc" : "#f09708ff"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleForwardArrow}
                        disabled={currentQ >= maxReached}
                      >
                        <Ionicons
                          name="arrow-forward-circle"
                          size={38}
                          color={
                            currentQ >= maxReached ? "#ccc" : "#f09708ff"
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.card}>
                    {lastRoundWon && (
                      <View style={styles.winBanner}>
                        <Ionicons
                          name="trophy"
                          size={22}
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.winBannerText}>
                          You won!{" "}
                          <Text style={{ fontWeight: "800" }}>
                            GHS {formatGHS(Quiz_reward_amount)}
                          </Text>{" "}
                          has been deposited into your wallet.
                        </Text>
                      </View>
                    )}

                    {answers.map((a, i) => (
                      <View
                        key={i}
                        style={[
                          styles.reviewItem,
                          {
                            backgroundColor: a.isCorrect
                              ? "#e8f5e9"
                              : "#ffebee",
                          },
                        ]}
                      >
                        <View style={styles.reviewHeader}>
                          <Ionicons
                            name={
                              a.isCorrect
                                ? "checkmark-circle"
                                : "close-circle"
                            }
                            size={22}
                            color={a.isCorrect ? "#4caf50" : "#f44336"}
                          />
                          <Text style={styles.reviewQ}>
                            Q{i + 1}: {questions[i]?.question}
                          </Text>
                        </View>
                        <Text style={styles.reviewA}>
                          Your answer:{" "}
                          <Text
                            style={
                              a.isCorrect
                                ? styles.correctAnswer
                                : styles.incorrectAnswer
                            }
                          >
                            {a.label} {a.answer}
                          </Text>
                        </Text>
                        {!a.isCorrect && (
                          <Text style={styles.reviewCorrect}>
                            ✅ Correct: {a.correct}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <View
                style={[
                  styles.footerInner,
                  {
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.footerButton,
                    startButtonDisabled && styles.footerButtonDisabled,
                    gameInProgress && styles.footerButtonInProgress,
                    topicLimitReached && styles.footerButtonLimitReached,
                  ]}
                  onPress={startGame}
                  disabled={startButtonDisabled}
                >
                  <Text style={styles.buttonText}>
                    {!isConnectedNET
                      ? "Offline"
                      : loading
                        ? "Loading…"
                        : topicLimitReached
                          ? "Topic Limit Reached"
                          : !canStartGame
                            ? `🔒 Reset to Play (${liveTotalWrongScore} wrong)`
                            : gameInProgress
                              ? "Game in Progress"
                              : "Start Game"}
                  </Text>
                </TouchableOpacity>

                {topicLimitReached && (
                  <TouchableOpacity
                    style={styles.changeTopicButton}
                    onPress={() => router.replace("./pickTopic")}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={15}
                      color="#fff"
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.changeTopicButtonText}>
                      Change Topic
                    </Text>
                  </TouchableOpacity>
                )}

                <PupupMenuForScoreReset
                  free_reset_credit={String(free_reset_credit ?? 0)}
                  pay_as_you_go={String(pay_as_you_go_credits ?? 0)}   // ← use pay_as_you_go_credits (numeric)
                  monthly_subscription_plan={monthlyPlan > 0 ? String(monthlyPlan) : "0"} // ← use monthlyPlan (numeric)
                  isOwner={email === userId}
                  Press_free_reset_credit={() => PupupMenuForScoreResetFun("free_reset_credit", email)}
                  Press_pay_as_you_go={() => PupupMenuForScoreResetFun("pay_as_you_go", email)}
                  Press_monthly_subscription_plan={() => PupupMenuForScoreResetFun("monthly_subscription_plan", email)}
                  Press_buy_reset_credit={() => PupupMenuBuyResetCreditFun(email)}
                />
              </View>
            </View>

            <BottomNavQuiz />
          </View>
        </View>
      </MenuProvider>
    </ReusableScreen>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingBottom: 10,
    marginTop: 10,
  },
  backButton: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 15, color: "#000", marginLeft: 6, fontWeight: "600" },
  scoreText: { fontSize: 15, color: "#f47208ff", fontWeight: "600" },
  timeUsedToPerformTask: { fontSize: 17, fontWeight: "600" },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  infoText: { marginTop: 40, color: "#333", textAlign: "center" },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
  },
  offlineBanner: {
    textAlign: "center",
    color: "#d32f2f",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 10,
    marginHorizontal: 15,
  },
  lockNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    backgroundColor: "#fff3f3",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#d32f2f",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lockNoticeText: { flex: 1, fontSize: 13, color: "#b71c1c", lineHeight: 20 },
  topicLimitNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    backgroundColor: "#f3e5f5",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#7b1fa2",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topicLimitText: { flex: 1, fontSize: 13, color: "#4a148c", lineHeight: 20 },
  persistedHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  persistedHintText: { fontSize: 12, color: "#78716c" },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  categoryBadgeText: { fontSize: 12, color: "#0369a1" },
  buttonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  winBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2e7d32",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  winBannerText: { flex: 1, fontSize: 15, color: "#fff", lineHeight: 22 },
  card: { paddingHorizontal: 10, paddingBottom: 15, width: "100%" },
  progressContainer: {
    alignSelf: "center",
    height: 15,
    width: "80%",
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 15,
  },
  progressBar: { height: "100%", backgroundColor: "#f47702ff" },
  progressText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  arrowsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 60,
    marginVertical: 10,
  },
  question: {
    paddingHorizontal: 25,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
    color: "#333",
    lineHeight: 24,
    marginVertical: 20,
  },
  option: {
    backgroundColor: "#f0f0f0",
    padding: 14,
    marginHorizontal: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  optionText: { fontSize: 16, color: "#333", lineHeight: 22 },
  reviewItem: { padding: 14, borderRadius: 10, marginBottom: 12 },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewQ: { fontSize: 15, color: "#333", marginLeft: 6 },
  reviewA: { fontSize: 14, marginTop: 2 },
  reviewCorrect: { fontSize: 14, color: "#1976d2", marginTop: 4 },
  correctAnswer: { color: "#388e3c" },
  incorrectAnswer: { color: "#d32f2f" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 10,
    marginBottom: 5,
    width: "100%",
  },
  footerInner: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    width: "70%",
  },
  footerButton: {
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff9800",
    paddingHorizontal: 25,
    borderRadius: 50,
  },
  footerButtonDisabled: { backgroundColor: "#ccc", paddingHorizontal: 18 },
  footerButtonInProgress: { backgroundColor: "#607d8ba2" },
  footerButtonLimitReached: { backgroundColor: "#9c27b0" },
  changeTopicButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7b1fa2",
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 50,
  },
  changeTopicButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
