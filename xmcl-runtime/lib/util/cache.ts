/**
 * The helper class to hold object with ttl, which is useful for holding web api result.
 */
export class CacheDictionary<T> {
  private cache: Record<string, [T, number] | undefined> = {}

  constructor(readonly ttl: number) { }

  get(key: string | number): T | undefined {
    const entry = this.cache[key]
    if (!entry) {
      return undefined
    }
    const [cache, createAt] = entry
    if (Date.now() - createAt > this.ttl) {
      this.cache[key] = undefined
      return undefined
    }
    return cache
  }

  set(key: string, value: T) {
    this.cache[key] = [value, Date.now()]
  }
}
