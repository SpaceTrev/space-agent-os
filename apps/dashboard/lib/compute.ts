// ============================================================
// Agent OS — Compute Provisioning
// Supports Railway and Fly.io for deploying agent servers
// ============================================================

import type { ComputeServer, ComputeProvider } from '@/lib/types'

// ============================================================
// Common interface for compute operations
// ============================================================

export interface ProvisionServerParams {
  name: string
  workspaceId: string
  region?: string
  cpu?: number
  memoryMb?: number
  diskGb?: number
  /** Docker image to run */
  image?: string
  /** Environment variables */
  env?: Record<string, string>
}

export interface ProvisionResult {
  provider_server_id: string
  status: ComputeServer['status']
  public_url: string | null
  internal_url: string | null
  region: string | null
  provider_metadata: Record<string, unknown>
}

// ============================================================
// Railway API Client
// ============================================================

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2'

interface RailwayProject {
  id: string
  name: string
}

interface RailwayDeployment {
  id: string
  status: string
  url: string | null
}

async function railwayRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = process.env.RAILWAY_TOKEN
  if (!token) throw new Error('Missing RAILWAY_TOKEN environment variable')

  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`Railway API error ${response.status}: ${await response.text()}`)
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors?.length) {
    throw new Error(`Railway API error: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  return json.data as T
}

export async function provisionRailwayServer(
  params: ProvisionServerParams
): Promise<ProvisionResult> {
  // Create a new Railway project for this workspace server
  const projectName = `agent-os-${params.workspaceId.slice(0, 8)}-${params.name}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')

  const createProjectData = await railwayRequest<{ projectCreate: RailwayProject }>(
    `mutation CreateProject($name: String!) {
      projectCreate(input: { name: $name }) {
        id
        name
      }
    }`,
    { name: projectName }
  )

  const projectId = createProjectData.projectCreate.id

  // Deploy a service in the project
  const image = params.image ?? 'ghcr.io/agent-os/agent-runner:latest'

  const deployData = await railwayRequest<{
    serviceCreate: { id: string }
  }>(
    `mutation CreateService($projectId: String!, $name: String!) {
      serviceCreate(input: { projectId: $projectId, name: $name }) {
        id
      }
    }`,
    { projectId, name: 'agent-runner' }
  )

  const serviceId = deployData.serviceCreate.id

  // Set environment variables
  const envVars = {
    WORKSPACE_ID: params.workspaceId,
    ...(params.env ?? {}),
  }

  for (const [key, value] of Object.entries(envVars)) {
    await railwayRequest(
      `mutation SetEnv($serviceId: String!, $key: String!, $value: String!) {
        variableUpsert(input: { serviceId: $serviceId, name: $key, value: $value })
      }`,
      { serviceId, key, value }
    )
  }

  // Deploy the service with the image
  const deployServiceData = await railwayRequest<{
    serviceInstanceDeploy: { deploymentId: string }
  }>(
    `mutation DeployService($serviceId: String!, $image: String!) {
      serviceInstanceDeploy(input: {
        serviceId: $serviceId
        latestDeployment: { image: $image }
      }) {
        deploymentId
      }
    }`,
    { serviceId, image }
  )

  const deploymentId = deployServiceData.serviceInstanceDeploy.deploymentId

  return {
    provider_server_id: projectId,
    status: 'provisioning',
    public_url: null, // URL becomes available after deployment completes
    internal_url: null,
    region: params.region ?? 'us-west1',
    provider_metadata: {
      project_id: projectId,
      service_id: serviceId,
      deployment_id: deploymentId,
      image,
    },
  }
}

export async function getRailwayServerStatus(
  providerServerId: string,
  metadata: Record<string, unknown>
): Promise<{ status: ComputeServer['status']; public_url: string | null }> {
  const deploymentId = metadata.deployment_id as string | undefined
  if (!deploymentId) {
    return { status: 'error', public_url: null }
  }

  const data = await railwayRequest<{
    deployment: RailwayDeployment
  }>(
    `query GetDeployment($id: String!) {
      deployment(id: $id) {
        id
        status
        url
      }
    }`,
    { id: deploymentId }
  )

  const deployment = data.deployment
  let status: ComputeServer['status'] = 'provisioning'

  switch (deployment.status.toUpperCase()) {
    case 'SUCCESS':
    case 'RUNNING':
      status = 'running'
      break
    case 'FAILED':
    case 'CRASHED':
      status = 'error'
      break
    case 'REMOVING':
      status = 'stopping'
      break
    case 'REMOVED':
      status = 'stopped'
      break
  }

  return {
    status,
    public_url: deployment.url ? `https://${deployment.url}` : null,
  }
}

export async function stopRailwayServer(
  metadata: Record<string, unknown>
): Promise<void> {
  const projectId = metadata.project_id as string | undefined
  if (!projectId) throw new Error('Missing project_id in Railway metadata')

  await railwayRequest(
    `mutation DeleteProject($id: String!) {
      projectDelete(id: $id)
    }`,
    { id: projectId }
  )
}

// ============================================================
// Fly.io API Client
// ============================================================

const FLY_API_URL = 'https://api.machines.dev/v1'

async function flyRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = process.env.FLY_API_TOKEN
  if (!token) throw new Error('Missing FLY_API_TOKEN environment variable')

  const response = await fetch(`${FLY_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    throw new Error(`Fly.io API error ${response.status}: ${await response.text()}`)
  }

  if (response.status === 204) return {} as T
  return response.json() as Promise<T>
}

interface FlyApp {
  id: string
  name: string
}

interface FlyMachine {
  id: string
  state: string
  private_ip: string | null
}

export async function provisionFlyServer(
  params: ProvisionServerParams
): Promise<ProvisionResult> {
  const appName = `agnt-${params.workspaceId.slice(0, 6)}-${params.name}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 30)

  // Create a Fly app
  const app = await flyRequest<FlyApp>('POST', '/apps', {
    app_name: appName,
    org_slug: 'personal',
  })

  // Determine region
  const region = params.region ?? 'iad'

  // Convert memory (Fly uses MB in powers of 256: 256, 512, 1024, 2048, 4096)
  const validMemorySizes = [256, 512, 1024, 2048, 4096, 8192]
  const requestedMemory = params.memoryMb ?? 512
  const memoryMb = validMemorySizes.find((s) => s >= requestedMemory) ?? 512

  const image = params.image ?? 'ghcr.io/agent-os/agent-runner:latest'

  // Create a machine in the app
  const machine = await flyRequest<FlyMachine>('POST', `/apps/${appName}/machines`, {
    name: 'agent-runner',
    region,
    config: {
      image,
      guest: {
        cpu_kind: 'shared',
        cpus: params.cpu ?? 1,
        memory_mb: memoryMb,
      },
      env: {
        WORKSPACE_ID: params.workspaceId,
        ...(params.env ?? {}),
      },
      services: [
        {
          ports: [{ port: 443, handlers: ['tls', 'http'] }],
          protocol: 'tcp',
          internal_port: 8080,
        },
      ],
    },
  })

  const publicUrl = `https://${appName}.fly.dev`

  return {
    provider_server_id: app.id,
    status: 'provisioning',
    public_url: publicUrl,
    internal_url: machine.private_ip ? `http://${machine.private_ip}:8080` : null,
    region,
    provider_metadata: {
      app_id: app.id,
      app_name: appName,
      machine_id: machine.id,
      image,
    },
  }
}

