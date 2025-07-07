import * as MongoDB from 'mongodb'
import { assert } from '../../common/assert'
import { Disposable } from '../../common/disposable'
import { config } from '../config'

export interface Id {
  _id: string
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] | DeepPartial<T[P]> | undefined
}

type Nullable<T> = {
  [P in keyof T]?: T[P] | null | undefined
}

export type FindOption<T> = {
  sort?: { [K in keyof T]?: -1 | 1 }
  limit?: number
  skip?: number
}

export class DbConnection extends Disposable {
  client!: MongoDB.MongoClient
  db!: MongoDB.Db

  constructor() {
    super()
    this.register(() => {
      this.close()
    })
  }

  async connect() {
    assert(!this.client, 'Database already connected')
    this.client = await MongoDB.MongoClient.connect(config.mongodb.url)
    this.db = this.client.db(config.mongodb.database)
  }

  async close() {
    if (this.client) {
      await this.client.close()
      this.client = undefined!
      this.db = undefined!
    }
  }
}

export class Table<T extends Id> {
  collection: MongoDB.Collection<T>
  private indices = new Set<keyof T>()

  constructor(connection: DbConnection, name: string) {
    this.collection = connection.db.collection<T>(name)
  }

  async add(item: T): Promise<void> {
    await this.collection.insertOne(item as MongoDB.OptionalUnlessRequiredId<T>)
  }

  async addMulti(items: T[]): Promise<void> {
    await this.collection.insertMany(items as MongoDB.OptionalUnlessRequiredId<T>[])
  }

  async find(query: DeepPartial<T>, option?: FindOption<T>): Promise<T[]> {
    const { limit, skip, sort } = option || {}
    let cursor = this.collection.find(query as any)

    if (sort) {
      cursor = cursor.sort(sort as any)
    }
    if (skip) {
      cursor = cursor.skip(skip)
    }
    if (limit && Number.isFinite(limit)) {
      cursor = cursor.limit(limit)
    }

    return (await cursor.toArray()) as T[]
  }

  async findOne(query: DeepPartial<T>): Promise<T | undefined> {
    const result = await this.collection.findOne(query as any)
    return (result as T) || undefined
  }

  async findAll(option?: FindOption<T>): Promise<T[]> {
    return this.find({}, option)
  }

  async count(query: DeepPartial<T>): Promise<number> {
    return this.collection.countDocuments(query as any)
  }

  async remove(query: DeepPartial<T>): Promise<void> {
    await this.collection.deleteOne(query as any)
  }

  async removeMulti(query: DeepPartial<T>): Promise<number> {
    const result = await this.collection.deleteMany(query as any)
    return result.deletedCount
  }

  async update(query: DeepPartial<T> & Id, item: Nullable<T>): Promise<T> {
    const filteredItem = this.filterUndefined(item)
    await this.collection.updateOne(query as any, {
      $set: filteredItem as any,
    })
    const updated = await this.findOne(query)
    if (!updated) throw new Error('Update failed: Document not found')
    return updated
  }

  async upsert(query: DeepPartial<T> & Id, item: T): Promise<void> {
    await this.collection.updateOne(query as any, { $set: item }, { upsert: true })
  }

  async setIndex(field: keyof T): Promise<void> {
    if (this.indices.has(field)) return
    await this.collection.createIndex({ [field]: 1 })
    this.indices.add(field)
  }

  private filterUndefined<U extends object>(obj: U): { [K in keyof U]: Exclude<U[K], undefined> } {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = value
      }
    }
    return result
  }
}
