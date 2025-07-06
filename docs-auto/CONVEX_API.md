# Convex Backend API

This documentation covers all the Convex backend functions and mutations.


## users

**File**: `convex/users.ts`

### current
**Type**: query

```typescript
export const current = query
```

### upsertFromClerk
**Type**: internalMutation

```typescript
export const upsertFromClerk = internalMutation
```

### deleteFromClerk
**Type**: internalMutation

```typescript
export const deleteFromClerk = internalMutation
```


## getTileSet

**File**: `convex/functions/getTileSet.ts`

### getTileSet
**Type**: query

```typescript
export const getTileSet = query
```

### getTileSets
**Type**: query

```typescript
export const getTileSets = query
```


## saveTileSet

**File**: `convex/functions/saveTileSet.ts`

### createTileSet
**Type**: mutation

```typescript
export const createTileSet = mutation
```

### insertTileBlocks
**Type**: mutation

```typescript
export const insertTileBlocks = mutation
```

### updateViewportTiles
**Type**: mutation

```typescript
export const updateViewportTiles = mutation
```

### clearTileBlocksBatch
**Type**: internalMutation

```typescript
export const clearTileBlocksBatch = internalMutation
```

### clearTileSetBatch
**Type**: internalMutation

```typescript
export const clearTileSetBatch = internalMutation
```

### clearUserDataBatch
**Type**: internalMutation

```typescript
export const clearUserDataBatch = internalMutation
```

### clearClustersBatch
**Type**: internalMutation

```typescript
export const clearClustersBatch = internalMutation
```

### clearUserData
**Type**: mutation

```typescript
export const clearUserData = mutation
```


## entityStates

**File**: `convex/functions/entityStates.ts`

### saveEntityState
**Type**: mutation

```typescript
export const saveEntityState = mutation
```

### getEntityState
**Type**: query

```typescript
export const getEntityState = query
```

### clearEntityStates
**Type**: internalMutation

```typescript
export const clearEntityStates = internalMutation
```


## clusters

**File**: `convex/functions/clusters.ts`

### saveClusters
**Type**: mutation

```typescript
export const saveClusters = mutation
```

### loadClusters
**Type**: query

```typescript
export const loadClusters = query
```

### updateClusters
**Type**: mutation

```typescript
export const updateClusters = mutation
```

