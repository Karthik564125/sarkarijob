import { Link } from 'react-router-dom';
import { Briefcase, ArrowRight } from 'lucide-react';
import mainLogo from '../assets/mainlogo.png';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal top nav */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 sm:px-10 max-w-6xl mx-auto w-full">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-base tracking-tight">SarkariJob</span>
        </div>
        <div className="flex items-center space-x-3 text-xs font-semibold">
          <Link to="/login" className="text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link
            to="/register"
            className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Hero — two-column on desktop, stacked on mobile */}
      <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 lg:py-0">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left column — Logo */}
          <div className="flex items-center justify-center">
            <img
              src={mainLogo}
              alt="SarkariJob Logo"
              className="w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[420px] h-auto"
            />
          </div>

          {/* Right column — Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
              Government recruitment information,{' '}
              <span className="text-indigo-600">without the noise.</span>
            </h1>

            <p className="mt-5 text-base text-slate-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Track official SSC and RRB notifications, check your eligibility,
              and know exactly what requires your attention — without visiting a dozen websites.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start gap-3">
              <Link
                to="/register"
                className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="flex items-center space-x-2 border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                <span>Sign In</span>
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              Tracks SSC (CGL, CHSL, CPO, MTS) and RRB (NTPC, ALP, Technician, Group D)
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        SarkariJob • Government Recruitment Tracker
      </footer>
    </div>
  );
}
