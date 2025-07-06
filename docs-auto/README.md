# 🎮 Game Engine Documentation

> Auto-generated documentation for the tile-based game engine

## 📚 Documentation Sections

### 🔧 [API Documentation](./API.md)
Complete TypeScript API documentation for all core classes and functions:
- Engine class and methods
- Entity system components  
- Map and tile management
- GPU rendering system
- Inventory and item management

### 🔌 [Backend API](./CONVEX_API.md) 
Convex backend functions and database operations:
- User management
- TileSet CRUD operations
- Entity state persistence
- Cluster management
- Real-time data sync

### 🎨 [UI Components](./COMPONENTS.md)
React/SolidJS component documentation:
- Game component
- Inventory viewer
- Menu systems
- User interface elements

## 🚀 Quick Start

```typescript
import { Engine } from "~/lib";
import { ConvexClient } from "convex/browser";

// Initialize the game engine
const convex = new ConvexClient(process.env.CONVEX_URL);
const engine = new Engine(1000, 1000, convex);

// Start the game
await engine.start();
await engine.renderDOM();
```

## 🔄 Regenerating Documentation

To regenerate this documentation:

```bash
npm run docs:generate
```

---

*Last generated: 2025-07-06T20:08:49.014Z*
