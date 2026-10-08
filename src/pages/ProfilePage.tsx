import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { profileApi, authApi } from '../lib/api.js';
import type { FullProfile } from '../types/api.types.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { 
  User, Mail, Phone, Lock, Save, LogOut, 
  ShieldCheck, KeyRound, CheckCircle2, AlertCircle,
  FileText, GraduationCap, Eye, EyeOff, Check, X, Loader2
} from 'lucide-react';
import { Modal } from '../components/common/Modal.js';
import axios from 'axios';

interface ProfilePageProps {
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type SectionKey = 'account' | 'personal' | 'tenth' | 'twelfth' | 'graduation';

export function ProfilePage({ onShowToast }: ProfilePageProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  // Form states
  const [account, setAccount] = useState({ fullName: '', username: '', email: '', phone: '' });
  const [personal, setPersonal] = useState({ full_name: '', date_of_birth: '', gender: '', state_of_domicile: '', reservation_category: '' });
  const [tenth, setTenth] = useState({ school_name: '', board: '', passing_year: '', percentage: '' });
  const [twelfth, setTwelfth] = useState({ school_college_name: '', board: '', stream: '', passing_year: '', percentage: '' });
  const [graduation, setGraduation] = useState({ degree: '', branch: '', university: '', passing_year: '', percentage_or_cgpa: '' });

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
        if (fullProf.education.tenth) {
          setTenth({
            school_name: fullProf.education.tenth.school_name ?? '',
            board: fullProf.education.tenth.board ?? '',
            passing_year: fullProf.education.tenth.passing_year?.toString() ?? '',
            percentage: fullProf.education.tenth.percentage ?? '',
          });
        }
        if (fullProf.education.twelfth) {
          setTwelfth({
            school_college_name: fullProf.education.twelfth.school_college_name ?? '',
            board: fullProf.education.twelfth.board ?? '',
            stream: fullProf.education.twelfth.stream ?? '',
            passing_year: fullProf.education.twelfth.passing_year?.toString() ?? '',
            percentage: fullProf.education.twelfth.percentage ?? '',
          });
        }
        if (fullProf.education.graduation) {
          setGraduation({
            degree: fullProf.education.graduation.degree ?? '',
            branch: fullProf.education.graduation.branch ?? '',
            university: fullProf.education.graduation.university ?? '',
            passing_year: fullProf.education.graduation.passing_year?.toString() ?? '',
            percentage_or_cgpa: fullProf.education.graduation.percentage_or_cgpa ?? '',
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
        }
      } else if (section === 'personal') {
        await profileApi.updatePersonal(personal);
      } else if (section === 'tenth') {
        await profileApi.updateEducation10th({
          ...tenth,
          passing_year: tenth.passing_year ? parseInt(tenth.passing_year) : undefined,
        });
      } else if (section === 'twelfth') {
        await profileApi.updateEducation12th({
          ...twelfth,
          passing_year: twelfth.passing_year ? parseInt(twelfth.passing_year) : undefined,
        });
      } else if (section === 'graduation') {
        await profileApi.updateEducationGraduation({
          ...graduation,
          passing_year: graduation.passing_year ? parseInt(graduation.passing_year) : undefined,
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

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!isPwFormValid) return;

    setIsChangingPw(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      onShowToast('Password changed successfully!', 'success');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setPwError(err.response?.data?.message ?? 'Failed to change password.');
      } else {
        setPwError('Failed to connect to server.');
      }
    } finally {
      setIsChangingPw(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500 space-x-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Loading full profile...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 text-sm text-rose-700 flex items-center space-x-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50";
  
  const SaveButton = ({ section }: { section: SectionKey }) => (
    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
      {savedSection === section ? (
        <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>Saved!</span>
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
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <User className="w-5 h-5 text-indigo-600" />
            <span>User Profile & Qualification</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Central management for account information, personal details, education, and security credentials.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-xs cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      <div className="space-y-6">
        
        {/* A. Account Information Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>A. Account Information</span>
          </h3>

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

        {/* B. Personal & Eligibility Information Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>B. Personal & Eligibility Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={personal.date_of_birth}
                onChange={(e) => setPersonal((p) => ({ ...p, date_of_birth: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={personal.gender}
                onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select</option>
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
                placeholder="e.g. Karnataka"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reservation Category</label>
              <select
                value={personal.reservation_category}
                onChange={(e) => setPersonal((p) => ({ ...p, reservation_category: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select</option>
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

        {/* C. 10th Education Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>C. 10th / Secondary Education</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">School Name</label>
              <input
                type="text"
                value={tenth.school_name}
                onChange={(e) => setTenth((p) => ({ ...p, school_name: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Board</label>
              <input
                type="text"
                value={tenth.board}
                onChange={(e) => setTenth((p) => ({ ...p, board: e.target.value }))}
                placeholder="CBSE, ICSE, State Board..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
              <input
                type="number"
                value={tenth.passing_year}
                onChange={(e) => setTenth((p) => ({ ...p, passing_year: e.target.value }))}
                placeholder="YYYY"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
              <input
                type="text"
                value={tenth.percentage}
                onChange={(e) => setTenth((p) => ({ ...p, percentage: e.target.value }))}
                placeholder="e.g. 91.5% or 9.2 CGPA"
                className={inputClass}
              />
            </div>
          </div>

          <SaveButton section="tenth" />
        </div>

        {/* D. Intermediate / 12th Education Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>D. Intermediate / 12th Education</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">School / College Name</label>
              <input
                type="text"
                value={twelfth.school_college_name}
                onChange={(e) => setTwelfth((p) => ({ ...p, school_college_name: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Board</label>
              <input
                type="text"
                value={twelfth.board}
                onChange={(e) => setTwelfth((p) => ({ ...p, board: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stream</label>
              <input
                type="text"
                value={twelfth.stream}
                onChange={(e) => setTwelfth((p) => ({ ...p, stream: e.target.value }))}
                placeholder="Science, Commerce, Arts..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
              <input
                type="number"
                value={twelfth.passing_year}
                onChange={(e) => setTwelfth((p) => ({ ...p, passing_year: e.target.value }))}
                placeholder="YYYY"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
              <input
                type="text"
                value={twelfth.percentage}
                onChange={(e) => setTwelfth((p) => ({ ...p, percentage: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <SaveButton section="twelfth" />
        </div>

        {/* E. Graduation Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>E. Graduation & Higher Education</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Degree / Qualification</label>
              <input
                type="text"
                value={graduation.degree}
                onChange={(e) => setGraduation((p) => ({ ...p, degree: e.target.value }))}
                placeholder="B.Tech, B.Sc, B.Com..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Stream</label>
              <input
                type="text"
                value={graduation.branch}
                onChange={(e) => setGraduation((p) => ({ ...p, branch: e.target.value }))}
                placeholder="Computer Science, Mechanical..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">University / Institute</label>
              <input
                type="text"
                value={graduation.university}
                onChange={(e) => setGraduation((p) => ({ ...p, university: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Graduation Year</label>
              <input
                type="number"
                value={graduation.passing_year}
                onChange={(e) => setGraduation((p) => ({ ...p, passing_year: e.target.value }))}
                placeholder="YYYY"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
              <input
                type="text"
                value={graduation.percentage_or_cgpa}
                onChange={(e) => setGraduation((p) => ({ ...p, percentage_or_cgpa: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <SaveButton section="graduation" />
        </div>

        {/* F. Account Security Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>F. Account Security</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Logged in as:</span>
              <span className="text-slate-900 font-mono font-bold">@{user?.username}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Password Status:</span>
              <span className="text-slate-700 font-mono font-semibold">•••••••••••• (Encrypted)</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPwError('');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setIsPasswordModalOpen(true);
              }}
              className="px-4 py-2 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out Session</span>
            </button>
          </div>
        </div>

      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title="Change Password"
        >
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
            {pwError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. Karthik@2026"
                  required
                  className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  aria-label={showNewPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Requirement checklist */}
              {newPassword.length > 0 && (
                <div className="mt-2.5 p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    New password must contain:
                  </span>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                    <RuleItem met={newPwRules.hasMinLength} label="8+ characters" />
                    <RuleItem met={newPwRules.hasUppercase} label="Uppercase letter" />
                    <RuleItem met={newPwRules.hasLowercase} label="Lowercase letter" />
                    <RuleItem met={newPwRules.hasNumber} label="Number" />
                    <RuleItem met={newPwRules.hasSpecialChar} label="Special character" />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmNewPw ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPw(!showConfirmNewPw)}
                  aria-label={showConfirmNewPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmNewPassword.length > 0 && !newPwMatches && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">
                  New passwords do not match.
                </p>
              )}
              {currentPassword.length > 0 && currentPassword === newPassword && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">
                  New password must be different from current password.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isChangingPw || !isPwFormValid}
                className="px-4 py-2 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {isChangingPw && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isChangingPw ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
