import Link from 'next/link';
import Image from 'next/image';
import MentorGratitude from '@/components/skill-development/MentorGratitude';
import {
  ArrowDownRight,
  ArrowLeft,
  BookOpenCheck,
  Compass,
  Lightbulb,
  Rocket,
  Target,
  UsersRound,
} from 'lucide-react';

export const metadata = {
  title: 'Skill Development | CodeSkill · Chandigarh University',
  description:
    'Discover the vision, goals, and learning approach behind CodeSkill’s skill development initiative by the Technical Training team.',
};

const focusAreas = [
  {
    icon: BookOpenCheck,
    title: 'Build strong foundations',
    description:
      'Strengthen core programming, data structures, algorithms, and problem-solving concepts through clear explanations and steady practice.',
  },
  {
    icon: Lightbulb,
    title: 'Learn by doing',
    description:
      'Turn concepts into working solutions with coding exercises, practical challenges, and projects that reward thoughtful iteration.',
  },
  {
    icon: Target,
    title: 'Make progress visible',
    description:
      'Use regular practice and constructive assessment to recognize strengths, spot learning gaps, and choose a useful next step.',
  },
];

const learningSteps = [
  ['01', 'Learn', 'Understand a concept and the ideas behind it.'],
  ['02', 'Practice', 'Apply it to a problem, then test and refine your solution.'],
  ['03', 'Reflect', 'Review what worked, where you got stuck, and why.'],
  ['04', 'Grow', 'Carry that learning into a more challenging task or project.'],
];

const teamMembers = [
  { name: 'Venkatesh', role: 'Technical Trainer', image: '/images/skill-development/team/member-01.jpg' },
  { name: 'Mustakim', role: 'Technical Trainer', image: '/images/skill-development/team/member-02.jpg' },
  { name: 'Vishal', role: 'Technical Trainer', image: '/images/skill-development/team/member-03.jpg' },
  { name: 'Neeraj', role: 'Assistant Professor', image: '/images/skill-development/team/member-04.jpg' },
  { name: 'Shadab', role: 'Technical Trainer', image: '/images/skill-development/team/member-05.jpg' },
  { name: 'Tushar', role: 'Technical Trainer', image: '/images/skill-development/team/member-06.jpg' },
  { name: 'Mazz', role: 'Technical Trainer', image: '/images/skill-development/team/member-07.jpg' },
  { name: 'Anmol', role: 'Technical Trainer', image: '/images/skill-development/team/member-08.jpg' },
  { name: 'Abhinav', role: 'Technical Trainer', image: '/images/skill-development/team/member-09.jpg' },
];

export default function SkillDevelopmentPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-screen-2xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to CodeSkill
        </Link>

        <header className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Compass className="h-4 w-4" aria-hidden="true" />
            Technical Training · Chandigarh University
          </span>
          <h1 className="mt-7 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Skill development for the <span className="text-primary">future</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
            A learning initiative to help students turn technical knowledge into practical ability—through deliberate practice, meaningful challenges, and steady growth.
          </p>
        </header>

        <MentorGratitude />

        <section
          className="mx-auto mt-14 max-w-screen-2xl rounded-[2rem] border border-emerald-900/10 bg-card/90 p-5 shadow-sm dark:border-emerald-100/10 sm:mt-16 sm:p-8 lg:p-10 2xl:p-12"
          aria-labelledby="team-title"
        >
          <div className="mb-8 text-center sm:mb-10">
            <span className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300 sm:text-sm">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
              <span className="h-5 w-px bg-primary/50" aria-hidden="true" />
              Our developers &amp; contributors
            </span>
            <h2 id="team-title" className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Meet the Team Behind CodeSkill
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base lg:text-lg">
              The team building practical, hands-on learning experiences.
            </p>
            <span className="mx-auto mt-5 block h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-5 xl:grid-cols-9 xl:gap-x-2 2xl:gap-x-4" aria-label="CodeSkill team members">
            {teamMembers.map((member) => (
              <article
                key={member.image}
                className="group flex min-w-0 flex-col items-center px-0.5 py-3 text-center transition duration-300 hover:-translate-y-1 sm:px-1"
              >
                <div className="relative aspect-[4/5] w-full max-w-[11rem] shrink-0 overflow-hidden rounded-2xl bg-muted shadow-md transition duration-300 group-hover:shadow-lg">
                  <Image
                    src={member.image}
                    alt={`Portrait of ${member.name}`}
                    fill
                    sizes="(max-width: 639px) 28vw, (max-width: 767px) 20vw, (max-width: 1279px) 18vw, 11rem"
                    quality={82}
                    className={`object-cover transition duration-500 group-hover:scale-[1.035] ${member.name === 'Shadab' ? 'object-[44%_center]' : 'object-center'}`}
                  />
                </div>
                <div className="mt-4 flex min-h-[4.5rem] w-full flex-col items-center gap-2">
                  <h3 className="w-full text-sm font-extrabold leading-snug tracking-tight text-foreground sm:text-base lg:text-lg">{member.name}</h3>
                  <span className="h-0.5 w-7 rounded-full bg-primary" aria-hidden="true" />
                  <p className="text-xs font-semibold leading-snug text-primary sm:text-sm">{member.role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-border/70 bg-card/75 p-7 shadow-sm sm:p-9">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Our vision</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Confident learners. Capable builders.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              We envision a learning environment where students can connect classroom concepts to real technical work, approach unfamiliar problems with confidence, and keep adapting as technology evolves.
            </p>
          </article>

          <article className="rounded-3xl border border-border/70 bg-card/75 p-7 shadow-sm sm:p-9">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Target className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Our goal</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Make learning active and measurable.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              We aim to give students structured opportunities to practice, receive useful feedback, and see how consistent effort translates into stronger problem-solving and technical communication.
            </p>
          </article>
        </section>

        <section className="mx-auto mt-20 max-w-5xl" aria-labelledby="focus-title">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">What we focus on</p>
            <h2 id="focus-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Skills that grow with practice
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Development is more than learning syntax. It is the habit of understanding a problem, choosing an approach, and improving a solution with evidence and feedback.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {focusAreas.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border/70 bg-card/75 p-6 transition-colors hover:border-primary/25">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl rounded-3xl border border-border/70 bg-card/70 p-7 sm:p-10" aria-labelledby="path-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">A practical learning cycle</p>
              <h2 id="path-title" className="mt-3 text-3xl font-bold tracking-tight">Learn, apply, improve.</h2>
            </div>
            <Rocket className="hidden h-9 w-9 text-primary sm:block" aria-hidden="true" />
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {learningSteps.map(([number, title, description], index) => (
              <li key={number} className="relative rounded-2xl border border-border/70 bg-background/70 p-5">
                <span className="text-xs font-bold tracking-[0.14em] text-primary">{number}</span>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                {index < learningSteps.length - 1 && (
                  <ArrowDownRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 text-primary/60 lg:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-12 max-w-5xl rounded-3xl bg-slate-950 px-7 py-9 text-white shadow-xl sm:px-10 sm:py-12">
          <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">The outcome we work toward</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Skills you can carry into what comes next.</h2>
              <p className="mt-4 max-w-3xl leading-7 text-slate-300">
                Strong fundamentals, independent problem-solving, thoughtful collaboration, and the confidence to keep learning—one challenge at a time.
              </p>
            </div>
            <Link
              href="/problems"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Start practising
              <ArrowDownRight className="h-4 w-4 -rotate-45" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
