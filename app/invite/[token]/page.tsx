"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, CheckCircle2, Mail, Building2, UserPlus, XCircle } from "lucide-react"

/* Shared branded frame — matches /welcome, /auth/landing and error.tsx (logo, Fraunces, teal). */
function InviteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="inv-root">
      <style>{INV_CSS}</style>
      <div className="inv-glow" aria-hidden />
      <a className="inv-brand" href="/welcome" aria-label="MailAssist home">
        <img src="/amanii_logo.png" alt="MailAssist" className="inv-logo" />
        <span className="inv-word">MailAssist</span>
      </a>
      <main className="inv-center">{children}</main>
    </div>
  )
}

function InviteLoader() {
  return (
    <InviteFrame>
      <div className="inv-spin" aria-label="Loading" role="status" />
    </InviteFrame>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<InviteLoader />}>
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
      <InviteFrame>
        <div className="inv-card inv-card-center">
          <div className="inv-spin" aria-label="Loading" role="status" />
          <p className="inv-muted">Validating invitation...</p>
        </div>
      </InviteFrame>
    )
  }

  if (error && !invitation) {
    return (
      <InviteFrame>
        <div className="inv-card inv-card-center">
          <div className="inv-badge inv-badge-danger" aria-hidden>
            <XCircle />
          </div>
          <h1 className="inv-h1">Invalid Invitation</h1>
          <p className="inv-muted">This invitation link is invalid or has expired</p>
          <div className="inv-alert" role="alert">{error}</div>
          <button className="inv-btn inv-btn-primary inv-btn-block" onClick={() => router.push("/welcome")}>
            Go to Home
          </button>
        </div>
      </InviteFrame>
    )
  }

  return (
    <InviteFrame>
      <div className="inv-card">
        <div className="inv-head">
          <div className="inv-badge" aria-hidden>
            <UserPlus />
          </div>
          <h1 className="inv-h1">Welcome to the Team!</h1>
          <p className="inv-muted">Create your password to complete your account setup</p>
        </div>

        {invitation && (
          <div className="inv-details">
            <div className="inv-detail-row">
              <span className="inv-detail-ic"><Mail /></span>
              <span className="inv-detail-val">{invitation.email}</span>
            </div>
            <div className="inv-detail-row">
              <span className="inv-detail-ic"><Building2 /></span>
              <span className="inv-detail-val">{invitation.business_name}</span>
            </div>
            <div className="inv-detail-row">
              <span className="inv-detail-ic"><CheckCircle2 /></span>
              <span className="inv-detail-val">Role: <span className="inv-accent">{invitation.role}</span></span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="inv-form">
          <div className="inv-field">
            <label htmlFor="password" className="inv-label">Password</label>
            <div className="inv-input-wrap">
              <Lock className="inv-input-ic-left" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="inv-input"
                placeholder="Create a strong password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="inv-input-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <p className="inv-hint">
              <CheckCircle2 />
              Minimum 8 characters
            </p>
          </div>

          <div className="inv-field">
            <label htmlFor="confirmPassword" className="inv-label">Confirm Password</label>
            <div className="inv-input-wrap">
              <Lock className="inv-input-ic-left" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="inv-input"
                placeholder="Confirm your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="inv-input-toggle"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {error && (
            <div className="inv-alert" role="alert">{error}</div>
          )}

          <button type="submit" disabled={loading} className="inv-btn inv-btn-primary inv-btn-block">
            {loading ? (
              <span className="inv-btn-loading">
                <span className="inv-spin inv-spin-sm" />
                Creating account...
              </span>
            ) : (
              <>
                <span>Create Account &amp; Sign In</span>
                <CheckCircle2 className="inv-btn-ic" />
              </>
            )}
          </button>
        </form>
      </div>
    </InviteFrame>
  )
}

