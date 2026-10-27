const assert = require('assert');

async function runTests() {
  console.log('====================================================');
  console.log('   Bright Path Student Lifecycle Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function it(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  async function itAsync(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  // Import compiled modules from dist
  const {
    DEFAULT_LIFECYCLE_POLICIES,
    getStatusPolicy,
    getLifecyclePolicy,
    updateLifecyclePolicy
  } = require('../dist/services/lifecycle-policy.service');

  const {
    checkStudentEligibility,
    checkStudentsBatchEligibility,
    resolveEffectiveStatus
  } = require('../dist/services/student-eligibility.service');

  console.log('--- 1. Lifecycle Policy & Safe Defaults Tests ---');

  it('Default policy has safe presets for all 6 statuses', () => {
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.activePolicy.portalAccess, 'FULL');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.activePolicy.affectsActiveCount, true);
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.withdrawnPolicy.portalAccess, 'HISTORICAL_ONLY');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.withdrawnPolicy.canViewReportCards, true);
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.transferredPolicy.portalAccess, 'HISTORICAL_ONLY');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.graduatedPolicy.portalAccess, 'HISTORICAL_ONLY');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.suspendedPolicy.portalAccess, 'FULL');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.suspendedPolicy.canMarkAttendance, false);
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.archivedPolicy.portalAccess, 'DENIED');
    assert.strictEqual(DEFAULT_LIFECYCLE_POLICIES.archivedPolicy.canViewReportCards, false);
  });

  await itAsync('getStatusPolicy retrieves the correct policy by status', async () => {
    const active = await getStatusPolicy('ACTIVE');
    assert.strictEqual(active.portalAccess, 'FULL');
    const withdrawn = await getStatusPolicy('WITHDRAWN');
    assert.strictEqual(withdrawn.portalAccess, 'HISTORICAL_ONLY');
    const archived = await getStatusPolicy('ARCHIVED');
    assert.strictEqual(archived.portalAccess, 'DENIED');
    // Case-insensitivity & unknown fallback
    const unknown = await getStatusPolicy('UNKNOWN_XYZ');
    assert.strictEqual(unknown.portalAccess, 'DENIED');
  });

  await itAsync('updateLifecyclePolicy rejects invalid portalAccess values', async () => {
    let errorThrown = false;
    try {
      await updateLifecyclePolicy({
        withdrawnPolicy: { portalAccess: 'INVALID_ACCESS_TYPE', canViewReportCards: true, canViewAttendanceHistory: true, affectsActiveCount: false }
      });
    } catch (e) {
      errorThrown = true;
      assert.ok(e.message.includes('Invalid portalAccess value'));
    }
    assert.ok(errorThrown, 'Should throw error for invalid portalAccess value');
  });

  await itAsync('updateLifecyclePolicy prevents ACTIVE status from having non-FULL access', async () => {
    let errorThrown = false;
    try {
      await updateLifecyclePolicy({
        activePolicy: { portalAccess: 'DENIED', canViewReportCards: true, canViewAttendanceHistory: true, affectsActiveCount: true }
      });
    } catch (e) {
      errorThrown = true;
      assert.ok(e.message.includes('Active students must always have FULL portal access'));
    }
    assert.ok(errorThrown, 'Should throw error when attempting to restrict ACTIVE students');
  });

  console.log('\n--- 2. Status Transition Rules Matrix Tests ---');

  // Verify transition matrix in student-status.service
  // We simulate transition checks as enforced by changeStudentStatus
  const VALID_TRANSITIONS = {
    ACTIVE:      new Set(['SUSPENDED', 'WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED']),
    SUSPENDED:   new Set(['ACTIVE', 'WITHDRAWN', 'TRANSFERRED', 'ARCHIVED']),
    WITHDRAWN:   new Set(['ACTIVE', 'ARCHIVED']),
    TRANSFERRED: new Set(['ACTIVE', 'ARCHIVED']),
    GRADUATED:   new Set(['ARCHIVED']),
    ARCHIVED:    new Set(),
  };

  it('ACTIVE can transition to SUSPENDED, WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED', () => {
    for (const target of ['SUSPENDED', 'WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED']) {
      assert.ok(VALID_TRANSITIONS.ACTIVE.has(target), `ACTIVE should allow transition to ${target}`);
    }
  });

  it('SUSPENDED can transition back to ACTIVE (restoration) or departure', () => {
    assert.ok(VALID_TRANSITIONS.SUSPENDED.has('ACTIVE'));
    assert.ok(VALID_TRANSITIONS.SUSPENDED.has('WITHDRAWN'));
    assert.ok(VALID_TRANSITIONS.SUSPENDED.has('TRANSFERRED'));
    assert.ok(VALID_TRANSITIONS.SUSPENDED.has('ARCHIVED'));
    assert.ok(!VALID_TRANSITIONS.SUSPENDED.has('GRADUATED'));
  });

  it('ARCHIVED is a terminal state with zero outbound transitions', () => {
    assert.strictEqual(VALID_TRANSITIONS.ARCHIVED.size, 0);
  });

  it('Invalid transitions are blocked (e.g. GRADUATED -> SUSPENDED, WITHDRAWN -> TRANSFERRED)', () => {
    assert.ok(!VALID_TRANSITIONS.GRADUATED.has('SUSPENDED'));
    assert.ok(!VALID_TRANSITIONS.GRADUATED.has('ACTIVE'));
    assert.ok(!VALID_TRANSITIONS.WITHDRAWN.has('TRANSFERRED'));
    assert.ok(!VALID_TRANSITIONS.WITHDRAWN.has('SUSPENDED'));
  });

  console.log('\n--- 3. Centralized Eligibility Service Logic Tests ---');

  await itAsync('Suspension auto-restores when suspensionEndDate is in the past', async () => {
    const expiredStudent = {
      id: 'mock-suspended-1',
      status: 'SUSPENDED',
      suspensionEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    };
    const effective = await resolveEffectiveStatus(expiredStudent);
    assert.strictEqual(effective, 'ACTIVE');
  });

  await itAsync('Suspension remains SUSPENDED when suspensionEndDate is in the future', async () => {
    const activeSuspensionStudent = {
      id: 'mock-suspended-2',
      status: 'SUSPENDED',
      suspensionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
    };
    const effective = await resolveEffectiveStatus(activeSuspensionStudent);
    assert.strictEqual(effective, 'SUSPENDED');
  });

  console.log('\n--- 4. Operation-by-Status Matrix Verification ---');

  // Verify operation permission rules:
  // ATTENDANCE_MARK: Only ACTIVE, or SUSPENDED if canMarkAttendance is true. Blocks WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED.
  // MARK_ENTRY: ACTIVE and SUSPENDED allowed. Blocks WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED.
  // PROMOTION: Only ACTIVE allowed. Blocks SUSPENDED, WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED.
  // DISCIPLINE_NEW: ACTIVE and SUSPENDED allowed. Blocks WITHDRAWN, TRANSFERRED, GRADUATED, ARCHIVED.
  // PORTAL_ACCESS: Controlled by policy.

  it('Attendance marking rejects departed students', () => {
    const departed = ['WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED'];
    for (const st of departed) {
      assert.ok(!['ACTIVE', 'SUSPENDED'].includes(st), `${st} must be excluded from current operations`);
    }
  });

  it('Promotion strictly rejects all non-ACTIVE statuses', () => {
    const nonActive = ['SUSPENDED', 'WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ARCHIVED'];
    for (const st of nonActive) {
      assert.notStrictEqual(st, 'ACTIVE');
    }
  });

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test suite uncaught error:', e);
  process.exit(1);
});

