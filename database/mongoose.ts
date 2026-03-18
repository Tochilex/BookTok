import mongoose from "mongoose";
import { ca, th } from "zod/locales";

const MONGODB_URI=process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
    )
}

// Global is used here to maintain a cached connection across hot reloads in development. 
// This prevents connections growing exponentially during API Route usage.
declare global {
    var mongooseCache: {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
    }
}

let cached = global.mongooseCache || (global.mongooseCache ={ conn: null, promise: null});

// This function is used to connect to the MongoDB database using Mongoose. 
// It checks if there is an existing connection in the cache and returns it if available. 
// If not, it creates a new connection and stores it in the cache for future use.
export const connectToDatabase = async () => {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false })
    }

    try {
        cached.conn = await cached.promise;

    } catch (e) {
        cached.promise = null;
        console.error('MongoDB connection error. Please make sure MongoDB is running.' + e);
        throw e;
    }

    console.info('Connected to MongoDB');
    return cached.conn;
}