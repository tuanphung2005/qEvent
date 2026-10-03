import React, { useEffect, useState, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Pressable,
  Input,
  InputField,
  Button,
  ButtonText,
  ButtonIcon,
  ButtonSpinner,
  Badge,
  BadgeText,
  Center,
  Spinner,
} from "@gluestack-ui/themed";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { colors, shadows } from "../../../src/constants/theme";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {/* Gluestack Clean Header - Realtime chip removed */}
      <HStack
        bg={colors.surface}
        px="$5"
        py="$3.5"
        alignItems="center"
        justifyContent="space-between"
        style={shadows.subtle}
      >
        <VStack>
          <Heading size="md" color={colors.textPrimary}>
            Live Q&A
          </Heading>
          <Text color={colors.textSecondary} fontSize="$xs">
            {selectedEvent?.name || "Đang tải sự kiện..."}
          </Text>
        </VStack>
      </HStack>

      {/* Subtle Attendance Notice only when action is restricted */}
      {!isCheckedIn && (
        <Box px="$4" pt="$2.5" pb="$1">
          <HStack space="xs" alignItems="center" bg={colors.warningLight} px="$3" py="$2" borderRadius={10}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text color={colors.warning} fontSize="$xs" fontWeight="$medium">
              {hasTicket ? "Cần điểm danh tại cổng để đặt câu hỏi" : "Chưa có vé sự kiện"}
            </Text>
          </HStack>
        </Box>
      )}

      {/* Sessions Horizontal Selector */}
      {selectedEvent?.sessions && selectedEvent.sessions.length > 0 && (
        <Box px="$4" pt="$2" pb="$2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="sm">
              {selectedEvent.sessions.map((s: Session) => {
                const isSelected = selectedSession?.id === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSession(s)}
                    bg={isSelected ? colors.primary : colors.surface}
                    px="$4"
                    py="$2.5"
                    borderRadius={12}
                    borderWidth={0}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn phiên thảo luận ${s.title}`}
                    accessibilityState={{ selected: isSelected }}
                    sx={{
                      minHeight: 48,
                      justifyContent: "center",
                      ":active": { opacity: 0.8 },
                    }}
                    style={[{ minHeight: 48, justifyContent: "center" }, shadows.subtle]}
                  >
                    <Text
                      color={isSelected ? colors.white : colors.textPrimary}
                      fontSize="$xs"
                      fontWeight={isSelected ? "$bold" : "$normal"}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    {s.room?.name && (
                      <Text
                        color={isSelected ? colors.white : colors.textSecondary}
                        fontSize="$2xs"
                        mt="$0.5"
                      >
                        {s.room.name}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </HStack>
          </ScrollView>
        </Box>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <Box
              bg={colors.surface}
              borderRadius={18}
              p="$4"
              mb="$4"
              borderWidth={0}
              style={shadows.card}
            >
              <Input
                size="md"
                variant="underlined"
                borderWidth={0}
                borderBottomWidth={0}
                borderRadius={12}
                bg={isCheckedIn ? colors.neutralFill : colors.background}
                px="$3.5"
                py="$2"
                mb="$3"
                sx={{
                  minHeight: 48,
                  borderWidth: 0,
                  borderBottomWidth: 0,
                }}
              >
                <InputField
                  value={content}
                  onChangeText={setContent}
                  editable={isCheckedIn}
                  placeholder={
                    isCheckedIn
                      ? "Nhập câu hỏi của bạn cho diễn giả..."
                      : "Cần điểm danh tại cổng để nhập câu hỏi..."
                  }
                  placeholderTextColor={colors.textMuted}
                  color={colors.textPrimary}
                  fontSize="$sm"
                  multiline
                  accessibilityLabel="Nội dung câu hỏi gửi diễn giả"
                />
              </Input>

              <Button
                size="md"
                bg={isCheckedIn ? colors.primary : colors.neutralDark}
                borderRadius={12}
                borderWidth={0}
                isDisabled={submitting || !isCheckedIn}
                onPress={handlePostQuestion}
                accessibilityRole="button"
                accessibilityLabel="Gửi câu hỏi"
                sx={{ minHeight: 48 }}
                style={{ minHeight: 48 }}
              >
                {submitting ? (
                  <ButtonSpinner color={colors.white} />
                ) : (
                  <>
                    <ButtonIcon as={() => <Ionicons name="send" size={16} color={isCheckedIn ? colors.white : colors.textSecondary} />} mr="$2" />
                    <ButtonText color={isCheckedIn ? colors.white : colors.textSecondary} fontWeight="$bold" fontSize="$sm">
                      {isCheckedIn ? "Gửi câu hỏi" : "Khóa (Chưa check-in)"}
                    </ButtonText>
                  </>
                )}
              </Button>
            </Box>
          }
          ListEmptyComponent={
            !loading ? (
              <Center py="$8">
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                <Text color={colors.textSecondary} fontSize="$xs" mt="$2">
                  Chưa có câu hỏi nào trong phiên này. Hãy là người đầu tiên!
                </Text>
              </Center>
            ) : (
              <Center py="$8">
                <Spinner size="large" color={colors.primary} />
              </Center>
            )
          }
          renderItem={({ item }) => {
            const isVoted = votedQuestionIds.includes(item.id);
            return (
              <Box
                bg={colors.surface}
                borderRadius={16}
                p="$3.5"
                mb="$3"
                borderWidth={0}
                style={shadows.card}
              >
                <HStack space="md" alignItems="center">
                  <VStack flex={1}>
                    <Text color={colors.textSecondary} fontWeight="$semibold" fontSize="$2xs" mb="$1">
                      {item.user?.fullName || "Khách tham dự"}
                    </Text>
                    <Text color={colors.textPrimary} fontSize="$sm">
                      {item.content}
                    </Text>
                  </VStack>

                  {/* Single toggleable upvote button */}
                  <Pressable
                    onPress={() => handleToggleUpvote(item.id)}
                    alignItems="center"
                    justifyContent="center"
                    bg={isVoted ? colors.primary : colors.primaryLight}
                    px="$3"
                    py="$2"
                    borderRadius={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Bình chọn câu hỏi, hiện có ${item.upvotes} lượt bình chọn`}
                    accessibilityState={{ selected: isVoted }}
                    sx={{
                      minWidth: 48,
                      minHeight: 48,
                      ":active": { opacity: 0.8 },
                    }}
                    style={{
                      minWidth: 48,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="caret-up"
                      size={18}
                      color={isVoted ? colors.white : colors.primary}
                    />
                    <Text
                      color={isVoted ? colors.white : colors.primary}
                      fontWeight="$bold"
                      fontSize="$xs"
                    >
                      {item.upvotes}
                    </Text>
                  </Pressable>
                </HStack>
              </Box>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
