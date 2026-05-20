// pickTopic.tsx — Simplified: no shadows, no animations
import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ReusableScreen from "@/components/ReusableScreen";
import { GlobalContext } from "@/context";
import { General_questions_on_football } from "@/DATASET/General_questions_on_football";
import { General_questions_on_science } from "@/DATASET/General_questions_on_science";
import { General_questions_on_mathematics } from "@/DATASET/General_questions_on_mathematics";
import { General_questions_on_general_knowledge } from "@/DATASET/General_questions_on_general_knowledge";
import { General_questions_on_english } from "@/DATASET/General_questions_on_english";
import { General_questions_on_computing } from "@/DATASET/General_questions_on_computing";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
type Strand = {
  title: string;
  dataset: string;
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  description: string;
};

type GenericTopics = Record<string, string[]>;

type PersistedSelection = {
  expandedDatasets: string[];
  expandedCategories: string[];
  selectedSubtopic: string;
  selected: { title: string; dataset: string };
  selectedCategoryKey: string;
};

const STORAGE_KEY = "pickTopic_persistedSelection_v2";
const RECENTS_KEY = "pickTopic_recentTopics_v1";
const MAX_RECENTS = 5;

type RecentTopic = {
  title: string;
  dataset: string;
  categoryKey: string;
  strandTitle: string;
  strandColor: string;
  strandIcon: keyof typeof Ionicons.glyphMap;
  playedAt: number;
};

/* ─────────────────────────────────────────────────────────
   Strand definitions
───────────────────────────────────────────────────────── */
const STRANDS: Strand[] = [
  {
    title: "Computer Science",
    dataset: "computing",
    active: true,
    icon: "desktop-outline",
    color: "#f97316",
    bgColor: "#fff7ed",
    description: "Hardware, software & cyber security",
  },
  {
    title: "English",
    dataset: "english",
    active: true,
    icon: "book-outline",
    color: "#ec4899",
    bgColor: "#fdf2f8",
    description: "Grammar, writing, literature & poetry",
  },
  {
    title: "Mathematics",
    dataset: "mathematics",
    active: true,
    icon: "calculator-outline",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    description: "Algebra, geometry & statistics",
  },
  {
    title: "General Science",
    dataset: "science",
    active: true,
    icon: "flask-outline",
    color: "#0ea5e9",
    bgColor: "#f0f9ff",
    description: "Biology, chemistry, physics & space",
  },
  {
    title: "General Knowledge",
    dataset: "general_knowledge",
    active: true,
    icon: "globe-outline",
    color: "#10b981",
    bgColor: "#f0fdf4",
    description: "History, geography & current affairs",
  },
  {
    title: "Football",
    dataset: "football",
    active: true,
    icon: "football-outline",
    color: "#ef4444",
    bgColor: "#fef2f2",
    description: "Africa, Europe, Asia & global football",
  },
];

/* ─────────────────────────────────────────────────────────
   Dataset map
───────────────────────────────────────────────────────── */
const DATASET_MAP: Record<string, GenericTopics> = {
  computing: General_questions_on_computing.topics as GenericTopics,
  football: General_questions_on_football.topics as GenericTopics,
  science: General_questions_on_science.topics as GenericTopics,
  mathematics: General_questions_on_mathematics.topics as GenericTopics,
  general_knowledge: General_questions_on_general_knowledge.topics as GenericTopics,
  english: General_questions_on_english.topics as GenericTopics,
};