const INV_CSS = `
.inv-root{
  --ink:#F6F5F1; --ink-2:#FFFFFF; --paper:#15181C; --muted:#5B6169; --teal:#0C8B99; --teal-2:#0C8B99;
  --line:#E4E1D9; --line-2:#E4E1D9;
  --serif:var(--font-fraunces),Georgia,serif; --sans:var(--font-geist),ui-sans-serif,system-ui,sans-serif;
  position:absolute; inset:0; height:100vh; overflow-y:auto; overflow-x:hidden;
  background:radial-gradient(1100px 560px at 82% -10%, rgba(12,139,153,.08), transparent 60%), var(--ink);
  color:var(--paper); font-family:var(--sans); letter-spacing:-.011em;
  display:flex; flex-direction:column;
}
.dark .inv-root{
  --ink:#0E1216; --ink-2:#161B22; --paper:#EAEDF1; --muted:#98A0AA; --teal:#0C8B99; --teal-2:#0C8B99;
  --line:rgba(255,255,255,.1); --line-2:rgba(255,255,255,.16);
  background:radial-gradient(1100px 560px at 82% -10%, rgba(12,139,153,.14), transparent 60%), #0E1216;
}
.dark .inv-card{box-shadow:0 30px 60px -30px rgba(0,0,0,.7);}
.dark .inv-details{background:rgba(255,255,255,.02);}
.dark .inv-spin{border-color:rgba(255,255,255,.15); border-top-color:var(--teal-2);}
.inv-glow{position:absolute; inset:0; pointer-events:none; background:radial-gradient(700px 400px at 10% 110%, rgba(12,139,153,.05), transparent 60%);}
.inv-brand{position:relative; z-index:2; display:inline-flex; align-items:center; gap:9px; padding:20px 26px; color:var(--paper); text-decoration:none; font-weight:600; font-size:15px; letter-spacing:-.02em; align-self:flex-start;}
.inv-logo{height:24px; width:auto; display:block;}
.inv-center{position:relative; z-index:2; flex:1; display:flex; align-items:center; justify-content:center; padding:20px 20px 56px;}

.inv-spin{width:34px; height:34px; border-radius:50%; border:3px solid #D8D4CA; border-top-color:var(--teal-2); animation:invspin .8s linear infinite;}
.inv-spin-sm{width:16px; height:16px; border-width:2px;}
@keyframes invspin{to{transform:rotate(360deg);}}

.inv-card{
  width:100%; max-width:440px; background:var(--ink-2);
  border:1px solid var(--line); border-radius:18px; padding:30px 28px;
  box-shadow:0 20px 44px -28px rgba(0,0,0,.18);
  animation:invfade .5s cubic-bezier(.2,.7,.2,1) both;
}
.inv-card-center{display:flex; flex-direction:column; align-items:center; gap:16px; text-align:center;}

.inv-head{text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:22px;}
.inv-badge{width:56px; height:56px; border-radius:16px; display:grid; place-items:center; background:rgba(12,139,153,.16); color:var(--teal-2); border:1px solid rgba(12,139,153,.4); margin-bottom:6px;}
.inv-badge svg{width:26px; height:26px;}
.inv-badge-danger{background:rgba(220,38,38,.08); color:#dc2626; border-color:rgba(220,38,38,.3);}
.inv-h1{font-family:var(--serif); font-weight:500; font-size:27px; letter-spacing:-.02em; margin:0;}
.inv-muted{color:var(--muted); font-size:14.5px; line-height:1.55; margin:0;}
.inv-accent{color:var(--teal-2);}

.inv-details{
  margin:0 0 22px; padding:14px; border:1px solid var(--line); border-radius:12px;
  background:#FAF9F5; display:flex; flex-direction:column; gap:4px;
  animation:invfade .5s cubic-bezier(.2,.7,.2,1) both;
}
.inv-detail-row{display:flex; align-items:center; gap:12px; padding:6px 4px; font-size:14px;}
.inv-detail-ic{width:32px; height:32px; flex:none; border-radius:999px; display:grid; place-items:center; background:rgba(12,139,153,.14); color:var(--teal-2); border:1px solid rgba(12,139,153,.28);}
.inv-detail-ic svg{width:15px; height:15px;}
.inv-detail-val{color:var(--paper); font-weight:500; overflow-wrap:anywhere;}

.inv-form{display:flex; flex-direction:column; gap:16px;}
.inv-field{display:flex; flex-direction:column; gap:8px;}
.inv-label{font-size:13.5px; font-weight:560; color:var(--paper);}
.inv-input-wrap{position:relative; display:flex; align-items:center;}
.inv-input-ic-left{position:absolute; left:12px; width:16px; height:16px; color:var(--muted); pointer-events:none; transition:color .2s;}
.inv-input-wrap:focus-within .inv-input-ic-left{color:var(--teal-2);}
.inv-input{
  width:100%; background:var(--ink-2); border:1px solid var(--line-2); border-radius:10px;
  padding:11px 40px 11px 38px; color:var(--paper); font:inherit; font-size:14.5px;
  transition:border-color .2s, box-shadow .2s;
}
.inv-input::placeholder{color:#9BA1A9;}
.inv-input:focus{outline:none; border-color:var(--teal); box-shadow:0 0 0 3px rgba(12,139,153,.18);}
.inv-input-toggle{position:absolute; right:10px; background:none; border:0; padding:4px; cursor:pointer; color:var(--muted); display:grid; place-items:center; transition:color .2s;}
.inv-input-toggle:hover{color:var(--paper);}
.inv-input-toggle svg{width:16px; height:16px;}
.inv-hint{display:flex; align-items:center; gap:6px; margin:0; font-size:12px; color:var(--muted);}
.inv-hint svg{width:12px; height:12px;}

.inv-alert{
  background:rgba(220,38,38,.08); border:1px solid rgba(220,38,38,.3); color:#b91c1c;
  border-radius:10px; padding:11px 13px; font-size:13.5px; line-height:1.5; width:100%; text-align:left;
}

.inv-btn{
  font:inherit; font-size:14.5px; font-weight:560; border-radius:999px; padding:12px 22px; cursor:pointer;
  border:1px solid transparent; transition:transform .16s, border-color .2s, box-shadow .2s, opacity .2s;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
}
.inv-btn-block{width:100%;}
.inv-btn-primary{background:var(--teal); color:#FFFFFF;}
.inv-btn-primary:hover:not(:disabled){transform:translateY(-2px); box-shadow:0 12px 26px -14px rgba(0,0,0,.35);}
.inv-btn:disabled{opacity:.7; cursor:default;}
.inv-btn-ic{width:16px; height:16px;}
.inv-btn-loading{display:inline-flex; align-items:center; gap:8px;}

@keyframes invfade{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:none;}}

@media (prefers-reduced-motion: reduce){
  .inv-card,.inv-details{animation:none !important;}
  .inv-btn,.inv-input,.inv-input-toggle,.inv-input-ic-left{transition:none !important;}
  .inv-btn-primary:hover:not(:disabled){transform:none;}
  .inv-spin{animation-duration:1.4s;}
}
`
