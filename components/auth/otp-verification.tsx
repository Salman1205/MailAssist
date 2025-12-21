"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mail, CheckCircle, ArrowLeft, Sparkles, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface OTPVerificationProps {
  email: string
  verificationToken: string
  businessId: string
  onSuccess: () => void
  onBack: () => void
}

export default function OTPVerification({ 
  email, 
  verificationToken, 
  businessId,
  onSuccess,
  onBack 
}: OTPVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Handle cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // Only take the last character

    setOtp(newOtp)
    setError(null)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== "") && index === 5) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("")
        const newOtp = [...otp]
        
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit
          }
        })
        
        setOtp(newOtp)
        
        if (digits.length === 6) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[Math.min(digits.length, 5)]?.focus()
        }
      })
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text")
    const digits = text.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    
    setOtp(newOtp)
    
    if (digits.length === 6) {
      handleVerify(newOtp.join(""))
    } else {
      inputRefs.current[Math.min(digits.length, 5)]?.focus()
    }
  }

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join("")
    
    if (code.length !== 6) {
      setError("Please enter all 6 digits")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otpCode: code,
          verificationToken,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Verification failed")
        setOtp(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
        return
      }

      // Store user data in cookies/localStorage for immediate access
      if (data.user) {
        // Store in sessionStorage for backward compatibility
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('current_user_id', data.user.id)
          sessionStorage.setItem('current_user_name', data.user.name)
          sessionStorage.setItem('current_user_role', data.user.role)
          sessionStorage.setItem('business_id', data.business.id)
          sessionStorage.setItem('business_name', data.business.name)
        }
        
        // Also set a client-side cookie for current_user_id
        document.cookie = `current_user_id=${data.user.id}; path=/; max-age=${30 * 24 * 60 * 60}`
      }

      // Success - redirect to dashboard
      onSuccess()
    } catch (error) {
      console.error("Verification error:", error)
      setError("An unexpected error occurred. Please try again.")
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return

    setResending(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          businessId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to resend code")
        return
      }

      setResendCooldown(60) // 60 second cooldown
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } catch (error) {
      console.error("Resend error:", error)
      setError("Failed to resend code. Please try again.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full shadow-2xl border-border/60 backdrop-blur-sm">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl animate-pulse">
                <Mail className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-background">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">Check Your Email</CardTitle>
            <CardDescription className="text-base">
              We sent a 6-digit verification code to<br />
              <span className="font-semibold text-foreground">{email}</span>
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* OTP Input Fields */}
          <div className="space-y-4">
            <div className="flex gap-3 justify-center">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    if (el) inputRefs.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-14 h-16 text-center text-3xl font-bold shadow-md transition-all focus:scale-105 focus:shadow-lg"
                  disabled={loading}
                  autoComplete="off"
                />
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <p>Code expires in 10 minutes</p>
            </div>
          </div>

          {/* Verify Button */}
          <Button
            onClick={() => handleVerify()}
            className="w-full h-12 text-base font-semibold group"
            disabled={loading || otp.some(digit => digit === "")}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                Verify Email
                <CheckCircle className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
              </>
            )}
          </Button>

          {/* Resend Code */}
          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Didn't receive it?</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            className="w-full h-11 font-medium"
          >
            {resending ? (
              <>
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : resendCooldown > 0 ? (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Resend in {resendCooldown}s
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Resend Code
              </>
            )}
          </Button>

          {/* Back Button */}
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={loading || resending}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Registration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
