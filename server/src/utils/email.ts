import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ─── Configuration ───────────────────────────────────────────────────────────
const APP_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

// SMTP Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const FROM_EMAIL_SMTP = process.env.FROM_EMAIL || 'Addis Hiwot School <zetime12@gmail.com>';

// Resend Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL_RESEND = 'Addis Hiwot School <onboarding@resend.dev>';

let transporter: nodemailer.Transporter | null = null;
let resend: Resend | null = null;

if (EMAIL_USER && EMAIL_PASS) {
  console.log(`[EmailService] Initializing SMTP Transporter for host: ${SMTP_HOST}, user: ${EMAIL_USER}`);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
} else {
  console.warn('[EmailService] SMTP credentials not set. Email will not send via SMTP.');
}

if (RESEND_API_KEY) {
  console.log('[EmailService] Initializing Resend client...');
  resend = new Resend(RESEND_API_KEY);
}

if (!transporter && !resend) {
  console.error('[EmailService] Neither SMTP nor Resend is configured. Emails will fail.');
}

// ─── Centralized Email Service ──────────────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const sendEmailViaResend = async (options: SendEmailOptions): Promise<boolean> => {
  if (!resend) {
    console.error('[EmailService] Resend client not configured.');
    return false;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL_RESEND,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('[EmailService] Resend API error:', error);
      return false;
    }

    console.log(`[EmailService] Email sent successfully via Resend to ${options.to} — ID: ${data?.id}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email via Resend:', error instanceof Error ? error.message : error);
    return false;
  }
};

/**
 * Low-level email sender. All email functions route through here.
 * Returns true on success, false on failure.
 */
const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: FROM_EMAIL_SMTP,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      console.log(`[EmailService] Email sent successfully via SMTP to ${options.to} — MessageID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email via SMTP:', error instanceof Error ? error.message : error);
      if (resend) {
        console.log('[EmailService] Attempting fallback to Resend...');
        return sendEmailViaResend(options);
      }
      return false;
    }
  } else if (resend) {
    return sendEmailViaResend(options);
  } else {
    console.error('[EmailService] No email service is configured. Cannot send email.');
    return false;
  }
};

// ─── Password Reset Email ───────────────────────────────────────────────────

export const sendResetPasswordEmail = async (email: string, token: string): Promise<boolean> => {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 12px; padding: 12px 20px;">
          <span style="color: white; font-size: 20px; font-weight: bold; letter-spacing: 1px;">Addis Hiwot</span>
        </div>
      </div>
      <h2 style="color: #111827; margin-bottom: 8px;">Password Reset Request</h2>
      <p style="color: #6b7280;">You requested a password reset for your Addis Hiwot account. Click the button below to set a new password.</p>
      <p style="color: #ef4444; font-size: 14px; font-weight: 600;">⏱ This link expires in 15 minutes.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">This is an automated email from Addis Hiwot School — please do not reply.</p>
    </div>
  `;

  return sendEmail({ to: email, subject: 'Password Reset Request — Addis Hiwot School', html });
};

// ─── Email Verification ─────────────────────────────────────────────────────

export const sendVerificationEmail = async (email: string, code: string): Promise<boolean> => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 12px; padding: 12px 20px;">
          <span style="color: white; font-size: 20px; font-weight: bold; letter-spacing: 1px;">Addis Hiwot</span>
        </div>
      </div>
      <h2 style="color: #111827; margin-bottom: 8px;">Verify Your Email Address</h2>
      <p style="color: #6b7280; margin-bottom: 24px;">Welcome to Addis Hiwot School! Enter the 6-digit code below to verify your email address.</p>
      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #f0f4ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px 40px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #1d4ed8;">${code}</span>
        </div>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code will expire in <strong>24 hours</strong>. If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">This is an automated email from Addis Hiwot School — please do not reply.</p>
    </div>
  `;

  return sendEmail({ to: email, subject: 'Verify Your Addis Hiwot Account', html });
};

// ─── Generic Email (for future notifications) ──────────────────────────────

export const sendGenericEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  return sendEmail({ to, subject, html });
};
