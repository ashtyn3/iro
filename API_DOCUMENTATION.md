# API Documentation

## Project Overview

This is a browser-based tile-based game built with SolidJS and Convex. The game features:
- Real-time multiplayer functionality
- WebGPU rendering with CPU fallback
- Tile-based world generation and exploration
- Entity-component system
- Inventory and item management
- User authentication with Clerk
- Persistent world state

## Technology Stack

- **Frontend**: SolidJS with Solid Start
- **Backend**: Convex (real-time database and API)
- **Authentication**: Clerk
- **Rendering**: WebGPU with ROT.js fallback
- **Styling**: TailwindCSS
- **Package Manager**: Bun

---

## Backend API (Convex Functions)

### Database Schema

The database uses the following main tables:

#### `users`
- `name`: string - User's display name
- `externalId`: string - Clerk user ID
- **Index**: `byExternalId`

#### `tileSets`
- `width`: number - Map width in tiles
- `height`: number - Map height in tiles
- `createdAt`: string - ISO timestamp
- `owner`: Id<"users"> - Reference to user
- `empty_blocks`: boolean (optional) - Cleanup flag
- `empty_clusters`: boolean (optional) - Cleanup flag
- **Index**: `byOwner`

#### `tileBlocks`
- `tileSetId`: Id<"tileSets"> - Reference to tileset
- `blockX`: number - Block X coordinate
- `blockY`: number - Block Y coordinate
- `data`: Tile[][] - 2D array of tile data
- **Indexes**: `byTileSetId`, `byTileSetAndPos`

#### `entityStates`
- `tileSetId`: Id<"tileSets"> - Reference to tileset
- `entityId`: string - Unique entity identifier
- `state`: any - Serialized entity state
- **Indexes**: `byTileSetId`, `byEntityId`

#### `clusters`
- `tileSetId`: Id<"tileSets"> - Reference to tileset
- `kind`: number - Tile kind (0-7)
- `data`: any - Serialized cluster data
- **Indexes**: `byTileSetId`, `byIdAndKind`

### User Management API

#### `users.current`
**Type**: Query
**Description**: Get current authenticated user
**Returns**: User object or null

```typescript
// Usage
const user = await convex.query(api.users.current);
```

#### `users.upsertFromClerk`
**Type**: Internal Mutation
**Description**: Create or update user from Clerk webhook
**Parameters**:
- `data`: UserJSON - Clerk user data

#### `users.deleteFromClerk`
**Type**: Internal Mutation
**Description**: Delete user from Clerk webhook
**Parameters**:
- `clerkUserId`: string - Clerk user ID

### TileSet Management API

#### `functions.getTileSet.getTileSet`
**Type**: Query
**Description**: Retrieve a complete tileset with metadata and blocks
**Parameters**:
- `tileSetId`: string - Tileset ID

**Returns**:
```typescript
{
  meta: TileSetMetadata,
  blocks: TileBlock[]
}
```

**Example**:
```typescript
const tileSet = await convex.query(api.functions.getTileSet.getTileSet, {
  tileSetId: "kt1..."
});
```

#### `functions.getTileSet.getTileSets`
**Type**: Query
**Description**: List all tilesets owned by current user
**Returns**: Array of tileset summaries

**Example**:
```typescript
const tileSets = await convex.query(api.functions.getTileSet.getTileSets);
// Returns: [{ id: "kt1...", width: 1000, height: 1000, createdAt: "2024-..." }]
```

#### `functions.saveTileSet.createTileSet`
**Type**: Mutation
**Description**: Create a new empty tileset
**Parameters**:
- `width`: number - Map width
- `height`: number - Map height

**Returns**: TileSet ID

**Example**:
```typescript
const tileSetId = await convex.mutation(api.functions.saveTileSet.createTileSet, {
  width: 1000,
  height: 1000
});
```

#### `functions.saveTileSet.updateViewportTiles`
**Type**: Mutation
**Description**: Update multiple tiles within a viewport
**Parameters**:
- `tileSetId`: string - Target tileset
- `viewport`: { x: number, y: number, width: number, height: number }
- `blockSize`: number - Size of each block
- `tileUpdates`: Array<{ x: number, y: number, tile: Tile }>

**Example**:
```typescript
await convex.mutation(api.functions.saveTileSet.updateViewportTiles, {
  tileSetId: "kt1...",
  viewport: { x: 0, y: 0, width: 80, height: 40 },
  blockSize: 32,
  tileUpdates: [
    { x: 10, y: 10, tile: { char: ".", fg: "#5C8A34", kind: TileKinds.grass } }
  ]
});
```

#### `functions.saveTileSet.clearUserData`
**Type**: Mutation
**Description**: Clear all user data (tilesets, blocks, entities)

### Entity State API

