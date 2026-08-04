// Mock data + operations — swap for Supabase/Neon in production.

export type TierPlan = string;
export type BillingPeriod = string;
export type SubscriptionStatus = string;
export type AddonSelection = any;

const calculateDynamicPrice = (..._args: any[]) => ({ effectiveMonthly: 0, currentPeriodTotal: 0, breakdown: [] });
const TIER_CONFIG = {};

export interface School {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  contactPerson: string
}

export interface Subscription {
  id: string
  schoolId: string
  tier: TierPlan
  billingPeriod: BillingPeriod
  /** Active students / billable seats */
  studentCount: number
  status: SubscriptionStatus
  billingStart: string
  billingEnd: string
  renewalDate: string
  createdAt: string
  updatedAt: string
  addons: AddonSelection[]
  discountPercent: number
  trialEndsAt?: string
  isTrial?: boolean
  trialStartedAt?: string
}

export interface BillingHistory {
  id: string
  subscriptionId: string
  amount: number
  date: string
  status: "completed" | "failed" | "pending"
  description: string
  invoiceUrl?: string
}

export interface Transaction {
  id: string
  subscriptionId: string
  schoolId: string
  amount: number
  currency: string
  status: "completed" | "failed" | "pending" | "refunded"
  type: "charge" | "refund" | "adjustment" | "credit"
  description: string
  createdAt: string
  invoiceId?: string
  paymentMethod?: string
  txRef?: string
  gatewayReference?: string
}

export interface Invoice {
  id: string
  number: string
  subscriptionId: string
  schoolId: string
  amount: number
  status: "draft" | "open" | "paid" | "void"
  issuedAt: string
  dueAt: string
  lineItemSummary: string
  pdfUrl?: string
}

export interface PricingRule {
  id: string
  name: string
  kind: "volume" | "coupon" | "enterprise"
  valueJson: string
  active: boolean
  updatedAt: string
}

const schools: Map<string, School> = new Map([
  [
    "s1",
    {
      id: "s1",
      name: "Springfield High School",
      email: "admin@springfield.edu",
      phone: "555-0101",
      address: "123 Main St",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      contactPerson: "John Smith",
    },
  ],
  [
    "s2",
    {
      id: "s2",
      name: "Central Academy",
      email: "admin@central.edu",
      phone: "555-0102",
      address: "456 Oak Ave",
      city: "Metropolis",
      state: "NY",
      zipCode: "10001",
      contactPerson: "Jane Doe",
    },
  ],
  [
    "s3",
    {
      id: "s3",
      name: "Lincoln Elementary",
      email: "admin@lincoln.edu",
      phone: "555-0103",
      address: "789 Pine Rd",
      city: "Shelbyville",
      state: "OH",
      zipCode: "43106",
      contactPerson: "Bob Johnson",
    },
  ],
  [
    "s4",
    {
      id: "s4",
      name: "Washington Middle School",
      email: "admin@washington.edu",
      phone: "555-0104",
      address: "321 Elm St",
      city: "Capital City",
      state: "DC",
      zipCode: "20001",
      contactPerson: "Alice Williams",
    },
  ],
  [
    "s5",
    {
      id: "s5",
      name: "Jefferson Technical High",
      email: "admin@jefferson.edu",
      phone: "555-0105",
      address: "654 Maple Dr",
      city: "Riverside",
      state: "CA",
      zipCode: "92501",
      contactPerson: "Charlie Brown",
    },
  ],
])

