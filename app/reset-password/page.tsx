"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function ResetPasswordContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    })
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    useEffect(() => {
        if (!token) {
            setError("Invalid reset link. Please request a new password reset.")
        }
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.password) {
            setError("Please enter a new password")
            return
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters")
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match")
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    password: formData.password,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || "Failed to reset password")
                return
            }

            setSuccess(true)
        } catch (err) {
            console.error("Reset password error:", err)
            setError("An unexpected error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="rp-root">
                <style>{RP_CSS}</style>
                <a href="/welcome" className="rp-brand">
                    <img src="/amanii_logo.png" alt="MailAssist" className="rp-logo" />
                    <span className="rp-brand-name">MailAssist</span>
                </a>
                <div className="rp-shell">
                    <div className="rp-card rp-card-center">
                        <div className="rp-check" aria-hidden>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3fbfae" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                            </svg>
                        </div>
                        <h1 className="rp-h">Password reset!</h1>
                        <p className="rp-p">
                            Your password has been successfully reset. You can now log in with your new password.
                        </p>
                        <button
                            onClick={() => router.push("/auth/landing?view=login")}
                            className="rp-btn rp-btn-primary rp-btn-full"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="rp-root">
            <style>{RP_CSS}</style>
            <a href="/welcome" className="rp-brand">
                <img src="/amanii_logo.png" alt="MailAssist" className="rp-logo" />
                <span className="rp-brand-name">MailAssist</span>
            </a>
            <div className="rp-shell">
                <div className="rp-card">
                    <div className="rp-head">
                        <h1 className="rp-h">Reset password</h1>
                        <p className="rp-p">Enter your new password below</p>
                    </div>

                    {error && (
                        <div className="rp-alert" role="alert">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="rp-form">
                        <div className="rp-field">
                            <label htmlFor="password" className="rp-label">New Password</label>
                            <div className="rp-input-wrap">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="rp-input"
                                    disabled={loading || !token}
                                    required
                                    autoComplete="new-password"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="rp-eye"
                                    disabled={loading}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        <div className="rp-field">
                            <label htmlFor="confirmPassword" className="rp-label">Confirm Password</label>
                            <div className="rp-input-wrap">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm new password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="rp-input"
                                    disabled={loading || !token}
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="rp-eye"
                                    disabled={loading}
                                    tabIndex={-1}
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="rp-btn rp-btn-primary rp-btn-full"
                            disabled={loading || !token}
                        >
                            {loading ? (
                                <>
                                    <span className="rp-spinner" aria-hidden />
                                    Resetting...
                                </>
                            ) : (
                                "Reset Password"
                            )}
                        </button>
                    </form>

                    <div className="rp-footer">
                        <button
                            onClick={() => router.push("/auth/landing?view=login")}
                            className="rp-link"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function EyeIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function EyeOffIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="rp-root rp-root-fallback">
                <style>{RP_CSS}</style>
                <span className="rp-spinner rp-spinner-lg" aria-hidden />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    )
}

const RP_CSS = `
.rp-root{
  --ink:#15181C; --paper:#F6F5F1; --muted:#5B6169; --teal:#0C8B99; --teal-2:#0C8B99; --line:#E4E1D9;
  --serif:var(--font-fraunces),Georgia,serif; --sans:var(--font-geist),ui-sans-serif,system-ui,sans-serif;
  position:absolute; inset:0; height:100vh; overflow-y:auto;
  background:radial-gradient(1100px 560px at 82% -10%, rgba(12,139,153,.08), transparent 60%), var(--paper);
  color:var(--ink); font-family:var(--sans); letter-spacing:-.011em;
}
.dark .rp-root{
  --ink:#EAEDF1; --paper:#0E1216; --muted:#98A0AA; --line:rgba(255,255,255,.12);
  background:radial-gradient(1100px 560px at 82% -10%, rgba(12,139,153,.14), transparent 60%), #0E1216;
}
.dark .rp-card{background:#161B22; border-color:rgba(255,255,255,.12); box-shadow:0 10px 30px -18px rgba(0,0,0,.6);}
.dark .rp-input{background:#161B22; border-color:rgba(255,255,255,.12);}
.dark .rp-input::placeholder{color:#6c757e;}
.dark .rp-btn-ghost{border-color:rgba(255,255,255,.16);}
.dark .rp-spinner-lg{border-color:rgba(255,255,255,.16); border-top-color:#0C8B99;}
.rp-root-fallback{display:flex; align-items:center; justify-content:center;}
.rp-brand{position:absolute; top:22px; left:24px; display:inline-flex; align-items:center; gap:9px; text-decoration:none; z-index:2;}
.rp-logo{height:24px; width:auto; opacity:.95;}
.rp-brand-name{font-family:var(--serif); font-weight:500; font-size:17px; letter-spacing:-.02em; color:var(--ink);}
.rp-shell{min-height:100%; display:flex; align-items:center; justify-content:center; padding:96px 24px 48px;}
.rp-card{width:100%; max-width:420px; display:flex; flex-direction:column; gap:20px;
  background:#FFFFFF; border:1px solid var(--line); border-radius:16px; padding:32px 30px;
  box-shadow:0 10px 30px -18px rgba(21,24,28,.18);}
.rp-card-center{text-align:center; align-items:center; gap:14px;}
.rp-head{display:flex; flex-direction:column; gap:6px; text-align:center;}
.rp-h{font-family:var(--serif); font-weight:500; font-size:28px; letter-spacing:-.02em; margin:0; color:var(--ink);}
.rp-p{color:var(--muted); font-size:14.5px; line-height:1.6; margin:0;}
.rp-check{width:60px; height:60px; border-radius:999px; display:flex; align-items:center; justify-content:center;
  background:rgba(12,139,153,.1); border:1px solid rgba(12,139,153,.3);}
.rp-alert{display:flex; align-items:center; gap:9px; padding:11px 13px; border-radius:10px;
  background:rgba(200,40,40,.07); border:1px solid rgba(200,40,40,.28); color:#b23434; font-size:13.5px; line-height:1.4;}
.rp-alert svg{flex:0 0 auto;}
.rp-form{display:flex; flex-direction:column; gap:16px;}
.rp-field{display:flex; flex-direction:column; gap:7px;}
.rp-label{font-size:13px; font-weight:560; color:var(--ink);}
.rp-input-wrap{position:relative; display:flex;}
.rp-input{
  width:100%; background:#FFFFFF; border:1px solid var(--line); border-radius:10px;
  padding:11px 42px 11px 13px; color:var(--ink); font:inherit; font-size:14.5px; letter-spacing:-.011em;
  transition:border-color .18s, box-shadow .18s;
}
.rp-input::placeholder{color:#9aa0a6;}
.rp-input:focus{outline:none; border-color:var(--teal); box-shadow:0 0 0 3px rgba(12,139,153,.18);}
.rp-input:disabled{opacity:.55; cursor:not-allowed;}
.rp-eye{
  position:absolute; right:11px; top:50%; transform:translateY(-50%);
  display:flex; align-items:center; justify-content:center; padding:0; background:none; border:none;
  color:var(--muted); cursor:pointer; transition:color .16s;
}
.rp-eye:hover{color:var(--ink);}
.rp-eye:disabled{cursor:not-allowed; opacity:.6;}
.rp-btn{
  font:inherit; font-size:14.5px; font-weight:560; border-radius:999px; padding:12px 22px; cursor:pointer;
  border:1px solid transparent; transition:transform .16s, border-color .2s, box-shadow .2s, opacity .2s;
  display:inline-flex; align-items:center; justify-content:center; gap:9px;
}
.rp-btn-full{width:100%;}
.rp-btn-primary{background:var(--teal); color:#FFFFFF;}
.rp-btn-primary:hover:not(:disabled){transform:translateY(-2px); box-shadow:0 12px 26px -12px rgba(12,139,153,.5);}
.rp-btn:disabled{opacity:.6; cursor:not-allowed;}
.rp-footer{text-align:center;}
.rp-link{background:none; border:none; font:inherit; font-size:13.5px; font-weight:560; color:var(--teal); cursor:pointer;}
.rp-link:hover{text-decoration:underline;}
.rp-spinner{
  width:16px; height:16px; border-radius:999px; border:3px solid rgba(255,255,255,.35); border-top-color:#FFFFFF;
  animation:rp-spin .8s linear infinite;
}
.rp-spinner-lg{width:34px; height:34px; border:3px solid #D8D4CA; border-top-color:#0C8B99;}
@keyframes rp-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce){
  .rp-spinner, .rp-spinner-lg{animation:none;}
  .rp-btn-primary:hover:not(:disabled){transform:none;}
}
`
