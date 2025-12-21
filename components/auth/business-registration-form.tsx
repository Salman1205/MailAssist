"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Mail, User, Lock, Phone, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BusinessRegistrationFormProps {
  onSuccess: (data: { businessId: string; email: string; verificationToken: string }) => void
  onLoginClick: () => void
}

export default function BusinessRegistrationForm({ onSuccess, onLoginClick }: BusinessRegistrationFormProps) {
  const [formData, setFormData] = useState({
    businessName: "",
    businessEmail: "",
    ownerName: "",
    password: "",
    confirmPassword: "",
    businessPhone: "",
  })
  
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: string[] = []

    if (!formData.businessName.trim()) {
      newErrors.push("Business name is required")
    }

    if (!formData.businessEmail.trim()) {
      newErrors.push("Business email is required")
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.businessEmail)) {
      newErrors.push("Invalid email format")
    }

    if (!formData.ownerName.trim()) {
      newErrors.push("Owner name is required")
    }

    if (!formData.password) {
      newErrors.push("Password is required")
    } else if (formData.password.length < 8) {
      newErrors.push("Password must be at least 8 characters")
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.push("Password must contain an uppercase letter")
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.push("Password must contain a lowercase letter")
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.push("Password must contain a number")
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push("Passwords do not match")
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setErrors([])

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName.trim(),
          businessEmail: formData.businessEmail.toLowerCase().trim(),
          ownerName: formData.ownerName.trim(),
          password: formData.password,
          businessPhone: formData.businessPhone.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors(data.errors || [data.error || "Registration failed"])
        return
      }

      // Success - move to OTP verification
      onSuccess({
        businessId: data.businessId,
        email: data.email,
        verificationToken: data.verificationToken,
      })
    } catch (error) {
      console.error("Registration error:", error)
      setErrors(["An unexpected error occurred. Please try again."])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Marketing content */}
        <div className="hidden lg:flex flex-col justify-center space-y-8 px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              AI-Powered Email Support
            </div>
            <h1 className="text-5xl font-bold leading-tight">
              Transform Your
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Customer Support
              </span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Manage customer emails with AI-powered drafts, team collaboration, and smart automation.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: CheckCircle2, text: "AI-generated email responses" },
              { icon: CheckCircle2, text: "Team collaboration & roles" },
              { icon: CheckCircle2, text: "Multi-email account support" },
              { icon: CheckCircle2, text: "Analytics & insights" },
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-base text-foreground/80">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Registration form */}
        <Card className="w-full shadow-2xl border-border/60 backdrop-blur-sm">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-3xl font-bold text-center">Create Your Account</CardTitle>
            <CardDescription className="text-center text-base">
              Start your 14-day free trial. No credit card required.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {errors.length > 0 && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-sm font-medium">
                  Business Name
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Acme Inc"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="h-11 pl-10"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Business Email */}
              <div className="space-y-2">
                <Label htmlFor="businessEmail" className="text-sm font-medium">
                  Business Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="businessEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.businessEmail}
                    onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                    className="h-11 pl-10"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div className="space-y-2">
                <Label htmlFor="ownerName" className="text-sm font-medium">
                  Your Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="ownerName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="h-11 pl-10"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-11 pl-10 pr-10"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="h-11 pl-10 pr-10"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold group"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
                </div>
              </div>

              {/* Login Link */}
              <Button
                type="button"
                variant="outline"
                onClick={onLoginClick}
                className="w-full h-11 font-medium"
                disabled={loading}
              >
                Sign In
              </Button>
            </form>

            {/* Terms */}
            <p className="text-xs text-center text-muted-foreground mt-6">
              By creating an account, you agree to our{" "}
              <a href="#" className="underline hover:text-foreground">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
