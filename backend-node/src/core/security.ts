/**
 * Password hashing + JWT token creation.
 * Equivalent of Python's core/security.py
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 12);
};

export const verifyPassword = (plain: string, hashed: string): boolean => {
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch {
    return false;
  }
};

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  exp?: number;
}

export const createToken = (userId: string, email: string, role: string): string => {
  const payload: TokenPayload = { sub: userId, email, role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const decodeToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};
