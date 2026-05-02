/**
 * MongoDB connection using Mongoose.
 * Equivalent of Python's core/database.py
 */
import mongoose from 'mongoose';
import { MONGO_URL, DB_NAME } from './config';

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
  console.info(`[DB] Connected to MongoDB — database: ${DB_NAME}`);
};

// Export the mongoose connection for direct collection access (mirroring Python's db.users, db.doctors etc.)
export const db = {
  users: () => mongoose.connection.collection('users'),
  doctors: () => mongoose.connection.collection('doctors'),
  appointments: () => mongoose.connection.collection('appointments'),
  transactions: () => mongoose.connection.collection('transactions'),
  activity_logs: () => mongoose.connection.collection('activity_logs'),
};