#### `functions.entityStates.saveEntityState`
**Type**: Mutation
**Description**: Save entity state to database
**Parameters**:
- `tileSetId`: Id<"tileSets"> - Target tileset
- `entityId`: string - Entity identifier
- `state`: any - Serialized entity state

**Example**:
```typescript
await convex.mutation(api.functions.entityStates.saveEntityState, {
  tileSetId: "kt1...",
  entityId: "player_123",
  state: { position: { x: 100, y: 200 }, health: 100 }
});
```

#### `functions.entityStates.getEntityState`
**Type**: Query
**Description**: Retrieve entity state from database
**Parameters**:
- `tileSetId`: Id<"tileSets"> - Target tileset
- `entityId`: string - Entity identifier

**Returns**: Entity state or null

### Cluster Management API

#### `functions.clusters.saveClusters`
**Type**: Mutation
**Description**: Save tile clusters for a tileset
**Parameters**:
- `tileSetId`: string - Target tileset
- `clusters`: Clusters - Cluster data by tile kind

#### `functions.clusters.loadClusters`
**Type**: Query
**Description**: Load clusters for a tileset
**Parameters**:
- `tileSetId`: string - Target tileset

**Returns**: Clusters object

#### `functions.clusters.updateClusters`
**Type**: Mutation
**Description**: Update existing clusters
**Parameters**:
- `tileSetId`: string - Target tileset
- `clusters`: Clusters - Updated cluster data

---

## Frontend Components (SolidJS)

### Game Component

#### `<Game engine={Engine} />`
**Description**: Main game component that renders the game world
**Props**:
- `engine`: Engine - Game engine instance

**Features**:
- Renders game canvas
- Displays player stats (air level)
- Shows inventory
- Handles player hand items

**Example**:
```tsx
import Game from "~/components/game";
import { Engine } from "~/lib";

function App() {
  const engine = new Engine(1000, 1000, convex);
  return <Game engine={engine} />;
}
```

### Inventory Component

#### `<Inventory engine={Engine} />`
**Description**: Displays player inventory items
**Props**:
- `engine`: Engine - Game engine instance

**Features**:
- Shows item sprites and counts
- Filters out empty slots
- Responsive grid layout

### Menu Components

#### `<Menu />`
**Description**: Main game menu system
**Location**: `src/components/menu.tsx`
**Features**:
- Save/load game functionality
- Settings management
- Game controls

#### `<MainMenu />`
**Description**: Main menu interface
**Location**: `src/components/main-menu.tsx`

### Inventory Viewer

#### `<InventoryViewer />`
**Description**: Detailed inventory management interface
**Location**: `src/components/inventoryView.tsx`

---

## Game Engine (Core Classes)

### Engine Class

#### `new Engine(width: number, height: number, convex: ConvexClient)`
**Description**: Main game engine that orchestrates all systems
**Parameters**:
- `width`: number - World width in tiles
- `height`: number - World height in tiles
- `convex`: ConvexClient - Convex client instance

**Properties**:
- `display`: ROT.Display - Rendering display
- `mapBuilder`: GMap - Map generation and management
- `player`: PlayerType - Player entity
- `scheduler`: ROT.Scheduler - Game loop scheduler
- `state`: State - Game state management

**Methods**:

##### `async start(): Promise<void>`
**Description**: Initialize and start the game engine
**Example**:
```typescript
const engine = new Engine(1000, 1000, convex);
await engine.start();
```

##### `async renderDOM(): Promise<void>`
**Description**: Render game to DOM canvas
**Features**:
- Canvas setup and styling
- Event listeners for keyboard/mouse
- Render loop initialization

##### `viewport(): Vec2d`
**Description**: Get current viewport coordinates
**Returns**: Current viewport position

##### `async render(): Promise<void>`
**Description**: Render current frame

### GMap Class

#### `new GMap(width: number, height: number, engine: Engine, convex: ConvexClient, id: string)`
**Description**: Handles map generation, rendering, and tile management

**Properties**:
- `tiles`: Tile[][] - 2D array of tile data
- `computedClusters`: Clusters - Tile clusters by kind
- `useGPU`: boolean - Whether to use GPU rendering
- `VIEW_RADIUS`: number - Player vision radius

**Methods**:

##### `async genMap(): Promise<boolean>`
**Description**: Generate a new procedural map
**Features**:
- Noise-based terrain generation
- Cellular automata smoothing
- Tree and resource placement
- Cluster computation

##### `async loadMap(id: string): Promise<boolean>`
**Description**: Load existing map from database
**Parameters**:
- `id`: string - Map ID to load

##### `async updateViewportTile(x: number, y: number, tile: Tile): Promise<void>`
**Description**: Update a single tile in the viewport
**Parameters**:
- `x`: number - Viewport X coordinate
- `y`: number - Viewport Y coordinate
- `tile`: Tile - New tile data

