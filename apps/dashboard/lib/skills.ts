// ============================================================
// Agent OS — Skill File Loader
// Loads skill markdown files for agents from the skills/ dir
// ============================================================

import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import type { Agent } from '@/lib/types'

// ============================================================
// Constants
// ============================================================

const SKILLS_DIR = join(process.cwd(), 'skills')

// ============================================================
// SkillFile — represents a loaded skill
// ============================================================

export interface SkillFile {
  filename: string
  name: string
  content: string
}

// ============================================================
// loadSkillFile — reads a single skill file by name
// ============================================================

export async function loadSkillFile(filename: string): Promise<SkillFile> {
  // Normalize: allow callers to pass "engineering" or "engineering.md"
  const normalized = filename.endsWith('.md') ? filename : `${filename}.md`
  const filepath = join(SKILLS_DIR, normalized)

  let content: string
  try {
    content = await readFile(filepath, 'utf-8')
  } catch (err) {
    throw new Error(`Skill file not found: ${normalized} (looked in ${SKILLS_DIR})`)
  }

  // Derive a human-readable name from the filename
  const baseName = normalized.replace(/\.md$/, '')
  const name = baseName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return { filename: normalized, name, content }
}

// ============================================================
// getAgentSkills — loads all skill files for an agent
// Looks at agent.config or agent metadata for skill list.
// Falls back to the agent type / model to pick defaults.
// ============================================================

export async function getAgentSkills(agent: Agent): Promise<SkillFile[]> {
  // Check if agent metadata specifies skill files
  const metaSkills = (agent.metadata as Record<string, unknown> | undefined)?.skills as
    | string[]
    | undefined

  // If explicit list provided in metadata, load those
  if (metaSkills && Array.isArray(metaSkills) && metaSkills.length > 0) {
    const results: SkillFile[] = []
    for (const skill of metaSkills) {
      try {
        const loaded = await loadSkillFile(skill)
        results.push(loaded)
      } catch {
        // Skip missing skill files gracefully
      }
    }
    return results
  }

  // Otherwise infer from the agent name / description
  const available = await listAvailableSkills()
  const agentNameLower = agent.name.toLowerCase()
  const agentDescLower = (agent.description ?? '').toLowerCase()

  // Map keywords to skill files
  const keywordMap: Record<string, string[]> = {
    engineer: ['engineering'],
    developer: ['engineering'],
    dev: ['engineering'],
    architect: ['architecture'],
    architecture: ['architecture'],
    research: ['research'],
    researcher: ['research'],
    analyst: ['research'],
    market: ['marketing'],
    marketer: ['marketing'],
    writer: ['content'],
    content: ['content'],
    editor: ['content'],
    support: ['support'],
    pm: ['content'],
    manager: ['content'],
  }

  const matchedSkills = new Set<string>()

  for (const [keyword, skills] of Object.entries(keywordMap)) {
    if (agentNameLower.includes(keyword) || agentDescLower.includes(keyword)) {
      for (const s of skills) {
        matchedSkills.add(s)
      }
    }
  }

  const availableNames = available.map((f) => f.replace(/\.md$/, ''))
  const results: SkillFile[] = []

  for (const skill of matchedSkills) {
    if (availableNames.includes(skill)) {
      try {
        const loaded = await loadSkillFile(skill)
        results.push(loaded)
      } catch {
        // Skip
      }
    }
  }

  return results
}

// ============================================================
// listAvailableSkills — returns all skill filenames in skills/
// ============================================================

export async function listAvailableSkills(): Promise<string[]> {
  try {
    const files = await readdir(SKILLS_DIR)
    return files
      .filter((f) => f.endsWith('.md') && f !== 'ROSTER.md')
      .sort()
  } catch {
    return []
  }
}

// ============================================================
// buildSkillPrompt — concatenates skill files into a prompt section
// ============================================================

export function buildSkillPrompt(skills: SkillFile[]): string {
  if (skills.length === 0) return ''

  const sections = skills.map((skill) => {
    return `## Skill: ${skill.name}\n\n${skill.content}`
  })

  return `\n\n---\n# Skill Files\n\n${sections.join('\n\n---\n\n')}`
}
