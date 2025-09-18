# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled with comprehensive type checking
- **exactOptionalPropertyTypes**: true (strict optional property handling)
- **noUncheckedIndexedAccess**: true (safe array/object access)
- **noImplicitReturns**: true (explicit return statements)
- **Path Aliases**: `@/*` maps to `src/*` for clean imports

## Code Formatting (Prettier)
```javascript
{
  semi: true,                    // Semicolons required
  trailingComma: 'es5',         // Trailing commas where valid
  singleQuote: true,            // Single quotes for strings
  printWidth: 80,               // 80 character line limit
  tabWidth: 2,                  // 2-space indentation
  useTabs: false               // Spaces, not tabs
}
```

## ESLint Rules
- **@react-native-community**: Base React Native rules
- **@typescript-eslint**: TypeScript-specific linting
- **No unused variables**: Error (TypeScript version)
- **No variable shadowing**: Error (TypeScript version)
- **React hooks exhaustive deps**: Warning
- **Inline styles allowed**: For React Native flexibility

## Naming Conventions
- **Files**: PascalCase for components (Card.tsx), camelCase for utilities
- **Components**: PascalCase (GameBoard, PlayerArea, CardMovement)
- **Hooks**: camelCase with 'use' prefix (useGameState, useRealtimeSubscription)  
- **Services**: camelCase with 'Service' suffix (gameService, authService)
- **Stores**: camelCase with 'Store' suffix (gameStore, userStore)
- **Types/Interfaces**: PascalCase (Player, GameState, CreatePlayerRequest)
- **Constants**: UPPER_SNAKE_CASE (CARDS_PER_CREATURE, DEFAULT_GAME_SETTINGS)

## File Organization
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components  
│   ├── cards/          # Card-specific components
│   ├── game/           # Game-specific components
│   └── animations/     # Animation components
├── screens/            # Screen-level components
├── services/           # Business logic and API calls
├── stores/             # State management (Zustand)
├── lib/                # Shared utilities and core logic
│   ├── entities/       # TypeScript entity models
│   └── gameLogic/      # Pure game mechanics
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── config/             # Configuration files
```

## Import Conventions
```typescript
// External libraries first
import React from 'react';
import { View, Text } from 'react-native';
import Animated from 'react-native-reanimated';

// Internal imports with path aliases
import { GameState } from '@/lib/entities/Game';
import { useGameStore } from '@/stores/gameStore';
import { CardComponent } from '@/components/cards/Card';
```

## Component Structure
```typescript
interface ComponentProps {
  // Props interface always defined
}

export const ComponentName: React.FC<ComponentProps> = ({ 
  prop1, 
  prop2 
}) => {
  // Hooks first
  const [state, setState] = useState();
  const navigation = useNavigation();
  
  // Event handlers
  const handleAction = () => {
    // Implementation
  };
  
  // Render
  return (
    <View>
      {/* JSX */}
    </View>
  );
};
```

## Testing Conventions
- **File naming**: Component.test.tsx, service.test.ts
- **Mock location**: jest.setup.js for global mocks
- **Test structure**: describe blocks for grouping, descriptive test names
- **React Native Testing Library**: Preferred for component testing
- **Comprehensive mocks**: Reanimated, Supabase, AsyncStorage, Navigation

## Comments and Documentation
- **JSDoc**: For public APIs and complex functions
- **Inline comments**: For business logic explanation
- **Enterprise architecture**: Clear documentation for security patterns
- **@deprecated**: For legacy compatibility layers

## Security Patterns
- **Player IDs**: Always use game_player_id (secure indirection)
- **Database access**: Via RLS policies and secure functions
- **Type safety**: Strict TypeScript for runtime safety
- **Validation**: Input validation at entity boundaries