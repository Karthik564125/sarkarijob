import type { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { refreshUserProfileMatches } from '../services/recruitment/matching.service.js';

async function refreshMatchesAfterProfileChange(userId: string): Promise<void> {
  try {
    const count = await refreshUserProfileMatches(userId);
    if (count > 0) {
      console.log(`[Profile] Re-evaluated ${count} existing match(es) after profile update for ${userId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Profile] Could not refresh matches after profile update for ${userId}: ${msg}`);
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    // Fetch account info (no password_hash)
    const { data: account, error: accErr } = await supabase
      .from('users')
      .select('id, username, email, phone, created_at')
      .eq('id', userId)
      .single();

    if (accErr || !account) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // Fetch personal profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, date_of_birth, gender, state_of_domicile, reservation_category')
      .eq('user_id', userId)
      .maybeSingle();

    // Fetch education records
    const { data: edu10 } = await supabase
      .from('education_10th')
      .select('school_name, board, passing_year, percentage')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: edu12 } = await supabase
      .from('education_12th')
      .select('school_college_name, board, stream, passing_year, percentage')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: eduGrad } = await supabase
      .from('education_graduation')
      .select('degree, branch, university, passing_year, percentage_or_cgpa')
      .eq('user_id', userId)
      .maybeSingle();

    res.status(200).json({
      account,
      profile: profile ?? null,
      education: {
        tenth: edu10 ?? null,
        twelfth: edu12 ?? null,
        graduation: eduGrad ?? null,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { full_name, date_of_birth, gender, state_of_domicile, reservation_category } = req.body;

  try {
    // Upsert personal profile
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, full_name, date_of_birth, gender, state_of_domicile, reservation_category },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('updateProfile error:', error);
      res.status(500).json({ message: 'Failed to update profile.' });
      return;
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: 'Personal profile updated.' });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
}

export async function updateAccountInfo(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { email, phone } = req.body;

  try {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: 'Invalid email format.' });
      return;
    }

    const updates: Record<string, string> = {};
    if (email) updates.email = email.trim().toLowerCase();
    if (phone) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No valid fields to update.' });
      return;
    }

    const { error } = await supabase.from('users').update(updates).eq('id', userId);

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ message: 'That email is already in use.' });
        return;
      }
      res.status(500).json({ message: 'Failed to update account info.' });
      return;
    }

    res.status(200).json({ message: 'Account info updated.' });
  } catch (err) {
    console.error('updateAccountInfo error:', err);
    res.status(500).json({ message: 'Failed to update account info.' });
  }
}

export async function updateEducation10th(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { school_name, board, passing_year, percentage } = req.body;

  try {
    const { error } = await supabase
      .from('education_10th')
      .upsert({ user_id: userId, school_name, board, passing_year, percentage }, { onConflict: 'user_id' });

    if (error) {
      res.status(500).json({ message: 'Failed to save 10th education.' });
      return;
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: '10th education saved.' });
  } catch (err) {
    console.error('updateEducation10th error:', err);
    res.status(500).json({ message: 'Failed to save 10th education.' });
  }
}

export async function updateEducation12th(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { school_college_name, board, stream, passing_year, percentage } = req.body;

  try {
    const { error } = await supabase
      .from('education_12th')
      .upsert(
        { user_id: userId, school_college_name, board, stream, passing_year, percentage },
        { onConflict: 'user_id' }
      );

    if (error) {
      res.status(500).json({ message: 'Failed to save 12th education.' });
      return;
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: '12th education saved.' });
  } catch (err) {
    console.error('updateEducation12th error:', err);
    res.status(500).json({ message: 'Failed to save 12th education.' });
  }
}

export async function updateEducationGraduation(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { degree, branch, university, passing_year, percentage_or_cgpa } = req.body;

  try {
    const { error } = await supabase
      .from('education_graduation')
      .upsert(
        { user_id: userId, degree, branch, university, passing_year, percentage_or_cgpa },
        { onConflict: 'user_id' }
      );

    if (error) {
      res.status(500).json({ message: 'Failed to save graduation education.' });
      return;
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: 'Graduation education saved.' });
  } catch (err) {
    console.error('updateEducationGraduation error:', err);
    res.status(500).json({ message: 'Failed to save graduation education.' });
  }
}
