import React, { useEffect, useState, useRef } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Appbar,
  Chip,
  TextInput,
  Button,
  Avatar,
  Text,
  useTheme,
  Surface,
} from "react-native-paper";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { colors, m3Shapes } from "../../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface Session {
  id: string;
  eventId: string;
  title: string;
  room?: { name: string };
}

interface Question {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  upvotes: number;
  user?: { id: string; fullName: string };
  votes?: { userId: string }[];
  createdAt: string;
}

export default function LiveQAScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [votedQuestionIds, setVotedQuestionIds] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Load active events & user tickets
  const loadEventAndAttendance = async () => {
    try {
      const [eventsRes, ticketsRes] = await Promise.all([
        api.getEvents(),
        api.getMyTickets(),
      ]);

      const loadedEvents = eventsRes?.events || [];
      const loadedTickets = ticketsRes?.tickets || [];
      setEvents(loadedEvents);
      setUserTickets(loadedTickets);

      if (loadedEvents.length > 0) {
        const ev = loadedEvents[0];
        setSelectedEvent(ev);
        if (ev.sessions && ev.sessions.length > 0) {
          setSelectedSession(ev.sessions[0]);
        }
      }
    } catch (err: any) {
      console.warn("Load event error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventAndAttendance();
  }, []);

  const matchingTicket = userTickets.find(
    (t) => t.eventId === selectedEvent?.id
  );
  const isCheckedIn = matchingTicket?.status === "CHECKED_IN";
  const hasTicket = Boolean(matchingTicket);

  // 2. Fetch questions for current session
  const fetchQuestions = async (sessionId: string) => {
    try {
      const res = await api.getSessionQuestions(sessionId);
      if (res?.questions) {
        setQuestions(res.questions);

        if (user?.id) {
          const userVoted = res.questions
            .filter((q: any) =>
              q.votes?.some((v: any) => v.userId === user.id)
            )
            .map((q: any) => q.id);
          setVotedQuestionIds(userVoted);
        }
      }
    } catch (err: any) {
      console.warn("Fetch questions error:", err.message);
    }
  };

  useEffect(() => {
    if (selectedSession?.id) {
      fetchQuestions(selectedSession.id);
    }
  }, [selectedSession]);

  // 3. Connect realtime WebSocket
  useEffect(() => {
    if (!selectedSession?.id) return;

    try {
      const wsUrl = api.getWebSocketUrl("/ws/qa");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "JOIN_SESSION", sessionId: selectedSession.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "NEW_QUESTION" && data.question) {
            setQuestions((prev) => [data.question, ...prev]);
          } else if (data.type === "QUESTION_UPVOTED") {
            setQuestions((prev) =>
              prev.map((q) =>
                q.id === data.questionId ? { ...q, upvotes: data.upvotes } : q
              )
            );
          }
        } catch {}
      };

      return () => {
        ws.close();
      };
    } catch (err) {
      console.warn("WebSocket init error:", err);
    }
  }, [selectedSession?.id]);

  const handlePostQuestion = async () => {
    if (!content.trim() || !selectedSession?.id) return;
    if (!isCheckedIn) {
      Alert.alert(
        "Yêu cầu Điểm danh",
        "Bạn cần quét mã vé tại cổng để mở quyền đặt câu hỏi trực tiếp trên màn hình."
      );
      return;
    }

    setSubmitting(true);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "POST_QUESTION",
          sessionId: selectedSession.id,
          content: content.trim(),
          userName: user?.fullName || "Khách tham dự",
        })
      );
      setContent("");
      setSubmitting(false);
    } else {
      try {
        await api.postQuestion(selectedSession.id, user?.id || "guest", content.trim());
        setContent("");
        await fetchQuestions(selectedSession.id);
      } catch (err: any) {
        Alert.alert("Lỗi gửi câu hỏi", err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleToggleUpvote = async (questionId: string) => {
    if (!user?.id) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để bình chọn");
      return;
    }

    const hasAlreadyVoted = votedQuestionIds.includes(questionId);

    if (hasAlreadyVoted) {
      setVotedQuestionIds((prev) => prev.filter((id) => id !== questionId));
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, upvotes: Math.max(0, q.upvotes - 1) } : q
        )
      );
    } else {
      setVotedQuestionIds((prev) => [...prev, questionId]);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, upvotes: q.upvotes + 1 } : q
        )
      );
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "UPVOTE",
          questionId,
          userId: user.id,
        })
      );
    } else {
      try {
        await api.upvoteQuestion(questionId, user.id);
      } catch {
        if (selectedSession?.id) fetchQuestions(selectedSession.id);
      }
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "K";
    const parts = name.trim().split(" ");
    return parts[parts.length - 1].slice(0, 1).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header mode="center-aligned" elevated style={styles.appbar}>
        <Appbar.Content
          title="Hỏi đáp Diễn giả"
          titleStyle={styles.appbarTitle}
          subtitle={selectedEvent?.name || "Đang tải sự kiện..."}
          subtitleStyle={styles.appbarSubtitle}
        />
      </Appbar.Header>

      {/* Attendance Gate Status Banner */}
      {!isCheckedIn && (
        <Surface style={styles.attendanceBanner} elevation={0}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text variant="bodySmall" style={styles.attendanceText}>
            {hasTicket
              ? "Cần check-in vé tại cổng để mở quyền đặt câu hỏi trực tiếp."
              : "Bạn cần có vé sự kiện đã điểm danh để tham gia đặt câu hỏi."}
          </Text>
        </Surface>
      )}

      {/* Sessions Horizontal Selector */}
      {selectedEvent?.sessions && selectedEvent.sessions.length > 0 && (
        <View style={styles.sessionsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sessionsContent}
          >
            {selectedEvent.sessions.map((s: Session) => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <Chip
                  key={s.id}
                  selected={isSelected}
                  showSelectedCheck
                  mode={isSelected ? "flat" : "outlined"}
                  onPress={() => setSelectedSession(s)}
                  style={[
                    styles.sessionChip,
                    isSelected && { backgroundColor: colors.m3.primaryContainer },
                  ]}
                  textStyle={{
                    color: isSelected ? colors.m3.onPrimaryContainer : colors.textPrimary,
                    fontWeight: isSelected ? "700" : "500",
                  }}
                >
                  {s.title}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            /* Compose Question Card */
            <Surface style={styles.composeCard} elevation={2}>
              <Text variant="titleSmall" style={styles.composeTitle}>
                {isCheckedIn ? "Gửi câu hỏi cho diễn giả" : "Khóa đặt câu hỏi"}
              </Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                editable={isCheckedIn}
                placeholder={
                  isCheckedIn
                    ? "Nhập nội dung câu hỏi thảo luận..."
                    : "Bạn cần điểm danh tại cổng để kích hoạt tính năng này..."
                }
                mode="outlined"
                outlineStyle={styles.inputOutline}
                multiline
                numberOfLines={2}
                style={styles.composeInput}
              />

              <Button
                mode="contained"
                loading={submitting}
                disabled={submitting || !isCheckedIn || !content.trim()}
                onPress={handlePostQuestion}
                icon="send"
                contentStyle={styles.submitBtnContent}
                style={styles.submitBtn}
              >
                {submitting ? "Đang gửi..." : "Gửi câu hỏi lên màn hình"}
              </Button>
            </Surface>
          }
          ListEmptyComponent={
            !loading ? (
              <Surface style={styles.emptySurface} elevation={0}>
                <Ionicons name="chatbubbles-outline" size={44} color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.emptyTitle}>
                  Chưa có câu hỏi nào
                </Text>
                <Text variant="bodySmall" style={styles.emptySubtitle}>
                  Hãy là người đầu tiên đặt câu hỏi cho diễn giả trong phiên này!
                </Text>
              </Surface>
            ) : (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const isVoted = votedQuestionIds.includes(item.id);
            return (
              <Surface style={styles.questionCard} elevation={1}>
                {/* Question Author & Content */}
                <View style={styles.questionMain}>
                  <View style={styles.authorRow}>
                    <Avatar.Text
                      size={34}
                      label={getInitials(item.user?.fullName)}
                      style={{
                        backgroundColor: isVoted
                          ? colors.m3.primaryContainer
                          : colors.m3.surfaceContainerHigh,
                      }}
                      color={isVoted ? colors.primary : colors.textPrimary}
                    />
                    <View style={styles.authorInfo}>
                      <Text variant="labelLarge" style={styles.authorName}>
                        {item.user?.fullName || "Khách tham dự"}
                      </Text>
                      <Text variant="bodySmall" style={styles.questionContent}>
                        {item.content}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Material 3 Upvote Action */}
                <Button
                  mode={isVoted ? "contained" : "contained-tonal"}
                  icon={isVoted ? "thumb-up" : "thumb-up-outline"}
                  onPress={() => handleToggleUpvote(item.id)}
                  compact
                  style={styles.upvoteBtn}
                >
                  {item.upvotes}
                </Button>
              </Surface>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appbar: {
    backgroundColor: colors.surface,
  },
  appbarTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  appbarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  attendanceBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.m3.warningContainer,
  },
  attendanceText: {
    flex: 1,
    color: colors.m3.onWarningContainer,
    fontWeight: "500",
  },
  sessionsWrapper: {
    paddingVertical: 10,
  },
  sessionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sessionChip: {
    borderRadius: m3Shapes.full,
    height: 38,
  },
  listContent: {
    padding: 16,
    paddingBottom: 48,
  },
  composeCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  composeTitle: {
    fontWeight: "700",
    marginBottom: 10,
    color: colors.textPrimary,
  },
  inputOutline: {
    borderRadius: 16,
  },
  composeInput: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  submitBtn: {
    borderRadius: m3Shapes.full,
  },
  submitBtnContent: {
    height: 48,
  },
  emptySurface: {
    padding: 36,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginTop: 12,
  },
  emptyTitle: {
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  loaderContainer: {
    paddingVertical: 36,
    alignItems: "center",
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  questionMain: {
    flex: 1,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontWeight: "700",
    marginBottom: 4,
    color: colors.textPrimary,
  },
  questionContent: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  upvoteBtn: {
    borderRadius: m3Shapes.full,
  },
});
