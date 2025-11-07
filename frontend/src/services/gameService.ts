/**
 * Game Service Stub
 * TODO: Migrate to ApiClient + SocketClient pattern
 * This is a temporary stub to unblock compilation
 */

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class GameService {
  async getGameWithParticipants(gameId: string): Promise<ServiceResponse> {
    console.log('GameService.getGameWithParticipants (stub):', gameId);
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }

  async joinGame(params: { gameId: string; playerId: string }): Promise<ServiceResponse> {
    console.log('GameService.joinGame (stub):', params);
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }

  async leaveGame(gameId: string): Promise<ServiceResponse> {
    console.log('GameService.leaveGame (stub):', gameId);
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }

  async startGame(gameId: string): Promise<ServiceResponse> {
    console.log('GameService.startGame (stub):', gameId);
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }

  async makeCardClaim(
    gameId: string,
    cardId: string,
    claimedType: string,
    targetParticipantId: string
  ): Promise<ServiceResponse> {
    console.log('GameService.makeCardClaim (stub):', {
      gameId,
      cardId,
      claimedType,
      targetParticipantId,
    });
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }

  async respondToCardClaim(
    gameId: string,
    roundId: string,
    response: 'truth' | 'lie' | 'pass_back'
  ): Promise<ServiceResponse> {
    console.log('GameService.respondToCardClaim (stub):', { gameId, roundId, response });
    return {
      success: false,
      error: 'GameService is deprecated. Use SocketClient instead.',
    };
  }
}

export const gameService = new GameService();
