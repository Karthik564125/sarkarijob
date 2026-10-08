// Types for auth-related request/response shapes

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

// Safe user object — never includes password_hash
export interface SafeUser {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  created_at: string;
}

// What we embed in the JWT payload
export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