##### `async render(): Promise<void>`
**Description**: Render current viewport
**Features**:
- GPU acceleration when available
- Distance-based lighting
- Mask rendering for objects

##### `getClusterAt(pt: Vec2d): Cluster | undefined`
**Description**: Get cluster at specific position
**Parameters**:
- `pt`: Vec2d - Position to check

**Returns**: Cluster data or undefined

### Entity System

#### Entity Components

##### `Movable`
**Description**: Adds movement capabilities to entities
**Properties**:
- `position`: Vec2d - Current position
- `move(delta: Vec2d): void` - Movement method

##### `Destructible`
**Description**: Adds health and damage to entities
**Properties**:
- `health`: number - Current health
- `damage(amount: number): void` - Take damage

##### `Collectable`
**Description**: Adds item collection to entities
**Methods**:
- `collect(item: Item, amount: number): boolean` - Collect items

##### `Inventory`
**Description**: Adds inventory management to entities
**Properties**:
- `Items`: Array<{count: number, item: Item}> - Inventory slots
- `hands`: {left: Item, right: Item} - Hand slots
- `dominant`: "left" | "right" - Dominant hand

**Methods**:
- `put(item: {count: number, item: Item}): void` - Add item to inventory
- `handPut(item: Item, hand: "left" | "right"): void` - Put item in hand
- `handSwap(): void` - Swap hand items

##### `Storeable`
**Description**: Adds database persistence to entities
**Properties**:
- `id`: string - Unique entity ID

**Methods**:
- `async store(): Promise<void>` - Save to database
- `async sync(): Promise<void>` - Load from database
- `serialize(): any` - Serialize entity state
- `deserialize(data: any): void` - Deserialize entity state

#### EntityBuilder

##### `new EntityBuilder(base: Existable)`
**Description**: Builder pattern for creating entities with components

**Methods**:
- `add<T>(component: Component<T>, params: any): EntityBuilder` - Add component
- `build(): Entity` - Build final entity

**Example**:
```typescript
const player = new EntityBuilder(createEntity(engine, "@"))
  .add(Movable, Vec2d({x: 100, y: 100}))
  .add(Destructible, 100)
  .add(Inventory, { slots: 20, dominant: "right" })
  .build();
```

### Player System

#### `Player(engine: Engine, char: string, dominant: "left" | "right"): PlayerType`
**Description**: Create player entity with all necessary components
**Parameters**:
- `engine`: Engine - Game engine reference
- `char`: string - Display character
- `dominant`: "left" | "right" - Dominant hand

**Returns**: Fully configured player entity

### GPU Rendering

#### `GPURenderer`
**Description**: WebGPU-based rendering system for enhanced performance

**Methods**:

##### `async render(tiles: Tile[][], playerPos: Vec2d, viewport: Vec2d, viewRadius: number)`
**Description**: Render viewport using GPU compute shaders
**Parameters**:
- `tiles`: Tile[][] - Tile data
- `playerPos`: Vec2d - Player position
- `viewport`: Vec2d - Viewport position
- `viewRadius`: number - Vision radius

**Returns**: Array of rendered pixels

### Item System

#### Item Interface
```typescript
interface Item {
  name: string;
  sprite: string[];
  usable: boolean;
  perform(engine: Engine, actor: Entity): Promise<void>;
}
```

#### Available Items

##### `Items.empty`
**Description**: Empty slot placeholder
**Properties**:
- `name`: "none"
- `usable`: false

##### `Items.o2`
**Description**: Oxygen tank for restoring air
**Properties**:
- `name`: "o2"
- `usable`: true
- **Effect**: Restores 10 air points (max 100)

##### `Items.pickaxe`
**Description**: Mining tool for destroying blocks efficiently
**Properties**:
- `name`: "pickaxe"
- `usable`: true
- **Effect**: Deals 7.5 damage to destructible blocks

##### `Items.hand`
**Description**: Default hand tool
**Properties**:
- `name`: "hand"
- `usable`: true
- **Effect**: Deals 3 damage to blocks

##### `Items.wood`
**Description**: Wood resource
**Properties**:
- `name`: "wood"
- `usable`: false

---

## Data Types

### Core Types

#### `Vec2d`
```typescript
interface Vec2d {
  x: number;
  y: number;
  equals(other: Vec2d): boolean;
}
```

#### `Tile`
```typescript
interface Tile {
  fg?: string;           // Foreground color
  bg?: string;           // Background color
  char: string;          // Display character
  boundary: boolean;     // Is passable
  kind: TileKinds;      // Tile type
  mask?: {              // Overlay object
    fg: string;
    bg: string;
    char: string;
    kind: TileKinds;
    promotable?: promotion;
  };
  promotable?: promotion; // Can become entity
}
```

