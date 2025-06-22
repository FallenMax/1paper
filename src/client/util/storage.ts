export class Storage<T> {
  constructor(private ns: string) {}

  prefixed(key: keyof T) {
    return `${this.ns}:${key as string}`
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    try {
      const thing = localStorage.getItem(this.prefixed(key)) as any
      if (!thing) return undefined
      return JSON.parse(thing) as T[K]
    } catch (error) {
      return undefined
    }
  }
  getAll<K extends keyof T>(): T[K][] {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.ns + ':'))
      return keys.map((key) => this.get(key.substring(this.ns.length + 1) as K) as T[K])
    } catch (error) {
      return []
    }
  }
  set<K extends keyof T>(key: K, value: T[K]) {
    try {
      localStorage.setItem(this.prefixed(key), JSON.stringify(value))
    } catch (error) {}
  }
  remove<K extends keyof T>(key: K) {
    try {
      localStorage.removeItem(this.prefixed(key))
    } catch (error) {}
  }
  clear() {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.ns + ':'))
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {}
  }
}
