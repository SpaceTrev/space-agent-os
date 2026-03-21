'use client'

import { useState, useEffect, use } from 'react'
import { clsx } from 'clsx'
import { Server, Plus, Cpu, HardDrive, DollarSign, Power, StopCircle, RefreshCw, Globe, Database } from 'lucide-react'
import { Button } from '../../../../components/shared/button'
import { Modal } from '../../../../components/shared/modal'
import { Select, Input } from '../../../../components/shared/input'
import { Badge } from '../../../../components/shared/badge'
import { useAuth } from '@/lib/auth-context'
import type { ComputeServerStatus } from '../../../../lib/types'

interface ComputeServer {
  id: string
  name: string
  provider: string
  status: ComputeServerStatus
  region: string | null
  cpu: number
  memory_mb: number
  disk_gb: number
  cost_per_hour_usd: number
  public_url: string | null
  started_at: string | null
}

const statusConfig: Record<ComputeServerStatus, { variant: 'green' | 'gray' | 'yellow' | 'red'; label: string; dot: string }> = {
  running: { variant: 'green', label: 'Running', dot: 'bg-green-400 animate-pulse' },
  stopped: { variant: 'gray', label: 'Stopped', dot: 'bg-gray-500' },
  provisioning: { variant: 'yellow', label: 'Provisioning', dot: 'bg-yellow-400 animate-pulse' },
  stopping: { variant: 'yellow', label: 'Stopping', dot: 'bg-yellow-400' },
  error: { variant: 'red', label: 'Error', dot: 'bg-red-400' },
}

const regionOptions = [
  { value: 'us-east-1', label: 'US East (Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
]

const sizeOptions = [
  { value: 'small', label: 'Small — 2 vCPU, 4 GB RAM ($0.06/hr)' },
  { value: 'medium', label: 'Medium — 4 vCPU, 8 GB RAM ($0.12/hr)' },
  { value: 'large', label: 'Large — 8 vCPU, 16 GB RAM ($0.24/hr)' },
]

export default function ComputePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = use(params)
  const { workspaces } = useAuth()
  const [servers, setServers] = useState<ComputeServer[]>([])
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [serverName, setServerName] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [size, setSize] = useState('medium')
  const [provisioning, setProvisioning] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const ws = workspaces.find((w) => w.slug === workspace)

  useEffect(() => {
    if (!ws) return
    fetch(`/api/compute?workspace_id=${ws.id}`)
      .then((r) => r.ok ? r.json() : { servers: [] })
      .then((data) => setServers(data.servers ?? []))
      .catch(() => {})
      .finally(() => setPageLoading(false))
  }, [ws])

  const runningServers = servers.filter((s) => s.status === 'running')
  const totalCostPerHour = runningServers.reduce((sum, s) => sum + Number(s.cost_per_hour_usd || 0), 0)

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ws || !serverName.trim()) return
    setProvisioning(true)

    try {
      const res = await fetch('/api/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: ws.id,
          name: serverName.trim(),
          provider: 'railway',
          region,
          size,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setServers((prev) => [data.server, ...prev])
      }
    } catch (err) {
      console.error('Failed to provision server:', err)
    } finally {
      setProvisioning(false)
      setProvisionOpen(false)
      setServerName('')
    }
  }

  const formatUptime = (startedAt: string | null) => {
    if (!startedAt) return '—'
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    const hours = Math.floor(elapsed / 3600)
    const mins = Math.floor((elapsed % 3600) / 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (pageLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Compute</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {runningServers.length} servers running &middot; ${totalCostPerHour.toFixed(3)}/hr current spend
          </p>
        </div>
        <Button variant="primary" onClick={() => setProvisionOpen(true)}>
          <Plus className="w-4 h-4" />
          Provision Server
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Running', value: runningServers.length, icon: Server, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Total servers', value: servers.length, icon: RefreshCw, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Cost / hr', value: `$${totalCostPerHour.toFixed(3)}`, icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
                <Icon className={clsx('w-4 h-4', stat.color)} />
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Server list */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-300">No compute servers</p>
          <p className="text-xs text-gray-500 mt-1">Provision a server to run your agents</p>
        </div>
      ) : (
        <div className="space-y-4">
          {servers.map((server) => {
            const config = statusConfig[server.status] ?? statusConfig.stopped
            return (
              <div key={server.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                      <Server className="w-5 h-5 text-gray-500" />
                      <span className={clsx(
                        'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900',
                        config.dot
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{server.name}</p>
                        <Badge variant={config.variant} size="sm" dot>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{server.provider} {server.region ? `· ${server.region}` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {server.status === 'running' && (
                      <Button variant="outline" size="sm">
                        <StopCircle className="w-3.5 h-3.5 text-red-400" />
                        Stop
                      </Button>
                    )}
                    {server.status === 'stopped' && (
                      <Button variant="outline" size="sm">
                        <Power className="w-3.5 h-3.5 text-green-400" />
                        Start
                      </Button>
                    )}
                  </div>
                </div>

                {/* Specs */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Cpu className="w-3.5 h-3.5" />
                    {server.cpu} vCPU
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Database className="w-3.5 h-3.5" />
                    {(server.memory_mb / 1024).toFixed(0)} GB RAM
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <HardDrive className="w-3.5 h-3.5" />
                    {server.disk_gb} GB disk
                  </div>
                  <div className="flex items-center gap-2 text-xs text-yellow-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="font-mono">${Number(server.cost_per_hour_usd || 0).toFixed(3)}/hr</span>
                  </div>
                </div>

                {/* Footer info */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                  {server.started_at && (
                    <span>Uptime: {formatUptime(server.started_at)}</span>
                  )}
                  {server.public_url && (
                    <a
                      href={server.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      {server.public_url.replace('https://', '')}
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Provision modal */}
      <Modal
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision Compute Server"
        description="Deploy a new server for your agents to run on"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setProvisionOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={provisioning} onClick={handleProvision}>
              <Server className="w-4 h-4" />
              Provision
            </Button>
          </>
        }
      >
        <form onSubmit={handleProvision} className="space-y-4">
          <Input
            label="Server Name"
            placeholder="compute-03"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            required
          />
          <Select
            label="Region"
            options={regionOptions}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <Select
            label="Server Size"
            options={sizeOptions}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <div className="p-3 bg-gray-800 rounded-lg text-xs text-gray-500">
            Estimated cost: <span className="text-yellow-400 font-mono">
              {size === 'small' ? '$0.06' : size === 'medium' ? '$0.12' : '$0.24'}/hr
            </span>
            {' '}&middot; Provisioning takes ~30 seconds
          </div>
        </form>
      </Modal>
    </div>
  )
}
