# Feature Specification: ごきぶりポーカー React Native App

**Feature Branch**: `001-reactnative-web`  
**Created**: 2025-09-06  
**Status**: Draft  
**Input**: User description: "ごきぶりポーカーをReactNativeアプリとして楽しめるようにしたい。ルールはweb検索してください。"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature: Mobile app for playing ごきぶりポーカー (Cockroach Poker) card game
2. Extract key concepts from description
   → Actors: 2 human players each with their own device (online multiplayer)
   → Actions: Deal cards, pass cards with claims, guess truth/lie, accumulate penalty cards
   → Data: Card deck (4 types × 6 cards), player hands (9 cards each), penalty piles, hidden cards (6)
   → Constraints: 2 human players, online multiplayer, 10-minute games, bluffing mechanics
3. For each unclear aspect:
   → Resolved: Online multiplayer, 2 human players each with their own device for MVP
4. Fill User Scenarios & Testing section
   → Clear user flow: Setup game → Play rounds → Determine winner
5. Generate Functional Requirements
   → Each requirement is testable against game rules
6. Identify Key Entities: Game, Player, Card, Round, Penalty Pile
7. Run Review Checklist
   → WARN "Spec has uncertainties about multiplayer implementation"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Two players want to enjoy the popular German bluffing card game "ごきぶりポーカー" (Cockroach Poker) on their mobile devices through online multiplayer. This MVP version focuses on remote gameplay where Player 1 and Player 2 use separate devices, passing cards face-down while making claims about creature types (which may be lies). Each player must decide whether to believe the claim or pass the card back. The goal is to avoid collecting 3 of the same creature type, as this results in losing the game (modified from original 4 for faster gameplay).

### Acceptance Scenarios
1. **Given** two players join an online game, **When** cards are dealt, **Then** each player receives 9 cards on their device (6 cards remain hidden for randomness)
2. **Given** Player 1's turn, **When** they select a card and make a creature claim, **Then** Player 2 receives notification on their device
3. **Given** Player 2 receives a card claim, **When** they choose to guess or pass back, **Then** system synchronizes game state across both devices
4. **Given** a player guesses correctly about a lie, **When** the claim was false, **Then** the liar receives the penalty card
5. **Given** a player accumulates 3 cards of the same creature type, **When** the penalty is applied, **Then** that player loses and game ends

### Edge Cases
- What happens when all cards are exhausted before either player loses?
- How does the app handle network disconnections during gameplay?
- What happens when a player takes too long to respond during online play?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST support exactly 2 human players in online multiplayer per game session
- **FR-002**: System MUST deal 9 cards to each player at game start (18 of 24 total cards, 6 cards remain hidden)
- **FR-003**: System MUST display 4 creature types: ゴキブリ (Cockroach), ネズミ (Mouse), コウモリ (Bat), カエル (Frog)
- **FR-004**: System MUST allow current player to select any card from their hand
- **FR-005**: System MUST allow current player to make any creature claim (truthful or false) when passing a card
- **FR-006**: System MUST allow receiving player to either guess (true/false) or pass the card back
- **FR-007**: System MUST correctly apply penalty rules: wrong guesser or successful bluffer receives the card
- **FR-008**: System MUST track penalty cards for each player by creature type
- **FR-009**: System MUST end the game when a player collects 3 cards of the same creature type (modified for faster gameplay)
- **FR-010**: System MUST display current game state: player's own hand, opponent penalty pile (visible), own penalty pile, and whose turn it is
- **FR-011**: System MUST synchronize game state across both player devices in real-time
- **FR-012**: System MUST provide matchmaking to connect two players for online games
- **FR-013**: System MUST handle network disconnections gracefully with reconnection attempts
- **FR-014**: System MUST provide game rules and tutorial for new players
- **FR-015**: System MUST keep 6 cards hidden from both players to add randomness and prevent perfect information
- **FR-016**: System MUST allow players to start a new game after completing one

### Key Entities *(include if feature involves data)*
- **Game**: Represents a single online multiplayer game session with 2 players, tracks current turn and game state
- **Player**: Individual participant with private hand of cards and public penalty pile, connected via separate devices
- **Card**: Individual card with creature type (one of 4 types), belongs to deck, hand, or penalty pile
- **Round**: Single card-passing interaction from initial claim through final penalty assignment via network
- **Penalty Pile**: Public collection of penalty cards for each player, organized by creature type, visible to both players

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---