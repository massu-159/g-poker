/**
 * Hono Backend API Client (T048)
 * Server-Authoritative Architecture Integration
 *
 * Connects React Native frontend to Hono backend API
 * Handles JWT token management and authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';


// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 10000; // 10 seconds

// Storage Keys
const STORAGE_KEY_ACCESS_TOKEN = 'auth_access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'auth_refresh_token';
const STORAGE_KEY_USER_ID = 'auth_user_id';

/**
 * API Client Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  creatorId: string;
  status: 'waiting' | 'in_progress' | 'completed';
  maxPlayers: number;
  currentPlayerCount: number;
  settings: {
    timeLimitSeconds: number;
  };
  createdAt: string;
  participants?: RoomParticipant[];
}

export interface RoomParticipant {
  playerId: string;
  displayName: string;
  position: number;
  status: 'joined' | 'playing' | 'disconnected';
  joinedAt: string;
}

export interface GameAction {
  type: 'claim_card' | 'respond_to_claim' | 'pass_card';
  payload: any;
}

/**
 * Hono Backend API Client
 */
export class HonoApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.loadTokensFromStorage();
  }

  /**
   * Load tokens from AsyncStorage on initialization
   */
  private async loadTokensFromStorage() {
    try {
      const [accessToken, refreshToken, userId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEY_REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEY_USER_ID),
      ]);

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.userId = userId;

      console.log('[ApiClient] Tokens loaded from storage:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        userId,
      });
    } catch (error) {
      console.error('[ApiClient] Failed to load tokens:', error);
    }
  }

  /**
   * Save tokens to AsyncStorage
   */
  private async saveTokensToStorage(tokens: AuthTokens, userId: string) {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, tokens.accessToken),
        AsyncStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, tokens.refreshToken),
        AsyncStorage.setItem(STORAGE_KEY_USER_ID, userId),
      ]);

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.userId = userId;

      console.log('[ApiClient] Tokens saved to storage');
    } catch (error) {
      console.error('[ApiClient] Failed to save tokens:', error);
    }
  }

  /**
   * Clear tokens from storage
   */
  private async clearTokensFromStorage() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEY_USER_ID),
      ]);

      this.accessToken = null;
      this.refreshToken = null;
      this.userId = null;

      console.log('[ApiClient] Tokens cleared from storage');
    } catch (error) {
      console.error('[ApiClient] Failed to clear tokens:', error);
    }
  }

  /**
   * Make HTTP request to Hono backend
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    body?: any,
    requiresAuth = true
  ): Promise<ApiResponse<T>> {
    try {
      // Ensure tokens are loaded
      if (requiresAuth && !this.accessToken) {
        await this.loadTokensFromStorage();
      }

      // Check if token needs refresh
      if (requiresAuth && this.accessToken && this.isTokenExpiringSoon()) {
        await this.refreshAccessToken();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Info': 'g-poker-mobile',
      };

      if (requiresAuth && this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const config: RequestInit = {
        method,
        headers,
      };

      if (body) {
        config.body = JSON.stringify(body);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - attempt token refresh
        if (response.status === 401 && requiresAuth) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry request with new token
            return this.request<T>(method, endpoint, body, requiresAuth);
          }
        }

        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }

      console.error(`[ApiClient] ${method} ${endpoint} failed:`, error);
      return {
        success: false,
        error: error.message || 'Network request failed',
      };
    }
  }

  /**
   * Check if access token is expiring soon (within 5 minutes)
   */
  private isTokenExpiringSoon(): boolean {
    // TODO: Implement JWT expiration check
    // For now, always return false (tokens are long-lived)
    return false;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise!;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _performTokenRefresh(): Promise<boolean> {
    if (!this.refreshToken) {
      console.warn('[ApiClient] No refresh token available');
      return false;
    }

    try {
      const response = await this.request<AuthTokens>(
        'POST',
        '/api/auth/refresh',
        { refreshToken: this.refreshToken },
        false // Don't require auth for refresh endpoint
      );

      if (response.success && response.data) {
        await this.saveTokensToStorage(response.data, this.userId!);
        console.log('[ApiClient] Access token refreshed successfully');
        return true;
      }

      // Refresh failed - clear tokens
      await this.clearTokensFromStorage();
      return false;
    } catch (error) {
      console.error('[ApiClient] Token refresh failed:', error);
      await this.clearTokensFromStorage();
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.accessToken && !!this.userId;
  }

  /**
   * Get current user ID
   */
  public getUserId(): string | null {
    return this.userId;
  }

  /**
   * Get current access token (for Socket.io authentication)
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  // ========================
  // Authentication Endpoints
  // ========================

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<ApiResponse<{ user: UserProfile; tokens: AuthTokens }>> {
    const response = await this.request<{ user: UserProfile; tokens: AuthTokens }>(
      'POST',
      '/api/auth/login',
      { email, password },
      false
    );

    if (response.success && response.data) {
      await this.saveTokensToStorage(response.data.tokens, response.data.user.id);
    }

    return response;
  }

  /**
   * Register new user
   */
  async register(email: string, password: string, displayName?: string): Promise<ApiResponse<{ user: UserProfile; tokens: AuthTokens }>> {
    const response = await this.request<{ user: UserProfile; tokens: AuthTokens }>(
      'POST',
      '/api/auth/register',
      { email, password, displayName },
      false
    );

    if (response.success && response.data) {
      await this.saveTokensToStorage(response.data.tokens, response.data.user.id);
    }

    return response;
  }

  /**
   * Logout
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('POST', '/api/auth/logout');
    await this.clearTokensFromStorage();
    return response;
  }

  // ========================
  // Profile Endpoints
  // ========================

  /**
   * Get user profile
   */
  async getProfile(userId?: string): Promise<ApiResponse<UserProfile>> {
    const id = userId || this.userId;
    return this.request<UserProfile>('GET', `/api/users/${id}`);
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('PATCH', `/api/users/${this.userId}`, updates);
  }

  // ========================
  // Room Management Endpoints
  // ========================

  /**
   * Create new room
   */
  async createRoom(settings?: { timeLimitSeconds?: number }): Promise<ApiResponse<Room>> {
    return this.request<Room>('POST', '/api/rooms', { settings });
  }

  /**
   * Get room details
   */
  async getRoom(roomId: string): Promise<ApiResponse<Room>> {
    return this.request<Room>('GET', `/api/rooms/${roomId}`);
  }

  /**
   * List available rooms
   */
  async listRooms(filters?: { status?: string; limit?: number }): Promise<ApiResponse<Room[]>> {
    const query = new URLSearchParams(filters as any).toString();
    return this.request<Room[]>('GET', `/api/rooms${query ? `?${query}` : ''}`);
  }

  /**
   * Join room
   */
  async joinRoom(roomId: string): Promise<ApiResponse<{ participant: RoomParticipant }>> {
    return this.request<{ participant: RoomParticipant }>('POST', `/api/rooms/${roomId}/join`);
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId: string): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `/api/rooms/${roomId}/leave`);
  }

  // ========================
  // Game Action Endpoints
  // ========================

  /**
   * Send game action
   */
  async sendGameAction(roomId: string, action: GameAction): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/games/${roomId}/action`, action);
  }

  /**
   * Get game state
   */
  async getGameState(roomId: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/games/${roomId}/state`);
  }
}

// Export singleton instance
export const apiClient = new HonoApiClient();

// Export for testing
export default apiClient;
