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
    // 1. Fetch account info (no password_hash)
    const { data: account, error: accErr } = await supabase
      .from('users')
      .select('id, username, email, phone, created_at')
      .eq('id', userId)
      .single();

    if (accErr || !account) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // 2. Fetch personal profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, date_of_birth, gender, state_of_domicile, reservation_category')
      .eq('user_id', userId)
      .maybeSingle();

    // 3. Fetch education records (with safe fallback for pre-migration schemas)
    let edu10: any = null;
    const { data: e10Full, error: e10Err } = await supabase
      .from('education_10th')
      .select('school_name, board, board_other, passing_year, percentage, percentage_or_cgpa')
      .eq('user_id', userId)
      .maybeSingle();

    if (!e10Err) {
      edu10 = e10Full;
    } else if (e10Err.code === '42703') {
      const { data: e10Base } = await supabase
        .from('education_10th')
        .select('school_name, board, passing_year, percentage')
        .eq('user_id', userId)
        .maybeSingle();
      edu10 = e10Base;
    }

    let edu12: any = null;
    const { data: e12Full, error: e12Err } = await supabase
      .from('education_12th')
      .select('college_name, school_college_name, board, board_other, stream, stream_other, passing_year, percentage, percentage_or_cgpa, subjects')
      .eq('user_id', userId)
      .maybeSingle();

    if (!e12Err) {
      edu12 = e12Full;
    } else if (e12Err.code === '42703') {
      const { data: e12Base } = await supabase
        .from('education_12th')
        .select('school_college_name, board, stream, passing_year, percentage')
        .eq('user_id', userId)
        .maybeSingle();
      edu12 = e12Base;
    }

    let eduGrad: any = null;
    const { data: gradFull, error: gradErr } = await supabase
      .from('education_graduation')
      .select('degree, degree_other, branch, branch_other, college_name, university, passing_year, percentage_or_cgpa')
      .eq('user_id', userId)
      .maybeSingle();

    if (!gradErr) {
      eduGrad = gradFull;
    } else if (gradErr.code === '42703') {
      const { data: gradBase } = await supabase
        .from('education_graduation')
        .select('degree, branch, university, passing_year, percentage_or_cgpa')
        .eq('user_id', userId)
        .maybeSingle();
      eduGrad = gradBase;
    }

    res.status(200).json({
      account,
      profile: profile ?? null,
      education: {
        tenth: edu10 ? {
          school_name: edu10.school_name ?? null,
          board: edu10.board ?? null,
          board_other: edu10.board_other ?? null,
          passing_year: edu10.passing_year ?? null,
          percentage: edu10.percentage ?? null,
          percentage_or_cgpa: edu10.percentage_or_cgpa ?? edu10.percentage ?? null,
        } : null,
        twelfth: edu12 ? {
          college_name: edu12.college_name ?? edu12.school_college_name ?? null,
          school_college_name: edu12.school_college_name ?? edu12.college_name ?? null,
          board: edu12.board ?? null,
          board_other: edu12.board_other ?? null,
          stream: edu12.stream ?? null,
          stream_other: edu12.stream_other ?? null,
          passing_year: edu12.passing_year ?? null,
          percentage: edu12.percentage ?? null,
          percentage_or_cgpa: edu12.percentage_or_cgpa ?? edu12.percentage ?? null,
          subjects: Array.isArray(edu12.subjects) ? edu12.subjects : [],
        } : null,
        graduation: eduGrad ? {
          degree: eduGrad.degree ?? null,
          degree_other: eduGrad.degree_other ?? null,
          branch: eduGrad.branch ?? null,
          branch_other: eduGrad.branch_other ?? null,
          college_name: eduGrad.college_name ?? null,
          university: eduGrad.university ?? null,
          passing_year: eduGrad.passing_year ?? null,
          percentage_or_cgpa: eduGrad.percentage_or_cgpa ?? null,
        } : null,
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

  // Validation
  if (date_of_birth) {
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      res.status(400).json({ message: 'Invalid date of birth format. Please use YYYY-MM-DD.' });
      return;
    }
    if (dob > new Date()) {
      res.status(400).json({ message: 'Date of birth cannot be in the future.' });
      return;
    }
  }

  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          full_name: full_name?.trim() || null,
          date_of_birth: date_of_birth || null,
          gender: gender?.trim() || null,
          state_of_domicile: state_of_domicile?.trim() || null,
          reservation_category: reservation_category?.trim() || null,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('updateProfile error:', error);
      res.status(500).json({ message: 'Failed to update personal profile.' });
      return;
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: 'Personal profile updated successfully.' });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: 'Failed to update personal profile.' });
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
  const { school_name, board, board_other, passing_year, percentage, percentage_or_cgpa } = req.body;

  const percVal = percentage_or_cgpa || percentage || null;
  const yr = passing_year ? parseInt(String(passing_year), 10) : null;

  if (yr !== null && (isNaN(yr) || yr < 1950 || yr > new Date().getFullYear() + 5)) {
    res.status(400).json({ message: 'Please provide a valid passing year.' });
    return;
  }

  try {
    // Attempt upsert with all structured fields
    const { error: fullErr } = await supabase
      .from('education_10th')
      .upsert(
        {
          user_id: userId,
          school_name: school_name?.trim() || null,
          board: board?.trim() || null,
          board_other: board_other?.trim() || null,
          passing_year: yr,
          percentage: percVal,
          percentage_or_cgpa: percVal,
        },
        { onConflict: 'user_id' }
      );

    if (fullErr) {
      // Fallback if board_other or percentage_or_cgpa columns do not exist yet
      if (fullErr.code === '42703') {
        const effectiveBoard = board === 'Other' && board_other ? board_other.trim() : (board?.trim() || null);
        const { error: baseErr } = await supabase
          .from('education_10th')
          .upsert(
            {
              user_id: userId,
              school_name: school_name?.trim() || null,
              board: effectiveBoard,
              passing_year: yr,
              percentage: percVal,
            },
            { onConflict: 'user_id' }
          );

        if (baseErr) {
          console.error('updateEducation10th fallback error:', baseErr);
          res.status(500).json({ message: 'Failed to save 10th education.' });
          return;
        }
      } else {
        console.error('updateEducation10th error:', fullErr);
        res.status(500).json({ message: 'Failed to save 10th education.' });
        return;
      }
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: '10th education saved successfully.' });
  } catch (err) {
    console.error('updateEducation10th error:', err);
    res.status(500).json({ message: 'Failed to save 10th education.' });
  }
}