#### `TileKinds`
```typescript
enum TileKinds {
  grass = 0,
  water = 1,
  rock = 2,
  copper = 3,
  wood = 4,
  leafs = 5,
  struct = 6,
  tree = 7
}
```

#### `Cluster`
```typescript
interface Cluster {
  kind: TileKinds;
  points: Vec2d[];
  center: Vec2d;
}
```

#### `State`
```typescript
interface State {
  currentCluster: Cluster | null;
  entities: Map<Vec2d, Entity>;
}
```

---

## Usage Examples

### Basic Game Setup

```typescript
import { Engine } from "~/lib";
import { ConvexClient } from "convex/browser";

// Initialize Convex client
const convex = new ConvexClient(process.env.CONVEX_URL);

// Create game engine
const engine = new Engine(1000, 1000, convex);

// Start game
await engine.start();
await engine.renderDOM();
```

### Creating a New Map

```typescript
// Generate new map
const success = await engine.mapBuilder.genMap();
if (success) {
  console.log("Map generated successfully");
}
```

### Loading Existing Map

```typescript
// Load existing map
const mapId = "kt1..."; // From database
const success = await engine.mapBuilder.loadMap(mapId);
if (success) {
  console.log("Map loaded successfully");
}
```

### Player Movement

```typescript
// Movement is handled by KeyHandles system
// Example key handler:
const movePlayer = async (engine: Engine, delta: Vec2d) => {
  engine.player.move(delta);
  await engine.player.store(); // Save to database
};
```

### Inventory Management

```typescript
// Add item to inventory
engine.player.put({
  count: 5,
  item: Items.wood
});

// Use item in hand
await engine.player.hands.right.perform(engine, engine.player);

// Swap hands
engine.player.handSwap();
```

### Tile Modification

```typescript
// Update single tile
await engine.mapBuilder.updateViewportTile(10, 10, {
  char: "X",
  fg: "#FF0000",
  bg: null,
  boundary: false,
  kind: TileKinds.struct,
  mask: null
});
```

### Entity Creation

```typescript
// Create custom entity
const entity = new EntityBuilder(createEntity(engine, "E"))
  .add(Movable, Vec2d({x: 100, y: 100}))
  .add(Destructible, 50)
  .add(Storeable, "custom_entity_1")
  .build();

// Save entity state
await entity.store();
```

---

## Error Handling

### Common Errors

#### Authentication Errors
```typescript
// Handle unauthenticated requests
try {
  const user = await convex.query(api.users.current);
  if (!user) {
    throw new Error("User not authenticated");
  }
} catch (error) {
  console.error("Auth error:", error);
}
```

#### Map Loading Errors
```typescript
// Handle map loading failures
try {
  const success = await engine.mapBuilder.loadMap(mapId);
  if (!success) {
    throw new Error("Failed to load map");
  }
} catch (error) {
  console.error("Map loading error:", error);
  // Fallback to generating new map
  await engine.mapBuilder.genMap();
}
```

#### GPU Rendering Errors
```typescript
// GPU rendering automatically falls back to CPU
// Check if GPU is being used:
if (engine.mapBuilder.useGPU) {
  console.log("Using GPU acceleration");
} else {
  console.log("Using CPU rendering");
}
```

---

## Performance Considerations

### Optimization Tips

1. **GPU Rendering**: Enable WebGPU for better performance on supported devices
2. **Viewport Culling**: Only render visible tiles
3. **Batch Updates**: Use `updateViewportTiles` for multiple tile changes
4. **Entity Pooling**: Reuse entity instances when possible
5. **Cluster Indexing**: Use cluster system for efficient spatial queries

### Memory Management

- Entities are automatically cleaned up when removed from state
- GPU buffers are destroyed after each render
- Use `clearUserData` mutation to clean up database storage

---

## WebGPU Shaders

The game uses WebGPU compute shaders for efficient rendering. The shader code is located in `src/lib/shaders.wgsl` and handles:

- Distance-based lighting calculations
- Color interpolation and dithering
- Mask rendering for objects
- Viewport culling

---

## Development Setup

### Prerequisites

- Node.js 22+
- Bun package manager
- WebGPU-compatible browser (Chrome 113+)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Configure CONVEX_URL and CLERK_PUBLISHABLE_KEY

# Run development server
bun run dev
```

### Building for Production

```bash
# Build application
bun run build

# Start production server
bun run start
```

---

## Contributing

When adding new features:

1. **Backend**: Add new Convex functions in `convex/functions/`
2. **Frontend**: Add new components in `src/components/`
3. **Game Logic**: Extend entity system in `src/lib/entity.ts`
4. **Rendering**: Modify GPU shaders in `src/lib/shaders.wgsl`

Remember to update this documentation when adding new public APIs or components.