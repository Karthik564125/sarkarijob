export const TENTH_BOARDS = [
  'State Board',
  'CBSE',
  'ICSE',
  'NIOS',
  'Other',
] as const;

export const TWELFTH_BOARDS = [
  'State Board',
  'CBSE',
  'ISC',
  'NIOS',
  'Other',
] as const;

export const TWELFTH_STREAMS = [
  'MPC — Mathematics, Physics, Chemistry',
  'BiPC — Biology, Physics, Chemistry',
  'MBiPC — Mathematics, Biology, Physics, Chemistry',
  'CEC — Civics, Economics, Commerce',
  'MEC — Mathematics, Economics, Commerce',
  'HEC — History, Economics, Civics',
  'Other Intermediate stream',
  'Polytechnic / Diploma',
  'Other',
] as const;

export const COMMON_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Botany',
  'Zoology',
  'Computer Science',
  'Economics',
  'Commerce',
  'Accountancy',
  'Civics',
  'History',
  'English',
  'Hindi',
  'Sanskrit',
  'Statistics',
  'Geography',
  'Political Science',
] as const;

export const GRADUATION_DEGREES = [
  'B.Tech / B.E.',
  'B.Sc.',
  'B.Com.',
  'B.A.',
  'BBA',
  'BCA',
  'B.Pharmacy',
  'B.Arch.',
  'B.Ed.',
  'LLB',
  'M.Tech / M.E.',
  'M.Sc.',
  'M.Com.',
  'M.A.',
  'MCA',
  'MBA',
  'Ph.D.',
  'Polytechnic / Diploma',
  'Other',
] as const;

export const DEGREE_BRANCH_MAP: Record<string, string[]> = {
  'B.Tech / B.E.': [
    'Computer Science and Engineering',
    'Information Technology',
    'Electronics and Communication Engineering',
    'Electrical and Electronics Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Biotechnology',
    'Aerospace Engineering',
    'Instrumentation Engineering',
    'Metallurgical Engineering',
    'Other Engineering Branch',
    'Other',
  ],
  'M.Tech / M.E.': [
    'Computer Science and Engineering',
    'Information Technology',
    'Electronics and Communication Engineering',
    'Electrical and Electronics Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Biotechnology',
    'Aerospace Engineering',
    'Instrumentation Engineering',
    'Metallurgical Engineering',
    'Other Engineering Branch',
    'Other',
  ],
  'B.Sc.': [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Statistics',
    'Biology',
    'Zoology',
    'Botany',
    'Agriculture',
    'Biotechnology',
    'Electronics',
    'Other',
  ],
  'M.Sc.': [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Statistics',
    'Biology',
    'Zoology',
    'Botany',
    'Agriculture',
    'Biotechnology',
    'Electronics',
    'Other',
  ],
  'B.Com.': [
    'General',
    'Computer Applications',
    'Accounting and Finance',
    'Banking and Insurance',
    'Taxation',
    'Other',
  ],
  'M.Com.': [
    'General',
    'Computer Applications',
    'Accounting and Finance',
    'Banking and Insurance',
    'Taxation',
    'Other',
  ],
  'B.A.': [
    'History',
    'Political Science',
    'Economics',
    'English Literature',
    'Sociology',
    'Public Administration',
    'Psychology',
    'Geography',
    'Other',
  ],
  'M.A.': [
    'History',
    'Political Science',
    'Economics',
    'English Literature',
    'Sociology',
    'Public Administration',
    'Psychology',
    'Geography',
    'Other',
  ],
  'BBA': [
    'General Management',
    'Finance',
    'Marketing',
    'Human Resource Management',
    'Operations Management',
    'Information Technology',
    'Other',
  ],
  'MBA': [
    'General Management',
    'Finance',
    'Marketing',
    'Human Resource Management',
    'Operations Management',
    'Information Technology',
    'International Business',
    'Other',
  ],
  'BCA': [
    'Computer Applications',
    'Software Development',
    'Data Science',
    'Cloud Computing',
    'Other',
  ],
  'MCA': [
    'Computer Applications',
    'Software Development',
    'Data Science',
    'Cloud Computing',
    'Other',
  ],
  'Polytechnic / Diploma': [
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Computer Engineering',
    'Automobile Engineering',
    'Chemical Engineering',
    'Other',
  ],
};

