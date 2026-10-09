import { ExternalLink, ShieldCheck, BellRing, GraduationCap, Target, Heart } from 'lucide-react';

const PORTFOLIO_URL = 'https://karthik-portfolio-blond.vercel.app/';

export function AboutPage() {
  return (
    <div className="min-h-full space-y-8 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          About the Project
        </span>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Government job updates, <span className="text-indigo-600">without the noise.</span>
        </h1>

        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          SarkariJob is a personal project built to make government recruitment
          information easier to discover, understand, and track. Instead of
          searching multiple websites every day, candidates can use one place
          to follow recruitment notifications, review eligibility information,
          and keep track of their applications.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900">Why SarkariJob?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Important recruitment details can be spread across different official
          portals and notifications. SarkariJob aims to simplify that process
          and help candidates stay organised during their exam preparation.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BellRing className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Recruitment updates</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Follow recruitment notices and important changes from supported
              government recruitment sources.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Eligibility awareness</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review available eligibility information against your profile
              and identify criteria that need manual verification.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Application tracking</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Record which recruitments you have applied for and which ones
              you have decided not to pursue.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Official-source first</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use official recruitment pages and documents to verify dates,
              qualifications, vacancies, and application instructions.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">An important note</h2>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          SarkariJob is an independent information and tracking project, not a
          government website. Automated eligibility assessments and extracted
          recruitment details may be incomplete or inaccurate. Always read the
          official notification and confirm the requirements on the relevant
          government portal before applying. SarkariJob does not submit
          applications on your behalf.
        </p>
      </section>

      <section className="rounded-2xl bg-slate-900 p-7 text-white sm:p-9">
        <div className="flex items-center gap-2 text-indigo-300">
          <Heart className="h-5 w-5" />
          <span className="text-sm font-semibold">Built with purpose</span>
        </div>

        <h2 className="mt-4 text-2xl font-bold">A project to make the journey simpler.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          SarkariJob was created to reduce the effort involved in keeping up
          with government recruitment information and to help candidates
          organise their preparation with greater clarity.
        </p>

        <a
          href={PORTFOLIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
        >
          Made by Karthik — Visit My Portfolio
          <ExternalLink className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