export async function getFlyServerStatus(
  metadata: Record<string, unknown>
): Promise<{ status: ComputeServer['status']; public_url: string | null }> {
  const appName = metadata.app_name as string | undefined
  const machineId = metadata.machine_id as string | undefined

  if (!appName || !machineId) {
    return { status: 'error', public_url: null }
  }

  const machine = await flyRequest<FlyMachine>('GET', `/apps/${appName}/machines/${machineId}`)

  let status: ComputeServer['status'] = 'provisioning'
  switch (machine.state) {
    case 'started':
      status = 'running'
      break
    case 'stopped':
      status = 'stopped'
      break
    case 'stopping':
      status = 'stopping'
      break
    case 'error':
    case 'failed':
      status = 'error'
      break
  }

  return {
    status,
    public_url: `https://${appName}.fly.dev`,
  }
}

export async function stopFlyServer(
  metadata: Record<string, unknown>
): Promise<void> {
  const appName = metadata.app_name as string | undefined
  if (!appName) throw new Error('Missing app_name in Fly metadata')

  await flyRequest('DELETE', `/apps/${appName}`)
}

// ============================================================
// Unified compute operations
// ============================================================

export async function provisionServer(
  provider: ComputeProvider,
  params: ProvisionServerParams
): Promise<ProvisionResult> {
  switch (provider) {
    case 'railway':
      return provisionRailwayServer(params)
    case 'fly':
      return provisionFlyServer(params)
    case 'custom':
      throw new Error('Custom compute providers must be provisioned manually')
    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown compute provider: ${exhaustive}`)
    }
  }
}

export async function getServerStatus(
  provider: ComputeProvider,
  providerServerId: string,
  metadata: Record<string, unknown>
): Promise<{ status: ComputeServer['status']; public_url: string | null }> {
  switch (provider) {
    case 'railway':
      return getRailwayServerStatus(providerServerId, metadata)
    case 'fly':
      return getFlyServerStatus(metadata)
    case 'custom':
      return { status: 'running', public_url: null }
    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown compute provider: ${exhaustive}`)
    }
  }
}

export async function stopServer(
  provider: ComputeProvider,
  metadata: Record<string, unknown>
): Promise<void> {
  switch (provider) {
    case 'railway':
      return stopRailwayServer(metadata)
    case 'fly':
      return stopFlyServer(metadata)
    case 'custom':
      throw new Error('Custom compute servers must be stopped manually')
    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown compute provider: ${exhaustive}`)
    }
  }
}

// ============================================================
// Estimate compute cost per hour
// ============================================================

export function estimateComputeCostPerHour(
  provider: ComputeProvider,
  cpu: number,
  memoryMb: number
): number {
  switch (provider) {
    case 'railway': {
      // Railway pricing: ~$0.000463/vCPU/min + $0.000231/GB RAM/min
      const cpuCostPerHour = cpu * 0.000463 * 60
      const ramCostPerHour = (memoryMb / 1024) * 0.000231 * 60
      return cpuCostPerHour + ramCostPerHour
    }
    case 'fly': {
      // Fly.io shared CPU pricing
      const cpuCostPerHour = cpu * 0.0055
      const ramCostPerHour = (memoryMb / 1024) * 0.006
      return cpuCostPerHour + ramCostPerHour
    }
    case 'custom':
      return 0
    default:
      return 0
  }
}
