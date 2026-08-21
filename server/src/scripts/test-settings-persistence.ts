import prisma from '../config/db';
import * as settingsService from '../services/settings.service';

async function runTests() {
  console.log('🧪 Starting End-to-End Settings Persistence Test...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Initial State
    console.log('--- Test 1: Load Initial Database Settings ---');
    const initial = await settingsService.getSettings();
    assert(!!initial, 'Initial settings retrieved from DB');
    console.log(`  Initial School Name: ${initial.school_name || '(empty)'}`);

    // 2. Save Full Settings Payload
    console.log('\n--- Test 2: Update All Settings via Service (Simulating UI Save) ---');
    const testPayload = {
      school_name: 'Addis Hiwot Academy Test',
      school_phone: '+251911002233',
      school_address: 'Bole Subcity, Woreda 03, Addis Ababa',
      calendar_type: 'GREGORIAN',
      attendance_mode: 'daily',
      attendance_ui_type: 'tabular',
      attendance_threshold: 85,
      allow_late_mark: true,
      email_notifications: true,
      sms_notifications: true,
      notification_time: '17:30',
      allow_attendance_editing: false,
      restrict_location: true,
      school_latitude: 9.024567,
      school_longitude: 38.751234,
      allowed_radius_meters: 350,
      allow_outside_attendance: false,
      grade_system: 'custom',
      email_api_key: 're_test_123456789',
      email_from_domain: 'mail.addishiwot.edu.et',
      staff_attendance_mode: 'daily',
      staff_working_days: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
      staff_work_start_time: '08:30',
      staff_work_end_time: '17:30',
      staff_late_grace_minutes: 20,
      staff_early_checkout_tolerance_minutes: 25,
      staff_absence_cutoff_minutes: 150,
      staff_absence_cutoff_time: '11:00',
      staff_earliest_checkin_time: '06:30',
      staff_latest_checkout_time: '21:00',
      staff_face_required: true,
      staff_geo_required: true,
      allow_staff_checkin_after_cutoff: true,
    };

    const saved = await settingsService.updateSettings(undefined, testPayload);
    assert(saved.school_name === 'Addis Hiwot Academy Test', 'Saved school_name confirmed in return');
    assert(saved.calendar_type === 'GREGORIAN', 'Saved calendar_type confirmed as GREGORIAN');
    assert(saved.attendance_threshold === 85, 'Saved attendance_threshold confirmed as 85');
    assert(saved.grade_system === 'custom', 'Saved grade_system confirmed as custom');
    assert(saved.email_api_key === 're_test_123456789', 'Saved email_api_key confirmed');
    assert(saved.email_from_domain === 'mail.addishiwot.edu.et', 'Saved email_from_domain confirmed');
    assert(saved.allowed_radius_meters === 350, 'Saved allowed_radius_meters confirmed as 350');
    assert(saved.allow_staff_checkin_after_cutoff === true, 'Saved allow_staff_checkin_after_cutoff confirmed as true');

    // 3. Verify Direct PostgreSQL Read (Bypassing Service to Confirm DB Persistence)
    console.log('\n--- Test 3: Confirm Persistence in PostgreSQL Database Directly ---');
    const dbRecord = await prisma.schoolSettings.findFirst();
    assert(!!dbRecord, 'Database record exists in PostgreSQL');
    assert(dbRecord?.school_name === 'Addis Hiwot Academy Test', 'DB record has updated school_name');
    assert(dbRecord?.school_phone === '+251911002233', 'DB record has updated school_phone');
    assert(dbRecord?.school_address === 'Bole Subcity, Woreda 03, Addis Ababa', 'DB record has updated school_address');
    assert(dbRecord?.calendar_type === 'GREGORIAN', 'DB record has updated calendar_type');
    assert(dbRecord?.attendance_mode === 'daily', 'DB record has updated attendance_mode');
    assert(dbRecord?.attendance_ui_type === 'tabular', 'DB record has updated attendance_ui_type');
    assert(dbRecord?.attendance_threshold === 85, 'DB record has updated attendance_threshold');
    assert(dbRecord?.restrict_location === true, 'DB record has updated restrict_location');
    assert(dbRecord?.school_latitude === 9.024567, 'DB record has updated school_latitude');
    assert(dbRecord?.school_longitude === 38.751234, 'DB record has updated school_longitude');
    assert(dbRecord?.allowed_radius_meters === 350, 'DB record has updated allowed_radius_meters');
    assert(dbRecord?.allow_outside_attendance === false, 'DB record has updated allow_outside_attendance');
    assert(dbRecord?.grade_system === 'custom', 'DB record has updated grade_system');
    assert(dbRecord?.email_api_key === 're_test_123456789', 'DB record has updated email_api_key');
    assert(dbRecord?.email_from_domain === 'mail.addishiwot.edu.et', 'DB record has updated email_from_domain');
    assert(dbRecord?.allow_staff_checkin_after_cutoff === true, 'DB record has updated allow_staff_checkin_after_cutoff');

    // 4. Reload Test (Simulating Page Refresh / Re-login)
    console.log('\n--- Test 4: Simulate Page Refresh / Re-login Fresh GET ---');
    const reloaded = await settingsService.getSettings();
    assert(reloaded.school_name === 'Addis Hiwot Academy Test', 'Reloaded school_name matches DB');
    assert(reloaded.calendar_type === 'GREGORIAN', 'Reloaded calendar_type matches DB');
    assert(reloaded.attendance_threshold === 85, 'Reloaded threshold matches DB');
    assert(reloaded.grade_system === 'custom', 'Reloaded grade_system matches DB');
    assert(reloaded.email_api_key === 're_test_123456789', 'Reloaded email_api_key matches DB');
    assert(reloaded.allow_staff_checkin_after_cutoff === true, 'Reloaded cutoff allowance matches DB');

    // 5. Test CamelCase Payload Normalization (Frontend form format)
    console.log('\n--- Test 5: Update with Frontend CamelCase Payload ---');
    const frontendPayload = {
      schoolName: 'Addis Hiwot Primary & Secondary School',
      calendarPreference: 'ethiopian',
      gradeSystem: 'standard',
      emailApiKey: 're_live_987654321',
      emailFromDomain: 'smartattenadacetracker.app',
      attendanceThreshold: 75,
      allowLateMark: true,
      staffLateGraceMinutes: 15,
      allowStaffCheckinAfterCutoff: false,
    };
    const camelSaved = await settingsService.updateSettings(undefined, frontendPayload);
    assert(camelSaved.school_name === 'Addis Hiwot Primary & Secondary School', 'CamelCase schoolName normalized and persisted');
    assert(camelSaved.calendar_type === 'ETHIOPIAN', 'CamelCase calendarPreference normalized to ETHIOPIAN');
    assert(camelSaved.grade_system === 'standard', 'CamelCase gradeSystem normalized and persisted');
    assert(camelSaved.email_api_key === 're_live_987654321', 'CamelCase emailApiKey normalized and persisted');
    assert(camelSaved.allow_staff_checkin_after_cutoff === false, 'CamelCase allowStaffCheckinAfterCutoff normalized and persisted');

    // 6. Test Validation Enforcement
    console.log('\n--- Test 6: Validate That Invalid Settings Are Rejected ---');
    let validationFailed = false;
    try {
      await settingsService.updateSettings(undefined, {
        staff_work_start_time: '18:00',
        staff_work_end_time: '08:00', // invalid: end before start
      });
    } catch (err: any) {
      validationFailed = true;
      assert(err instanceof settingsService.ScheduleValidationError, 'ScheduleValidationError properly thrown');
    }
    assert(validationFailed, 'Invalid daily schedule was correctly rejected');

    console.log(`\n========================================`);
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
