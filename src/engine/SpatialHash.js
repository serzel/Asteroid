export class SpatialHash {
  constructor(cellSize = 96) {
    this.cellSize = Math.max(1, cellSize);
    this.invCellSize = 1 / this.cellSize;
    this.buckets = new Map();
    this._queryId = 0;
    this._seenByItem = new WeakMap();
  }

  clear() {
    this.buckets.clear();
  }

  insert(item, x, y, radius = 0) {
    const minCellX = Math.floor((x - radius) * this.invCellSize);
    const maxCellX = Math.floor((x + radius) * this.invCellSize);
    const minCellY = Math.floor((y - radius) * this.invCellSize);
    const maxCellY = Math.floor((y + radius) * this.invCellSize);

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const key = `${cellX},${cellY}`;
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(item);
      }
    }
  }

  query(x, y, radius = 0, out) {
    this._queryId += 1;
    const queryId = this._queryId;

    const minCellX = Math.floor((x - radius) * this.invCellSize);
    const maxCellX = Math.floor((x + radius) * this.invCellSize);
    const minCellY = Math.floor((y - radius) * this.invCellSize);
    const maxCellY = Math.floor((y + radius) * this.invCellSize);

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const bucket = this.buckets.get(`${cellX},${cellY}`);
        if (!bucket) continue;

        for (const item of bucket) {
          if (this._seenByItem.get(item) === queryId) continue;
          this._seenByItem.set(item, queryId);
          out.push(item);
        }
      }
    }

    return out;
  }
}
