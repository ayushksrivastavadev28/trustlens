import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { config } from "./config";
import { User, Scan, Report } from "./types";

let client: MongoClient | null = null;
let db: Db | null = null;
let memoryDb: MemoryDb | null = null;

type SortSpec = Record<string, 1 | -1>;

function normalizeId(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof ObjectId) return value.toString();
  if (typeof value.toString === "function") return value.toString();
  return String(value);
}

function matchesQuery(doc: any, query: Record<string, any>) {
  for (const [key, expected] of Object.entries(query || {})) {
    const actual = doc?.[key];
    if (expected && typeof expected === "object" && "$exists" in expected) {
      const exists = Boolean((expected as any).$exists);
      const has = actual !== undefined;
      if (exists !== has) return false;
      continue;
    }

    const actualId = normalizeId(actual);
    const expectedId = normalizeId(expected);
    if (actualId && expectedId) {
      if (actualId !== expectedId) return false;
      continue;
    }

    if (actual !== expected) return false;
  }
  return true;
}

class MemoryCursor<T extends Record<string, any>> {
  private docs: T[];

  constructor(docs: T[]) {
    this.docs = docs;
  }

  sort(spec: SortSpec) {
    const [key, dir] = Object.entries(spec)[0] || [];
    if (!key) return this;
    this.docs.sort((a, b) => {
      const av = (a as any)[key];
      const bv = (b as any)[key];
      if (av === bv) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return (av > bv ? 1 : -1) * (dir === -1 ? -1 : 1);
    });
    return this;
  }

  limit(n: number) {
    this.docs = this.docs.slice(0, Math.max(0, n));
    return this;
  }

  async toArray() {
    return this.docs.map((d) => ({ ...d })) as T[];
  }
}

class MemoryCollection<T extends Record<string, any>> {
  private name: string;
  private store: T[];

  constructor(name: string, store: T[]) {
    this.name = name;
    this.store = store;
  }

  async findOne(query: Record<string, any>) {
    const doc = this.store.find((d) => matchesQuery(d, query));
    return doc ? ({ ...doc } as T) : null;
  }

  find(query: Record<string, any>) {
    const matched = this.store.filter((d) => matchesQuery(d, query || {}));
    return new MemoryCursor<T>(matched.map((d) => ({ ...d } as T)));
  }

  async insertOne(doc: T) {
    const withId = { ...doc } as any;
    if (!withId._id) withId._id = new ObjectId();
    this.store.push(withId);
    return { insertedId: withId._id };
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>) {
    const idx = this.store.findIndex((d) => matchesQuery(d, filter));
    if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
    const current: any = { ...this.store[idx] };
    const setValues = (update as any).$set || {};
    const incValues = (update as any).$inc || {};

    for (const [k, v] of Object.entries(setValues)) {
      current[k] = v;
    }
    for (const [k, v] of Object.entries(incValues)) {
      const num = Number(v || 0);
      current[k] = Number(current[k] || 0) + num;
    }
    this.store[idx] = current;
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async countDocuments(query: Record<string, any> = {}) {
    return this.store.filter((d) => matchesQuery(d, query)).length;
  }
}

class MemoryDb {
  users: any[] = [];
  scans: any[] = [];
  reports: any[] = [];

  collection<T extends Record<string, any>>(name: "users" | "scans" | "reports") {
    if (name === "users") return new MemoryCollection<T>(name, this.users as T[]);
    if (name === "scans") return new MemoryCollection<T>(name, this.scans as T[]);
    return new MemoryCollection<T>(name, this.reports as T[]);
  }
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  try {
    client = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    db = client.db();
    return db;
  } catch (err: any) {
    if (!memoryDb) {
      memoryDb = new MemoryDb();
      console.error("[db] MongoDB connect failed. Falling back to in-memory DB.", err?.message || err);
    }
    db = memoryDb as unknown as Db;
    return db;
  }
}

export async function getCollections(): Promise<{
  users: Collection<User> | any;
  scans: Collection<Scan> | any;
  reports: Collection<Report> | any;
}> {
  const database = await getDb();
  return {
    users: database.collection<User>("users"),
    scans: database.collection<Scan>("scans"),
    reports: database.collection<Report>("reports")
  };
}
