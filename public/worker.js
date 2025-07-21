
const TileKinds = {
  grass: 0,
  water: 1,
  rock: 2,
  copper: 3,
  wood: 4,
  leafs: 5,
  struct: 6,
  tree: 7,
  berry: 8,
  ore: 9,
};

class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array(size).fill(0);
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(x, y) {
    const px = this.find(x);
    const py = this.find(y);

    if (px === py) return;

    if (this.rank[px] < this.rank[py]) {
      this.parent[px] = py;
    } else if (this.rank[px] > this.rank[py]) {
      this.parent[py] = px;
    } else {
      this.parent[py] = px;
      this.rank[px]++;
    }
  }
}

const getEffectiveKind = (tile) => {
  if (
    tile.mask?.kind === TileKinds.wood ||
    tile.mask?.kind === TileKinds.leafs
  ) {
    return TileKinds.tree;
  } else return tile.mask?.kind || tile.kind;
};
const coordToIndex = (x, y, height) => x * height + y;

self.onmessage = (event) => {
  const { taskId, startX, endX, width, height, tilesChunk } = event.data;

  try {
    const uf = new UnionFind(width * height);

    
    for (let x = startX; x < endX; x++) {
      const localX = x - startX;
      for (let y = 0; y < height; y++) {
        if (!tilesChunk[localX] || !tilesChunk[localX][y]) continue;

        const currentKind = getEffectiveKind(tilesChunk[localX][y]);
        if (currentKind === TileKinds.grass && !tilesChunk[localX][y].mask)
          continue;

        const currentIndex = coordToIndex(x, y, height);
        const neighbors = [
          		{ x: x - 1, y },
		{ x: x + 1, y },
		{ x, y: y - 1 },
		{ x, y: y + 1 },
        ];

        for (const { x: nx, y: ny } of neighbors) {
          if (nx < width && ny < height) {
            let neighborTile;
            const neighborLocalX = nx - startX;

            if (neighborLocalX >= 0 && neighborLocalX < tilesChunk.length) {
              neighborTile = tilesChunk[neighborLocalX]?.[ny];
            }

            if (neighborTile) {
              const neighborKind = getEffectiveKind(neighborTile);

              if (
                currentKind === neighborKind &&
                !(neighborKind === TileKinds.grass && !neighborTile.mask)
              ) {
                uf.union(currentIndex, coordToIndex(nx, ny, height));
              }
            }
          }
        }
      }
    }

    
    const clusterMap = new Map();

    for (let x = startX; x < endX; x++) {
      const localX = x - startX;
      for (let y = 0; y < height; y++) {
        if (!tilesChunk[localX] || !tilesChunk[localX][y]) continue;

        const kind = getEffectiveKind(tilesChunk[localX][y]);
        if (kind === TileKinds.grass && !tilesChunk[localX][y].mask) continue;

        const index = coordToIndex(x, y, height);
        const root = uf.find(index);

        if (!clusterMap.has(root)) {
          clusterMap.set(root, []);
        }
        clusterMap.get(root).push({ x, y, kind });
      }
    }

    self.postMessage({
      taskId,
      success: true,
      clusters: Array.from(clusterMap.entries()),
    });
  } catch (error) {
    self.postMessage({
      taskId,
      success: false,
      error: error.message,
    });
  }
};
