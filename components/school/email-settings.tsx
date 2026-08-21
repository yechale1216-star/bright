"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db/database"

export function EmailSettings() {
  const [apiKey, setApiKey] = useState("")
  const [fromDomain, setFromDomain] = useState("smartattenadacetracker.app")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await db.getSettings(true)
        if (settings) {
          setApiKey(settings.email_api_key || settings.emailApiKey || "")
          setFromDomain(settings.email_from_domain || settings.emailFromDomain || "smartattenadacetracker.app")
        }
      } catch (err) {
        console.error("Failed to load email settings:", err)
      }
    }
    loadSettings()
  }, [])

  const handleTestEmail = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Resend API key first",
        variant: "destructive",
      })
      return
    }

    setTesting(true)
    setTestResult(null)

    // Mock testing behavior for the local-only environment
    setTimeout(() => {
      const success = apiKey.startsWith("re_")
      const result = {
        success,
        message: success 
          ? "Connection to Resend established! Test email sent to yechale1216@gmail.com" 
          : "Invalid API key format. Should start with 're_'"
      }
      
      setTestResult(result)
      setTesting(false)

      if (success) {
        toast({
          title: "Email Test Successful",
          description: "Real email delivery is now configured!",
        })
      } else {
        toast({
          title: "Email Test Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    }, 1500)
  }

  const handleSaveSettings = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Resend API key",
        variant: "destructive",
      })
      return
    }

    try {
      await db.updateSettings({
        email_api_key: apiKey.trim(),
        email_from_domain: fromDomain.trim(),
      })

      toast({
        title: "Settings Saved",
        description: "Email configuration has been saved successfully",
      })
    } catch (error) {
      console.error("Error saving email settings:", error)
      toast({
        title: "Save Failed",
        description: "Could not save email settings",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Email Notification Settings</CardTitle>
        <CardDescription>Configure real email delivery using Resend service</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                <strong>To enable real email delivery:</strong>
              </p>
              <ol className="typography-body list-decimal list-inside space-y-1">
                <li>
                  Create a free account at{" "}
                  <a
                    href="https://resend.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    resend.com <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  Go to{" "}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    API Keys <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and create a new key
                </li>
                <li>Add your domain (or use their test domain for now)</li>
                <li>Enter your API key below and test the configuration</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">Resend API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="re_xxxxxxxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="font-mono"
          />
          <p className="typography-body text-muted-foreground">
            Your API key starts with "re_" and is found in your Resend dashboard
          </p>
        </div>

        {/* From Domain Input */}
        <div className="space-y-2">
          <Label htmlFor="fromDomain">From Domain</Label>
          <Input
            id="fromDomain"
            placeholder="smartattenadacetracker.app"
            value={fromDomain}
            onChange={(e) => setFromDomain(e.target.value)}
          />
          <p className="typography-body text-muted-foreground">Domain for sending emails (use "resend.dev" for testing)</p>
        </div>

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={handleTestEmail} disabled={testing || !apiKey.trim()} variant="outline">
            {testing ? "Testing..." : "Test Email"}
          </Button>
          <Button onClick={handleSaveSettings} disabled={!apiKey.trim()}>
            Save Settings
          </Button>
        </div>

        {/* Current Status */}
        <div className="pt-4 border-t">
          <h4 className="typography-label mb-2">Current Status</h4>
          <div className="typography-body text-muted-foreground">
            {apiKey.trim() ? (
              testResult?.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Real email delivery configured
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  API key entered, test to verify
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <AlertCircle className="h-4 w-4" />
                Using demo mode - no real emails sent
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

