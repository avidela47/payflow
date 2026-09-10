import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Cachea la conexión entre invocaciones (necesario en serverless/Next.js
// para no abrir una conexión nueva en cada request/hot-reload).
type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as unknown as { mongoose: MongooseCache };

const cache: MongooseCache = globalForMongoose.mongoose ?? { conn: null, promise: null };
globalForMongoose.mongoose = cache;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en las variables de entorno.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
