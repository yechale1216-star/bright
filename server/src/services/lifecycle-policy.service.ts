import prisma from '../config/db';

export interface StatusPolicy {
  portalAccess: 'FULL' | 'HISTORICAL_ONLY' | 'DENIED';
  canViewReportCards: boolean;
  canViewAttendanceHistory: boolean;
  affectsActiveCount: boolean;
  canMarkAttendance?: boolean;
}

export interface LifecyclePolicy {
  activePolicy: StatusPolicy;
  withdrawnPolicy: StatusPolicy;
  transferredPolicy: StatusPolicy;
  graduatedPolicy: StatusPolicy;
  suspendedPolicy: StatusPolicy;
  archivedPolicy: StatusPolicy;
  sessionRevocationOnChange: boolean;
  autoRestoreOnSuspensionEnd: boolean;
}

export const DEFAULT_LIFECYCLE_POLICIES: LifecyclePolicy = {
  activePolicy: {
    portalAccess: 'FULL',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: true,
  },
  withdrawnPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  transferredPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  graduatedPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  suspendedPolicy: {
    portalAccess: 'FULL',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: true,
    canMarkAttendance: false,
  },
  archivedPolicy: {
    portalAccess: 'DENIED',
    canViewReportCards: false,
    canViewAttendanceHistory: false,
    affectsActiveCount: false,
  },
  sessionRevocationOnChange: false,
  autoRestoreOnSuspensionEnd: true,
};

const POLICY_FIELDS = [
  'activePolicy', 'withdrawnPolicy', 'transferredPolicy',
  'graduatedPolicy', 'suspendedPolicy', 'archivedPolicy',
  'sessionRevocationOnChange', 'autoRestoreOnSuspensionEnd',
] as const;

type PolicyKey = 'activePolicy' | 'withdrawnPolicy' | 'transferredPolicy' | 'graduatedPolicy' | 'suspendedPolicy' | 'archivedPolicy';

const STATUS_TO_POLICY_KEY: Record<string, PolicyKey> = {
  ACTIVE: 'activePolicy',
  WITHDRAWN: 'withdrawnPolicy',
  TRANSFERRED: 'transferredPolicy',
  GRADUATED: 'graduatedPolicy',
  SUSPENDED: 'suspendedPolicy',
  ARCHIVED: 'archivedPolicy',
};

async function ensurePolicy(): Promise<any> {
  let policy = await (prisma as any).studentLifecyclePolicy.findUnique({
    where: { id: 'lifecycle_policy_singleton' },
  });
  if (!policy) {
    policy = await (prisma as any).studentLifecyclePolicy.create({
      data: {
        id: 'lifecycle_policy_singleton',
        activePolicy: DEFAULT_LIFECYCLE_POLICIES.activePolicy as any,
        withdrawnPolicy: DEFAULT_LIFECYCLE_POLICIES.withdrawnPolicy as any,
        transferredPolicy: DEFAULT_LIFECYCLE_POLICIES.transferredPolicy as any,
        graduatedPolicy: DEFAULT_LIFECYCLE_POLICIES.graduatedPolicy as any,
        suspendedPolicy: DEFAULT_LIFECYCLE_POLICIES.suspendedPolicy as any,
        archivedPolicy: DEFAULT_LIFECYCLE_POLICIES.archivedPolicy as any,
        sessionRevocationOnChange: DEFAULT_LIFECYCLE_POLICIES.sessionRevocationOnChange,
        autoRestoreOnSuspensionEnd: DEFAULT_LIFECYCLE_POLICIES.autoRestoreOnSuspensionEnd,
      },
    });
  }
  return policy;
}

