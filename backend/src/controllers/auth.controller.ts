import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import type { RegisterRequest, LoginRequest, SafeUser } from '../types/auth.types.js';
import { validatePassword } from '../utils/passwordValidation.js';

const BCRYPT_SALT_ROUNDS = 12;

function signToken(userId: string, username: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId, username }, secret, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, username, email, phone, password } = req.body as RegisterRequest;

    // --- Validation ---
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      res.status(400).json({ message: 'Username must be at least 3 characters.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'A valid email is required.' });
      return;
    }

    // --- Validate Password Requirements ---
    const passValidation = validatePassword(password || '');
    if (!passValidation.isValid) {
      res.status(400).json({
        message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
      });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // --- Check for duplicates ---
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${cleanUsername},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (existing) {
      if (existing.username === cleanUsername) {
        res.status(409).json({ message: 'This username is already taken.' });
      } else {
        res.status(409).json({ message: 'An account with this email already exists.' });
      }
      return;
    }

    // --- Hash password (never store plaintext) ---
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // --- Insert user ---
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username: cleanUsername,
        email: cleanEmail,
        phone: phone ?? null,
        password_hash: passwordHash,
      })
      .select('id, username, email, phone, created_at')
      .single();

    if (insertError || !newUser) {
      console.error('Register insert error:', insertError);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
      return;
    }

    // --- Create blank profile row ---
    await supabase.from('user_profiles').insert({
      user_id: newUser.id,
      full_name: fullName ?? null,
    });

    // --- Issue JWT immediately so user is logged in ---
    const token = signToken(newUser.id, newUser.username);

    const safeUser: SafeUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      phone: newUser.phone,
      created_at: newUser.created_at,
    };

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { usernameOrEmail, password } = req.body as LoginRequest;

    if (!usernameOrEmail || !password) {
      res.status(400).json({ message: 'Username/email and password are required.' });
      return;
    }

    const identifier = usernameOrEmail.trim().toLowerCase();

    // --- Find user by username OR email ---
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, phone, password_hash, created_at')
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .maybeSingle();

    if (error) {
      console.error('Login query error:', error);
      res.status(500).json({ message: 'Server error during login.' });
      return;
    }

    // Generic error: don't reveal whether user exists
    if (!user) {
      res.status(401).json({ message: 'Invalid username/email or password.' });
      return;
    }

    // --- Verify password with bcrypt ---
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ message: 'Invalid username/email or password.' });
      return;
    }

    // --- Issue JWT ---
    const token = signToken(user.id, user.username);

    const safeUser: SafeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
    };

    res.status(200).json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required.' });
      return;
    }

    // Validate new password rules
    const passValidation = validatePassword(newPassword);
    if (!passValidation.isValid) {
      res.status(400).json({
        message: 'New password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ message: 'New password must be different from current password.' });
      return;
    }

    // Fetch existing user password_hash
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      res.status(400).json({ message: 'Incorrect current password.' });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    if (updateError) {
      console.error('Change password update error:', updateError);
      res.status(500).json({ message: 'Failed to update password.' });
      return;
    }

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error during password change.' });
  }
}
