"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, Eye, EyeOff, CheckCircle2, Mail, Building2, UserPlus, XCircle } from "lucide-react"

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}

function AcceptInvitationContent() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    // Validate invitation token
    validateInvitation()
  }, [token])

  const validateInvitation = async () => {
    try {
      const response = await fetch(`/api/agents/validate-invite?token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Invalid invitation")
        setValidating(false)
        return
      }

      setInvitation(data.invitation)
      setValidating(false)
    } catch (err) {
      setError("Failed to validate invitation")
      setValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/agents/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationToken: token,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation")
        setLoading(false)
        return
      }

      // Store user data in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('current_user_id', data.user.id)
        sessionStorage.setItem('current_user_name', data.user.name)
        sessionStorage.setItem('current_user_role', data.user.role)
        sessionStorage.setItem('business_id', data.business.id)
        sessionStorage.setItem('business_name', data.business.name)
      }

      // Set client-side cookie
      document.cookie = `current_user_id=${data.user.id}; path=/; max-age=${30 * 24 * 60 * 60}`

      // Redirect to dashboard
      router.push("/?businessAuth=true")
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-in fade-in duration-500">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          <CardContent className="pt-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-slate-400">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-in fade-in duration-500">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-950/30 rounded-full flex items-center justify-center mb-4 border border-red-900/50">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <CardTitle className="text-2xl text-white">Invalid Invitation</CardTitle>
            <CardDescription className="text-slate-400">
              This invitation link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-red-950/30 border-red-900/50">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push("/welcome")}
              className="w-full mt-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-200"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-in fade-in duration-500">
      <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-purple-500/30 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <UserPlus className="w-8 h-8 text-white relative z-10" />
          </div>
          <CardTitle className="text-2xl text-white font-bold">Welcome to the Team!</CardTitle>
          <CardDescription className="text-slate-400">
            Create your password to complete your account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitation && (
            <div className="mb-6 p-4 bg-gradient-to-br from-slate-800/50 to-slate-800/30 rounded-lg border border-slate-700 space-y-3 animate-in slide-in-from-top-2 duration-500">
              <div className="flex items-center gap-3 text-sm group hover:bg-slate-700/30 p-2 rounded transition-colors">
                <div className="w-8 h-8 bg-purple-950/50 rounded-full flex items-center justify-center border border-purple-800/30">
                  <Mail className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-slate-300 font-medium">{invitation.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm group hover:bg-slate-700/30 p-2 rounded transition-colors">
                <div className="w-8 h-8 bg-purple-950/50 rounded-full flex items-center justify-center border border-purple-800/30">
                  <Building2 className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-slate-300 font-medium">{invitation.business_name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm group hover:bg-slate-700/30 p-2 rounded transition-colors">
                <div className="w-8 h-8 bg-purple-950/50 rounded-full flex items-center justify-center border border-purple-800/30">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-slate-300 font-medium">Role: <span className="text-purple-400">{invitation.role}</span></span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-12 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Minimum 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300 font-medium">Confirm Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-12 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <Alert className="bg-red-950/30 border-red-900/50">
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] group"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </div>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <CheckCircle2 className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
