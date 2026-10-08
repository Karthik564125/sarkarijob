import { useState, useEffect } from 'react';
import { profileApi } from '../lib/api.js';
import type { FullProfile } from '../types/api.types.js';
import { 
  Save, CheckCircle2, ShieldCheck, GraduationCap, MapPin, Tag, User,
  FileText, Info, ChevronDown, ChevronUp, AlertCircle, Loader2
} from 'lucide-react';
import { Badge } from '../components/common/Badge.js';
import axios from 'axios';

interface EligibilityPageProps {
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type SectionKey = 'personal' | 'tenth' | 'twelfth' | 'graduation';

export function EligibilityPage({ onShowToast }: EligibilityPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [saved, setSaved] = useState<SectionKey | null>(null);

  const [openSections, setOpenSections] = useState({
    personal: true,
    tenth: true,
    twelfth: true,
    graduation: true,
  });

  // Form state for each section
  const [personal, setPersonal] = useState({
    full_name: '', date_of_birth: '', gender: '', state_of_domicile: '', reservation_category: ''
  });
  const [tenth, setTenth] = useState({
    school_name: '', board: '', passing_year: '', percentage: ''
  });
  const [twelfth, setTwelfth] = useState({
    school_college_name: '', board: '', stream: '', passing_year: '', percentage: ''
  });
  const [graduation, setGraduation] = useState({
    degree: '', branch: '', university: '', passing_year: '', percentage_or_cgpa: ''
  });

  useEffect(() => {
    profileApi.get()
      .then(({ data: d }) => {
        const fullProf = d as FullProfile;
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
        setLoadError('Failed to load eligibility data.');
        setIsLoading(false);
      });
  }, []);

  const toggle = (s: SectionKey) => setOpenSections(p => ({ ...p, [s]: !p[s] }));

  const saveSection = async (section: SectionKey) => {
    setSaving(section);
    setSaved(null);
    try {
      if (section === 'personal') {
        await profileApi.updatePersonal({
          ...personal,
        });
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
      setSaved(section);
      onShowToast('Section saved successfully.', 'success');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message ?? 'Save failed.' : 'Save failed.';
      onShowToast(msg, 'warning');
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500 space-x-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading eligibility profile...</span>
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

  const SectionHeader = ({ section, icon: Icon, label }: { section: SectionKey; icon: React.ElementType; label: string }) => (
    <div
      onClick={() => toggle(section)}
      className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
    >
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
      </div>
      {openSections[section] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
    </div>
  );

  const inputClass = "w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50";
  const SaveBtn = ({ section }: { section: SectionKey }) => (
    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
      <button
        onClick={() => saveSection(section)}
        disabled={saving === section}
        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-70"
      >
        {saving === section ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved === section ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        <span>{saving === section ? 'Saving...' : 'Save Section'}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Detailed Recruitment Eligibility</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Provide accurate qualification details for recruitment criteria matching.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* 1. Personal Details */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <SectionHeader section="personal" icon={User} label="1. Personal Details" />
            {openSections.personal && (
              <>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', key: 'full_name', type: 'text' },
                    { label: 'Date of Birth', key: 'date_of_birth', type: 'date' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
                      <input type={type} value={personal[key as keyof typeof personal]} onChange={e => setPersonal(p => ({ ...p, [key]: e.target.value }))} className={inputClass} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                    <select value={personal.gender} onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))} className={inputClass}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State / Domicile</label>
                    <input type="text" value={personal.state_of_domicile} onChange={e => setPersonal(p => ({ ...p, state_of_domicile: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reservation Category</label>
                    <select value={personal.reservation_category} onChange={e => setPersonal(p => ({ ...p, reservation_category: e.target.value }))} className={inputClass}>
                      <option value="">Select</option>
                      <option value="General (UR)">General (UR)</option>
                      <option value="OBC (Non-Creamy Layer)">OBC (Non-Creamy Layer)</option>
                      <option value="EWS">EWS (Economically Weaker Section)</option>
                      <option value="SC">SC (Scheduled Caste)</option>
                      <option value="ST">ST (Scheduled Tribe)</option>
                    </select>
                  </div>
                </div>
                <SaveBtn section="personal" />
              </>
            )}
          </div>

          {/* 2. 10th Education */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <SectionHeader section="tenth" icon={FileText} label="2. 10th / Secondary Education" />
            {openSections.tenth && (
              <>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">School Name</label>
                    <input type="text" value={tenth.school_name} onChange={e => setTenth(p => ({ ...p, school_name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Board</label>
                    <input type="text" value={tenth.board} onChange={e => setTenth(p => ({ ...p, board: e.target.value }))} placeholder="CBSE, ICSE, State Board..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
                    <input type="number" value={tenth.passing_year} onChange={e => setTenth(p => ({ ...p, passing_year: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                    <input type="text" value={tenth.percentage} onChange={e => setTenth(p => ({ ...p, percentage: e.target.value }))} placeholder="e.g. 92.4% or 9.2 CGPA" className={inputClass} />
                  </div>
                </div>
                <SaveBtn section="tenth" />
              </>
            )}
          </div>

          {/* 3. 12th Education */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <SectionHeader section="twelfth" icon={FileText} label="3. Intermediate / 12th Standard" />
            {openSections.twelfth && (
              <>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">School / College Name</label>
                    <input type="text" value={twelfth.school_college_name} onChange={e => setTwelfth(p => ({ ...p, school_college_name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Board</label>
                    <input type="text" value={twelfth.board} onChange={e => setTwelfth(p => ({ ...p, board: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Stream</label>
                    <input type="text" value={twelfth.stream} onChange={e => setTwelfth(p => ({ ...p, stream: e.target.value }))} placeholder="Science, Commerce, Arts..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
                    <input type="number" value={twelfth.passing_year} onChange={e => setTwelfth(p => ({ ...p, passing_year: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                    <input type="text" value={twelfth.percentage} onChange={e => setTwelfth(p => ({ ...p, percentage: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <SaveBtn section="twelfth" />
              </>
            )}
          </div>

          {/* 4. Graduation */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <SectionHeader section="graduation" icon={GraduationCap} label="4. Graduation & Higher Education" />
            {openSections.graduation && (
              <>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Degree / Qualification</label>
                    <input type="text" value={graduation.degree} onChange={e => setGraduation(p => ({ ...p, degree: e.target.value }))} placeholder="B.Tech, B.Sc, B.Com..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Branch / Stream</label>
                    <input type="text" value={graduation.branch} onChange={e => setGraduation(p => ({ ...p, branch: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">University / Institute</label>
                    <input type="text" value={graduation.university} onChange={e => setGraduation(p => ({ ...p, university: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Year</label>
                    <input type="number" value={graduation.passing_year} onChange={e => setGraduation(p => ({ ...p, passing_year: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage / CGPA</label>
                    <input type="text" value={graduation.percentage_or_cgpa} onChange={e => setGraduation(p => ({ ...p, percentage_or_cgpa: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <SaveBtn section="graduation" />
              </>
            )}
          </div>

        </div>

        {/* Eligibility Summary card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs self-start sticky top-20">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Your Eligibility Profile</h3>
            <Badge variant="eligible" size="sm">Summary</Badge>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { icon: User, label: 'Name', value: personal.full_name || '—' },
              { icon: MapPin, label: 'Domicile', value: personal.state_of_domicile || '—' },
              { icon: Tag, label: 'Category', value: personal.reservation_category || '—' },
              { icon: FileText, label: '10th', value: tenth.board && tenth.percentage ? `${tenth.board} (${tenth.percentage})` : '—' },
              { icon: FileText, label: '12th', value: twelfth.stream && twelfth.percentage ? `${twelfth.stream} (${twelfth.percentage})` : '—' },
              { icon: GraduationCap, label: 'Graduation', value: graduation.degree && graduation.branch ? `${graduation.degree} – ${graduation.branch}` : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start justify-between py-1 border-b border-slate-100 last:border-0 gap-2">
                <span className="text-slate-500 flex items-center gap-1.5 flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  {label}:
                </span>
                <strong className="text-slate-800 font-semibold text-right">{value}</strong>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3 bg-amber-50/70 rounded-md border border-amber-200/60 text-[11px] text-amber-900 leading-normal flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-0.5">Disclaimer:</strong>
              Recruitment eligibility is determined from the official notification. SarkariJob provides a matching aid and does not replace official eligibility rules.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
