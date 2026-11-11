import { createFileRoute, Link } from '@tanstack/react-router'
import { Braces, FileText, Zap, FileEdit, ArrowRight, TrendingUp } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const FEATURES = [
  {
    icon: FileText,
    tone: 'bg-blue-50 text-blue-600',
    title: 'CSV import',
    desc: 'Upload your data and let the system create content combinations.',
  },
  {
    icon: Braces,
    tone: 'bg-purple-50 text-purple-600',
    title: 'Template engine',
    desc: 'Handlebars templates with click-to-insert variables.',
  },
  {
    icon: FileEdit,
    tone: 'bg-slate-100 text-slate-700',
    title: 'Mass drafts',
    desc: 'Park thousands of articles as drafts and review before going live.',
  },
  {
    icon: Zap,
    tone: 'bg-amber-50 text-amber-600',
    title: 'Smart publishing',
    desc: 'Delayed auto-publish to avoid spam detection, or publish manually.',
  },
]

function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[32rem] bg-gradient-to-b from-blue-100/70 via-purple-50/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700">
            <TrendingUp className="h-3.5 w-3.5" /> Programmatic SEO at scale
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
            Mass Marketing{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SEO</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            Generate thousands of SEO-optimized content pages from CSV data with customizable templates.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/projects" className="btn btn-primary btn-lg">
              Get started <ArrowRight />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, tone, title, desc }) => (
            <div key={title} className="surface p-6">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
