export class Pool {
  constructor(factory) {
    this.factory = factory;
    this.free = [];
  }

  acquire(...args) {
    const item = this.free.pop() ?? this.factory(...args);
    if (typeof item.reset === "function") item.reset(...args);
    return item;
  }

  release(item) {
    this.free.push(item);
  }

  releaseMany(items) {
    for (const item of items) this.release(item);
  }
}
