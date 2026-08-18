import { toast } from "sonner"
import type { Student } from "@/lib/db/database"
import { db } from "@/lib/db/database"
import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { formatEthiopianDateDMY } from "@/lib/utils/ethiopian-calendar"

export class NotificationService {
  private recentToasts: Map<string, number> = new Map()

  private shouldThrottle(key: string, cooldownMs = 3000): boolean {
    const now = Date.now()
    const last = this.recentToasts.get(key)
    if (last && now - last < cooldownMs) {
      return true
    }
    this.recentToasts.set(key, now)
    // Cleanup old keys periodically
    if (this.recentToasts.size > 50) {
      for (const [k, time] of this.recentToasts.entries()) {
        if (now - time > 10000) this.recentToasts.delete(k)
      }
    }
    return false
  }

  async success(title: string, message: string, duration?: number): Promise<void> {
    const key = `success:${title}:${message}`
    if (this.shouldThrottle(key)) return

    toast.success(`${title}: ${message}`, {
      id: key,
      duration: duration || 4000,
      style: {
        backgroundColor: "#dcfce7",
        color: "#15803d",
        border: "2px solid #22c55e",
        fontWeight: "600",
        fontSize: "15px",
      },
    })
    console.log(`[Success] ${title}: ${message}`)
  }

  async error(title: string, message: string): Promise<void> {
    let displayMessage = message;
    let displayTitle = title;
    let isSuspention = false;
    
    // Try to parse if it's a raw JSON string from a fetch error
    if (message && (message.trim().startsWith('{') || message.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(message);
        displayMessage = parsed.message || parsed.error || message;
        if (parsed.code === 'SCHOOL_SUSPENDED' || (parsed.message && parsed.message.toLowerCase().includes('suspended'))) {
          isSuspention = true;
        }
      } catch (e) {
        // Fallback to original message
      }
    }

    if (!isSuspention && displayMessage && displayMessage.toLowerCase().includes('suspended')) {
      isSuspention = true;
    }

    if (isSuspention) {
      displayTitle = "Portal Read-Only";
      displayMessage = "Your school account is suspended. Write actions are disabled, but historical records remain fully visible. Please contact support.";
    }

    const key = `error:${displayTitle}:${displayMessage}`
    if (this.shouldThrottle(key)) return

    toast.error(`${displayTitle}: ${displayMessage}`, {
      id: key,
      duration: 5000,
      style: {
        backgroundColor: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
      },
    })
    console.warn(`[Error] ${displayTitle}: ${displayMessage}`)
  }

  async warning(title: string, message: string): Promise<void> {
    const key = `warning:${title}:${message}`
    if (this.shouldThrottle(key)) return

    toast.warning(`${title}: ${message}`, {
      id: key,
      duration: 4000,
      style: {
        backgroundColor: "#fef3c7",
        color: "#78350f",
        border: "1px solid #fcd34d",
      },
    })
    console.warn(`[Warning] ${title}: ${message}`)
  }

  async info(title: string, message: string, duration?: number): Promise<void> {
    const key = `info:${title}:${message}`
    if (this.shouldThrottle(key)) return

    toast.info(`${title}: ${message}`, {
      id: key,
      duration: duration || 3000,
      style: {
        backgroundColor: "#dbeafe",
        color: "#1e40af",
        border: "1px solid #93c5fd",
      },
    })
    console.info(`[Info] ${title}: ${message}`)
  }

  async sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[NotificationService] External email notification to ${to} skipped (disabled for parents).`)
    return { success: false, error: "External email notifications to parents are disabled." }
  }

  async sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[NotificationService] External SMS notification to ${phone} skipped (disabled for parents).`)
    return { success: false, error: "External SMS notifications to parents are disabled." }
  }
}

class EmailService {
  private setupRequiredCallback: (() => void) | null = null

  setSetupRequiredCallback(callback: () => void): void {
    this.setupRequiredCallback = callback
  }

  private triggerSetupRequired(): void {
    if (this.setupRequiredCallback) {
      this.setupRequiredCallback()
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[EmailService] External email notification to ${to} skipped (disabled for parents).`)
    return { success: false, error: "External email notifications to parents are disabled." }
  }
}

class CombinedNotificationService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async sendCombinedNotification(params: {
    to: string
    phone?: string
    subject: string
    message: string
    html: string
  }): Promise<{ success: boolean; error?: string }> {
    console.log("[CombinedNotificationService] External notification skipped (disabled for parents).")
    return { success: false, error: "External email and SMS notifications for parents are disabled." }
  }

  async sendBulkNotifications(
    notifications: Array<{
      student: Student
      status: "absent" | "late" | "excused"
      note: string
    }>,
    options: { email: boolean; sms: boolean },
  ): Promise<{
    email: { success: number; failed: number }
    sms: { success: number; failed: number }
  }> {
    console.log(`[CombinedNotificationService] Bulk external SMS/Email skipped for ${notifications.length} notifications (disabled for parents, in-app portal notifications remain active).`)
    return {
      email: { success: 0, failed: notifications.length },
      sms: { success: 0, failed: notifications.length },
    }
  }
}

export const emailService = new EmailService()
export const combinedNotificationService = new CombinedNotificationService()

export const notifications = new NotificationService()

