import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import ReusableScreen from "@/components/ReusableScreen";
import { GlobalContext } from "@/context";
import { db, storage } from "@/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type PollType = "single" | "multiple";

interface Aspirant {
  id: string;
  name: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generatePollId = () =>
  `POLL_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const pad2 = (n: number) => n.toString().padStart(2, "0");
const toDateInputValue = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeInputValue = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const AVATAR_PALETTE = ["#1F9F4E", "#2563EB", "#D97706", "#7C3AED", "#DB2777", "#0D9488", "#DC2626", "#0891B2"];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatePollScreen() {
  const { userName, rawUserEmail } = useContext(GlobalContext);
  const scrollRef = React.useRef<ScrollView>(null);

  const [title, setTitle] = useState("");
  const [pollType, setPollType] = useState<PollType>("single");
  const [aspirants, setAspirants] = useState<Aspirant[]>([
    { id: "1", name: "", email: "" },
    { id: "2", name: "", email: "" },
  ]);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Logo
  const [logoUri, setLogoUri] = useState<string | null>(null);       // local preview URI
  const [logoUrl, setLogoUrl] = useState<string>("");                 // uploaded download URL
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Inline deadline picker
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(new Date());

  // Post-publish success state
  const [publishedTitle, setPublishedTitle] = useState<string | null>(null);

  // ── Aspirant helpers ────────────────────────────────────────────────────────

  const addAspirant = () => {
    if (aspirants.length >= 10) return;
    setAspirants((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", email: "" },
    ]);
  };

  const removeAspirant = (id: string) => {
    if (aspirants.length <= 2) return;
    setAspirants((prev) => prev.filter((a) => a.id !== id));
  };

  const updateAspirant = (id: string, field: "name" | "email", value: string) => {
    setAspirants((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // ── Logo picker ─────────────────────────────────────────────────────────────

  const pickLogo = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photo library to add a logo."
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setLogoUri(asset.uri);
    setUploadingLogo(true);

    try {
      // Convert URI → blob (works on native + web)
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const ext = asset.uri.split(".").pop()?.split("?")[0] ?? "jpg";
      const storagePath = `poll_logos/${rawUserEmail}/${generatePollId()}.${ext}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      setLogoUrl(downloadUrl);
    } catch (err) {
      console.error("Logo upload failed:", err);
      Alert.alert("Upload failed", "Could not upload the image. Please try again.");
      setLogoUri(null);
      setLogoUrl("");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setLogoUri(null);
    setLogoUrl("");
  };

  // ── Deadline picker ─────────────────────────────────────────────────────────

  const openDeadlinePicker = () => {
    setPendingDate(deadline ?? new Date());
    setShowDeadlinePicker(true);
  };

  const confirmDeadline = () => {
    setDeadline(pendingDate);
    setShowDeadlinePicker(false);
  };

  const cancelDeadline = () => setShowDeadlinePicker(false);

  const handleNativeDateTimeChange = (_e: any, date?: Date) => {
    if (date) setPendingDate(date);
  };

  const handleAndroidDateChange = (_e: any, date?: Date) => {
    if (!date) return;
    setPendingDate((prev) => {
      const m = new Date(prev);
      m.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      return m;
    });
  };

  const handleAndroidTimeChange = (_e: any, time?: Date) => {
    if (!time) return;
    setPendingDate((prev) => {
      const m = new Date(prev);
      m.setHours(time.getHours(), time.getMinutes(), 0);
      return m;
    });
  };

  const handleWebDateChange = (e: any) => {
    const val = e.target.value;
    if (!val) return;
    const [y, mo, d] = val.split("-").map(Number);
    setPendingDate((prev) => {
      const m = new Date(prev);
      m.setFullYear(y, mo - 1, d);
      return m;
    });
  };

  const handleWebTimeChange = (e: any) => {
    const val = e.target.value;
    if (!val) return;
    const [h, min] = val.split(":").map(Number);
    setPendingDate((prev) => {
      const m = new Date(prev);
      m.setHours(h, min, 0);
      return m;
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const duplicateEmails = aspirants
    .map((a) => a.email.trim().toLowerCase())
    .filter((e, i, arr) => e && arr.indexOf(e) !== i);

  const isFormValid =
    title.trim().length > 0 &&
    !uploadingLogo &&
    aspirants.every((a) => a.name.trim().length > 0 && isValidEmail(a.email)) &&
    duplicateEmails.length === 0;

  // ── Derived progress (UI only) ──────────────────────────────────────────────

  const aspirantsValidCount = aspirants.filter(
    (a) => a.name.trim().length > 0 && isValidEmail(a.email)
  ).length;

  // ── Publish ─────────────────────────────────────────────────────────────────
  //
  // Writes to:
  //   CREATOR_DB/{creatorEmail}
  //   POLL_TITLE_DB/{creatorEmail}/polls/{pollId}
  //   ASPIRANTS_DETAILS_DB/{creatorEmail}/{pollId}/{aspirantEmail}

  const handlePublish = async () => {
    if (!isFormValid || !rawUserEmail) return;
    setPublishing(true);

    try {
      const creatorEmail = rawUserEmail;
      const now = new Date();

      // 1. Upsert creator in CREATOR_DB
      const creatorRef = doc(db, "CREATOR_DB", creatorEmail);
      const creatorSnap = await getDoc(creatorRef);
      if (!creatorSnap.exists()) {
        await setDoc(creatorRef, {
          name: userName || "Unknown",
          email: creatorEmail,
          status: "active",
          createdAt: serverTimestamp(),
          dateCreated: now.toLocaleDateString(),
          timeCreated: now.toLocaleTimeString(),
        });
      }

      // 2. Verify creator is active
      const latestSnap = await getDoc(creatorRef);
      if (latestSnap.data()?.status !== "active") {
        Alert.alert("Account inactive", "Your creator account is not active.");
        return;
      }

      // 3. Generate poll ID
      const pollId = generatePollId();

      // 4. Save poll → POLL_TITLE_DB/{creatorEmail}/polls/{pollId}
      await setDoc(doc(db, "POLL_TITLE_DB", creatorEmail, "polls", pollId), {
        pollId,
        title: title.trim(),
        pollType,
        isAnonymous,
        showResults,
        logoUrl,                                         // "" if no logo chosen
        deadline: deadline ? deadline.toISOString() : null,
        status: "active",
        creatorEmail,
        creatorName: userName || "Unknown",
        aspirantCount: aspirants.length,
        createdAt: serverTimestamp(),
        dateCreated: now.toLocaleDateString(),
        timeCreated: now.toLocaleTimeString(),
      });

      // 5. Save aspirants → ASPIRANTS_DETAILS_DB/{creatorEmail}/{pollId}/{aspirantEmail}
      //    votes always start at 0; use increment() for all future updates.
      // 5. Save aspirants → ASPIRANTS_DETAILS_DB/{creatorEmail}/{pollId}/{aspirantEmail}
      await Promise.all(
        aspirants.map((aspirant) => {
          const aspirantEmail = aspirant.email.trim().toLowerCase();
          return setDoc(
            doc(db, "ASPIRANTS_DETAILS_DB", creatorEmail, pollId, aspirantEmail),
            {
              name: aspirant.name.trim(),
              email: aspirantEmail,
              photo: "",
              votes: 0,
              lastVotedAt: null,          // ← ADDED: initialised to null
              pollId,
              creatorEmail,
              addedAt: serverTimestamp(),
            }
          );
        })
      );

      setPublishedTitle(title.trim());
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      console.error("Publish failed:", err);
      Alert.alert("Error", "Failed to publish poll. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const handleViewPoll = () => {
    router.navigate("./PollsListScreen");
  };

  const handleDone = () => {
    router.navigate("./members_list");
  };

  // ── UI ───────────────────────────────────────────────────────────────────────

  return (
    <ReusableScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.navigate("./members_list")}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={18} color="#1F9F4E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create a Poll</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {publishedTitle && (
            <View style={styles.successBanner}>
              <View style={styles.successHeaderRow}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={22} color="#1F9F4E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Poll published!</Text>
                  <Text style={styles.successDesc} numberOfLines={1}>
                    "{publishedTitle}" is now live.
                  </Text>
                </View>
              </View>

              {/* Two-in-one segmented button */}
              <View style={styles.segmentedBtn}>
                <TouchableOpacity
                  style={styles.segmentLeft}
                  onPress={handleViewPoll}
                  activeOpacity={0.85}
                >
                  <Ionicons name="eye-outline" size={14} color="#fff" />
                  <Text style={styles.segmentLeftText}>VIEW POLL</Text>
                </TouchableOpacity>
                <View style={styles.segmentDivider} />
                <TouchableOpacity
                  style={styles.segmentRight}
                  onPress={handleDone}
                  activeOpacity={0.85}
                >
                  <Text style={styles.segmentRightText}>DONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Poll details card ── */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#EAF6EE" }]}>
                <Ionicons name="document-text-outline" size={15} color="#1F9F4E" />
              </View>
              <Text style={styles.sectionLabel}>Poll details</Text>
            </View>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HTU-SRC Presidential Poll, 2026"
              placeholderTextColor="#a1a1a1ff"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              Logo <Text style={styles.optional}>(Optional)</Text>
            </Text>

            {/* Logo preview */}
            {logoUri ? (
              <View style={styles.logoPreviewWrap}>
                <Image source={{ uri: logoUri }} style={styles.logoPreview} resizeMode="cover" />
                {uploadingLogo && (
                  <View style={styles.logoUploadOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.logoUploadText}>Uploading…</Text>
                  </View>
                )}
                {!uploadingLogo && (
                  <TouchableOpacity style={styles.logoRemoveBtn} onPress={removeLogo}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.logoRow} onPress={pickLogo} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={18} color="#1F9F4E" />
                <Text style={styles.logoText}>Tap to add logo or banner image</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Poll type card ── */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#EAF6EE" }]}>
                <Ionicons name="options-outline" size={15} color="#1F9F4E" />
              </View>
              <Text style={styles.sectionLabel}>Poll type</Text>
            </View>

            <TouchableOpacity
              style={[styles.radioRow, pollType === "single" && styles.radioRowActive]}
              onPress={() => setPollType("single")}
              activeOpacity={0.8}
            >
              <View style={styles.radioOuter}>
                {pollType === "single" && <View style={styles.radioInner} />}
              </View>
              <View style={styles.radioText}>
                <Text style={[styles.radioTitle, pollType === "single" && styles.radioTitleActive]}>
                  Single-Vote
                </Text>
                <Text style={styles.radioDesc}>Each voter casts exactly one vote.</Text>
              </View>
              {pollType === "single" && (
                <Ionicons name="checkmark-circle" size={18} color="#1F9F4E" />
              )}
            </TouchableOpacity>

            <View style={styles.dividerThin} />

            <TouchableOpacity
              style={[styles.radioRow, pollType === "multiple" && styles.radioRowActive]}
              onPress={() => setPollType("multiple")}
              activeOpacity={0.8}
            >
              <View style={styles.radioOuter}>
                {pollType === "multiple" && <View style={styles.radioInner} />}
              </View>
              <View style={styles.radioText}>
                <Text style={[styles.radioTitle, pollType === "multiple" && styles.radioTitleActive]}>
                  Multiple-Voting
                </Text>
                <Text style={styles.radioDesc}>Each voter can vote for more than one aspirant.</Text>
              </View>
              {pollType === "multiple" && (
                <Ionicons name="checkmark-circle" size={18} color="#1F9F4E" />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Aspirants card ── */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#EAF6EE" }]}>
                <Ionicons name="people-outline" size={15} color="#1F9F4E" />
              </View>
              <Text style={styles.sectionLabel}>Aspirants</Text>
              <View style={styles.aspirantProgressPill}>
                <Text style={styles.aspirantProgressText}>
                  {aspirantsValidCount}/{aspirants.length} ready
                </Text>
              </View>
            </View>
            <Text style={styles.fieldHint}>
              Add candidates with their name and email (min 2, max 10)
            </Text>

            {aspirants.map((asp, index) => {
              const nameOk = asp.name.trim().length > 0;
              const emailOk = isValidEmail(asp.email);
              const isDup = duplicateEmails.includes(asp.email.trim().toLowerCase());
              const aspirantComplete = nameOk && emailOk && !isDup;
              const avatarColor = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

              return (
                <View
                  key={asp.id}
                  style={[styles.aspirantCard, aspirantComplete && styles.aspirantCardComplete]}
                >
                  <View style={styles.aspirantHeaderRow}>
                    <View style={[styles.optionIndex, { backgroundColor: avatarColor }]}>
                      <Text style={styles.optionIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.aspirantLabel}>Aspirant {index + 1}</Text>
                    {aspirantComplete && (
                      <Ionicons name="checkmark-circle" size={16} color="#1F9F4E" />
                    )}
                    {aspirants.length > 2 && (
                      <TouchableOpacity
                        onPress={() => removeAspirant(asp.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#d1d5db" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.subFieldLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. John Mensah"
                    placeholderTextColor="#b0b0b0"
                    value={asp.name}
                    onChangeText={(t) => updateAspirant(asp.id, "name", t)}
                    maxLength={80}
                    returnKeyType="next"
                  />

                  <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>Email Address *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      asp.email.trim() && !isValidEmail(asp.email) && styles.inputError,
                      isDup && styles.inputError,
                    ]}
                    placeholder="e.g. john@example.com"
                    placeholderTextColor="#b0b0b0"
                    value={asp.email}
                    onChangeText={(t) => updateAspirant(asp.id, "email", t)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    maxLength={120}
                    returnKeyType="next"
                  />
                  {asp.email.trim() && !isValidEmail(asp.email) && (
                    <Text style={styles.errorText}>Invalid email address</Text>
                  )}
                  {isDup && (
                    <Text style={styles.errorText}>
                      Duplicate — each aspirant must have a unique email
                    </Text>
                  )}
                </View>
              );
            })}

            {aspirants.length < 10 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={addAspirant}>
                <Ionicons name="add-circle-outline" size={16} color="#1F9F4E" />
                <Text style={styles.addOptionText}>Add aspirant</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Settings card ── */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#EAF6EE" }]}>
                <Ionicons name="settings-outline" size={15} color="#1F9F4E" />
              </View>
              <Text style={styles.sectionLabel}>Settings</Text>
            </View>

            <Text style={styles.fieldLabel}>
              Voting deadline <Text style={styles.optional}>(Optional)</Text>
            </Text>

            <TouchableOpacity
              style={[styles.deadlineRow, deadline ? styles.deadlineRowActive : null]}
              onPress={openDeadlinePicker}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color="#1F9F4E" />
              <Text style={[styles.deadlineText, deadline ? styles.deadlineTextActive : null]}>
                {deadline ? deadline.toLocaleString() : "Set end date & time"}
              </Text>
              {deadline && (
                <TouchableOpacity
                  onPress={() => setDeadline(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Inline deadline picker */}
            {showDeadlinePicker && (
              <View style={styles.inlinePickerBox}>
                <Text style={styles.inlinePickerPreview}>
                  {pendingDate.toLocaleString()}
                </Text>

                {Platform.OS === "ios" && (
                  <DateTimePicker
                    value={pendingDate}
                    mode="datetime"
                    display="spinner"
                    onChange={handleNativeDateTimeChange}
                    minimumDate={new Date()}
                    style={{ width: "100%" }}
                  />
                )}

                {Platform.OS === "android" && (
                  <View style={styles.androidPickersRow}>
                    <DateTimePicker
                      value={pendingDate}
                      mode="date"
                      display="spinner"
                      onChange={handleAndroidDateChange}
                      minimumDate={new Date()}
                      style={styles.androidSpinner}
                    />
                    <DateTimePicker
                      value={pendingDate}
                      mode="time"
                      display="spinner"
                      onChange={handleAndroidTimeChange}
                      style={styles.androidSpinner}
                    />
                  </View>
                )}

                {Platform.OS === "web" && (
                  <View style={styles.webPickersRow}>
                    <input
                      type="date"
                      value={toDateInputValue(pendingDate)}
                      min={toDateInputValue(new Date())}
                      onChange={handleWebDateChange}
                      style={webInputStyle}
                    />
                    <input
                      type="time"
                      value={toTimeInputValue(pendingDate)}
                      onChange={handleWebTimeChange}
                      style={webInputStyle}
                    />
                  </View>
                )}

                <View style={styles.inlinePickerActions}>
                  <TouchableOpacity onPress={cancelDeadline} style={styles.inlineCancelBtn}>
                    <Text style={styles.inlineCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmDeadline} style={styles.inlineDoneBtn}>
                    <Text style={styles.inlineDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.dividerThin} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleIconWrap}>
                <Ionicons name="eye-off-outline" size={15} color="#6b7280" />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Anonymous voting</Text>
                <Text style={styles.toggleDesc}>
                  Voter identities will be hidden from results.
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: "#e5e7eb", true: "#A2E0B8" }}
                thumbColor={isAnonymous ? "#1F9F4E" : "#9ca3af"}
              />
            </View>

            <View style={styles.dividerThin} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleIconWrap}>
                <Ionicons name="stats-chart-outline" size={15} color="#6b7280" />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Show live results</Text>
                <Text style={styles.toggleDesc}>
                  Voters can see results as voting progresses.
                </Text>
              </View>
              <Switch
                value={showResults}
                onValueChange={setShowResults}
                trackColor={{ false: "#e5e7eb", true: "#A2E0B8" }}
                thumbColor={showResults ? "#1F9F4E" : "#9ca3af"}
              />
            </View>
          </View>

          {/* ── Publish ── */}
          <TouchableOpacity
            style={[
              styles.publishBtn,
              (!isFormValid || publishing) && styles.publishBtnDisabled,
            ]}
            onPress={handlePublish}
            activeOpacity={0.85}
            disabled={!isFormValid || publishing}
          >
            {publishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="how-to-vote" size={18} color="#fff" />
                <Text style={styles.publishText}>Publish Poll</Text>
              </>
            )}
          </TouchableOpacity>

          {!isFormValid && !publishing && (
            <Text style={styles.validationHint}>
              Fill in all required fields to enable publishing.
            </Text>
          )}

          <Text style={styles.footerNote}>
            Once published, the poll will be visible to all community members.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ReusableScreen>
  );
}

// ─── Web-only datetime input style ───────────────────────────────────────────

const webInputStyle: any = {
  flex: 1,
  fontSize: 15,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  backgroundColor: "#fff",
  color: "#1a1a1a",
  outline: "none",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f6f8" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a", letterSpacing: -0.2 },

  scroll: { flex: 1, backgroundColor: "#e2e1e1ff", margin: 5, },
  scrollContent: { paddingHorizontal: 4, paddingTop: 5, paddingBottom: 40 },

  // Section cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 6,
    borderWidth: 1.4,
    borderColor: "#d9dad9ff",
    marginBottom: 5,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F9F4E",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  aspirantProgressPill: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  aspirantProgressText: { fontSize: 13, fontWeight: "700", color: "#6b7280" },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  subFieldLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 5 },
  optional: { fontWeight: "400", color: "#9ca3af" },
  fieldHint: { fontSize: 12, color: "#9ca3af", marginBottom: 12, marginTop: -8 },

  input: {
    borderWidth: 1,
    borderColor: "#e0e1e3ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1a1a1a",
    backgroundColor: "#f0f1f2ff",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  inputError: { borderColor: "#ef4444", backgroundColor: "#fff5f5" },
  errorText: { fontSize: 13, color: "#ef4444", marginTop: 4, marginLeft: 2 },

  // Logo
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#A2E0B8",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#EAF6EE",
  },
  logoText: { fontSize: 13, color: "#1F9F4E" },
  logoPreviewWrap: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    height: 160,
    backgroundColor: "#f3f4f6",
  },
  logoPreview: { width: "100%", height: "100%" },
  logoUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoUploadText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  logoRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },

  // Radio
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  radioRowActive: { backgroundColor: "#EAF6EE" },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1F9F4E",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1F9F4E" },
  radioText: { flex: 1 },
  radioTitle: { fontSize: 15, fontWeight: "600", color: "#374151" },
  radioTitleActive: { color: "#1F9F4E" },
  radioDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  // Aspirants
  aspirantCard: {
    borderWidth: 1,
    borderColor: "#eef0f2",
    backgroundColor: "#fafbfc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  aspirantCardComplete: { borderColor: "#cdeed9", backgroundColor: "#fbfffc" },
  aspirantHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  aspirantLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: "#374151" },
  optionIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIndexText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  addOptionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4, justifyContent: "center" },
  addOptionText: { fontSize: 13, color: "#1F9F4E", fontWeight: "600" },

  // Deadline
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  deadlineRowActive: { borderColor: "#1F9F4E", backgroundColor: "#EAF6EE" },
  deadlineText: { flex: 1, fontSize: 14, color: "#9ca3af" },
  deadlineTextActive: { color: "#1F9F4E", fontWeight: "500" },

  // Inline picker
  inlinePickerBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  inlinePickerPreview: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F9F4E",
    textAlign: "center",
    marginBottom: 8,
  },
  androidPickersRow: { flexDirection: "row", justifyContent: "center" },
  androidSpinner: { flex: 1 },
  webPickersRow: { flexDirection: "row", gap: 10 },
  inlinePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 10,
  },
  inlineCancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  inlineCancelText: { fontSize: 14, fontWeight: "500", color: "#9ca3af" },
  inlineDoneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1F9F4E",
  },
  inlineDoneText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Toggles
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  toggleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  toggleDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  // Success banner + segmented button
  successBanner: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cdeed9",
    padding: 14,
    marginBottom: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: "#1F9F4E", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
      default: { boxShadow: "0 1px 4px rgba(31,159,78,0.08)" } as any,
    }),
  },
  successHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  successIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF6EE",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 14.5, fontWeight: "700", color: "#1a1a1a" },
  successDesc: { fontSize: 12.5, color: "#6b7280", marginTop: 1 },

  segmentedBtn: {
    flexDirection: "row",
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
  },
  segmentLeft: {
    flex: 1.3,
    backgroundColor: "#1F9F4E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentLeftText: { color: "#fff", fontWeight: "700", fontSize: 12.5, letterSpacing: 0.3 },
  segmentDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  segmentRight: {
    flex: 1,
    backgroundColor: "#17803F",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentRightText: { color: "#fff", fontWeight: "700", fontSize: 12.5, letterSpacing: 0.3 },

  dividerThin: { height: 0.5, backgroundColor: "#f3f4f6", marginVertical: 2 },

  // Publish
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1F9F4E",
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 10,
    shadowColor: "#1F9F4E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  publishBtnDisabled: { backgroundColor: "#d1d5db", shadowOpacity: 0, elevation: 0 },
  publishText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  validationHint: {
    fontSize: 12,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 10,
  },
  footerNote: {
    fontSize: 13,
    color: "#000",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
