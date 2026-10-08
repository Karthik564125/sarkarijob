export interface SafeUser {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface UserProfile {
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  state_of_domicile: string | null;
  reservation_category: string | null;
}

export interface Education10th {
  school_name: string | null;
  board: string | null;
  passing_year: number | null;
  percentage: string | null;
}

export interface Education12th {
  school_college_name: string | null;
  board: string | null;
  stream: string | null;
  passing_year: number | null;
  percentage: string | null;
}

export interface EducationGraduation {
  degree: string | null;
  branch: string | null;
  university: string | null;
  passing_year: number | null;
  percentage_or_cgpa: string | null;
}

export interface FullProfile {
  account: SafeUser;
  profile: UserProfile | null;
  education: {
    tenth: Education10th | null;
    twelfth: Education12th | null;
    graduation: EducationGraduation | null;
  };
}

export interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export interface RegisterData {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}
