import { MongoClient, Db, Collection } from "mongodb";
import { config } from "./config";
import { User, Scan, Report } from "./types";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  db = client.db();
  return db;
}

export async function getCollections(): Promise<{
  users: Collection<User>;
  scans: Collection<Scan>;
  reports: Collection<Report>;
}> {
  const database = await getDb();
  return {
    users: database.collection<User>("users"),
    scans: database.collection<Scan>("scans"),
    reports: database.collection<Report>("reports")
  };
}