/* ─────────────────────────────────────────────────────────
   Category emoji map
───────────────────────────────────────────────────────── */
const CATEGORY_EMOJI_MAP: Record<string, Record<string, string>> = {
  computing: {
    ComponentsOfComputers: "🖥️",
    NumberSystemsAndDataRepresentation: "🔢",
    TechnologyInTheCommunity: "🌐",
    HealthAndSafetyInICT: "🛡️",
    NetworkingAndCommunications: "📡",
    WordProcessing: "📝",
    Spreadsheets: "📊",
    PresentationSoftware: "🎞️",
    DatabasesAndDataManagement: "🗄️",
    CyberSecurity: "🔒",
    OperatingSystemsAndSoftware: "⚙️",
    Robotics: "🤖",
    ArtificialIntelligenceAndMachineLearning: "🧠",
    Programming: "💻",
    WebDevelopment: "🌍",
  },
  football: {
    Africa: "🌍", Asia: "🌏", Europe: "🌎", America: "🗽", Global: "🌐",
  },
  science: {
    Biology: "🧬", Chemistry: "⚗️", Physics: "⚡", EarthScience: "🌏", SpaceScience: "🚀",
  },
  mathematics: {
    NumberAndAlgebra: "🔢",
    GeometryAndMeasure: "📐",
    StatisticsAndProbability: "📊",
    Calculus: "∫",
    FinancialMathematics: "💰",
  },
  general_knowledge: {
    History: "📜",
    Geography: "🗺️",
    ScienceAndTechnology: "💡",
    ArtsAndCulture: "🎭",
    CurrentAffairs: "📰",
  },
  english: {
    ReadingComprehension: "📖",
    GrammarAndLanguageStructure: "🔤",
    Vocabulary: "💬",
    WritingSkills: "✍️",
    Punctuation: "❕",
    LiteraryDevicesAndFigurativeLanguage: "🎨",
    Poetry: "🎭",
    ProseFiction: "📚",
    Drama: "🎬",
    OralCommunicationAndListening: "🎤",
    SpellingAndWordStudy: "🔡",
    MediaAndInformationLiteracy: "📰",
  },
};

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function categoryLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/And/g, "&").trim();
}

function stripPrefix(subtopic: string): string {
  return subtopic.replace(/^[^:]+:\s*/, "").trim();
}

function getStrandForDataset(datasetKey: string): Strand | undefined {
  return STRANDS.find((s) => s.dataset === datasetKey);
}

/* ─────────────────────────────────────────────────────────
   StepIndicator
───────────────────────────────────────────────────────── */
function StepIndicator({
  step1Done,
  step2Done,
  step3Done,
  activeStrandTitle,
}: {
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  activeStrandTitle?: string;
}) {
  const steps = [
    { label: "Subject", done: step1Done },
    { label: "Category", done: step2Done },
    { label: "Topic", done: step3Done },
  ];

  return (
    <View style={stepStyles.wrapper}>
      <View style={stepStyles.row}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <View style={stepStyles.stepItem}>
              <View style={[stepStyles.dot, s.done && stepStyles.dotActive]}>
                {s.done ? (
                  <Ionicons name="checkmark" size={15} color="#fff" />
                ) : (
                  <Text style={stepStyles.dotNum}>{i + 1}</Text>
                )}
              </View>
              <Text style={[stepStyles.label, s.done && stepStyles.labelActive]}>
                {s.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[stepStyles.connector, s.done && stepStyles.connectorActive]} />
            )}
          </React.Fragment>
        ))}
      </View>

    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  stepItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#fbeadfff",
    borderWidth: 2, borderColor: "#f1aa77ff",
    justifyContent: "center", alignItems: "center",
  },
  dotActive: { backgroundColor: "#fd9043ff", borderColor: "#f97316" },
  dotNum: { fontSize: 11, fontWeight: "700", color: "#f97316" },
  label: {
    fontSize: 10, fontWeight: "700", color: "#000",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  labelActive: { color: "#f97316" },
  connector: {
    flex: 1, height: 1.5, backgroundColor: "#e8ddd5", marginHorizontal: 6,
  },
  connectorActive: { backgroundColor: "#f97316" },


  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff7ed",
    borderWidth: 1.5, borderColor: "#fed7aa",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f97316" },
  chipText: { fontSize: 11, fontWeight: "700", color: "#ea6c00" },
});

/* ─────────────────────────────────────────────────────────
   SearchBar
───────────────────────────────────────────────────────── */
function SearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <View style={searchStyles.wrap}>
      <Ionicons name="search-outline" size={16} color="#94a3b8" style={searchStyles.icon} />
      <TextInput
        style={searchStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Search topics..."
        placeholderTextColor="#b0b8c4"
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const searchStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f5f6f8",
    borderRadius: 12, borderWidth: 1, borderColor: "#e8e2dc",
    marginHorizontal: 12, marginVertical: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  input: {
    flex: 1, fontSize: 14, color: "#1e293b",
    fontWeight: "400", padding: 0,
  },
});

