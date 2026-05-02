/**
 * Activity log helper.
 * Equivalent of Python's services/activity.py
 */
import { db } from '../core/database';

export const logActivity = async (
  userId: string,
  userName: string,
  action: string,
  details?: string
): Promise<void> => {
  await db.activity_logs().insertOne({
    user_id: userId,
    user_name: userName,
    action,
    details: details ?? null,
    timestamp: new Date(),
  });
};
