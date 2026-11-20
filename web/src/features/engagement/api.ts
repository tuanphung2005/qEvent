import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddGameQuestionInput,
  CreatePollInput,
  CreateQuestionInput,
  UpdateGameQuestionInput,
  UpdatePollInput,
} from "./types";

/**
 * G2: Q&A Queries and Mutations
 */
export function useQuestions(sessionId: string | undefined, refetchInterval?: number | false) {
  return useQuery({
    queryKey: qk.engagement.questions(sessionId ?? "none"),
    queryFn: async () => {
      if (!sessionId) throw new Error("Chưa chọn phiên");
      return unwrap(
        await api.GET("/api/sessions/{sessionId}/questions", {
          params: { path: { sessionId } },
        }),
      );
    },
    enabled: Boolean(sessionId),
    refetchInterval,
  });
}

export function useCreateQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuestionInput) =>
      unwrap(
        await api.POST("/api/sessions/{sessionId}/questions", {
          params: { path: { sessionId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.questions(sessionId) });
    },
  });
}

export function useToggleVote(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) =>
      unwrap(
        await api.PUT("/api/questions/{questionId}/votes", {
          params: { path: { questionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.questions(sessionId) });
    },
  });
}

export function useUpdateQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, content }: { questionId: string; content: string }) =>
      unwrap(
        await api.PATCH("/api/questions/{questionId}", {
          params: { path: { questionId } },
          body: { content },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.questions(sessionId) });
    },
  });
}

export function useDeleteQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) =>
      unwrap(
        await api.DELETE("/api/questions/{questionId}", {
          params: { path: { questionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.questions(sessionId) });
    },
  });
}

/**
 * G3: Polls Queries and Mutations
 */
export function useRestoreQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) =>
      unwrap(
        await api.POST("/api/questions/{questionId}/restore", {
          params: { path: { questionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.questions(sessionId) });
    },
  });
}

export function usePolls(sessionId: string | undefined, refetchInterval?: number | false) {
  return useQuery({
    queryKey: qk.engagement.polls(sessionId ?? "none"),
    queryFn: async () => {
      if (!sessionId) throw new Error("Chưa chọn phiên");
      return unwrap(
        await api.GET("/api/sessions/{sessionId}/polls", {
          params: { path: { sessionId } },
        }),
      );
    },
    enabled: Boolean(sessionId),
    refetchInterval,
  });
}

export function useCreatePoll(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePollInput) =>
      unwrap(
        await api.POST("/api/sessions/{sessionId}/polls", {
          params: { path: { sessionId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.polls(sessionId) });
    },
  });
}

export function useUpdatePoll(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, ...input }: { pollId: string } & UpdatePollInput) =>
      unwrap(
        await api.PATCH("/api/polls/{pollId}", {
          params: { path: { pollId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.polls(sessionId) });
    },
  });
}

export function useDeletePoll(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pollId: string) =>
      unwrap(await api.DELETE("/api/polls/{pollId}", { params: { path: { pollId } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.polls(sessionId) });
    },
  });
}

/**
 * G4: Quiz Game Queries and Mutations
 */
export function useRestorePoll(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pollId: string) =>
      unwrap(await api.POST("/api/polls/{pollId}/restore", { params: { path: { pollId } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.polls(sessionId) });
    },
  });
}

export function useSessionGame(sessionId: string | undefined, refetchInterval?: number | false) {
  return useQuery({
    queryKey: qk.engagement.game(sessionId ?? "none"),
    queryFn: async () => {
      if (!sessionId) throw new Error("Chưa chọn phiên");
      return unwrap(
        await api.GET("/api/sessions/{sessionId}/game", {
          params: { path: { sessionId } },
        }),
      );
    },
    enabled: Boolean(sessionId),
    refetchInterval,
  });
}

export function useCreateSessionGame(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/sessions/{sessionId}/game", {
          params: { path: { sessionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useAddGameQuestion(sessionId: string, gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddGameQuestionInput) =>
      unwrap(
        await api.POST("/api/game/{gameId}/question", {
          params: { path: { gameId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useUpdateGameQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameId,
      questionId,
      ...input
    }: { gameId: string; questionId: string } & UpdateGameQuestionInput) =>
      unwrap(
        await api.PATCH("/api/game/{gameId}/question/{questionId}", {
          params: { path: { gameId, questionId } },
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useStartGame(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) =>
      unwrap(
        await api.POST("/api/game/{gameId}/start", {
          params: { path: { gameId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useRevealGameAnswer(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) =>
      unwrap(
        await api.POST("/api/game/{gameId}/reveal", {
          params: { path: { gameId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useNextGameQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) =>
      unwrap(
        await api.POST("/api/game/{gameId}/next", {
          params: { path: { gameId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useEndGame(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) =>
      unwrap(
        await api.POST("/api/game/{gameId}/end", {
          params: { path: { gameId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useRestartGame(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) =>
      unwrap(
        await api.POST("/api/game/{gameId}/restart", {
          params: { path: { gameId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
      queryClient.invalidateQueries({ queryKey: ["game", "leaderboard"] });
    },
  });
}

export function useDeleteGameQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, questionId }: { gameId: string; questionId: string }) =>
      unwrap(
        await api.DELETE("/api/game/{gameId}/question/{questionId}", {
          params: { path: { gameId, questionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useRestoreGameQuestion(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, questionId }: { gameId: string; questionId: string }) =>
      unwrap(
        await api.POST("/api/game/{gameId}/question/{questionId}/restore", {
          params: { path: { gameId, questionId } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.engagement.game(sessionId) });
    },
  });
}

export function useGameLeaderboard(gameId: string | undefined, refetchInterval?: number | false) {
  return useQuery({
    queryKey: ["game", "leaderboard", gameId ?? "none"],
    queryFn: async () => {
      if (!gameId) throw new Error("Chưa có game");
      return unwrap(
        await api.GET("/api/game/{gameId}/leaderboard", {
          params: { path: { gameId } },
        }),
      );
    },
    enabled: Boolean(gameId),
    refetchInterval,
  });
}