const subscriptions: Map<string, Subscription> = new Map([
  [
    "sub1",
    {
      id: "sub1",
      schoolId: "s1",
      tier: "standard",
      billingPeriod: "monthly",
      studentCount: 250,
      status: "active",
      billingStart: "2024-05-13",
      billingEnd: "2024-06-13",
      renewalDate: "2024-06-13",
      createdAt: "2024-01-15",
      updatedAt: "2024-05-13",
      addons: [{ id: "sms_package" }],
      discountPercent: 0,
    },
  ],
  [
    "sub2",
    {
      id: "sub2",
      schoolId: "s2",
      tier: "premium",
      billingPeriod: "semester",
      studentCount: 178,
      status: "active",
      billingStart: "2024-02-20",
      billingEnd: "2024-08-20",
      renewalDate: "2024-08-20",
      createdAt: "2024-02-20",
      updatedAt: "2024-05-13",
      addons: [{ id: "priority_support" }],
      discountPercent: 5,
    },
  ],
  [
    "sub3",
    {
      id: "sub3",
      schoolId: "s3",
      tier: "starter",
      billingPeriod: "monthly",
      studentCount: 90,
      status: "expiring",
      billingStart: "2024-03-10",
      billingEnd: "2024-06-10",
      renewalDate: "2024-06-10",
      createdAt: "2024-03-10",
      updatedAt: "2024-05-13",
      addons: [],
      discountPercent: 0,
    },
  ],
  [
    "sub4",
    {
      id: "sub4",
      schoolId: "s4",
      tier: "standard",
      billingPeriod: "yearly",
      studentCount: 144,
      status: "expired",
      billingStart: "2023-06-15",
      billingEnd: "2024-06-15",
      renewalDate: "2024-06-15",
      createdAt: "2023-06-15",
      updatedAt: "2024-06-15",
      addons: [{ id: "custom_domain" }],
      discountPercent: 0,
    },
  ],
  [
    "sub5",
    {
      id: "sub5",
      schoolId: "s5",
      tier: "enterprise",
      billingPeriod: "yearly",
      studentCount: 196,
      status: "trial",
      billingStart: "2024-05-01",
      billingEnd: "2025-05-01",
      renewalDate: "2025-05-01",
      createdAt: "2024-05-01",
      updatedAt: "2024-05-13",
      addons: [
        { id: "white_label" },
        { id: "extra_branches", quantity: 2 },
      ],
      discountPercent: 10,
      trialEndsAt: "2024-06-01",
    },
  ],
  [
    "sub6",
    {
      id: "sub6",
      schoolId: "s2",
      tier: "standard",
      billingPeriod: "monthly",
      studentCount: 120,
      status: "pending_payment",
      billingStart: "2024-05-01",
      billingEnd: "2024-06-01",
      renewalDate: "2024-06-01",
      createdAt: "2024-05-01",
      updatedAt: "2024-05-13",
      addons: [],
      discountPercent: 0,
    },
  ],
  [
    "sub7",
    {
      id: "sub7",
      schoolId: "s4",
      tier: "premium",
      billingPeriod: "monthly",
      studentCount: 300,
      status: "suspended",
      billingStart: "2024-04-01",
      billingEnd: "2024-05-01",
      renewalDate: "2024-05-01",
      createdAt: "2024-04-01",
      updatedAt: "2024-05-13",
      addons: [{ id: "sms_package" }],
      discountPercent: 0,
    },
  ],
])

const billingHistory: Map<string, BillingHistory> = new Map([
  [
    "bill1",
    {
      id: "bill1",
      subscriptionId: "sub1",
      amount: 62500,
      date: "2024-05-13",
      status: "completed",
      description: "Monthly subscription — Standard / 250 students",
      invoiceUrl: "/invoices/INV-001.pdf",
    },
  ],
  [
    "bill2",
    {
      id: "bill2",
      subscriptionId: "sub1",
      amount: 62500,
      date: "2024-04-13",
      status: "completed",
      description: "Monthly subscription — Standard / 250 students",
      invoiceUrl: "/invoices/INV-002.pdf",
    },
  ],
  [
    "bill3",
    {
      id: "bill3",
      subscriptionId: "sub2",
      amount: 241200,
      date: "2024-02-20",
      status: "completed",
      description: "Semester — Premium / 178 students",
      invoiceUrl: "/invoices/INV-003.pdf",
    },
  ],
  [
    "bill4",
    {
      id: "bill4",
      subscriptionId: "sub5",
      amount: 1411200,
      date: "2024-05-01",
      status: "completed",
      description: "Yearly — Enterprise / 196 students + add-ons",
      invoiceUrl: "/invoices/INV-004.pdf",
    },
  ],
])

const transactions: Map<string, Transaction> = new Map([
  [
    "txn1",
    {
      id: "txn1",
      subscriptionId: "sub1",
      schoolId: "s1",
      amount: 62500,
      currency: "ETB",
      status: "completed",
      type: "charge",
      description: "Subscription renewal",
      createdAt: "2024-05-13T10:00:00Z",
      invoiceId: "inv1",
      paymentMethod: "telebirr",
    },
  ],
  [
    "txn2",
    {
      id: "txn2",
      subscriptionId: "sub2",
      schoolId: "s2",
      amount: 241200,
      currency: "ETB",
      status: "completed",
      type: "charge",
      description: "Semester charge",
      createdAt: "2024-02-20T14:30:00Z",
      invoiceId: "inv2",
      paymentMethod: "cbe",
    },
  ],
  [
    "txn3",
    {
      id: "txn3",
      subscriptionId: "sub6",
      schoolId: "s2",
      amount: 30000,
      currency: "ETB",
      status: "pending",
      type: "charge",
      description: "Awaiting payment method",
      createdAt: "2024-05-12T09:00:00Z",
      paymentMethod: "dashen",
    },
  ],
  [
    "txn4",
    {
      id: "txn4",
      subscriptionId: "sub3",
      schoolId: "s3",
      amount: -6000,
      currency: "ETB",
      status: "completed",
      type: "credit",
      description: "Goodwill credit — support case #4412",
      createdAt: "2024-05-01T16:00:00Z",
    },
  ],
])

