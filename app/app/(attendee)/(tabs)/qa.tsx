import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
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
  Card,
  Chip,
  TextInput,
  Button,
} from "react-native-paper";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { colors, shadows, m3Shapes } from "../../../src/constants/theme";
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

  // 1. Load active events & user tickets to determine attendance permission
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

  // Check attendance status for the selected event
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

        // Pre-fill user voted list
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

    // Optimistic UI update
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

    // Send through WebSocket or REST fallback
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header elevated style={styles.appbar}>
        <Appbar.Content
          title="Live Q&A"
          titleStyle={styles.appbarTitle}
          subtitle={selectedEvent?.name || "Đang tải sự kiện..."}
          subtitleStyle={styles.appbarSubtitle}
        />
      </Appbar.Header>

      {/* Subtle Attendance Notice */}
      {!isCheckedIn && (
        <View style={styles.noticeContainer}>
          <View style={styles.noticeBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text style={styles.noticeText}>
              {hasTicket ? "Cần điểm danh tại cổng để đặt câu hỏi" : "Chưa có vé sự kiện"}
            </Text>
          </View>
        </View>
      )}

      {/* Sessions Horizontal Selector */}
      {selectedEvent?.sessions && selectedEvent.sessions.length > 0 && (
        <View style={styles.sessionsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionsContent}>
            {selectedEvent.sessions.map((s: Session) => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <Chip
                  key={s.id}
                  selected={isSelected}
                  showSelectedCheck
                  mode="flat"
                  onPress={() => setSelectedSession(s)}
                  style={[
                    styles.sessionChip,
                    {
                      backgroundColor: isSelected
                        ? colors.m3.primaryContainer
                        : colors.m3.surfaceContainer,
                    },
                  ]}
                  textStyle={[
                    styles.sessionChipText,
                    {
                      color: isSelected
                        ? colors.m3.onPrimaryContainer
                        : colors.textPrimary,
                    },
                  ]}
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
            <Card mode="contained" style={[styles.askCard, shadows.card]}>
              <Card.Content>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  editable={isCheckedIn}
                  placeholder={
                    isCheckedIn
                      ? "Nhập câu hỏi của bạn cho diễn giả..."
                      : "Cần điểm danh tại cổng để nhập câu hỏi..."
                  }
                  mode="outlined"
                  outlineStyle={styles.inputOutline}
                  multiline
                  numberOfLines={2}
                  style={styles.askInput}
                />

                <Button
                  mode="contained"
                  loading={submitting}
                  disabled={submitting || !isCheckedIn}
                  onPress={handlePostQuestion}
                  icon="send"
                  contentStyle={styles.submitBtnContent}
                  style={styles.submitBtn}
                >
                  {submitting
                    ? "Đang gửi..."
                    : isCheckedIn
                    ? "Gửi câu hỏi"
                    : "Khóa (Chưa check-in)"}
                </Button>
              </Card.Content>
            </Card>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  Chưa có câu hỏi nào trong phiên này. Hãy là người đầu tiên!
                </Text>
              </View>
            ) : (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const isVoted = votedQuestionIds.includes(item.id);
            return (
              <Card mode="contained" style={[styles.questionCard, shadows.card]}>
                <Card.Content style={styles.questionCardContent}>
                  <View style={styles.questionContentCol}>
                    <Text style={styles.questionAuthor}>
                      {item.user?.fullName || "Khách tham dự"}
                    </Text>
                    <Text style={styles.questionText}>
                      {item.content}
                    </Text>
                  </View>

                  <Button
                    mode={isVoted ? "contained" : "contained-tonal"}
                    icon="arrow-up-bold"
                    onPress={() => handleToggleUpvote(item.id)}
                    compact
                    style={styles.upvoteBtn}
                  >
                    {item.upvotes}
                  </Button>
                </Card.Content>
              </Card>
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
    borderWidth: 0,
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
  noticeContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 0,
  },
  noticeText: {
    color: colors.warning,
    fontSize: 12,
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
  sessionChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  askCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 0,
  },
  inputOutline: {
    borderRadius: 16,
    borderColor: colors.neutralDark,
  },
  askInput: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  submitBtn: {
    borderRadius: m3Shapes.full,
  },
  submitBtnContent: {
    height: 48,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  loaderContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 0,
  },
  questionCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  questionContentCol: {
    flex: 1,
  },
  questionAuthor: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 11,
    marginBottom: 4,
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  upvoteBtn: {
    borderRadius: m3Shapes.full,
  },
});