function parseJsonPolicy(raw: any, fallback: StatusPolicy): StatusPolicy {
  if (!raw) return fallback;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      portalAccess: parsed.portalAccess ?? fallback.portalAccess,
      canViewReportCards: parsed.canViewReportCards ?? fallback.canViewReportCards,
      canViewAttendanceHistory: parsed.canViewAttendanceHistory ?? fallback.canViewAttendanceHistory,
      affectsActiveCount: parsed.affectsActiveCount ?? fallback.affectsActiveCount,
      canMarkAttendance: parsed.canMarkAttendance !== undefined ? parsed.canMarkAttendance : fallback.canMarkAttendance,
    };
  } catch {
    return fallback;
  }
}

export async function getLifecyclePolicy(): Promise<LifecyclePolicy> {
  const raw = await ensurePolicy();
  return {
    activePolicy: parseJsonPolicy(raw.activePolicy, DEFAULT_LIFECYCLE_POLICIES.activePolicy),
    withdrawnPolicy: parseJsonPolicy(raw.withdrawnPolicy, DEFAULT_LIFECYCLE_POLICIES.withdrawnPolicy),
    transferredPolicy: parseJsonPolicy(raw.transferredPolicy, DEFAULT_LIFECYCLE_POLICIES.transferredPolicy),
    graduatedPolicy: parseJsonPolicy(raw.graduatedPolicy, DEFAULT_LIFECYCLE_POLICIES.graduatedPolicy),
    suspendedPolicy: parseJsonPolicy(raw.suspendedPolicy, DEFAULT_LIFECYCLE_POLICIES.suspendedPolicy),
    archivedPolicy: parseJsonPolicy(raw.archivedPolicy, DEFAULT_LIFECYCLE_POLICIES.archivedPolicy),
    sessionRevocationOnChange: raw.sessionRevocationOnChange ?? false,
    autoRestoreOnSuspensionEnd: raw.autoRestoreOnSuspensionEnd ?? true,
  };
}

export async function getStatusPolicy(status: string): Promise<StatusPolicy> {
  const policy = await getLifecyclePolicy();
  const normalized = (status || 'ARCHIVED').trim().toUpperCase();
  const key = STATUS_TO_POLICY_KEY[normalized] || 'archivedPolicy';
  return policy[key] || DEFAULT_LIFECYCLE_POLICIES.archivedPolicy;
}

export async function updateLifecyclePolicy(data: Partial<LifecyclePolicy>, changedByUserId?: string): Promise<LifecyclePolicy> {
  const validPortalValues = ['FULL', 'HISTORICAL_ONLY', 'DENIED'];
  for (const field of (['activePolicy', 'withdrawnPolicy', 'transferredPolicy', 'graduatedPolicy', 'suspendedPolicy', 'archivedPolicy'] as PolicyKey[])) {
    const p = data[field] as StatusPolicy | undefined;
    if (p && !validPortalValues.includes(p.portalAccess)) {
      throw new Error(`Invalid portalAccess value "${p.portalAccess}" for ${field}. Must be FULL, HISTORICAL_ONLY, or DENIED.`);
    }
  }

  // Active students must always have FULL portal access
  if (data.activePolicy && data.activePolicy.portalAccess !== 'FULL') {
    throw new Error('Active students must always have FULL portal access.');
  }

  const updateData: any = { lastChangedByUserId: changedByUserId };
  for (const field of POLICY_FIELDS) {
    if (data[field as keyof LifecyclePolicy] !== undefined) {
      updateData[field] = data[field as keyof LifecyclePolicy];
    }
  }

  await ensurePolicy();
  await (prisma as any).studentLifecyclePolicy.update({
    where: { id: 'lifecycle_policy_singleton' },
    data: updateData,
  });

  try {
    await prisma.auditLog.create({
      data: {
        user_id: changedByUserId || null,
        action: 'UPDATE_LIFECYCLE_POLICY',
        entity_type: 'StudentLifecyclePolicy',
        entity_id: 'lifecycle_policy_singleton',
        new_values: updateData as any,
      },
    });
  } catch (e) {
    console.error('[LifecyclePolicyService] Failed to write audit log:', e);
  }

  return getLifecyclePolicy();
}

