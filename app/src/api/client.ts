import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Resolve API URL automatically based on Android emulator, physical device LAN, or web
const getAutoApiUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Expo debugger host (automatically detects developer machine IP when using Expo Go or Dev Client)
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(":")[0];
    if (ip) return `http://${ip}:3000`;
  }

  if (Platform.OS === "android") {
    // 10.0.2.2 points to host machine from Android Emulator
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
};

export const DEFAULT_API_URL = getAutoApiUrl();

class ApiService {
  private baseUrl: string = DEFAULT_API_URL;
  private token: string | null = null;

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, "");
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  async setToken(token: string | null) {
    this.token = token;
    if (Platform.OS === "web") {
      if (token) localStorage.setItem("qcheck_token", token);
      else localStorage.removeItem("qcheck_token");
    } else {
      if (token) {
        await SecureStore.setItemAsync("qcheck_token", token);
      } else {
        await SecureStore.deleteItemAsync("qcheck_token");
      }
    }
  }

  async loadStoredToken(): Promise<string | null> {
    if (Platform.OS === "web") {
      this.token = localStorage.getItem("qcheck_token");
      return this.token;
    }
    try {
      this.token = await SecureStore.getItemAsync("qcheck_token");
      return this.token;
    } catch {
      return null;
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
      console.log(`[qCheck API] ${options.method || "GET"} ${url}`);
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP error! status: ${response.status}`);
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timer);
      if (error.name === "AbortError") {
        throw new Error(`Hết thời gian chờ (Timeout 7s) khi kết nối tới ${this.baseUrl}`);
      }
      if (error.name === "TypeError" && error.message.includes("Network request failed")) {
        throw new Error(`Không thể kết nối đến máy chủ tại ${this.baseUrl}. Vui lòng kiểm tra Docker / mạng WiFi.`);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // --- Auth APIs ---
  async login(email: string, password: string): Promise<any> {
    const data: any = await this.post("/api/auth/login", { email, password });
    if (data?.token) {
      await this.setToken(data.token);
    }
    return data;
  }

  async getMe(): Promise<any> {
    return this.get("/api/auth/me");
  }

  // --- Tickets & Events APIs ---
  async getEvents(): Promise<any> {
    return this.get("/api/tickets/events");
  }

  async getMyTickets(): Promise<any> {
    return this.get("/api/tickets/my");
  }

  async getEventStats(eventId: string): Promise<any> {
    return this.get(`/api/checkin/stats/${eventId}`);
  }

  async getTicketToken(ticketId: string): Promise<any> {
    return this.get(`/api/tickets/${ticketId}/token`);
  }

  async purchaseTicketSandbox(eventId: string, ticketTypeId: string, quantity = 1): Promise<any> {
    return this.post("/api/tickets/sandbox-purchase", { eventId, ticketTypeId, quantity });
  }

  // --- Check-in APIs ---
  async verifyCheckin(qrToken: string, gate = "MAIN_GATE", offlineTimestamp?: number): Promise<any> {
    return this.post("/api/checkin/verify", { qrToken, gate, offlineTimestamp });
  }

  async getEventCache(eventId: string): Promise<any> {
    return this.get(`/api/checkin/event-cache/${eventId}`);
  }

  async syncOfflineScans(scans: any[]): Promise<any> {
    return this.post("/api/checkin/sync-offline", { scans });
  }

  // --- Q&A Realtime APIs ---
  async getSessionQuestions(sessionId: string): Promise<any> {
    return this.get(`/api/qa/session/${sessionId}`);
  }

  async postQuestion(sessionId: string, userId: string, content: string): Promise<any> {
    return this.post(`/api/qa/question`, { sessionId, userId, content });
  }

  async upvoteQuestion(questionId: string, userId: string): Promise<any> {
    return this.post(`/api/qa/upvote/${questionId}`, { userId });
  }

}

export const api = new ApiService();
