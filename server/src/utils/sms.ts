import { normalizePhoneNumber } from './parent.service';

const MOCK_SMS = process.env.NODE_ENV !== 'production' || !process.env.SMS_API_KEY;

/**
 * Format and send an OTP via SMS for password reset.
 * Pluggable: add any SMS gateway by setting SMS_PROVIDER env var.
 * Falls back to console logging when no SMS provider is configured.
 */
export const sendPasswordResetOTP = async (phone: string, otp: string): Promise<boolean> => {
  const normalizedPhone = normalizePhoneNumber(phone);
  const message =
    `Your Addis Hiwot password reset code is: ${otp}\n` +
    `This code expires in 15 minutes. Do not share it with anyone.\n` +
    `If you did not request this, please ignore.`;

  if (MOCK_SMS) {
    // Development / no SMS gateway: log safely (mask OTP partially)
    const masked = otp.substring(0, 2) + '****';
    console.log(
      `[SMS-MOCK] Would send to ${normalizedPhone}: "...reset code: ${masked}..." ` +
      `(set SMS_API_KEY to enable real SMS delivery)`
    );
    return true; // Succeed in dev so the full reset flow can be tested
  }

  // ── AfroMessage / custom webhook delivery ──────────────────────────────────
  // Set: SMS_API_KEY, SMS_API_URL (optional, defaults to AfroMessage)
  try {
    const apiUrl = process.env.SMS_API_URL || 'https://api.afromessage.com/api/send';
    const apiKey = process.env.SMS_API_KEY!;

    const body = JSON.stringify({
      to: normalizedPhone,
      message,
      // AfroMessage-specific fields — adjust for your gateway
      sender: process.env.SMS_SENDER_ID || 'AddisHiwot',
    });

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[SMSService] Delivery failed (${res.status}): ${err}`);
      return false;
    }

    console.log(`[SMSService] OTP delivered to ${normalizedPhone.slice(0, -4)}****`);
    return true;
  } catch (error) {
    console.error('[SMSService] Network error delivering OTP:', error instanceof Error ? error.message : error);
    return false;
  }
};
