'use client'

import { useState, use } from 'react'
import { Settings, Users, Plus, Trash2, Mail, Shield } from 'lucide-react'
import { Input, Textarea, Select } from '../../../../components/shared/input'
import { Button } from '../../../../components/shared/button'
import { Badge } from '../../../../components/shared/badge'
import { ConfirmModal } from '../../../../components/shared/modal'
import type { WorkspaceRole } from '../../../../lib/types'

const members = [
  { id: 'm1', name: 'Alex Johnson', email: 'alex@acme.com', role: 'owner' as WorkspaceRole, avatarChar: 'A' },
  { id: 'm2', name: 'Sam Rivera', email: 'sam@acme.com', role: 'admin' as WorkspaceRole, avatarChar: 'S' },
  { id: 'm3', name: 'Jordan Kim', email: 'jordan@acme.com', role: 'developer' as WorkspaceRole, avatarChar: 'J' },
  { id: 'm4', name: 'Taylor Smith', email: 'taylor@acme.com', role: 'viewer' as WorkspaceRole, avatarChar: 'T' },
]

const roleConfig: Record<WorkspaceRole, { variant: 'green' | 'blue' | 'gray' | 'purple'; label: string; description: string }> = {
  owner: { variant: 'purple', label: 'Owner', description: 'Full access including billing' },
  admin: { variant: 'blue', label: 'Admin', description: 'Manage agents, tasks, and members' },
  developer: { variant: 'green', label: 'Developer', description: 'Create and run tasks' },
  viewer: { variant: 'gray', label: 'Viewer', description: 'Read-only access' },
}

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'viewer', label: 'Viewer' },
]

export default function SettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const [name, setName] = useState(workspace.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
  const [description, setDescription] = useState('Automation workspace for backend and infrastructure tasks')
  const [defaultModel, setDefaultModel] = useState('anthropic:claude-3-5-sonnet-20241022')
  const [maxRetries, setMaxRetries] = useState('3')
  const [taskTimeout, setTaskTimeout] = useState('3600')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('developer')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 700))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    await new Promise((r) => setTimeout(r, 600))
    setInviting(false)
    setInviteEmail('')
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-surface-high border border-outline-variant flex items-center justify-center">
          <Settings className="w-5 h-5 text-on-surface-variant" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Workspace Settings</h1>
          <p className="text-sm text-on-surface-variant capitalize">{workspace.replace(/-/g, ' ')}</p>
        </div>
      </div>

      {/* General settings */}
      <form onSubmit={handleSave} className="space-y-6 mb-8">
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-on-surface">General</h2>

          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <Input
            label="Default Model"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            hint="Format: provider:model-id — override on individual agents"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Task Retries"
              type="number"
              min="0"
              max="10"
              value={maxRetries}
              onChange={(e) => setMaxRetries(e.target.value)}
            />
            <Input
              label="Task Timeout (seconds)"
              type="number"
              min="60"
              value={taskTimeout}
              onChange={(e) => setTaskTimeout(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" variant="primary" loading={saving}>
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

      {/* Members */}
      <div className="mb-8">
        <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-on-surface-variant" />
              <h2 className="text-sm font-semibold text-on-surface">Members</h2>
              <span className="text-xs text-on-surface-variant">{members.length}</span>
            </div>
          </div>

          {/* Member list */}
          <div className="divide-y divide-gray-800">
            {members.map((member) => {
              const config = roleConfig[member.role]
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {member.avatarChar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{member.name}</p>
                    <p className="text-xs text-on-surface-variant">{member.email}</p>
                  </div>
                  <Badge variant={config.variant} size="sm">{config.label}</Badge>
                  {member.role !== 'owner' && (
                    <button className="text-on-surface-variant hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Invite form */}
          <form onSubmit={handleInvite} className="px-5 py-4 border-t border-outline-variant flex items-end gap-3">
            <Input
              label="Invite by email"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <Select
              label="Role"
              options={roleOptions}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-36"
            />
            <Button type="submit" variant="outline" loading={inviting} className="flex-shrink-0 mb-0">
              <Plus className="w-4 h-4" />
              Invite
            </Button>
          </form>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-surface-base border border-red-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-on-surface">Delete workspace</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Permanently delete this workspace and all its agents, tasks, and data.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete Workspace
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true)
          await new Promise((r) => setTimeout(r, 1000))
          setDeleting(false)
          setDeleteOpen(false)
        }}
        title="Delete Workspace"
        description={`Are you sure you want to delete the "${name}" workspace? This action cannot be undone and will permanently delete all agents, tasks, and data.`}
        confirmLabel="Delete Workspace"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}