/* ─────────────────────────────────────────────────────────
   RecentTopicsBar
───────────────────────────────────────────────────────── */
function RecentTopicsBar({
  recents,
  onSelect,
}: {
  recents: RecentTopic[];
  onSelect: (r: RecentTopic) => void;
}) {
  if (recents.length === 0) return null;

  return (
    <View style={recentStyles.section}>
      <View style={recentStyles.headerRow}>
        <Ionicons name="time-outline" size={13} color="#94a3b8" />
        <Text style={recentStyles.headerText}>Recent</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={recentStyles.scrollContent}
      >
        {recents.map((r, i) => (
          <TouchableOpacity
            key={i}
            style={[recentStyles.chip, { borderColor: r.strandColor + "40" }]}
            onPress={() => onSelect(r)}
            activeOpacity={0.72}
          >
            <View style={[recentStyles.chipIcon, { backgroundColor: r.strandColor + "18" }]}>
              <Ionicons name={r.strandIcon} size={13} color={r.strandColor} />
            </View>
            <Text style={recentStyles.chipLabel} numberOfLines={1}>
              {stripPrefix(r.title)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const recentStyles = StyleSheet.create({
  section: {
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f1ece6",
    paddingTop: 10, paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, marginBottom: 8,
  },
  headerText: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 1,
  },
  scrollContent: { paddingHorizontal: 12, gap: 8, flexDirection: "row" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#fff", borderRadius: 999,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  chipLabel: { fontSize: 12, fontWeight: "600", color: "#334155", maxWidth: 130 },
});

/* ═══════════════════════════════════════════════════════
   Main Screen
═══════════════════════════════════════════════════════ */
export default function PickTopicScreen() {
  const router = useRouter();
  const { userName } = useContext(GlobalContext);

  useFocusEffect(
    useCallback(() => {
      if (!userName) router.replace("/");
    }, [userName, router])
  );

  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ title: string; dataset: string } | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentTopics, setRecentTopics] = useState<RecentTopic[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  /* ── Load persisted selection + recents on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [raw, rawRecents] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(RECENTS_KEY),
        ]);
        if (raw) {
          const saved: PersistedSelection = JSON.parse(raw);
          setExpandedDatasets(new Set(saved.expandedDatasets ?? []));
          setExpandedCategories(new Set(saved.expandedCategories ?? []));
          setSelectedSubtopic(saved.selectedSubtopic);
          setSelected(saved.selected);
          setSelectedCategoryKey(saved.selectedCategoryKey ?? "");
        }
        if (rawRecents) {
          setRecentTopics(JSON.parse(rawRecents));
        }
      } catch (_) { }
      finally {
        setHydrated(true);
      }
    })();
  }, []);

  /* ── Persist selection whenever it changes ── */
  useEffect(() => {
    if (!hydrated) return;
    if (selected && selectedSubtopic) {
      const payload: PersistedSelection = {
        expandedDatasets: Array.from(expandedDatasets),
        expandedCategories: Array.from(expandedCategories),
        selectedSubtopic,
        selected,
        selectedCategoryKey,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => { });
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => { });
    }
  }, [selected, expandedDatasets, expandedCategories, selectedSubtopic, selectedCategoryKey, hydrated]);

  /* ── Search filter ── */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{
      strand: Strand;
      categoryKey: string;
      subtopic: string;
    }> = [];
    for (const strand of STRANDS) {
      if (!strand.active) continue;
      const topics = DATASET_MAP[strand.dataset];
      if (!topics) continue;
      for (const catKey of Object.keys(topics)) {
        for (const subtopic of topics[catKey]) {
          const label = stripPrefix(subtopic).toLowerCase();
          const cat = categoryLabel(catKey).toLowerCase();
          if (label.includes(q) || cat.includes(q) || strand.title.toLowerCase().includes(q)) {
            hits.push({ strand, categoryKey: catKey, subtopic });
          }
        }
      }
    }
    return hits.slice(0, 30);
  }, [searchQuery]);

  /* ── Handlers ── */
  const handleStrandTap = useCallback((strand: Strand) => {
    if (!strand.active) return;
    setExpandedDatasets((prev) => {
      const next = new Set(prev);
      next.has(strand.dataset) ? next.delete(strand.dataset) : next.add(strand.dataset);
      return next;
    });
  }, []);

  const handleCategoryTap = useCallback((categoryKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(categoryKey) ? next.delete(categoryKey) : next.add(categoryKey);
      return next;
    });
  }, []);

  const handleSubtopicSelect = useCallback(
    (dataset: string, categoryKey: string, subtopic: string) => {
      if (selectedSubtopic === subtopic) {
        setSelectedSubtopic(null);
        setSelected(null);
        setSelectedCategoryKey("");
        return;
      }
      setSelectedSubtopic(subtopic);
      setSelected({ title: subtopic, dataset: `${dataset}__${categoryKey}__${subtopic}` });
      setSelectedCategoryKey(categoryKey);
    },
    [selectedSubtopic]
  );

  const handleSearchResultSelect = useCallback(
    (strand: Strand, categoryKey: string, subtopic: string) => {
      setSearchQuery("");
      setShowSearch(false);
      setExpandedDatasets((prev) => new Set([...prev, strand.dataset]));
      setExpandedCategories((prev) => new Set([...prev, categoryKey]));
      handleSubtopicSelect(strand.dataset, categoryKey, subtopic);
    },
    [handleSubtopicSelect]
  );

  const handleRecentSelect = useCallback(
    (r: RecentTopic) => {
      const strand = getStrandForDataset(r.dataset);
      if (!strand) return;
      setExpandedDatasets((prev) => new Set([...prev, r.dataset]));
      setExpandedCategories((prev) => new Set([...prev, r.categoryKey]));
      handleSubtopicSelect(r.dataset, r.categoryKey, r.title);
    },
    [handleSubtopicSelect]
  );

  const handleProceed = useCallback(async () => {
    if (!selected) return;

    const datasetKey = selected.dataset.split("__")[0];
    const strand = getStrandForDataset(datasetKey);
    if (strand) {
      const newRecent: RecentTopic = {
        title: selected.title,
        dataset: datasetKey,
        categoryKey: selectedCategoryKey,
        strandTitle: strand.title,
        strandColor: strand.color,
        strandIcon: strand.icon,
        playedAt: Date.now(),
      };
      const updated = [
        newRecent,
        ...recentTopics.filter((r) => r.title !== selected.title),
      ].slice(0, MAX_RECENTS);
      setRecentTopics(updated);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated)).catch(() => { });
    }

    router.replace({
      pathname: "./quiz",
      params: {
        topic: selected.title,
        topic_category: selectedCategoryKey,
        dataset: selected.dataset,
        quizStatus: "online",
      },
    });
  }, [selected, selectedCategoryKey, recentTopics, router]);

  const handleClearAll = useCallback(() => {
    setExpandedDatasets(new Set());
    setExpandedCategories(new Set());
    setSelectedSubtopic(null);
    setSelected(null);
    setSelectedCategoryKey("");
    setSearchQuery("");
    setShowSearch(false);
  }, []);

  const step1Done = expandedDatasets.size > 0;
  const step2Done = expandedCategories.size > 0;
  const step3Done = !!selected;

  const activeStrandTitle = useMemo(() => {
    if (expandedDatasets.size === 0) return undefined;
    return STRANDS.find((s) => expandedDatasets.has(s.dataset))?.title;
  }, [expandedDatasets]);

  const selectedDatasetKey = selected ? selected.dataset.split("__")[0] : null;
  const selectedStrand = selectedDatasetKey ? getStrandForDataset(selectedDatasetKey) : null;

  return (
    <ReusableScreen>
      <View style={{ flex: 1, backgroundColor: "#f0ebe3" }}>

        {/* ── White header bar ── */}
        <View style={styles.headerTopBar}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.navigate({ pathname: "/chat/members_list" })}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerEyebrow}>Anser questions & earn</Text>
              <Text style={styles.headerTitle}>Pick a Topic</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconBtn, showSearch && styles.iconBtnActive]}
                onPress={() => {
                  setShowSearch((v) => !v);
                  if (showSearch) setSearchQuery("");
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showSearch ? "close-outline" : "search-outline"}
                  size={20}
                  color={showSearch ? "#f97316" : "#f97316"}
                />
              </TouchableOpacity>

              {selected && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClearAll}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="refresh-outline" size={19} color="#f97316" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Step indicator ── */}
        <View style={styles.headerStepSection}>
          <StepIndicator
            step1Done={step1Done}
            step2Done={step2Done}
            step3Done={step3Done}
            activeStrandTitle={activeStrandTitle}
          />
        </View>

        {/* ── Inline search bar ── */}
        {showSearch && (
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
          />
        )}

        {/* ── Search results ── */}
        {showSearch && searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsPanel}>
            {searchResults.length === 0 ? (
              <View style={styles.searchEmpty}>
                <Ionicons name="search-outline" size={28} color="#c4bab2" />
                <Text style={styles.searchEmptyText}>No topics found</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.searchResultsScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {searchResults.map((hit, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.searchResultRow}
                    onPress={() => handleSearchResultSelect(hit.strand, hit.categoryKey, hit.subtopic)}
                    activeOpacity={0.72}
                  >
                    <View style={[styles.searchResultIcon, { backgroundColor: hit.strand.color + "18" }]}>
                      <Ionicons name={hit.strand.icon} size={15} color={hit.strand.color} />
                    </View>
                    <View style={styles.searchResultText}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>
                        {stripPrefix(hit.subtopic)}
                      </Text>
                      <Text style={styles.searchResultMeta}>
                        {hit.strand.title} · {categoryLabel(hit.categoryKey)}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward-outline" size={14} color="#c4bab2" />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 8 }} />
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Recents strip + Subject list ── */}
        {!(showSearch && searchQuery.trim().length > 0) && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <RecentTopicsBar recents={recentTopics} onSelect={handleRecentSelect} />

            <View style={styles.strandsWrapper}>
              {STRANDS.map((strand) => {
                const isOpen = expandedDatasets.has(strand.dataset);
                const topics = DATASET_MAP[strand.dataset];
                const categoryKeys = topics ? Object.keys(topics) : [];
                const emojiMap = CATEGORY_EMOJI_MAP[strand.dataset] ?? {};

                return (
                  <StrandCard
                    key={strand.dataset}
                    strand={strand}
                    isOpen={isOpen}
                    categoryKeys={categoryKeys}
                    topics={topics}
                    emojiMap={emojiMap}
                    expandedCategories={expandedCategories}
                    selectedSubtopic={selectedSubtopic}
                    onStrandTap={() => handleStrandTap(strand)}
                    onCategoryTap={handleCategoryTap}
                    onSubtopicSelect={handleSubtopicSelect}
                  />
                );
              })}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <View style={styles.footerTopicWrap}>
              <View style={styles.footerLabelRow}>
                <Text style={styles.footerLabel}>Selected Topic</Text>
                {selected && <View style={styles.footerStatusDot} />}
              </View>
              <Text
                style={[styles.footerTopic, !selected && styles.footerTopicEmpty]}
                numberOfLines={1}
              >
                {selected ? stripPrefix(selected.title) : "Nothing selected yet"}
              </Text>
              {selected && selectedCategoryKey ? (
                <Text style={styles.footerCategory} numberOfLines={1}>
                  {selectedStrand?.title ?? ""} · {categoryLabel(selectedCategoryKey)}
                </Text>
              ) : (
                <Text style={styles.footerHintText}>Tap a topic pill above to select</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.proceedBtn, selected ? { backgroundColor: "orange" } : styles.proceedBtnDisabled]}
              onPress={selected ? handleProceed : undefined}
              activeOpacity={0.85}
            >
              <Text style={styles.proceedText}>Start</Text>
              <View style={[styles.proceedIconBox, { backgroundColor: selected ? "#e38c0a" : "#d1c9c0" }]}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ReusableScreen>
  );
}

/* ─────────────────────────────────────────────────────────
   StrandCard
───────────────────────────────────────────────────────── */
function StrandCard({
  strand, isOpen, categoryKeys, topics, emojiMap,
  expandedCategories, selectedSubtopic,
  onStrandTap, onCategoryTap, onSubtopicSelect,
}: {
  strand: Strand;
  isOpen: boolean;
  categoryKeys: string[];
  topics: GenericTopics;
  emojiMap: Record<string, string>;
  expandedCategories: Set<string>;
  selectedSubtopic: string | null;
  onStrandTap: () => void;
  onCategoryTap: (key: string) => void;
  onSubtopicSelect: (dataset: string, categoryKey: string, subtopic: string) => void;
}) {
  return (
    <View style={[styles.strandWrapper, isOpen && { borderColor: strand.color + "30", borderWidth: 1.5 }]}>
      <TouchableOpacity
        style={[styles.strandRow, isOpen && { backgroundColor: strand.bgColor }]}
        onPress={onStrandTap}
        activeOpacity={0.78}
      >
        {isOpen && <View style={[styles.accentStripe, { backgroundColor: strand.color }]} />}
        <View style={[styles.strandIconWrap, { backgroundColor: strand.color + "18" }]}>
          <Ionicons name={strand.icon} size={22} color={strand.color} />
        </View>
        <View style={styles.strandTextBlock}>
          <Text style={[styles.strandTitle, isOpen && { color: strand.color }]}>{strand.title}</Text>
          <Text style={styles.strandDesc} numberOfLines={1}>{strand.description}</Text>
        </View>
        <View style={styles.strandRight}>
          <View style={[styles.badge, { backgroundColor: strand.color + "15" }]}>
            <Text style={[styles.badgeText, { color: strand.color }]}>{categoryKeys.length}</Text>
          </View>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={17}
            color={isOpen ? strand.color : "#cbd5e1"}
          />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.categoryPanel}>
          <Text style={[styles.categoryPanelLabel, { color: strand.color + "aa" }]}>CATEGORIES</Text>
          {categoryKeys.map((catKey) => (
            <CategoryRow
              key={catKey}
              catKey={catKey}
              label={categoryLabel(catKey)}
              emoji={emojiMap[catKey] ?? "📁"}
              subtopics={topics[catKey] ?? []}
              isCatOpen={expandedCategories.has(catKey)}
              selectedSubtopic={selectedSubtopic}
              strandColor={strand.color}
              strandBgColor={strand.bgColor}
              strandDataset={strand.dataset}
              onCategoryTap={onCategoryTap}
              onSubtopicSelect={onSubtopicSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────
   CategoryRow
───────────────────────────────────────────────────────── */
type CategoryRowProps = {
  catKey: string;
  label: string;
  emoji: string;
  subtopics: string[];
  isCatOpen: boolean;
  selectedSubtopic: string | null;
  strandColor: string;
  strandBgColor: string;
  strandDataset: string;
  onCategoryTap: (key: string) => void;
  onSubtopicSelect: (dataset: string, categoryKey: string, subtopic: string) => void;
};

function CategoryRow({
  catKey, label, emoji, subtopics,
  isCatOpen, selectedSubtopic, strandColor, strandBgColor, strandDataset,
  onCategoryTap, onSubtopicSelect,
}: CategoryRowProps) {
  return (
    <View style={styles.categoryWrapper}>
      <TouchableOpacity
        style={[
          styles.categoryRow,
          isCatOpen && { backgroundColor: strandBgColor, borderColor: strandColor + "28" },
        ]}
        onPress={() => onCategoryTap(catKey)}
        activeOpacity={0.75}
      >
        <Text style={styles.categoryEmoji}>{emoji}</Text>
        <Text style={[styles.categoryLabel, isCatOpen && { color: strandColor, fontWeight: "700" }]}>
          {label}
        </Text>
        <View style={styles.categoryRight}>
          <View style={[styles.badge, { backgroundColor: strandColor + "12" }]}>
            <Text style={[styles.badgeText, { color: strandColor }]}>{subtopics.length}</Text>
          </View>
          <Ionicons
            name={isCatOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={isCatOpen ? strandColor : "#cbd5e1"}
          />
        </View>
      </TouchableOpacity>

      {isCatOpen && (
        <View style={styles.topicGrid}>
          {subtopics.map((subtopic, si) => {
            const isChosen = selectedSubtopic === subtopic;
            const pillLabel = stripPrefix(subtopic);
            return (
              <TouchableOpacity
                key={si}
                style={[
                  styles.topicPill,
                  isChosen && { backgroundColor: strandColor, borderColor: strandColor },
                ]}
                onPress={() => onSubtopicSelect(strandDataset, catKey, subtopic)}
                activeOpacity={0.72}
              >
                {isChosen && (
                  <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 5 }} />
                )}
                <Text
                  style={[styles.topicPillText, isChosen && { color: "#fff", fontWeight: "600" }]}
                  numberOfLines={2}
                >
                  {pillLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════════ */
const styles = StyleSheet.create({

  // ── Header: now white, flat, no blobs ──────────────────────────────────────
  headerTopBar: {
    backgroundColor: "#ffffff",
    paddingTop: 0,               // ✅ RootLayout owns status bar height
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  headerStepSection: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8eaed",   // neutral — no longer orange-tinted
  },

  headerTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 10,
  },
  headerCenter: { alignItems: "center", flex: 1 },
  headerEyebrow: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2.2,
    color: "#f53206ff",               // muted grey on white
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 20, fontWeight: "800", color: "#ff9c1bff",   // dark on white
    letterSpacing: -0.4, lineHeight: 26, position: "relative", top: 3,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Icon buttons: grey border on white background
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#fb7e2bff",
    justifyContent: "center", alignItems: "center",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#fcf9f7ff",
    borderWidth: 1, borderColor: "#f5d5b3ff",
    justifyContent: "center", alignItems: "center",
  },
  iconBtnActive: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  clearBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#fcf9f7ff",
    borderWidth: 1, borderColor: "#f5d5b3ff",
    justifyContent: "center", alignItems: "center",
  },

  searchResultsPanel: {
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e8e2dc",
    maxHeight: 320,
  },
  searchResultsScroll: { flex: 1 },
  searchEmpty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  searchEmptyText: { fontSize: 14, color: "#c4bab2", fontWeight: "500" },
  searchResultRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f5f0eb",
  },
  searchResultIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  searchResultText: { flex: 1 },
  searchResultTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  searchResultMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2, fontWeight: "400" },

  scrollArea: { flex: 1, backgroundColor: "#f0ebe3" },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  strandsWrapper: { paddingHorizontal: 10, paddingTop: 10, gap: 10 },

  strandWrapper: {
    borderRadius: 16, overflow: "hidden", backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#ddd",
  },
  strandRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
    paddingHorizontal: 14, backgroundColor: "#fff", minHeight: 68, position: "relative",
  },
  accentStripe: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
  },
  strandIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginRight: 12, marginLeft: 6,
  },
  strandTextBlock: { flex: 1, justifyContent: "center", gap: 2 },
  strandTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", letterSpacing: -0.1 },
  strandDesc: { fontSize: 12, color: "#94a3b8", fontWeight: "400" },
  strandRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, justifyContent: "center", alignItems: "center" },
  badgeText: { fontSize: 12, fontWeight: "800" },

  categoryPanel: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f1f5f9",
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12,
  },
  categoryPanelLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10, paddingHorizontal: 4 },
  categoryWrapper: { marginBottom: 6 },
  categoryRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "#f1f5f9", minHeight: 48,
  },
  categoryEmoji: { fontSize: 18, marginRight: 10, width: 24, textAlign: "center" },
  categoryLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#334155", letterSpacing: -0.1 },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 6 },

  topicGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingTop: 10, paddingHorizontal: 2, paddingBottom: 4,
  },
  topicPill: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: "#e2e8f0", minHeight: 38,
  },
  topicPillText: { fontSize: 13, color: "#475569", fontWeight: "500", maxWidth: 180 },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#ede8e2",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
  },
  footerInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerTopicWrap: { flex: 1, paddingVertical: 2, minWidth: 0 },
  footerLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  footerLabel: {
    fontSize: 12, fontWeight: "700", color: "#000",
    textTransform: "uppercase", letterSpacing: 1.5,
  },
  footerStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f97316" },
  footerTopic: { fontSize: 16, fontWeight: "800", color: "#f98f05ff", letterSpacing: -0.2 },
  footerTopicEmpty: { color: "#666", fontWeight: "500" },
  footerCategory: { fontSize: 11, color: "#a89b90", fontWeight: "400", marginTop: 2 },
  footerHintText: { fontSize: 11, color: "#777", fontWeight: "400", marginTop: 2 },

  proceedBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18,
  },
  proceedBtnDisabled: { backgroundColor: "#e2ddd9" },
  proceedText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.1 },
  proceedIconBox: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },

  footerBottomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 10, gap: 12,
  },
  difficultyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  difficultyText: { fontSize: 11, color: "#a89b90", fontWeight: "400" },
});