const invoices: Map<string, Invoice> = new Map([
  [
    "inv1",
    {
      id: "inv1",
      number: "INV-2024-0001",
      subscriptionId: "sub1",
      schoolId: "s1",
      amount: 1250,
      status: "paid",
      issuedAt: "2024-05-13",
      dueAt: "2024-05-20",
      lineItemSummary: "Standard tier · 250 students · monthly",
      pdfUrl: "/invoices/INV-001.pdf",
    },
  ],
  [
    "inv2",
    {
      id: "inv2",
      number: "INV-2024-0002",
      subscriptionId: "sub2",
      schoolId: "s2",
      amount: 2691,
      status: "paid",
      issuedAt: "2024-02-20",
      dueAt: "2024-03-01",
      lineItemSummary: "Premium · 178 students · semester",
      pdfUrl: "/invoices/INV-003.pdf",
    },
  ],
  [
    "inv3",
    {
      id: "inv3",
      number: "INV-2024-0003",
      subscriptionId: "sub6",
      schoolId: "s2",
      amount: 600,
      status: "open",
      issuedAt: "2024-05-12",
      dueAt: "2024-05-26",
      lineItemSummary: "Standard · 120 students · monthly",
    },
  ],
])

const pricingRules: Map<string, PricingRule> = new Map([
  [
    "rule1",
    {
      id: "rule1",
      name: "Volume band 1000+",
      kind: "volume",
      valueJson: JSON.stringify({ minStudents: 1000, percentOff: 8 }),
      active: true,
      updatedAt: new Date().toISOString(),
    },
  ],
])

/** Add-on overrides (merged with catalog) */
let addonOverrides: Map<string, any> = new Map()

/** Super-admin overrides for $/student/month (merged in pricing APIs) */
let tierBaseOverrides: Partial<Record<TierPlan, number>> = {}

/** Global Trial Configuration */
let trialSettings = {
  enabled: true,
  durationDays: 14,
  studentCapacity: 100
}

function subscriptionPrice(sub: Subscription) {
  return calculateDynamicPrice(
    {
      studentCount: sub.studentCount,
      tier: sub.tier,
      billingPeriod: sub.billingPeriod,
      addons: sub.addons,
      discountPercent: sub.discountPercent,
    },
    { tierBaseOverrides },
  )
}

