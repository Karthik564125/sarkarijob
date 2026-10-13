import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { profileApi, authApi } from '../lib/api.js';
import type { FullProfile } from '../types/api.types.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { calculateAge } from '../utils/age.js';
import {
  TENTH_BOARDS,
  TWELFTH_BOARDS,
  TWELFTH_STREAMS,
  COMMON_SUBJECTS,
  GRADUATION_DEGREES,
  DEGREE_BRANCH_MAP,
  mapLegacyTenthBoard,
  mapLegacyTwelfthBoard,
  mapLegacyTwelfthStream,
  mapLegacyGraduationDegree,
  mapLegacyGraduationBranch,
} from '../data/educationOptions.js';
import {
  User,
  Mail,
  Phone,
  Save,
  LogOut,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  FileText,
  GraduationCap,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Calendar,
  Plus,
  Info,
} from 'lucide-react';
import { Modal } from '../components/common/Modal.js';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal.js';
import axios from 'axios';

interface ProfilePageProps {
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type SectionKey = 'account' | 'personal' | 'tenth' | 'twelfth' | 'graduation';

export function ProfilePage({ onShowToast }: ProfilePageProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  // Form states
  const [account, setAccount] = useState({ fullName: '', username: '', email: '', phone: '' });

  const [personal, setPersonal] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    state_of_domicile: '',
    reservation_category: '',
  });

  const [tenth, setTenth] = useState({
    school_name: '',
    board: '',
    board_other: '',
    passing_year: '',
    percentage_or_cgpa: '',
  });

  const [twelfth, setTwelfth] = useState({
    college_name: '',
    board: '',
    board_other: '',
    stream: '',
    stream_other: '',
    passing_year: '',
    percentage_or_cgpa: '',
    subjects: [] as string[],
  });
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  const [graduation, setGraduation] = useState({
    degree: '',
    degree_other: '',
    branch: '',
    branch_other: '',
    university: '',
    passing_year: '',
    percentage_or_cgpa: '',
  });

  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);

  const newPwRules = validatePassword(newPassword);
  const newPwMatches = confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const isPwFormValid = currentPassword.length > 0 && newPwRules.isValid && newPwMatches && currentPassword !== newPassword;

  // Calculated Age derived strictly from Date of Birth
  const calculatedAge = useMemo(() => {
    return calculateAge(personal.date_of_birth);
  }, [personal.date_of_birth]);

  // Branch options dynamically computed from selected degree
  const availableBranches = useMemo(() => {
    if (!graduation.degree) return [];
    return DEGREE_BRANCH_MAP[graduation.degree] || ['General', 'Other'];
  }, [graduation.degree]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    profileApi.get()
      .then(({ data }) => {
        const fullProf = data as FullProfile;
        setAccount({
          fullName: fullProf.profile?.full_name ?? '',
          username: fullProf.account.username ?? '',
          email: fullProf.account.email ?? '',
          phone: fullProf.account.phone ?? '',
        });

        if (fullProf.profile) {
          setPersonal({
            full_name: fullProf.profile.full_name ?? '',
            date_of_birth: fullProf.profile.date_of_birth ?? '',
            gender: fullProf.profile.gender ?? '',
            state_of_domicile: fullProf.profile.state_of_domicile ?? '',
            reservation_category: fullProf.profile.reservation_category ?? '',
          });
        }

        // Prefill 10th with legacy normalization
        if (fullProf.education.tenth) {
          const t = fullProf.education.tenth;
          let boardVal = t.board ?? '';
          let boardOtherVal = t.board_other ?? '';
          if (!t.board_other && t.board) {
            const mapped = mapLegacyTenthBoard(t.board);
            boardVal = mapped.board;
            boardOtherVal = mapped.board_other ?? '';
          }

          setTenth({
            school_name: t.school_name ?? '',
            board: boardVal,
            board_other: boardOtherVal,
            passing_year: t.passing_year?.toString() ?? '',
            percentage_or_cgpa: t.percentage_or_cgpa ?? t.percentage ?? '',
          });
        }

        // Prefill 12th with legacy normalization
        if (fullProf.education.twelfth) {
          const tw = fullProf.education.twelfth;
          let boardVal = tw.board ?? '';
          let boardOtherVal = tw.board_other ?? '';
          if (!tw.board_other && tw.board) {
            const mappedBoard = mapLegacyTwelfthBoard(tw.board);
            boardVal = mappedBoard.board;
            boardOtherVal = mappedBoard.board_other ?? '';
          }

          let streamVal = tw.stream ?? '';
          let streamOtherVal = tw.stream_other ?? '';
          if (!tw.stream_other && tw.stream) {
            const mappedStream = mapLegacyTwelfthStream(tw.stream);
            streamVal = mappedStream.stream;
            streamOtherVal = mappedStream.stream_other ?? '';
          }

          setTwelfth({
            college_name: tw.college_name ?? tw.school_college_name ?? '',
            board: boardVal,
            board_other: boardOtherVal,
            stream: streamVal,
            stream_other: streamOtherVal,
            passing_year: tw.passing_year?.toString() ?? '',
            percentage_or_cgpa: tw.percentage_or_cgpa ?? tw.percentage ?? '',
            subjects: Array.isArray(tw.subjects) ? tw.subjects : [],
          });
        }

        // Prefill Graduation with legacy normalization
        if (fullProf.education.graduation) {
          const g = fullProf.education.graduation;
          let degVal = g.degree ?? '';
          let degOtherVal = g.degree_other ?? '';
          if (!g.degree_other && g.degree) {
            const mappedDeg = mapLegacyGraduationDegree(g.degree);
            degVal = mappedDeg.degree;
            degOtherVal = mappedDeg.degree_other ?? '';
          }

          let branchVal = g.branch ?? '';
          let branchOtherVal = g.branch_other ?? '';
          if (!g.branch_other && g.branch) {
            const mappedBranch = mapLegacyGraduationBranch(degVal, g.branch);
            branchVal = mappedBranch.branch;
            branchOtherVal = mappedBranch.branch_other ?? '';
          }

          setGraduation({
            degree: degVal,
            degree_other: degOtherVal,
            branch: branchVal,
            branch_other: branchOtherVal,
            university: g.university ?? g.college_name ?? '',
            passing_year: g.passing_year?.toString() ?? '',
            percentage_or_cgpa: g.percentage_or_cgpa ?? '',
          });
        }

        setIsLoading(false);
      })
      .catch(() => {
        setLoadError('Failed to load profile data.');
        setIsLoading(false);
      });
  }, []);

  const saveSection = async (section: SectionKey) => {
    setSavingSection(section);
    setSavedSection(null);
    try {
      if (section === 'account') {
        await profileApi.updateAccount({ email: account.email, phone: account.phone });
        if (personal.full_name !== account.fullName) {
          await profileApi.updatePersonal({ full_name: account.fullName });
          setPersonal((p) => ({ ...p, full_name: account.fullName }));
        }
      } else if (section === 'personal') {
        await profileApi.updatePersonal(personal);
      } else if (section === 'tenth') {
        await profileApi.updateEducation10th({
          school_name: tenth.school_name,
          board: tenth.board,
          board_other: tenth.board === 'Other' ? tenth.board_other : undefined,
          passing_year: tenth.passing_year ? parseInt(tenth.passing_year, 10) : undefined,
          percentage_or_cgpa: tenth.percentage_or_cgpa,
          percentage: tenth.percentage_or_cgpa,
        });
      } else if (section === 'twelfth') {
        await profileApi.updateEducation12th({
          college_name: twelfth.college_name,
          school_college_name: twelfth.college_name,
          board: twelfth.board,
          board_other: twelfth.board === 'Other' ? twelfth.board_other : undefined,
          stream: twelfth.stream,
          stream_other:
            twelfth.stream === 'Other' || twelfth.stream === 'Other Intermediate stream'
              ? twelfth.stream_other
              : undefined,
          passing_year: twelfth.passing_year ? parseInt(twelfth.passing_year, 10) : undefined,
          percentage_or_cgpa: twelfth.percentage_or_cgpa,
          percentage: twelfth.percentage_or_cgpa,
          subjects: twelfth.subjects,
        });
      } else if (section === 'graduation') {
        await profileApi.updateEducationGraduation({
          degree: graduation.degree,
          degree_other: graduation.degree === 'Other' ? graduation.degree_other : undefined,
          branch: graduation.branch,
          branch_other: graduation.branch === 'Other' ? graduation.branch_other : undefined,
          university: graduation.university,
          college_name: graduation.university,
          passing_year: graduation.passing_year ? parseInt(graduation.passing_year, 10) : undefined,
          percentage_or_cgpa: graduation.percentage_or_cgpa,
        });
      }

      setSavedSection(section);
      onShowToast('Profile section saved successfully!', 'success');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message ?? 'Save failed.' : 'Save failed.';
      onShowToast(msg, 'warning');
    } finally {
      setSavingSection(null);
    }
  };

  const handleToggleSubject = (subject: string) => {
    setTwelfth((prev) => {
      const exists = prev.subjects.includes(subject);
      const updated = exists ? prev.subjects.filter((s) => s !== subject) : [...prev.subjects, subject];
      return { ...prev, subjects: updated };
    });
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;
    if (!twelfth.subjects.includes(trimmed)) {
      setTwelfth((prev) => ({ ...prev, subjects: [...prev.subjects, trimmed] }));
    }
    setCustomSubjectInput('');
  };

  const handleRemoveSubject = (subject: string) => {
    setTwelfth((prev) => ({ ...prev, subjects: prev.subjects.filter((s) => s !== subject) }));
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (newPassword !== confirmNewPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (!newPwRules.isValid) {
      setPwError('New password does not meet complexity requirements.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from current password.');
      return;
    }

    setIsChangingPw(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      onShowToast('Password changed successfully!', 'success');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message ?? 'Failed to change password.' : 'Failed to change password.';
      setPwError(msg);
    } finally {
      setIsChangingPw(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500 space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span>Loading profile information...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 text-sm text-rose-700 flex items-center space-x-2 max-w-4xl">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 transition-colors';

  const selectClass =
    'w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-colors cursor-pointer';

  const SaveButton = ({ section }: { section: SectionKey }) => (
    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
      {savedSection === section ? (
        <span className="text-xs text-emerald-600 font-medium flex items-center space-x-1">
          <Check className="w-3.5 h-3.5" />
          <span>Saved</span>
        </span>
      ) : (
        <span className="text-xs text-slate-400">Save changes for this section</span>
      )}
      <button
        type="button"
        onClick={() => saveSection(section)}
        disabled={savingSection === section}
        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-70 cursor-pointer"
      >
        {savingSection === section ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        <span>{savingSection === section ? 'Saving...' : 'Save Section'}</span>
      </button>
    </div>
  );

  const RuleItem = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center space-x-1.5 text-[11px] ${met ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
      {met ? <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Page Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <User className="w-5 h-5 text-indigo-600" />
            <span>User Profile & Qualification</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your account credentials, personal information, and structured education records for recruitment eligibility.
          </p>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-xs cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      <div className="space-y-6">

        {/* 1. Account Information */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>1. Account Information</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={account.fullName}
                onChange={(e) => setAccount((p) => ({ ...p, fullName: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-slate-400 font-normal">(read-only)</span>
              </label>
              <div className="relative">
                <span className="text-slate-400 font-mono text-xs absolute left-3 top-1/2 -translate-y-1/2">@</span>
                <input
                  type="text"
                  value={account.username}
                  readOnly
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={account.email}
                  onChange={(e) => setAccount((p) => ({ ...p, email: e.target.value }))}
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={account.phone}
                  onChange={(e) => setAccount((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          <SaveButton section="account" />
        </div>

        {/* 2. Personal Information */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>2. Personal Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
              <div className="relative">
                <input
                  type="date"
                  value={personal.date_of_birth}
                  onChange={(e) => setPersonal((p) => ({ ...p, date_of_birth: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* Automatic Age Calculation Display */}
              <div className="mt-2">
                {calculatedAge !== null ? (
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      Calculated Age: <strong>{calculatedAge} years</strong>{' '}
                      <span className="text-indigo-600 text-[11px]">(automatically derived from Date of Birth)</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Age: <strong>Unavailable</strong> — please provide Date of Birth</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={personal.gender}
                onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value }))}
                className={selectClass}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Domicile</label>
              <input
                type="text"
                value={personal.state_of_domicile}
                onChange={(e) => setPersonal((p) => ({ ...p, state_of_domicile: e.target.value }))}
                placeholder="e.g. Andhra Pradesh, Karnataka, Delhi"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reservation Category</label>
              <select
                value={personal.reservation_category}
                onChange={(e) => setPersonal((p) => ({ ...p, reservation_category: e.target.value }))}
                className={selectClass}
              >
                <option value="">Select Category</option>
                <option value="General (UR)">General (UR)</option>
                <option value="OBC (Non-Creamy Layer)">OBC (Non-Creamy Layer)</option>
                <option value="EWS">EWS (Economically Weaker Section)</option>
                <option value="SC">SC (Scheduled Caste)</option>
                <option value="ST">ST (Scheduled Tribe)</option>
              </select>
            </div>
          </div>

          <SaveButton section="personal" />
        </div>

        {/* 3. Education Information */}
        <div className="space-y-6">
          <div className="bg-slate-100/80 rounded-lg p-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <span>3. Education Information</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide structured qualifications for 10th, Intermediate/12th, and Graduation. These fields are used by the eligibility engine to evaluate recruitment notices accurately.
            </p>
          </div>

          {/* Subsection: 10th / Secondary Education */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
            <h4 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>10th / Secondary Education</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Name</label>
                <input
                  type="text"
                  value={tenth.school_name}
                  onChange={(e) => setTenth((p) => ({ ...p, school_name: e.target.value }))}
                  placeholder="e.g. St. Joseph High School"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Education Board</label>
                <select
                  value={tenth.board}
                  onChange={(e) => setTenth((p) => ({ ...p, board: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select Board</option>
                  {TENTH_BOARDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {tenth.board === 'Other' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Specify Board Name</label>
                    <input
                      type="text"
                      value={tenth.board_other}
                      onChange={(e) => setTenth((p) => ({ ...p, board_other: e.target.value }))}
                      placeholder="e.g. Maharashtra State Board"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
                <input
                  type="number"
                  value={tenth.passing_year}
                  onChange={(e) => setTenth((p) => ({ ...p, passing_year: e.target.value }))}
                  placeholder="e.g. 2020"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                <input
                  type="text"
                  value={tenth.percentage_or_cgpa}
                  onChange={(e) => setTenth((p) => ({ ...p, percentage_or_cgpa: e.target.value }))}
                  placeholder="e.g. 88.5% or 9.0 CGPA"
                  className={inputClass}
                />
              </div>
            </div>

            <SaveButton section="tenth" />
          </div>

          {/* Subsection: Intermediate / 12th Education */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
            <h4 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Intermediate / 12th Education</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College Name</label>
                <input
                  type="text"
                  value={twelfth.college_name}
                  onChange={(e) => setTwelfth((p) => ({ ...p, college_name: e.target.value }))}
                  placeholder="e.g. Sri Chaitanya Junior College"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Education Board</label>
                <select
                  value={twelfth.board}
                  onChange={(e) => setTwelfth((p) => ({ ...p, board: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select Board</option>
                  {TWELFTH_BOARDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {twelfth.board === 'Other' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Specify Board Name</label>
                    <input
                      type="text"
                      value={twelfth.board_other}
                      onChange={(e) => setTwelfth((p) => ({ ...p, board_other: e.target.value }))}
                      placeholder="e.g. BIEAP, TSBIE, Maharashtra HSC"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stream / Qualification</label>
                <select
                  value={twelfth.stream}
                  onChange={(e) => setTwelfth((p) => ({ ...p, stream: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select Stream / Qualification</option>
                  {TWELFTH_STREAMS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {(twelfth.stream === 'Other' || twelfth.stream === 'Other Intermediate stream') && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Specify Exact Stream / Qualification</label>
                    <input
                      type="text"
                      value={twelfth.stream_other}
                      onChange={(e) => setTwelfth((p) => ({ ...p, stream_other: e.target.value }))}
                      placeholder="e.g. Vocational Science, Agriculture"
                      className={inputClass}
                    />
                  </div>
                )}

                {twelfth.stream === 'Polytechnic / Diploma' && (
                  <div className="mt-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Important Notice:</strong> Polytechnic / Diploma is recorded as an independent technical qualification and is not automatically treated as equivalent to Intermediate. Equivalence is evaluated strictly when official recruitment rules explicitly permit it.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
                <input
                  type="number"
                  value={twelfth.passing_year}
                  onChange={(e) => setTwelfth((p) => ({ ...p, passing_year: e.target.value }))}
                  placeholder="e.g. 2022"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                <input
                  type="text"
                  value={twelfth.percentage_or_cgpa}
                  onChange={(e) => setTwelfth((p) => ({ ...p, percentage_or_cgpa: e.target.value }))}
                  placeholder="e.g. 85.0% or 8.8 CGPA"
                  className={inputClass}
                />
              </div>

              {/* Structured Subjects */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subjects Studied{' '}
                  <span className="text-slate-400 font-normal">
                    (Used to verify recruitment notifications requiring specific subjects)
                  </span>
                </label>

                {/* Selected Subject Badges */}
                {twelfth.subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {twelfth.subjects.map((sub) => (
                      <span
                        key={sub}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(sub)}
                          className="ml-1.5 hover:text-indigo-900 focus:outline-none"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic mb-2">No subjects selected yet. Click quick-add tags below or enter your subjects.</p>
                )}

                {/* Quick-Add Popular Subjects */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] font-medium text-slate-500">Quick-Add Subjects:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SUBJECTS.map((sub) => {
                      const isSelected = twelfth.subjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleToggleSubject(sub)}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isSelected ? `✓ ${sub}` : `+ ${sub}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Subject Entry */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={customSubjectInput}
                    onChange={(e) => setCustomSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSubject();
                      }
                    }}
                    placeholder="Enter additional subject name..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSubject}
                    className="inline-flex items-center space-x-1 px-3 py-2 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            <SaveButton section="twelfth" />
          </div>

          {/* Subsection: Graduation / Higher Education */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
            <h4 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Graduation / Higher Education</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Degree / Qualification</label>
                <select
                  value={graduation.degree}
                  onChange={(e) => {
                    const newDeg = e.target.value;
                    setGraduation((p) => ({
                      ...p,
                      degree: newDeg,
                      // Reset branch if new degree doesn't include previous branch
                      branch: '',
                    }));
                  }}
                  className={selectClass}
                >
                  <option value="">Select Degree / Qualification</option>
                  {GRADUATION_DEGREES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {graduation.degree === 'Other' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Specify Degree / Qualification</label>
                    <input
                      type="text"
                      value={graduation.degree_other}
                      onChange={(e) => setGraduation((p) => ({ ...p, degree_other: e.target.value }))}
                      placeholder="e.g. B.Voc, Dual Degree"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Specialization</label>
                <select
                  value={graduation.branch}
                  onChange={(e) => setGraduation((p) => ({ ...p, branch: e.target.value }))}
                  disabled={!graduation.degree}
                  className={`${selectClass} ${!graduation.degree ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                >
                  <option value="">
                    {graduation.degree ? 'Select Branch / Specialization' : 'Select Degree First'}
                  </option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {graduation.branch === 'Other' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Specify Branch / Specialization</label>
                    <input
                      type="text"
                      value={graduation.branch_other}
                      onChange={(e) => setGraduation((p) => ({ ...p, branch_other: e.target.value }))}
                      placeholder="e.g. Artificial Intelligence & Data Science"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College / University Name</label>
                <input
                  type="text"
                  value={graduation.university}
                  onChange={(e) => setGraduation((p) => ({ ...p, university: e.target.value }))}
                  placeholder="e.g. KL University, Andhra University"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={graduation.passing_year}
                  onChange={(e) => setGraduation((p) => ({ ...p, passing_year: e.target.value }))}
                  placeholder="e.g. 2026"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                <input
                  type="text"
                  value={graduation.percentage_or_cgpa}
                  onChange={(e) => setGraduation((p) => ({ ...p, percentage_or_cgpa: e.target.value }))}
                  placeholder="e.g. 82.5% or 8.5 CGPA"
                  className={inputClass}
                />
              </div>
            </div>

            <SaveButton section="graduation" />
          </div>
        </div>

      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPwError('');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }}
        title="Change Account Password"
      >
        <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
          {pwError && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Validation Hints */}
            {newPassword.length > 0 && (
              <div className="mt-2.5 p-2.5 bg-slate-50 rounded-md border border-slate-100 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Password Requirements</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <RuleItem met={newPwRules.hasMinLength} label="8+ characters" />
                  <RuleItem met={newPwRules.hasUppercase} label="1 uppercase letter" />
                  <RuleItem met={newPwRules.hasLowercase} label="1 lowercase letter" />
                  <RuleItem met={newPwRules.hasNumber} label="1 number" />
                  <RuleItem met={newPwRules.hasSpecialChar} label="1 special character" />
                  <RuleItem met={currentPassword.length > 0 && currentPassword !== newPassword} label="Different from current" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmNewPw ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPw(!showConfirmNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmNewPassword.length > 0 && (
              <p className={`text-[11px] mt-1 ${newPwMatches ? 'text-emerald-600 font-medium' : 'text-rose-600'}`}>
                {newPwMatches ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isPwFormValid || isChangingPw}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isChangingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{isChangingPw ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </Modal>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
