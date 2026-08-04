"use client"
import { EmailSettings } from "./email-settings"
import { Settings } from "lucide-react"

export function SettingsPanel() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="typography-page-title flex items-center gap-2">
          <Settings className="h-8 w-8" />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-2">Configure notification services and system preferences</p>
      </div>

      <div className="mt-6">
        <EmailSettings />
      </div>
    </div>
  )
}
