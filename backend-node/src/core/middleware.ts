/**
 * Express middleware: authenticate JWT and inject current user.
 * Equivalent of Python's core/deps.py
 */
import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { db } from './database';
import { decodeToken } from './security';

// Extend Express Request to carry the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Record<string, unknown>;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Not authenticated' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = decodeToken(token);
    const user = await db.users().findOne({ _id: new ObjectId(payload.sub) });
    if (!user) {
      res.status(401).json({ detail: 'User not found' });
      return;
    }
    // Sanitise and attach user to request
    const safeUser: Record<string, unknown> = { ...user };
    safeUser['_id'] = String(safeUser['_id']);
    delete safeUser['password_hash'];
    req.user = safeUser;
    next();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      res.status(401).json({ detail: 'Token expired' });
    } else {
      res.status(401).json({ detail: 'Invalid token' });
    }
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await requireAuth(req, res, async () => {
    if (req.user?.['role'] !== 'admin') {
      res.status(403).json({ detail: 'Admin access required' });
      return;
    }
    next();
  });
};
