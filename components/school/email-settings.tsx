"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

export function EmailSettings() {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="typography-card-title flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Email Service Configuration
        </CardTitle>
        <CardDescription>Transactional and notification email provider status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
          Email infrastructure is currently offline for upgrade. Email delivery configuration will be available in the upcoming email system setup.
        </div>
      </CardContent>
    </Card>
  )
}
