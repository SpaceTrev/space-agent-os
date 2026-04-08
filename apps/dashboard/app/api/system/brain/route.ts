// GET /api/system/brain — public brain vault stats, no auth required
// Returns Obsidian vault structure from brains/ directory (hardcoded from design spec)
export function GET() {
  const domains = [
    {
      id: 'company',
      name: 'Company',
      path: 'brains/company/',
      description: 'Mission, tech stack, org context',
      doc_count: 4,
      icon: 'building',
    },
    {
      id: 'departments',
      name: 'Departments',
      path: 'brains/departments/',
      description: 'Engineering, marketing, planning, QA brains',
      doc_count: 8,
      icon: 'layers',
    },
    {
      id: 'projects',
      name: 'Projects',
      path: 'brains/projects/',
      description: 'Project-scoped context and specs',
      doc_count: 12,
      icon: 'folder',
    },
    {
      id: 'people',
      name: 'People',
      path: 'brains/people/',
      description: 'Team and contact profiles',
      doc_count: 6,
      icon: 'users',
    },
    {
      id: 'decisions',
      name: 'Decisions',
      path: 'brains/decisions/',
      description: 'ADRs and business decisions',
      doc_count: 9,
      icon: 'git-branch',
    },
    {
      id: 'daily',
      name: 'Daily Logs',
      path: 'brains/daily/',
      description: 'Append-only daily note log',
      doc_count: 31,
      icon: 'calendar',
    },
  ]

  const total_docs = domains.reduce((sum, d) => sum + d.doc_count, 0)

  return Response.json({
    vault: 'Space-Brain',
    format: 'Obsidian',
    domains,
    total_docs,
    schema_version: '1.0',
  })
}
