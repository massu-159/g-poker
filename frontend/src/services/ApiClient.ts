/**
 * Hono Backend API Client (T048)
 * Server-Authoritative Architecture Integration
 *
 * Connects React Native frontend to Hono backend API
 * Handles JWT token management and authentication
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ApiResponse,
  AuthResponse,
  AuthTokens,
  RefreshTokenResponse,
  LogoutResponse,
  MeResponse,
  FullUserProfile,
  PublicUserProfile,
  ProfileUpdateRequest,
  PreferencesUpdateRequest,
  UserStatistics,
  GameHistoryResponse,
  TutorialCompleteResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  RoomListResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  StartGameResponse,
  RoomDetailsResponse,
  LeaveRoomResponse,
  ClaimCardRequest,
  ClaimCardResponse,
  RespondToClaimRequest,
  RespondToClaimResponse,
  PassCardRequest,
  PassCardResponse,
  GameStateResponse,
} from '@/types/api';


// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 10000; // 10 seconds

// Storage Keys
const STORAGE_KEY_ACCESS_TOKEN = 'auth_access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'auth_refresh_token';
const STORAGE_KEY_USER_ID = 'auth_user_id';

// Re-export commonly used types for convenience
export type { ApiResponse, FullUserProfile, PublicUserProfile } from '@/types/api';

/**
 * Internal storage format for auth tokens
 */
interface StoredAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  private async saveTokensToStorage(tokens: StoredAuthTokens, userId: string) {
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
  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>(
      'POST',
      '/api/auth/login',
      { email, password },
      false
    );

    if (response.success && response.data) {
      // Convert API tokens to storage format
      const storedTokens: StoredAuthTokens = {
        accessToken: response.data.tokens.access_token,
        refreshToken: response.data.tokens.refresh_token,
        expiresIn: response.data.tokens.expires_in,
      };
      await this.saveTokensToStorage(storedTokens, response.data.user.id);
    }

    return response;
  }

  /**
   * Register new user
   */
  async register(email: string, password: string, displayName: string, username: string): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>(
      'POST',
      '/api/auth/register',
      { email, password, displayName, username },
      false
    );

    if (response.success && response.data) {
      // Convert API tokens to storage format
      const storedTokens: StoredAuthTokens = {
        accessToken: response.data.tokens.access_token,
        refreshToken: response.data.tokens.refresh_token,
        expiresIn: response.data.tokens.expires_in,
      };
      await this.saveTokensToStorage(storedTokens, response.data.user.id);
    }

    return response;
  }

  /**
   * Logout
   */
  async logout(): Promise<ApiResponse<LogoutResponse>> {
    const response = await this.request<LogoutResponse>('POST', '/api/auth/logout');
    await this.clearTokensFromStorage();
    return response;
  }

  /**
   * Get current user profile (from auth context)
   */
  async getMe(): Promise<ApiResponse<MeResponse>> {
    return this.request<MeResponse>('GET', '/api/auth/me');
  }

  // ========================
  // User Endpoints
  // ========================

  /**
   * Get current user's full profile
   */
  async getUsersMe(): Promise<ApiResponse<FullUserProfile>> {
    return this.request<FullUserProfile>('GET', '/api/users/me');
  }

  /**
   * Get public profile of another user
   */
  async getUserPublicProfile(userId: string): Promise<ApiResponse<PublicUserProfile>> {
    return this.request<PublicUserProfile>('GET', `/api/users/${userId}/profile`);
  }

  /**
   * Update current user's profile
   */
  async updateUserProfile(updates: ProfileUpdateRequest): Promise<ApiResponse<FullUserProfile>> {
    return this.request<FullUserProfile>('PUT', '/api/users/me/profile', updates);
  }

  /**
   * Update current user's preferences
   */
  async updateUserPreferences(preferences: PreferencesUpdateRequest): Promise<ApiResponse<FullUserProfile>> {
    return this.request<FullUserProfile>('PUT', '/api/users/me/preferences', preferences);
  }

  /**
   * Get current user's statistics
   */
  async getUserStatistics(days: number = 30): Promise<ApiResponse<UserStatistics>> {
    return this.request<UserStatistics>('GET', `/api/users/me/statistics?days=${days}`);
  }

  /**
   * Get current user's game history
   */
  async getUserGames(page: number = 1, limit: number = 20): Promise<ApiResponse<GameHistoryResponse>> {
    return this.request<GameHistoryResponse>('GET', `/api/users/me/games?page=${page}&limit=${limit}`);
  }

  /**
   * Mark tutorial as completed
   */
  async markTutorialComplete(): Promise<ApiResponse<TutorialCompleteResponse>> {
    return this.request<TutorialCompleteResponse>('POST', '/api/users/me/tutorial-complete');
  }

  // ========================
  // Room Management Endpoints
  // ========================

  /**
   * Create new room
   */
  async createRoom(settings?: CreateRoomRequest): Promise<ApiResponse<CreateRoomResponse>> {
    return this.request<CreateRoomResponse>('POST', '/api/rooms/create', {
      timeLimitSeconds: settings?.timeLimitSeconds || 60
    });
  }

  /**
   * List available rooms
   */
  async listRooms(): Promise<ApiResponse<RoomListResponse>> {
    return this.request<RoomListResponse>('GET', '/api/rooms/list');
  }

  /**
   * Join room
   */
  async joinRoom(gameId: string): Promise<ApiResponse<JoinRoomResponse>> {
    return this.request<JoinRoomResponse>('POST', '/api/rooms/join', { gameId });
  }

  /**
   * Start game (creator only)
   */
  async startGame(gameId: string): Promise<ApiResponse<StartGameResponse>> {
    return this.request<StartGameResponse>('POST', `/api/rooms/${gameId}/start`);
  }

  /**
   * Get room details
   */
  async getRoom(roomId: string): Promise<ApiResponse<RoomDetailsResponse>> {
    return this.request<RoomDetailsResponse>('GET', `/api/rooms/${roomId}`);
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId: string): Promise<ApiResponse<LeaveRoomResponse>> {
    return this.request<LeaveRoomResponse>('POST', `/api/rooms/${roomId}/leave`);
  }

  // ========================
  // Game Action Endpoints
  // ========================

  /**
   * Claim a card during gameplay
   */
  async claimCard(gameId: string, params: ClaimCardRequest): Promise<ApiResponse<ClaimCardResponse>> {
    return this.request<ClaimCardResponse>('POST', `/api/games/${gameId}/claim`, params);
  }

  /**
   * Respond to a claim (believe or doubt)
   */
  async respondToClaim(gameId: string, params: RespondToClaimRequest): Promise<ApiResponse<RespondToClaimResponse>> {
    return this.request<RespondToClaimResponse>('POST', `/api/games/${gameId}/respond`, params);
  }

  /**
   * Pass a card to the next player
   */
  async passCard(gameId: string, params: PassCardRequest): Promise<ApiResponse<PassCardResponse>> {
    return this.request<PassCardResponse>('POST', `/api/games/${gameId}/pass`, params);
  }

  /**
   * Get current game state
   */
  async getGameState(gameId: string): Promise<ApiResponse<GameStateResponse>> {
    return this.request<GameStateResponse>('GET', `/api/games/${gameId}/state`);
  }
}

// Export singleton instance
export const apiClient = new HonoApiClient();

// Export for testing
export default apiClient;