function normalizeString(val: string): string {
  return val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mapLegacyTenthBoard(raw: string | null | undefined): { board: string; board_other?: string } {
  if (!raw || !raw.trim()) return { board: '' };
  const trimmed = raw.trim();
  const norm = normalizeString(trimmed);

  if (norm.includes('state') || norm.includes('ssc') || norm.includes('matric')) return { board: 'State Board' };
  if (norm.includes('cbse')) return { board: 'CBSE' };
  if (norm.includes('icse')) return { board: 'ICSE' };
  if (norm.includes('nios')) return { board: 'NIOS' };

  for (const opt of TENTH_BOARDS) {
    if (opt !== 'Other' && normalizeString(opt) === norm) return { board: opt };
  }

  return { board: 'Other', board_other: trimmed };
}

export function mapLegacyTwelfthBoard(raw: string | null | undefined): { board: string; board_other?: string } {
  if (!raw || !raw.trim()) return { board: '' };
  const trimmed = raw.trim();
  const norm = normalizeString(trimmed);

  if (norm.includes('state') || norm.includes('bieap') || norm.includes('tsbie') || norm.includes('hsc') || norm.includes('intermediate')) {
    return { board: 'State Board' };
  }
  if (norm.includes('cbse')) return { board: 'CBSE' };
  if (norm.includes('isc')) return { board: 'ISC' };
  if (norm.includes('nios')) return { board: 'NIOS' };

  for (const opt of TWELFTH_BOARDS) {
    if (opt !== 'Other' && normalizeString(opt) === norm) return { board: opt };
  }

  return { board: 'Other', board_other: trimmed };
}

export function mapLegacyTwelfthStream(raw: string | null | undefined): { stream: string; stream_other?: string } {
  if (!raw || !raw.trim()) return { stream: '' };
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/);

  if (lower.includes('polytechnic') || lower.includes('diploma')) return { stream: 'Polytechnic / Diploma' };
  if (lower.includes('mbipc') || (words.includes('maths') && words.includes('biology'))) return { stream: 'MBiPC — Mathematics, Biology, Physics, Chemistry' };
  if (words.includes('bipc') || lower.includes('bi.p.c') || (words.includes('biology') && words.includes('physics'))) return { stream: 'BiPC — Biology, Physics, Chemistry' };
  if (words.includes('mpc') || (words.includes('mathematics') && words.includes('physics') && words.includes('chemistry'))) return { stream: 'MPC — Mathematics, Physics, Chemistry' };
  if (words.includes('cec') || (words.includes('civics') && words.includes('economics') && words.includes('commerce'))) return { stream: 'CEC — Civics, Economics, Commerce' };
  if (words.includes('mec') || (words.includes('mathematics') && words.includes('economics') && words.includes('commerce'))) return { stream: 'MEC — Mathematics, Economics, Commerce' };
  if (words.includes('hec') || (words.includes('history') && words.includes('economics') && words.includes('civics'))) return { stream: 'HEC — History, Economics, Civics' };
  if (words.includes('science')) return { stream: 'Other Intermediate stream', stream_other: 'Science' };
  if (words.includes('commerce')) return { stream: 'Other Intermediate stream', stream_other: 'Commerce' };
  if (words.includes('arts') || words.includes('humanities')) return { stream: 'Other Intermediate stream', stream_other: trimmed };

  const norm = normalizeString(trimmed);
  for (const opt of TWELFTH_STREAMS) {
    if (opt !== 'Other' && normalizeString(opt) === norm) return { stream: opt };
  }

  return { stream: 'Other', stream_other: trimmed };
}

