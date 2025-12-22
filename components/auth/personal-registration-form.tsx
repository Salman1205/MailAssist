"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PersonalRegistrationFormProps {
    onSuccess: () => void
    onLoginClick: () => void
}

export default function PersonalRegistrationForm({ onSuccess, onLoginClick }: PersonalRegistrationFormProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    })

    const [errors, setErrors] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const validateForm = (): boolean => {
        const newErrors: string[] = []

        if (!formData.name.trim()) {
            newErrors.push("Name is required")
        }

        if (!formData.email.trim()) {
            newErrors.push("Email is required")
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.push("Invalid email format")
        }

        if (!formData.password) {
            newErrors.push("Password is required")
        } else if (formData.password.length < 8) {
            newErrors.push("Password must be at least 8 characters")
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
            const response = await fetch("/api/auth/register-personal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    email: formData.email.toLowerCase().trim(),
                    password: formData.password,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setErrors(data.errors || [data.error || "Registration failed"])
                return
            }

            // Success
            if (typeof window !== 'undefined' && data.user) {
                sessionStorage.setItem('current_user_id', data.user.id)
                sessionStorage.setItem('current_user_name', data.user.name)
                sessionStorage.setItem('current_user_role', data.user.role)
                sessionStorage.setItem('current_user_email', data.user.email)
            }

            onSuccess()
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold">
                            <Sparkles className="w-4 h-4" />
                            Personal Account
                        </div>
                        <h1 className="text-5xl font-bold leading-tight">
                            AI Email Assistant
                            <br />
                            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                For Everyone
                            </span>
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Experience the power of AI-drafted emails and smart organization, completely free for personal use.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {[
                            { icon: CheckCircle2, text: "Works with any email provider" },
                            { icon: CheckCircle2, text: "Smart drafts & replies" },
                            { icon: CheckCircle2, text: "Priority inbox sorting" },
                            { icon: CheckCircle2, text: "Always free for personal use" },
                        ].map((feature, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                    <feature.icon className="w-4 h-4 text-purple-400" />
                                </div>
                                <span className="text-base text-foreground/80">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side - Registration form */}
                <Card className="w-full shadow-2xl border-border/60 backdrop-blur-sm">
                    <CardHeader className="space-y-2 pb-6">
                        <CardTitle className="text-3xl font-bold text-center">Create Personal Account</CardTitle>
                        <CardDescription className="text-center text-base">
                            Get started with your free personal account.
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
                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium">
                                    Full Name
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="h-11 pl-10"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">
                                    Email Address
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                                className="w-full h-12 text-base font-semibold group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        Create Free Account
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
