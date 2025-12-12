"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { useToast } from "./ui/use-toast"
import { ShoppingBag, CheckCircle2, XCircle, Loader2, ExternalLink, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "./ui/alert"
import { Skeleton } from "./ui/skeleton"

export default function ShopifySettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shopDomain, setShopDomain] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [isConfigured, setIsConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/shopify/config")
      if (!response.ok) {
        if (response.status === 403) {
          setError("Admin access required to configure Shopify")
          return
        }
        throw new Error("Failed to fetch Shopify config")
      }

      const data = await response.json()
      if (data.config && data.config.isConfigured) {
        setIsConfigured(true)
        setShopDomain(data.config.shopDomain || "")
        // Don't show the actual token, just indicate it's configured
      }
    } catch (err) {
      console.error("Error fetching Shopify config:", err)
      setError(err instanceof Error ? err.message : "Failed to load configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!shopDomain.trim() || !accessToken.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both shop domain and access token",
        variant: "destructive",
      })
      return
    }

    // Validate shop domain format
    const domainPattern = /^[a-zA-Z0-9-]+\.myshopify\.com$/
    if (!domainPattern.test(shopDomain.trim())) {
      toast({
        title: "Invalid Domain",
        description: "Shop domain must be in format: your-shop.myshopify.com",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/shopify/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          accessToken: accessToken.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save configuration")
      }

      setIsConfigured(true)
      setAccessToken("") // Clear token input for security
      toast({
        title: "Success",
        description: "Shopify integration configured successfully",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save configuration"
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove Shopify integration?")) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/shopify/config", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove configuration")
      }

      setIsConfigured(false)
      setShopDomain("")
      setAccessToken("")
      toast({
        title: "Success",
        description: "Shopify integration removed",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove configuration"
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Shopify Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Shopify Integration
        </CardTitle>
        <CardDescription className="text-xs">
          Connect your Shopify store to view customer information, order history, and purchase data in tickets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {isConfigured && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-xs text-green-600 dark:text-green-400">
              Shopify integration is configured. Customer information will appear in ticket views.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-domain" className="text-sm">
              Shop Domain
            </Label>
            <Input
              id="shop-domain"
              type="text"
              placeholder="your-shop.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              disabled={saving || isConfigured}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your Shopify store domain (e.g., my-store.myshopify.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token" className="text-sm">
              Access Token
            </Label>
            <Input
              id="access-token"
              type="password"
              placeholder={isConfigured ? "••••••••" : "Enter your private app access token"}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={saving || isConfigured}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Create a private app in Shopify Admin → Apps → Develop apps → Create an app
              <br />
              Required permissions: Read customers, Read orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isConfigured ? (
              <Button
                onClick={handleSave}
                disabled={saving || !shopDomain.trim() || !accessToken.trim()}
                className="text-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setIsConfigured(false)
                    setAccessToken("")
                  }}
                  variant="outline"
                  disabled={saving}
                  className="text-sm"
                >
                  Edit Configuration
                </Button>
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  disabled={saving}
                  className="text-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove Integration"
                  )}
                </Button>
              </>
            )}
          </div>

          <div className="pt-2 border-t">
            <a
              href="https://help.shopify.com/en/manual/apps/private-apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Learn how to create a Shopify private app
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