export const mockDB = {
  getSchool: (id: string): School | undefined => schools.get(id),
  getAllSchools: (): School[] => Array.from(schools.values()),

  getSubscription: (id: string): Subscription | undefined => {
    const sub = subscriptions.get(id)
    if (sub && sub.status === "trial" && sub.trialEndsAt && new Date() > new Date(sub.trialEndsAt)) {
      sub.status = "expired"
      sub.updatedAt = new Date().toISOString()
    }
    return sub
  },
  getSubscriptionBySchoolId: (schoolId: string): Subscription | undefined => {
    for (const sub of subscriptions.values()) {
      if (sub.schoolId === schoolId) {
        if (sub.status === "trial" && sub.trialEndsAt && new Date() > new Date(sub.trialEndsAt)) {
          sub.status = "expired"
          sub.updatedAt = new Date().toISOString()
        }
        return sub
      }
    }
    return undefined
  },
  getAllSubscriptions: (): Subscription[] => Array.from(subscriptions.values()),

  createSubscription: (schoolId: string, sub: Omit<Subscription, "id" | "schoolId" | "createdAt" | "updatedAt">): Subscription => {
    const id = `sub${Date.now()}`
    const newSub: Subscription = {
      ...sub,
      id,
      schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    subscriptions.set(id, newSub)
    return newSub
  },

  updateSubscription: (id: string, updates: Partial<Subscription>): Subscription | null => {
    const existing = subscriptions.get(id)
    if (!existing) return null
    const updated: Subscription = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    subscriptions.set(id, updated)
    return updated
  },

  deleteSubscription: (id: string): boolean => subscriptions.delete(id),

  getBillingHistory: (subscriptionId: string): BillingHistory[] =>
    Array.from(billingHistory.values()).filter((b) => b.subscriptionId === subscriptionId),

  getAllBillingHistory: (): BillingHistory[] => Array.from(billingHistory.values()),

  addBillingRecord: (record: Omit<BillingHistory, "id">): BillingHistory => {
    const id = `bill${Date.now()}`
    const newRecord: BillingHistory = { ...record, id }
    billingHistory.set(id, newRecord)
    return newRecord
  },

  getAllTransactions: (): Transaction[] => Array.from(transactions.values()),
  addTransaction: (t: Omit<Transaction, "id">): Transaction => {
    const id = `txn${Date.now()}`
    const row = { ...t, id }
    transactions.set(id, row)
    return row
  },
  getTransactionByTxRef: (txRef: string): Transaction | undefined => {
    for (const t of transactions.values()) {
      if (t.txRef === txRef) return t
    }
    return undefined
  },
  updateTransactionStatus: (id: string, status: Transaction["status"], gatewayReference?: string): Transaction | null => {
    const txn = transactions.get(id)
    if (!txn) return null
    const updated = { ...txn, status, gatewayReference: gatewayReference || txn.gatewayReference }
    transactions.set(id, updated)
    return updated
  },

  getAllInvoices: (): Invoice[] => Array.from(invoices.values()),
  getInvoice: (id: string): Invoice | undefined => invoices.get(id),
  addInvoice: (inv: Omit<Invoice, "id">): Invoice => {
    const id = `inv${Date.now()}`
    const row = { ...inv, id }
    invoices.set(id, row)
    return row
  },

  getPricingRules: (): PricingRule[] => Array.from(pricingRules.values()),
  upsertPricingRule: (rule: PricingRule): void => {
    pricingRules.set(rule.id, rule)
  },

  getTierBaseOverrides: (): Partial<Record<TierPlan, number>> => ({ ...tierBaseOverrides }),
  setTierBaseOverrides: (next: Partial<Record<TierPlan, number>>): void => {
    tierBaseOverrides = { ...next }
  },

  getAddonOverrides: () => Array.from(addonOverrides.values()),
  upsertAddonOverride: (id: string, data: any) => {
    addonOverrides.set(id, { ...data, id })
  },
  deleteAddonOverride: (id: string) => addonOverrides.delete(id),

  /** Aggregated metrics for dashboards */
  getSubscriptionMetrics: () => {
    const subs = Array.from(subscriptions.values())
    const bills = Array.from(billingHistory.values())
    const totalRevenue = bills.filter((b) => b.status === "completed").reduce((s, b) => s + b.amount, 0)
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const monthlyRevenue = bills
      .filter((b) => b.status === "completed" && b.date.startsWith(monthKey))
      .reduce((s, b) => s + b.amount, 0)

    const active = subs.filter((s) => s.status === "active" || s.status === "trial").length
    const expiringSoon = subs.filter((s) => s.status === "expiring").length

    const mrr = subs.reduce((sum, s) => {
      if (s.status !== "active" && s.status !== "trial") return sum
      return sum + subscriptionPrice(s).effectiveMonthly
    }, 0)

    const revenueTrends = [
      { month: "Jan", revenue: 3200, subscriptions: 38 },
      { month: "Feb", revenue: 3400, subscriptions: 39 },
      { month: "Mar", revenue: 3600, subscriptions: 40 },
      { month: "Apr", revenue: 3900, subscriptions: 42 },
      { month: "May", revenue: 4200, subscriptions: 44 },
      { month: "Jun", revenue: 4625, subscriptions: 47 },
    ]

    const studentsByTier = subs.reduce<Record<string, number>>((acc, s) => {
      acc[s.tier] = (acc[s.tier] || 0) + s.studentCount
      return acc
    }, {})

    return {
      totalRevenue,
      monthlyRevenue,
      mrr: Math.round(mrr * 100) / 100,
      activeSubscriptions: active,
      expiringSoon,
      pendingPayment: subs.filter((s) => s.status === "pending_payment").length,
      suspended: subs.filter((s) => s.status === "suspended").length,
      subscriptionGrowthPercent: 8.2,
      revenueTrends,
      studentsByTier,
    }
  },

  /** Expose catalog for admin UI */
  getTierCatalog: () => TIER_CONFIG,

  calculateForSubscription: (sub: Subscription) => subscriptionPrice(sub),

  /** Trial Configuration */
  getTrialSettings: () => ({ ...trialSettings }),
  updateTrialSettings: (updates: Partial<typeof trialSettings>) => {
    trialSettings = { ...trialSettings, ...updates }
    return trialSettings
  },
}

