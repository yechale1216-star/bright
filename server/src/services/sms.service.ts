/**
 * SMS Service for SMSEthiopia integration
 * Endpoint: https://smsethiopia.com/api/sms/send
 */

const SMSETHIOPIA_API_URL = 'https://smsethiopia.com/api/sms/send';
// NOTE: SMSETHIOPIA_API_KEY must be set in environment variables.
// No hardcoded fallback — a missing key will cause SMS sends to fail at runtime
// so the issue is detected immediately rather than silently using a leaked key.
const SMSETHIOPIA_API_KEY = process.env.SMSETHIOPIA_API_KEY || '';

export interface SMSSendResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errorCode?: number | string;
}

/**
 * Format any Ethiopian phone number into standard SMSEthiopia msisdn format:
 * e.g. 251912345678 (no leading +, no leading 0)
 */
export const formatMsisdn = (phone: string): string => {
  if (!phone) return '';
  
  // Remove spaces, dashes, parentheses and any non-digit/non-plus chars
  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = '251' + cleaned.substring(1);
  } else if (!cleaned.startsWith('251') && (cleaned.startsWith('9') || cleaned.startsWith('7'))) {
    cleaned = '251' + cleaned;
  }

  return cleaned;
};

/**
 * Send an SMS via SMSEthiopia API
 */
export const sendSMS = async (phone: string, text: string): Promise<SMSSendResult> => {
  const msisdn = formatMsisdn(phone);
  const apiKey = process.env.SMSETHIOPIA_API_KEY || SMSETHIOPIA_API_KEY;

  if (!apiKey) {
    console.error('[SMSEthiopia] SMSETHIOPIA_API_KEY is not configured. SMS cannot be sent.');
    return {
      success: false,
      error: 'SMS service is not configured (missing SMSETHIOPIA_API_KEY). Contact the system administrator.',
    };
  }

  if (!msisdn || msisdn.length < 12) {
    console.warn(`[SMSEthiopia] Invalid phone number provided: "${phone}" (parsed: "${msisdn}")`);
    return {
      success: false,
      error: `Invalid Ethiopian phone number: ${phone}`,
    };
  }

  console.log(`[SMSEthiopia] Dispatching SMS to ${msisdn}...`);

  try {
    const response = await fetch(SMSETHIOPIA_API_URL, {
      method: 'POST',
      headers: {
        'KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msisdn,
        text,
      }),
    });

    const bodyText = await response.text();
    let body: any = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = { raw: bodyText };
    }

    if (!response.ok) {
      const errMsg = body?.error_message || body?.message || `HTTP ${response.status}: ${bodyText}`;
      const errCode = body?.error_code || body?.code;
      console.error(`[SMSEthiopia] Error sending SMS to ${msisdn}:`, errMsg);

      return {
        success: false,
        error: errMsg,
        errorCode: errCode,
        data: body,
      };
    }

    console.log(`[SMSEthiopia] SMS successfully sent to ${msisdn}:`, body);
    return {
      success: true,
      data: body,
    };
  } catch (error: any) {
    console.error(`[SMSEthiopia] Network error sending SMS to ${msisdn}:`, error);
    return {
      success: false,
      error: error?.message || 'Failed to connect to SMSEthiopia gateway.',
    };
  }
};

/**
 * Send parent password reset OTP code
 */
export const sendParentPasswordResetOTP = async (phone: string, otpCode: string): Promise<SMSSendResult> => {
  const text = `Bright Path: Your password reset verification code is ${otpCode}. Valid for 15 minutes. Please do not share this code.`;
  return sendSMS(phone, text);
};
