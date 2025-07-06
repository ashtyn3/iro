## :toolbox: Functions

- [assetPath](#gear-assetpath)
- [Items.perform](#gear-items.perform)
- [Inventory](#gear-inventory)
- [MenuHolder](#gear-menuholder)
- [createMenuHolder](#gear-createmenuholder)
- [createEntity](#gear-createentity)
- [Renderable](#gear-renderable)
- [Movable](#gear-movable)
- [Destructible](#gear-destructible)
- [Collectable](#gear-collectable)
- [Storeable](#gear-storeable)
- [promote](#gear-promote)
- [deserializeEntity](#gear-deserializeentity)

### :gear: assetPath

| Function | Type |
| ---------- | ---------- |
| `assetPath` | `(name: string) => Promise<any>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/inventory.ts#L26)

### :gear: Items.perform

| Function | Type |
| ---------- | ---------- |
| `Items.perform` | `() => Promise<void>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/inventory.ts#L29)

### :gear: Inventory

| Function | Type |
| ---------- | ---------- |
| `Inventory` | `Component<Inventory, { slots: number; dominant: "right" or "left"; Items?: { item: Item; count: number; }[] or undefined; hands?: { right: Item; left: Item; } or undefined; }>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/inventory.ts#L165)

### :gear: MenuHolder

| Function | Type |
| ---------- | ---------- |
| `MenuHolder` | `Component<MenuHolder, { menu: () => Element; }>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/inventory.ts#L232)

### :gear: createMenuHolder

| Function | Type |
| ---------- | ---------- |
| `createMenuHolder` | `(engine: Engine) => Existable and Syncable and MenuHolder` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/inventory.ts#L252)

### :gear: createEntity

| Function | Type |
| ---------- | ---------- |
| `createEntity` | `(e: Engine, char: string, fg?: string or undefined, bg?: string or undefined) => Entity` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L33)

### :gear: Renderable

| Function | Type |
| ---------- | ---------- |
| `Renderable` | `Component<Renderable, () => void>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L51)

### :gear: Movable

| Function | Type |
| ---------- | ---------- |
| `Movable` | `Component<Movable, RecordOf<IVec2d>>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L62)

### :gear: Destructible

| Function | Type |
| ---------- | ---------- |
| `Destructible` | `Component<Destructible, number>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L95)

### :gear: Collectable

| Function | Type |
| ---------- | ---------- |
| `Collectable` | `Component<Collectable, {}>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L113)

### :gear: Storeable

| Function | Type |
| ---------- | ---------- |
| `Storeable` | `Component<Storeable, string>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L164)

### :gear: promote

| Function | Type |
| ---------- | ---------- |
| `promote` | `(e: Engine, pos: RecordOf<IVec2d>, params?: { [key: string]: any; } or undefined) => Entity` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L227)

### :gear: deserializeEntity

| Function | Type |
| ---------- | ---------- |
| `deserializeEntity` | `(engine: Engine, data: any, existingEntity?: Entity or undefined) => Entity` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L260)


## :wrench: Constants

- [COLORS](#gear-colors)
- [VIEWPORT](#gear-viewport)

### :gear: COLORS

| Constant | Type |
| ---------- | ---------- |
| `COLORS` | `{ grass: { close: string; far: string; superFar: string; }; water: { close: string; far: string; superFar: string; }; rock: { close: string; far: string; superFar: string; }; copper: { close: string; far: string; superFar: string; }; wood: { ...; }; leafs: { ...; }; struct: { ...; }; tree: { ...; }; }` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L8)

### :gear: VIEWPORT

| Constant | Type |
| ---------- | ---------- |
| `VIEWPORT` | `RecordOf<IVec2d>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L62)


## :factory: EntityBuilder

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L200)

### Methods

- [add](#gear-add)
- [build](#gear-build)

#### :gear: add

| Method | Type |
| ---------- | ---------- |
| `add` | `<Mi extends Component<any, any>>(fn: Mi, params: ParamsOf<Mi>) => EntityBuilder<[...M, Mi]>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L210)

#### :gear: build

| Method | Type |
| ---------- | ---------- |
| `build` | `() => Existable and UnionToIntersection<AddedOf<M[number]>>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L222)

## :factory: GPURenderer

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/gpu.ts#L5)

## :factory: GMap

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L94)

### Methods

- [getViewport](#gear-getviewport)
- [loadMap](#gear-loadmap)
- [interpolateColor](#gear-interpolatecolor)
- [dither](#gear-dither)
- [renderCPU](#gear-rendercpu)
- [buildClusterIndex](#gear-buildclusterindex)
- [getClusterAt](#gear-getclusterat)
- [removeCluster](#gear-removecluster)
- [worldToViewport](#gear-worldtoviewport)
- [viewportToWorld](#gear-viewporttoworld)

#### :gear: getViewport

| Method | Type |
| ---------- | ---------- |
| `getViewport` | `() => { x: number; y: number; width: number; height: number; }` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L138)

#### :gear: loadMap

| Method | Type |
| ---------- | ---------- |
| `loadMap` | `(id: string) => Promise<boolean>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L310)

#### :gear: interpolateColor

| Method | Type |
| ---------- | ---------- |
| `interpolateColor` | `(color1: string, color2: string, factor: number) => string` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L339)

#### :gear: dither

| Method | Type |
| ---------- | ---------- |
| `dither` | `(total_dist: number, hi_dist: number, dith_dist: number, steps: number, start: string, end: string) => string` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L356)

#### :gear: renderCPU

| Method | Type |
| ---------- | ---------- |
| `renderCPU` | `() => void` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L408)

#### :gear: buildClusterIndex

| Method | Type |
| ---------- | ---------- |
| `buildClusterIndex` | `() => void` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L473)

#### :gear: getClusterAt

| Method | Type |
| ---------- | ---------- |
| `getClusterAt` | `(pt: RecordOf<IVec2d>) => Cluster or undefined` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L487)

#### :gear: removeCluster

| Method | Type |
| ---------- | ---------- |
| `removeCluster` | `(clusterToRemove: Cluster) => Promise<void>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L577)

#### :gear: worldToViewport

| Method | Type |
| ---------- | ---------- |
| `worldToViewport` | `(worldX: number, worldY: number) => { x: number; y: number; } or null` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L654)

#### :gear: viewportToWorld

| Method | Type |
| ---------- | ---------- |
| `viewportToWorld` | `(viewportX: number, viewportY: number) => { x: number; y: number; }` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L674)

### Properties

- [width](#gear-width)
- [height](#gear-height)
- [map](#gear-map)
- [engine](#gear-engine)
- [tiles](#gear-tiles)
- [computedClusters](#gear-computedclusters)
- [gpu](#gear-gpu)
- [useGPU](#gear-usegpu)
- [mapId](#gear-mapid)
- [convex](#gear-convex)
- [saved](#gear-saved)
- [writeQueue](#gear-writequeue)
- [VIEW_RADIUS](#gear-view_radius)

#### :gear: width

| Property | Type |
| ---------- | ---------- |
| `width` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L95)

#### :gear: height

| Property | Type |
| ---------- | ---------- |
| `height` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L96)

#### :gear: map

| Property | Type |
| ---------- | ---------- |
| `map` | `number[][]` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L97)

#### :gear: engine

| Property | Type |
| ---------- | ---------- |
| `engine` | `Engine` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L98)

#### :gear: tiles

| Property | Type |
| ---------- | ---------- |
| `tiles` | `Tile[][]` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L99)

#### :gear: computedClusters

| Property | Type |
| ---------- | ---------- |
| `computedClusters` | `Clusters` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L100)

#### :gear: gpu

| Property | Type |
| ---------- | ---------- |
| `gpu` | `GPURenderer` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L101)

#### :gear: useGPU

| Property | Type |
| ---------- | ---------- |
| `useGPU` | `boolean` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L102)

#### :gear: mapId

| Property | Type |
| ---------- | ---------- |
| `mapId` | `string` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L103)

#### :gear: convex

| Property | Type |
| ---------- | ---------- |
| `convex` | `ConvexClient` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L104)

#### :gear: saved

| Property | Type |
| ---------- | ---------- |
| `saved` | `boolean` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L105)

#### :gear: writeQueue

| Property | Type |
| ---------- | ---------- |
| `writeQueue` | `{ x: number; y: number; tile: Tile; }[]` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L106)

#### :gear: VIEW_RADIUS

| Property | Type |
| ---------- | ---------- |
| `VIEW_RADIUS` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L375)

## :factory: Engine

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L12)

### Methods

- [viewport](#gear-viewport)
- [render](#gear-render)

#### :gear: viewport

| Method | Type |
| ---------- | ---------- |
| `viewport` | `() => RecordOf<IVec2d>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L149)

#### :gear: render

| Method | Type |
| ---------- | ---------- |
| `render` | `() => Promise<void>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L159)

### Properties

- [width](#gear-width)
- [height](#gear-height)
- [display](#gear-display)
- [mapBuilder](#gear-mapbuilder)
- [player](#gear-player)
- [scheduler](#gear-scheduler)
- [engine](#gear-engine)
- [state](#gear-state)
- [clock](#gear-clock)
- [cycles](#gear-cycles)
- [convex](#gear-convex)
- [menuHolder](#gear-menuholder)

#### :gear: width

| Property | Type |
| ---------- | ---------- |
| `width` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L13)

#### :gear: height

| Property | Type |
| ---------- | ---------- |
| `height` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L14)

#### :gear: display

| Property | Type |
| ---------- | ---------- |
| `display` | `Display` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L15)

#### :gear: mapBuilder

| Property | Type |
| ---------- | ---------- |
| `mapBuilder` | `GMap` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L16)

#### :gear: player

| Property | Type |
| ---------- | ---------- |
| `player` | `Existable and Syncable and Inventory and Renderable and Movable and Storeable and Air` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L17)

#### :gear: scheduler

| Property | Type |
| ---------- | ---------- |
| `scheduler` | `Simple<any>` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L19)

#### :gear: engine

| Property | Type |
| ---------- | ---------- |
| `engine` | `Engine` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L20)

#### :gear: state

| Property | Type |
| ---------- | ---------- |
| `state` | `State` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L21)

#### :gear: clock

| Property | Type |
| ---------- | ---------- |
| `clock` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L22)

#### :gear: cycles

| Property | Type |
| ---------- | ---------- |
| `cycles` | `number` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L23)

#### :gear: convex

| Property | Type |
| ---------- | ---------- |
| `convex` | `ConvexClient` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L24)

#### :gear: menuHolder

| Property | Type |
| ---------- | ---------- |
| `menuHolder` | `MenuHolder` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/index.ts#L25)

## :nut_and_bolt: Enum

- [TileKinds](#gear-tilekinds)

### :gear: TileKinds



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `grass` | `` |  |
| `water` | `` |  |
| `rock` | `` |  |
| `copper` | `` |  |
| `wood` | `` |  |
| `leafs` | `` |  |
| `struct` | `` |  |
| `tree` | `` |  |


## :tropical_drink: Interfaces

- [Item](#gear-item)
- [Inventory](#gear-inventory)
- [MenuHolder](#gear-menuholder)
- [Existable](#gear-existable)
- [Entity](#gear-entity)
- [Renderable](#gear-renderable)
- [Movable](#gear-movable)
- [Destructible](#gear-destructible)
- [Collectable](#gear-collectable)
- [Storeable](#gear-storeable)
- [promotion](#gear-promotion)
- [Tile](#gear-tile)

### :gear: Item



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `name` | `string` |  |
| `sprite` | `string[]` |  |
| `usable` | `boolean` |  |


### :gear: Inventory



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `Items` | `{ count: number; item: Item; }[]` |  |
| `hands` | `{ right: Item; left: Item; }` |  |
| `dominant` | `"right" or "left"` |  |
| `put` | `(item: { count: number; item: Item; }) => void` |  |
| `handPut` | `(item: Item, hand: "right" or "left") => void` |  |
| `handSwap` | `() => void` |  |


### :gear: MenuHolder



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `displayed` | `boolean` |  |
| `Menu` | `() => Element` |  |
| `setMenu` | `(menu: () => Element) => void` |  |
| `menuOff` | `() => null` |  |


### :gear: Existable



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `engine` | `Engine` |  |


### :gear: Entity



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `char` | `string` |  |
| `fg` | `string or undefined` |  |
| `bg` | `string or undefined` |  |


### :gear: Renderable



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `render` | `() => void` |  |


### :gear: Movable



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `position` | `RecordOf<IVec2d>` |  |
| `move` | `(delta: RecordOf<IVec2d>) => void` |  |


### :gear: Destructible



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `health` | `number` |  |


### :gear: Collectable



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `collect` | `(item: Item, amount: number) => boolean` |  |


### :gear: Storeable



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `store` | `() => Promise<void>` |  |
| `id` | `string` |  |
| `serialize` | `() => any` |  |
| `deserialize` | `(data: any) => void` |  |
| `sync` | `() => Promise<void>` |  |


### :gear: promotion



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `type` | `string` |  |


### :gear: Tile



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `fg` | `string or undefined` |  |
| `bg` | `string or undefined` |  |
| `char` | `string` |  |
| `boundary` | `boolean` |  |
| `kind` | `TileKinds` |  |
| `mask` | `{ fg: string; bg: string; char: string; kind: TileKinds; promotable: promotion; } or null` |  |
| `promotable` | `promotion or undefined` |  |


## :cocktail: Types

- [EntityTypes](#gear-entitytypes)
- [Cluster](#gear-cluster)
- [Clusters](#gear-clusters)

### :gear: EntityTypes

| Type | Type |
| ---------- | ---------- |
| `EntityTypes` | `norm" or "destructable" or "collectable` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/entity.ts#L21)

### :gear: Cluster

| Type | Type |
| ---------- | ---------- |
| `Cluster` | `{ kind: TileKinds; points: Vec2d[]; center: Vec2d; }` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L64)

### :gear: Clusters

| Type | Type |
| ---------- | ---------- |
| `Clusters` | `{ [key in TileKinds]: Cluster[]; }` |

[:link: Source](https://github.com/yourusername/game-engine/tree/main/src/lib/map.ts#L70)