export function mapLegacyGraduationDegree(raw: string | null | undefined): { degree: string; degree_other?: string } {
  if (!raw || !raw.trim()) return { degree: '' };
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/);

  if (lower.includes('pharm')) return { degree: 'B.Pharmacy' };
  if (lower.includes('arch')) return { degree: 'B.Arch.' };
  if (words.includes('bed') || lower.includes('b.ed')) return { degree: 'B.Ed.' };
  if (words.includes('llb') || lower.includes('l.l.b')) return { degree: 'LLB' };
  if (lower.includes('phd') || lower.includes('doctorate')) return { degree: 'Ph.D.' };
  if (lower.includes('polytechnic') || lower.includes('diploma')) return { degree: 'Polytechnic / Diploma' };

  if (lower.includes('btech') || lower.includes('b.tech') || words.includes('be') || lower.includes('b.e.') || lower.includes('bachelor of technology') || lower.includes('bachelor of engineering')) {
    return { degree: 'B.Tech / B.E.' };
  }
  if (lower.includes('mtech') || lower.includes('m.tech') || words.includes('me') || lower.includes('m.e.') || lower.includes('master of technology') || lower.includes('master of engineering')) {
    return { degree: 'M.Tech / M.E.' };
  }
  if (words.includes('bca') || lower.includes('b.c.a')) return { degree: 'BCA' };
  if (words.includes('mca') || lower.includes('m.c.a')) return { degree: 'MCA' };
  if (words.includes('bba') || lower.includes('b.b.a')) return { degree: 'BBA' };
  if (words.includes('mba') || lower.includes('m.b.a')) return { degree: 'MBA' };

  if (words.includes('bsc') || lower.includes('b.sc') || lower.includes('bachelor of science')) return { degree: 'B.Sc.' };
  if (words.includes('msc') || lower.includes('m.sc') || lower.includes('master of science')) return { degree: 'M.Sc.' };
  if (words.includes('bcom') || lower.includes('b.com') || lower.includes('bachelor of commerce')) return { degree: 'B.Com.' };
  if (words.includes('mcom') || lower.includes('m.com') || lower.includes('master of commerce')) return { degree: 'M.Com.' };

  if (words.includes('ba') || lower.includes('b.a.') || lower.includes('bachelor of arts')) return { degree: 'B.A.' };
  if (words.includes('ma') || lower.includes('m.a.') || lower.includes('master of arts')) return { degree: 'M.A.' };

  if (lower.includes("bachelor's") || lower.includes('bachelors') || lower === 'graduate') {
    return { degree: 'B.Tech / B.E.' };
  }

  const norm = normalizeString(trimmed);
  for (const opt of GRADUATION_DEGREES) {
    if (opt !== 'Other' && normalizeString(opt) === norm) return { degree: opt };
  }

  return { degree: 'Other', degree_other: trimmed };
}

export function mapLegacyGraduationBranch(
  degree: string,
  raw: string | null | undefined
): { branch: string; branch_other?: string } {
  if (!raw || !raw.trim()) return { branch: '' };
  const trimmed = raw.trim();
  const norm = normalizeString(trimmed);

  const allowed = DEGREE_BRANCH_MAP[degree] || ['General', 'Other'];

  if (norm === 'cse' || norm === 'computerscience' || norm === 'computerscienceandengineering') {
    if (allowed.includes('Computer Science and Engineering')) return { branch: 'Computer Science and Engineering' };
    if (allowed.includes('Computer Science')) return { branch: 'Computer Science' };
  }
  if (norm === 'it' || norm === 'informationtechnology') {
    if (allowed.includes('Information Technology')) return { branch: 'Information Technology' };
  }
  if (norm === 'ece' || norm.includes('electronicsandcomm')) {
    if (allowed.includes('Electronics and Communication Engineering')) return { branch: 'Electronics and Communication Engineering' };
  }
  if (norm === 'eee' || norm.includes('electricalandelec')) {
    if (allowed.includes('Electrical and Electronics Engineering')) return { branch: 'Electrical and Electronics Engineering' };
  }
  if (norm === 'mech' || norm.includes('mechanical')) {
    if (allowed.includes('Mechanical Engineering')) return { branch: 'Mechanical Engineering' };
  }
  if (norm.includes('civil')) {
    if (allowed.includes('Civil Engineering')) return { branch: 'Civil Engineering' };
  }

  for (const opt of allowed) {
    if (opt !== 'Other' && normalizeString(opt) === norm) return { branch: opt };
  }

  return { branch: 'Other', branch_other: trimmed };
}
