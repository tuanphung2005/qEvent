import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { Button } from "../../../src/components/Button";
import { colors, shadows, m3Shapes, m3Ripples } from "../../../src/constants/theme";
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
      {/* Top Header Bar */}
      <View style={[styles.headerBar, shadows.subtle]}>
        <View>
          <Text style={styles.headerTitle}>Live Q&A</Text>
          <Text style={styles.headerSubtitle}>
            {selectedEvent?.name || "Đang tải sự kiện..."}
          </Text>
        </View>
      </View>

      {/* Subtle Attendance Notice only when action is restricted */}
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
                <View
                  key={s.id}
                  style={[
                    styles.sessionChipWrapper,
                    shadows.subtle,
                    { backgroundColor: isSelected ? colors.primary : colors.surface },
                  ]}
                >
                  <Pressable
                    onPress={() => setSelectedSession(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn phiên thảo luận ${s.title}`}
                    accessibilityState={{ selected: isSelected }}
                    android_ripple={isSelected ? m3Ripples.dark : m3Ripples.light}
                    style={styles.sessionChipPressable}
                  >
                    <Text
                      style={[
                        styles.sessionChipTitle,
                        { color: isSelected ? colors.white : colors.textPrimary },
                        isSelected && { fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    {s.room?.name && (
                      <Text
                        style={[
                          styles.sessionChipRoom,
                          { color: isSelected ? colors.white : colors.textSecondary },
                        ]}
                      >
                        {s.room.name}
                      </Text>
                    )}
                  </Pressable>
                </View>
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
            <View style={[styles.askCard, shadows.card]}>
              <TextInput
                value={content}
                onChangeText={setContent}
                editable={isCheckedIn}
                placeholder={
                  isCheckedIn
                    ? "Nhập câu hỏi của bạn cho diễn giả..."
                    : "Cần điểm danh tại cổng để nhập câu hỏi..."
                }
                placeholderTextColor={colors.textMuted}
                multiline
                accessibilityLabel="Nội dung câu hỏi gửi diễn giả"
                style={[
                  styles.askInput,
                  {
                    backgroundColor: isCheckedIn ? colors.neutralFill : colors.background,
                  },
                ]}
              />

              <Button
                title={
                  submitting
                    ? "Đang gửi..."
                    : isCheckedIn
                    ? "Gửi câu hỏi"
                    : "Khóa (Chưa check-in)"
                }
                variant={isCheckedIn ? "primary" : "secondary"}
                loading={submitting}
                disabled={submitting || !isCheckedIn}
                onPress={handlePostQuestion}
                icon={
                  !submitting ? (
                    <Ionicons
                      name="send"
                      size={16}
                      color={isCheckedIn ? colors.white : colors.textSecondary}
                    />
                  ) : undefined
                }
              />
            </View>
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
              <View style={[styles.questionCard, shadows.card]}>
                <View style={styles.questionContentCol}>
                  <Text style={styles.questionAuthor}>
                    {item.user?.fullName || "Khách tham dự"}
                  </Text>
                  <Text style={styles.questionText}>
                    {item.content}
                  </Text>
                </View>

                {/* Single toggleable upvote button */}
                <View
                  style={[
                    styles.upvoteBtnWrapper,
                    {
                      backgroundColor: isVoted ? colors.primary : colors.primaryLight,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => handleToggleUpvote(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Bình chọn câu hỏi, hiện có ${item.upvotes} lượt bình chọn`}
                    accessibilityState={{ selected: isVoted }}
                    android_ripple={isVoted ? m3Ripples.dark : m3Ripples.light}
                    style={styles.upvotePressable}
                  >
                    <Ionicons
                      name="caret-up"
                      size={18}
                      color={isVoted ? colors.white : colors.primary}
                    />
                    <Text
                      style={[
                        styles.upvoteCount,
                        { color: isVoted ? colors.white : colors.primary },
                      ]}
                    >
                      {item.upvotes}
                    </Text>
                  </Pressable>
                </View>
              </View>
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
  headerBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
    borderRadius: m3Shapes.sm,
    borderWidth: 0,
  },
  noticeText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "500",
  },
  sessionsWrapper: {
    paddingVertical: 8,
  },
  sessionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sessionChipWrapper: {
    borderRadius: m3Shapes.sm,
    borderWidth: 0,
    overflow: "hidden",
  },
  sessionChipPressable: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
  },
  sessionChipTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  sessionChipRoom: {
    fontSize: 10,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  askCard: {
    backgroundColor: colors.surface,
    borderRadius: m3Shapes.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
  },
  askInput: {
    borderRadius: m3Shapes.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    minHeight: 52,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: "top",
    borderWidth: 0,
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
    borderRadius: m3Shapes.lg,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 0,
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
  upvoteBtnWrapper: {
    borderRadius: m3Shapes.sm,
    borderWidth: 0,
    overflow: "hidden",
  },
  upvotePressable: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upvoteCount: {
    fontWeight: "700",
    fontSize: 12,
  },
});