export async function updateEducation12th(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const {
    school_college_name,
    college_name,
    board,
    board_other,
    stream,
    stream_other,
    passing_year,
    percentage,
    percentage_or_cgpa,
    subjects,
  } = req.body;

  const colName = (college_name || school_college_name || '').trim() || null;
  const percVal = percentage_or_cgpa || percentage || null;
  const yr = passing_year ? parseInt(String(passing_year), 10) : null;
  const subsArray = Array.isArray(subjects) ? subjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];

  if (yr !== null && (isNaN(yr) || yr < 1950 || yr > new Date().getFullYear() + 5)) {
    res.status(400).json({ message: 'Please provide a valid passing year.' });
    return;
  }

  try {
    // Attempt upsert with all structured fields
    const { error: fullErr } = await supabase
      .from('education_12th')
      .upsert(
        {
          user_id: userId,
          college_name: colName,
          school_college_name: colName,
          board: board?.trim() || null,
          board_other: board_other?.trim() || null,
          stream: stream?.trim() || null,
          stream_other: stream_other?.trim() || null,
          passing_year: yr,
          percentage: percVal,
          percentage_or_cgpa: percVal,
          subjects: subsArray,
        },
        { onConflict: 'user_id' }
      );

    if (fullErr) {
      if (fullErr.code === '42703') {
        const effectiveBoard = board === 'Other' && board_other ? board_other.trim() : (board?.trim() || null);
        const effectiveStream = (stream === 'Other' || stream === 'Other Intermediate stream') && stream_other
          ? stream_other.trim()
          : (stream?.trim() || null);

        const { error: baseErr } = await supabase
          .from('education_12th')
          .upsert(
            {
              user_id: userId,
              school_college_name: colName,
              board: effectiveBoard,
              stream: effectiveStream,
              passing_year: yr,
              percentage: percVal,
            },
            { onConflict: 'user_id' }
          );

        if (baseErr) {
          console.error('updateEducation12th fallback error:', baseErr);
          res.status(500).json({ message: 'Failed to save 12th education.' });
          return;
        }
      } else {
        console.error('updateEducation12th error:', fullErr);
        res.status(500).json({ message: 'Failed to save 12th education.' });
        return;
      }
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: '12th education saved successfully.' });
  } catch (err) {
    console.error('updateEducation12th error:', err);
    res.status(500).json({ message: 'Failed to save 12th education.' });
  }
}

export async function updateEducationGraduation(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const {
    degree,
    degree_other,
    branch,
    branch_other,
    college_name,
    university,
    passing_year,
    percentage_or_cgpa,
  } = req.body;

  const yr = passing_year ? parseInt(String(passing_year), 10) : null;
  const univVal = (university || college_name || '').trim() || null;
  const colVal = (college_name || university || '').trim() || null;

  if (yr !== null && (isNaN(yr) || yr < 1950 || yr > new Date().getFullYear() + 10)) {
    res.status(400).json({ message: 'Please provide a valid graduation year.' });
    return;
  }

  try {
    // Attempt upsert with all structured fields
    const { error: fullErr } = await supabase
      .from('education_graduation')
      .upsert(
        {
          user_id: userId,
          degree: degree?.trim() || null,
          degree_other: degree_other?.trim() || null,
          branch: branch?.trim() || null,
          branch_other: branch_other?.trim() || null,
          college_name: colVal,
          university: univVal,
          passing_year: yr,
          percentage_or_cgpa: percentage_or_cgpa?.trim() || null,
        },
        { onConflict: 'user_id' }
      );

    if (fullErr) {
      if (fullErr.code === '42703') {
        const effectiveDegree = degree === 'Other' && degree_other ? degree_other.trim() : (degree?.trim() || null);
        const effectiveBranch = branch === 'Other' && branch_other ? branch_other.trim() : (branch?.trim() || null);

        const { error: baseErr } = await supabase
          .from('education_graduation')
          .upsert(
            {
              user_id: userId,
              degree: effectiveDegree,
              branch: effectiveBranch,
              university: univVal,
              passing_year: yr,
              percentage_or_cgpa: percentage_or_cgpa?.trim() || null,
            },
            { onConflict: 'user_id' }
          );

        if (baseErr) {
          console.error('updateEducationGraduation fallback error:', baseErr);
          res.status(500).json({ message: 'Failed to save graduation education.' });
          return;
        }
      } else {
        console.error('updateEducationGraduation error:', fullErr);
        res.status(500).json({ message: 'Failed to save graduation education.' });
        return;
      }
    }

    await refreshMatchesAfterProfileChange(userId);
    res.status(200).json({ message: 'Graduation education saved successfully.' });
  } catch (err) {
    console.error('updateEducationGraduation error:', err);
    res.status(500).json({ message: 'Failed to save graduation education.' });
  }
}
