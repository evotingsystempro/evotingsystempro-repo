// CompleteProfileScreen.tsx
// ─── Optional profile completion wizard ──────────────────────────────────────
// Changes:
//   - Removed Identity (legal name) step entirely — now 2 steps: Birthday + Gender
//   - Dropdown z-index fixed so lists float above the info box
//   - Color changed from blue (#2563EB) to orange (#F97316) throughout
//   - "Maybe Later" skip button is now clearly visible (orange text, warm border)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  DevSettings,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getFirestore, onSnapshot, updateDoc } from "firebase/firestore";
import { GlobalContext } from "@/context/index";
import ReusableScreen from "./ReusableScreen";

const IS_WEB = Platform.OS === "web";

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-PLATFORM RELOAD
// ─────────────────────────────────────────────────────────────────────────────

// After
// After
async function reloadApp(): Promise<void> {
  if (IS_WEB) {
    if (typeof window !== "undefined") window.location.reload();
    return;
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  try {
    const Updates = await import("expo-updates");
    if (typeof Updates?.reloadAsync === "function") {
      await Updates.reloadAsync();
      return;
    }
  } catch { }
  DevSettings.reload();
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Gender = "male" | "female" | "other" | "prefer_not_to_say";

interface ComplianceFields {
  actualFullname: string;
  actualDayOfBirth: string;
  actualMonthOfBirth: string;
  actualYearOfBirth: string;
  actualGender: Gender;
}

interface FormState {
  actualMonthOfBirth: string;
  actualDayOfBirth: string;
  actualYearOfBirth: string;
  actualGender: Gender | "";
}

interface FormErrors {
  dob?: string;
  actualGender?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRESTORE
// ─────────────────────────────────────────────────────────────────────────────

const db = getFirestore();
const COLLECTION = "members_list_db";

export const CACHE_KEY = (uid: string) => `profile_complete:${uid}`;
export const SKIP_KEY = (uid: string) => `profile_prompt_skipped:${uid}`;

function isProfileComplete(
  data: Partial<Record<keyof ComplianceFields, unknown>>
): boolean {
  return (
    !!data.actualDayOfBirth &&
    !!data.actualMonthOfBirth &&
    !!data.actualYearOfBirth &&
    !!data.actualGender
  );
}

async function updateComplianceFields(
  userId: string,
  fields: ComplianceFields
): Promise<void> {
  const ref = doc(db, COLLECTION, userId);
  await updateDoc(ref, {
    actualFullname: fields.actualFullname.trim(),
    actualDayOfBirth: fields.actualDayOfBirth,
    actualMonthOfBirth: fields.actualMonthOfBirth,
    actualYearOfBirth: fields.actualYearOfBirth,
    actualGender: fields.actualGender,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN DATA
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  { label: "January", value: "01" },
  { label: "February", value: "02" },
  { label: "March", value: "03" },
  { label: "April", value: "04" },
  { label: "May", value: "05" },
  { label: "June", value: "06" },
  { label: "July", value: "07" },
  { label: "August", value: "08" },
  { label: "September", value: "09" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
];

const GENDERS: { label: string; value: Gender; icon: string; desc: string }[] =
  [
    { label: "Male", value: "male", icon: "male-outline", desc: "He / Him" },
    {
      label: "Female",
      value: "female",
      icon: "female-outline",
      desc: "She / Her",
    },
    {
      label: "Other",
      value: "other",
      icon: "person-outline",
      desc: "They / Them",
    },
    {
      label: "Prefer not to say",
      value: "prefer_not_to_say",
      icon: "eye-off-outline",
      desc: "Private",
    },
  ];

function getDays(month: string, year: string) {
  const m = parseInt(month, 10) || 1;
  const y = parseInt(year, 10) || 2000;
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return { label: String(i + 1), value: d };
  });
}

function getYears() {
  const current = new Date().getFullYear();
  const years: { label: string; value: string }[] = [];
  for (let y = current - 13; y >= 1900; y--)
    years.push({ label: String(y), value: String(y) });
  return years;
}
const YEARS = getYears();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function computeAge(
  month: string,
  day: string,
  year: string
): number | null {
  if (!month || !day || !year) return null;
  const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mDiff = today.getMonth() - dob.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 && age <= 130 ? age : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL-SCREEN OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const FullScreenOverlay: React.FC<{
  visible: boolean;
  children: React.ReactNode;
}> = ({ visible, children }) => {
  if (!visible) return null;

  if (IS_WEB) {
    return (
      <View style={[overlay.web, { position: "fixed" as any, zIndex: 9999 }]}>
        {children}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={() => { }}
    >
      {children}
    </Modal>
  );
};

const overlay = StyleSheet.create({
  web: { top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#F8FAFC" },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN ROOT
// ─────────────────────────────────────────────────────────────────────────────

const ScreenRoot: React.FC<{ style?: object; children: React.ReactNode }> = ({
  style,
  children,
}) => {
  const base = { flex: 1, backgroundColor: "#F8FAFC" };
  if (IS_WEB) return <View style={[base, style]}>{children}</View>;
  return <SafeAreaView style={[base, style]}>{children}</SafeAreaView>;
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

interface DropdownOption {
  label: string;
  value: string;
}
interface DropdownProps {
  placeholder: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  zIndex?: number;
}

const InlineDropdown: React.FC<DropdownProps> = ({
  placeholder,
  options,
  value,
  onChange,
  error,
  zIndex = 10,
}) => {
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(rotateAnim, {
      toValue: open ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    setOpen((p) => !p);
  };

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    Animated.timing(rotateAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const chevron = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const selected = options.find((o) => o.value === value);

  return (
    <View style={[dd.wrapper, { zIndex: IS_WEB && open ? 9999 : zIndex }]}>
      <Pressable
        onPress={toggle}
        style={[dd.trigger, open && dd.triggerOpen, !!error && dd.triggerErr]}
        accessibilityRole="button"
      >
        <Text
          style={[dd.triggerText, !selected && dd.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Animated.View style={{ transform: [{ rotate: chevron }] }}>
          <Ionicons
            name="chevron-down"
            size={14}
            color={error ? "#E53935" : "#94A3B8"}
          />
        </Animated.View>
      </Pressable>

      {open && (
        <View style={[dd.list, IS_WEB && (dd.listWeb as any)]}>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            nestedScrollEnabled
            style={{ maxHeight: 180 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSel = item.value === value;
              return (
                <Pressable
                  style={({ pressed }) => [
                    dd.option,
                    isSel && dd.optionSel,
                    pressed && dd.optionPressed,
                  ]}
                  onPress={() => select(item.value)}
                >
                  <Text style={[dd.optionText, isSel && dd.optionTextSel]}>
                    {item.label}
                  </Text>
                  {isSel && (
                    <Ionicons name="checkmark" size={14} color="#F97316" />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {!!error && <Text style={dd.errText}>{error}</Text>}
    </View>
  );
};

const dd = StyleSheet.create({
  wrapper: { position: "relative", overflow: "visible" },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 13,
    height: 48,
    backgroundColor: "#F8FAFC",
    ...(IS_WEB && ({ cursor: "pointer" } as any)),
  },
  triggerOpen: { borderColor: "#F97316", backgroundColor: "#fff" },
  triggerErr: { borderColor: "#E53935" },
  triggerText: {
    fontSize: 14,
    color: "#1E293B",
    flex: 1,
    marginRight: 4,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "System",
  },
  placeholder: { color: "#94A3B8" },
  list: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 999,
    zIndex: 9999,
  },
  listWeb: { boxShadow: "0 8px 24px rgba(15,23,42,0.12)" } as any,
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  optionSel: { backgroundColor: "#FFF7ED" },
  optionPressed: { backgroundColor: "#F8FAFC" },
  optionText: { fontSize: 14, color: "#334155" },
  optionTextSel: { color: "#F97316", fontWeight: "700" },
  errText: { fontSize: 11.5, color: "#E53935", marginTop: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileCompletionResult {
  completed: boolean;
}

interface ProfileCompletionCtx {
  profileComplete: boolean;
  requireComplete: () => Promise<ProfileCompletionResult>;
}

const ProfileCompletionContext =
  createContext<ProfileCompletionCtx | null>(null);

export const ProfileCompletionProvider: React.FC<{
  children: React.ReactNode;
  onSkip?: () => void;
}> = ({ children, onSkip }) => {
  const { userId } = useContext(GlobalContext);
  const [profileComplete, setProfileComplete] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const resolveRef = useRef<((r: ProfileCompletionResult) => void) | null>(null);

  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | undefined;

    const init = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY(userId));
        if (cached === "true") {
          setProfileComplete(true);
          return;
        }
      } catch { }

      const ref = doc(db, COLLECTION, userId);
      unsub = onSnapshot(ref, async (snap) => {
        if (!snap.exists()) return;
        const complete = isProfileComplete(snap.data());
        setProfileComplete(complete);
        if (complete) {
          try {
            await AsyncStorage.setItem(CACHE_KEY(userId), "true");
          } catch { }
          setModalVisible(false);
          unsub?.();
        }
      });
    };

    init();
    return () => { unsub?.(); };
  }, [userId]);

  const requireComplete = useCallback((): Promise<ProfileCompletionResult> => {
    if (profileComplete) return Promise.resolve({ completed: true });
    return new Promise<ProfileCompletionResult>((resolve) => {
      resolveRef.current = resolve;
      setModalVisible(true);
    });
  }, [profileComplete]);

  const handleComplete = useCallback(async () => {
    try {
      if (userId) await AsyncStorage.setItem(CACHE_KEY(userId), "true");
    } catch { }
    setProfileComplete(true);
    setModalVisible(false);
    resolveRef.current?.({ completed: true });
    resolveRef.current = null;
  }, [userId]);

  // After
  const handleSkip = useCallback(async () => {
    try {
      if (userId) await AsyncStorage.setItem(SKIP_KEY(userId), "true");
    } catch { }
    setModalVisible(false);
    onSkip?.();
    resolveRef.current?.({ completed: false });
    resolveRef.current = null;
    await reloadApp();
  }, [userId, onSkip]);

  return (
    <ProfileCompletionContext.Provider value={{ profileComplete, requireComplete }}>
      {children}
      <FullScreenOverlay visible={modalVisible && !profileComplete}>
        <CompleteProfileScreen
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </FullScreenOverlay>
    </ProfileCompletionContext.Provider>
  );
};

export function useProfileCompletion(): ProfileCompletionCtx {
  const ctx = useContext(ProfileCompletionContext);
  if (!ctx)
    throw new Error(
      "useProfileCompletion must be used inside <ProfileCompletionProvider>"
    );
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR — 2 steps now
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ["Birthday", "Gender"];

const StepIndicator: React.FC<{ current: number; total: number }> = ({
  current,
  total,
}) => (
  <View style={si.row}>
    {STEPS.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <View key={label} style={si.stepWrap}>
          <View
            style={[
              si.circle,
              done && si.circleDone,
              active && si.circleActive,
            ]}
          >
            {done ? (
              <Ionicons name="checkmark" size={13} color="#fff" />
            ) : (
              <Text style={[si.num, active && si.numActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[si.label, active && si.labelActive, done && si.labelDone]}>
            {label}
          </Text>
          {i < total - 1 && (
            <View style={[si.line, done && si.lineDone]} />
          )}
        </View>
      );
    })}
  </View>
);

const si = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 32,
  },
  stepWrap: {
    alignItems: "center",
    flexDirection: "column",
    position: "relative",
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  circleActive: {
    backgroundColor: "#F97316",
    shadowColor: "#F97316",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  circleDone: { backgroundColor: "#10B981" },
  num: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  numActive: { color: "#fff" },
  label: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  labelActive: { color: "#F97316" },
  labelDone: { color: "#10B981" },
  line: {
    position: "absolute",
    top: 15,
    left: 30,
    width: 60,
    height: 1.5,
    backgroundColor: "#E2E8F0",
  },
  lineDone: { backgroundColor: "#10B981" },
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUST BAR
// ─────────────────────────────────────────────────────────────────────────────

const TrustBar: React.FC = () => (
  <View style={tb.row}>
    {[
      { icon: "lock-closed-outline" as const, text: "Encrypted" },
      { icon: "shield-checkmark-outline" as const, text: "Secure" },
      { icon: "eye-off-outline" as const, text: "Private" },
    ].map(({ icon, text }) => (
      <View key={text} style={tb.item}>
        <Ionicons name={icon} size={13} color="#64748B" />
        <Text style={tb.text}>{text}</Text>
      </View>
    ))}
  </View>
);

const tb = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontSize: 11, color: "#64748B", fontWeight: "500" },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — BIRTHDAY
// ─────────────────────────────────────────────────────────────────────────────

const BirthdayStep: React.FC<{
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  error?: string;
}> = ({ form, setField, error }) => {
  const dayOptions = getDays(form.actualMonthOfBirth, form.actualYearOfBirth);
  const age = computeAge(
    form.actualMonthOfBirth,
    form.actualDayOfBirth,
    form.actualYearOfBirth
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={s.stepTitle}>When were you born?</Text>
      <Text style={s.stepSub}>
        Your date of birth is used to verify your age and eligibility.
      </Text>

      {/* ── Dropdowns in a high-zIndex container so lists float above everything below ── */}
      <View style={{ zIndex: 100 }}>
        <View style={s.dobGrid}>
          <View style={{ flex: 2.5, zIndex: 30 }}>
            <Text style={s.fieldLabel}>Month</Text>
            <InlineDropdown
              placeholder="Month"
              options={MONTHS}
              value={form.actualMonthOfBirth}
              onChange={(v) => setField("actualMonthOfBirth", v)}
              zIndex={30}
            />
          </View>
          <View style={{ flex: 1.2, zIndex: 20 }}>
            <Text style={s.fieldLabel}>Day</Text>
            <InlineDropdown
              placeholder="Day"
              options={dayOptions}
              value={form.actualDayOfBirth}
              onChange={(v) => setField("actualDayOfBirth", v)}
              zIndex={20}
            />
          </View>
          <View style={{ flex: 1.8, zIndex: 10 }}>
            <Text style={s.fieldLabel}>Year</Text>
            <InlineDropdown
              placeholder="Year"
              options={YEARS}
              value={form.actualYearOfBirth}
              onChange={(v) => setField("actualYearOfBirth", v)}
              zIndex={10}
            />
          </View>
        </View>
      </View>

      {!!error && (
        <Text style={[s.errText, { marginTop: 6 }]}>{error}</Text>
      )}

      {age !== null && (
        <View style={s.agePreview}>
          <Ionicons name="calendar-outline" size={16} color="#F97316" />
          <Text style={s.ageText}>
            You are <Text style={s.ageBold}>{age} years old</Text>
            {age >= 13 ? " ✓ Eligible" : " ✗ Must be 13+"}
          </Text>
        </View>
      )}

      {/* ── Info box sits below with zIndex 0 so dropdowns float over it ── */}
      <View style={[s.infoBox, { zIndex: 0 }]}>
        <Ionicons name="shield-outline" size={15} color="#F97316" />
        <Text style={s.infoText}>
          You must be at least 13 years old. Date of birth is never shown
          publicly.
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — GENDER
// ─────────────────────────────────────────────────────────────────────────────

const GenderStep: React.FC<{
  value: Gender | "";
  onChange: (v: Gender) => void;
  error?: string;
}> = ({ value, onChange, error }) => (
  <View style={{ flex: 1 }}>
    <Text style={s.stepTitle}>How do you identify?</Text>
    <Text style={s.stepSub}>
      Select the option that best describes you. This information is kept
      private.
    </Text>

    <View style={gs.grid}>
      {GENDERS.map((g) => {
        const selected = value === g.value;
        return (
          <Pressable
            key={g.value}
            style={({ pressed }) => [
              gs.card,
              selected && gs.cardSelected,
              pressed && gs.cardPressed,
            ]}
            onPress={() => onChange(g.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
          >
            <View style={[gs.iconCircle, selected && gs.iconCircleSel]}>
              <Ionicons
                name={g.icon as any}
                size={22}
                color={selected ? "#fff" : "#64748B"}
              />
            </View>
            <Text style={[gs.cardLabel, selected && gs.cardLabelSel]}>
              {g.label}
            </Text>
            <Text style={[gs.cardDesc, selected && gs.cardDescSel]}>
              {g.desc}
            </Text>
            {selected && (
              <View style={gs.checkDot}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>

    {!!error && (
      <Text style={[s.errText, { marginTop: 8 }]}>{error}</Text>
    )}
  </View>
);

const gs = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  card: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 14,
    alignItems: "center",
    position: "relative",
    ...(IS_WEB && ({ cursor: "pointer" } as any)),
  },
  cardPressed: { opacity: 0.82 },
  cardSelected: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
    shadowColor: "#F97316",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    ...(IS_WEB && ({ boxShadow: "0 4px 16px rgba(249,115,22,0.15)" } as any)),
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconCircleSel: { backgroundColor: "#F97316" },
  cardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  cardLabelSel: { color: "#EA6D0E" },
  cardDesc: { fontSize: 11, color: "#94A3B8" },
  cardDescSel: { color: "#FB923C" },
  checkDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{
  onReload: () => void;
  reloading: boolean;
}> = ({ onReload, reloading }) => {
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpac = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpac = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpac, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1.4,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpac, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={ss.container}>
      <Animated.View
        style={[
          ss.ring,
          { opacity: ringOpac, transform: [{ scale: ringScale }] },
        ]}
      />
      <Animated.View
        style={[
          ss.badge,
          { opacity: checkOpac, transform: [{ scale: checkScale }] },
        ]}
      >
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
      </Animated.View>

      <Text style={ss.title}>Profile Verified</Text>
      <Text style={ss.body}>
        Your information has been securely saved. Tap below to continue.
      </Text>

      <View style={ss.chips}>
        {[
          { icon: "calendar-outline" as const, text: "Age confirmed" },
          { icon: "shield-checkmark-outline" as const, text: "Profile secured" },
        ].map(({ icon, text }) => (
          <View key={text} style={ss.chip}>
            <Ionicons name={icon} size={14} color="#10B981" />
            <Text style={ss.chipText}>{text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[ss.btn, reloading && ss.btnLoading]}
        onPress={onReload}
        disabled={reloading}
        activeOpacity={0.85}
      >
        <View style={ss.btnInner}>
          {reloading ? (
            <>
              <Ionicons
                name="reload-outline"
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={ss.btnText}>Reloading…</Text>
            </>
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={ss.btnText}>Proceed to App</Text>
            </>
          )}
        </View>
      </TouchableOpacity>

      <Text style={ss.footer}>
        🔒 Your data is encrypted end-to-end and never sold.
      </Text>
    </View>
  );
};

const ss = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  ring: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: "#D1FAE5",
    backgroundColor: "transparent",
  },
  badge: { marginBottom: 20 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 28,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  chipText: { fontSize: 12, color: "#065F46", fontWeight: "600" },
  btn: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#10B981",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    ...(IS_WEB && ({
      boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
      cursor: "pointer",
    } as any)),
  },
  btnLoading: { opacity: 0.7 },
  btnInner: { flexDirection: "row", alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  footer: {
    marginTop: 20,
    fontSize: 11.5,
    color: "#94A3B8",
    textAlign: "center",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onComplete?: () => Promise<void>;
  onSkip?: () => void;
  navigation?: { goBack?: () => void };
}

export const CompleteProfileScreen: React.FC<Props> = ({
  onComplete,
  onSkip,
  navigation,
}) => {
  const { userId } = useContext(GlobalContext);
  const { width: SCREEN_W } = useWindowDimensions();

  const TOTAL_STEPS = 2;
  const [step, setStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [form, setFormState] = useState<FormState>({
    actualMonthOfBirth: "",
    actualDayOfBirth: "",
    actualYearOfBirth: "",
    actualGender: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const slideX = useRef(new Animated.Value(0)).current;

  const goToStep = useCallback(
    (next: number, direction: 1 | -1 = 1) => {
      const from = direction === 1 ? SCREEN_W : -SCREEN_W;
      slideX.setValue(from);
      setStep(next);
      Animated.spring(slideX, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    },
    [slideX, SCREEN_W]
  );

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const setField = useCallback(
    <K extends keyof FormState>(key: K, val: FormState[K]) => {
      setFormState((p) => ({ ...p, [key]: val }));
      setErrors((e) => {
        const next = { ...e };
        if (
          (["actualMonthOfBirth", "actualDayOfBirth", "actualYearOfBirth"] as string[]).includes(
            key as string
          )
        )
          delete next.dob;
        if (key === "actualGender") delete next.actualGender;
        return next;
      });
      if (key === "actualMonthOfBirth" || key === "actualYearOfBirth") {
        setFormState((p) => ({ ...p, [key]: val, actualDayOfBirth: "" }));
      }
    },
    []
  );

  const validateStep = useCallback((): boolean => {
    if (step === 0) {
      if (
        !form.actualMonthOfBirth ||
        !form.actualDayOfBirth ||
        !form.actualYearOfBirth
      ) {
        setErrors({ dob: "Please select a complete date of birth." });
        return false;
      }
      const age = computeAge(
        form.actualMonthOfBirth,
        form.actualDayOfBirth,
        form.actualYearOfBirth
      );
      if (age !== null && age < 13) {
        setErrors({ dob: "You must be at least 13 years old." });
        return false;
      }
    }
    if (step === 1 && !form.actualGender) {
      setErrors({ actualGender: "Please select a gender." });
      return false;
    }
    return true;
  }, [step, form]);

  // After
  const handleNext = useCallback(async () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1, 1);
      return;
    }

    setLoading(true);
    try {
      await updateComplianceFields(userId, {
        actualFullname: "",
        actualDayOfBirth: form.actualDayOfBirth,
        actualMonthOfBirth: form.actualMonthOfBirth,
        actualYearOfBirth: form.actualYearOfBirth,
        actualGender: form.actualGender as Gender,
      });
      try {
        await AsyncStorage.setItem(CACHE_KEY(userId), "true");
      } catch { }

      setShowSuccess(true);
      try {
        await onComplete?.();
      } catch { }

      await reloadApp();

    } catch (err) {
      console.error(err);
      setErrors({ dob: "Something went wrong. Please try again." });
      setLoading(false);
    }
  }, [step, form, userId, validateStep, goToStep, onComplete]);

  const handleBack = useCallback(() => {
    if (step === 0) {
      onSkip?.();
      navigation?.goBack?.();
      return;
    }
    goToStep(step - 1, -1);
  }, [step, navigation, onSkip, goToStep]);

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      await onComplete?.();
    } catch { }
    // Cross-platform reload
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.reload();
    } else {
      try {
        const Updates = await import("expo-updates");
        if (typeof Updates?.reloadAsync === "function") {
          await Updates.reloadAsync();
          return;
        }
      } catch { }
      if (typeof DevSettings?.reload === "function") {
        DevSettings.reload();
      }
    }
    setReloading(false);
  }, [onComplete]);

  if (showSuccess) {
    return (
      <ScreenRoot style={{ backgroundColor: "#fff" }}>
        <SuccessScreen onReload={handleReload} reloading={reloading} />
      </ScreenRoot>
    );
  }

  return (
    <ReusableScreen>
      <ScreenRoot>
        {/* ── Header ── */}
        <View style={sc.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={sc.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sc.headerTitle}>Complete Your Profile</Text>
            <Text style={sc.headerSub}>
              Step {step + 1} of {TOTAL_STEPS}
            </Text>
          </View>

          {/* ── "Maybe Later" — clearly visible orange button ── */}
          <TouchableOpacity
            onPress={onSkip}
            style={sc.skipBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Skip for now"
          >
            <Text style={sc.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>

        {/* ── Optional banner ── */}
        <View style={sc.optionalBanner}>
          <Ionicons name="information-circle-outline" size={14} color="#7C3AED" />
          <Text style={sc.optionalText}>
            This step is optional — you can complete it anytime from your
            profile settings.
          </Text>
        </View>

        {/* ── Progress bar ── */}
        <View style={sc.progressTrack}>
          <Animated.View style={[sc.progressFill, { width: progressWidth }]} />
        </View>

        {/* ── Step indicator ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </View>

        {/* ── Step content ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={sc.scrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ transform: [{ translateX: slideX }] }}>
              {step === 0 && (
                <BirthdayStep
                  form={form}
                  setField={setField}
                  error={errors.dob}
                />
              )}
              {step === 1 && (
                <GenderStep
                  value={form.actualGender}
                  onChange={(v) => setField("actualGender", v)}
                  error={errors.actualGender}
                />
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Footer ── */}
        <View style={sc.footer}>
          <TrustBar />
          <TouchableOpacity
            style={[sc.nextBtn, loading && sc.nextBtnDisabled]}
            onPress={handleNext}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={sc.nextBtnText}>Saving…</Text>
            ) : (
              <View style={sc.nextBtnInner}>
                <Text style={sc.nextBtnText}>
                  {step < TOTAL_STEPS - 1 ? "Continue" : "Submit & Verify"}
                </Text>
                <Ionicons
                  name={
                    step < TOTAL_STEPS - 1
                      ? "arrow-forward"
                      : "checkmark-circle-outline"
                  }
                  size={16}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>

          {/* ── Secondary skip link ── */}
          <TouchableOpacity
            onPress={onSkip}
            style={sc.skipLinkWrap}
            activeOpacity={0.7}
          >
            <Text style={sc.skipLinkText}>Skip for now — I'll do this later</Text>
          </TouchableOpacity>
        </View>
      </ScreenRoot>
    </ReusableScreen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — SCREEN
// ─────────────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    ...(IS_WEB && ({ cursor: "pointer" } as any)),
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 11.5, color: "#94A3B8", marginTop: 1 },

  // ── Visible orange "Maybe Later" button ──
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    ...(IS_WEB && ({ cursor: "pointer" } as any)),
  },
  skipText: { fontSize: 13, color: "#F97316", fontWeight: "700" },

  optionalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#F5F3FF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  optionalText: {
    flex: 1,
    fontSize: 12,
    color: "#5B21B6",
    lineHeight: 17,
  },

  progressTrack: { height: 3, backgroundColor: "#E2E8F0" },
  progressFill: { height: 3, backgroundColor: "#F97316", borderRadius: 2 },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 20, flexGrow: 1 },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 10,
  },
  nextBtn: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    ...(IS_WEB && ({
      boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
      cursor: "pointer",
    } as any)),
  },
  nextBtnDisabled: { opacity: 0.65 },
  nextBtnInner: { flexDirection: "row", alignItems: "center" },
  nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  skipLinkWrap: {
    alignItems: "center",
    paddingVertical: 4,
    ...(IS_WEB && ({ cursor: "pointer" } as any)),
  },
  skipLinkText: {
    fontSize: 12.5,
    color: "#94A3B8",
    textDecorationLine: "underline",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STEP STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  stepSub: {
    fontSize: 13.5,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 24,
  },
  errText: { fontSize: 12, color: "#E53935" },
  dobGrid: { flexDirection: "row", gap: 8 },
  fieldLabel: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  agePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  ageText: { fontSize: 13, color: "#334155" },
  ageBold: { fontWeight: "800", color: "#EA6D0E" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  infoText: { flex: 1, fontSize: 12.5, color: "#9A3412", lineHeight: 18 },
});

export default CompleteProfileScreen;
