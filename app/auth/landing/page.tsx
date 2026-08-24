"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Building2, User } from "lucide-react"
import BusinessRegistrationForm from "@/components/auth/business-registration-form"
import LoginForm from "@/components/auth/login-form"
import OTPVerification from "@/components/auth/otp-verification"
import PersonalRegistrationForm from "@/components/auth/personal-registration-form"

type ViewType = "landing" | "login" | "register" | "verify-otp" | "register-personal"

/* Shared branded frame — matches the /welcome homepage: warm paper, Fraunces, teal.
   The frame also scopes the shadcn theme vars to LIGHT so the form components
   (Card/Input/Button) render on paper instead of the app's dark theme. */
function AuthFrame({ children, narrow = true }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="auth-frame">
      <style>{AUTH_CSS}</style>
      <div className="auth-glow" aria-hidden />
      <a className="auth-brand" href="/welcome" aria-label="MailAssist home">
        <img src="/amanii_logo.png" alt="" className="auth-logo" />
        <span className="auth-word">MailAssist</span>
      </a>
      <main className={`auth-center ${narrow ? "auth-narrow" : ""}`}>{children}</main>
    </div>
  )
}

function AuthLoader() {
  return (
    <AuthFrame>
      <div className="auth-spin" aria-label="Loading" role="status" />
    </AuthFrame>
  )
}

export default function AuthLandingPage() {
  return (
    <Suspense fallback={<AuthLoader />}>
      <AuthLandingContent />
    </Suspense>
  )
}

function AuthLandingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentView, setCurrentView] = useState<ViewType | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [verificationData, setVerificationData] = useState<{
    email: string
    verificationToken: string
    businessId: string
  } | null>(null)

  useEffect(() => {
    const view = searchParams.get("view")
    if (view === "login" || view === "register" || view === "register-personal" || view === "verify-otp") {
      setCurrentView(view as ViewType)
    } else {
      setCurrentView("landing")
    }
    setIsInitialized(true)
  }, [searchParams])

  if (!isInitialized) return <AuthLoader />

  const handleRegistrationSuccess = (data: { email: string; verificationToken: string; businessId: string }) => {
    setVerificationData(data)
    setCurrentView("verify-otp")
  }
  const handleLoginSuccess = () => router.push("/")
  const handleOTPSuccess = () => router.push("/")
  const handlePersonalRegistrationSuccess = () => router.push("/")

  if (currentView === "landing") {
    return (
      <AuthFrame narrow={false}>
        <div className="auth-choose">
          <h1 className="auth-h1">Get started with MailAssist</h1>
          <p className="auth-sub">Bring your own Gmail. Upgrade to a team whenever you're ready.</p>
          <div className="auth-choose-grid">
            <button className="auth-choice" onClick={() => setCurrentView("register")}>
              <span className="auth-choice-ic"><Building2 /></span>
              <span className="auth-choice-t">Business &amp; teams</span>
              <span className="auth-choice-d">A shared helpdesk for the whole support team.</span>
              <span className="auth-choice-go">Create a team account <ArrowRight /></span>
            </button>
            <button className="auth-choice" onClick={() => setCurrentView("register-personal")}>
              <span className="auth-choice-ic"><User /></span>
              <span className="auth-choice-t">Just me</span>
              <span className="auth-choice-d">AI drafts for your own inbox, no setup.</span>
              <span className="auth-choice-go">Create a personal account <ArrowRight /></span>
            </button>
          </div>
          <button className="auth-signin-link" onClick={() => setCurrentView("login")}>
            Already have an account? Sign in
          </button>
        </div>
      </AuthFrame>
    )
  }

  if (currentView === "login") {
    return (
      <AuthFrame>
        <LoginForm
          onSuccess={handleLoginSuccess}
          onRegisterClick={() => setCurrentView("register")}
          onPersonalRegisterClick={() => setCurrentView("register-personal")}
          initialError={searchParams.get("error")}
        />
      </AuthFrame>
    )
  }

  if (currentView === "register") {
    return (
      <AuthFrame>
        <BusinessRegistrationForm onSuccess={handleRegistrationSuccess} onLoginClick={() => setCurrentView("login")} />
      </AuthFrame>
    )
  }

  if (currentView === "register-personal") {
    return (
      <AuthFrame>
        <PersonalRegistrationForm onSuccess={handlePersonalRegistrationSuccess} onLoginClick={() => setCurrentView("login")} />
      </AuthFrame>
    )
  }

  if (currentView === "verify-otp" && verificationData) {
    return (
      <AuthFrame>
        <OTPVerification
          email={verificationData.email}
          verificationToken={verificationData.verificationToken}
          businessId={verificationData.businessId}
          onSuccess={handleOTPSuccess}
          onBack={() => setCurrentView("register")}
        />
      </AuthFrame>
    )
  }

  return <AuthLoader />
}

const AUTH_CSS = `
.auth-frame{
  --paper:#F6F5F1; --paper-2:#FFFFFF; --ink:#15181C; --muted:#5B6169; --teal:#0C8B99; --teal-2:#0A6E79;
  --line:#E4E1D9; --line-2:#D8D4CA;
  --serif:var(--font-fraunces),Georgia,serif; --sans:var(--font-geist),ui-sans-serif,system-ui,sans-serif;
  /* Scope shadcn theme to LIGHT so the form components render on paper */
  --background:#F6F5F1; --foreground:#15181C;
  --card:#FFFFFF; --card-foreground:#15181C;
  --popover:#FFFFFF; --popover-foreground:#15181C;
  --primary:#0C8B99; --primary-foreground:#FFFFFF;
  --secondary:#EEECE6; --secondary-foreground:#15181C;
  --muted:#EEECE6; --muted-foreground:#5B6169;
  --accent:#EAF6F7; --accent-foreground:#0A6E79;
  --border:#E4E1D9; --input:#E4E1D9; --ring:#0C8B99;
  --destructive:#D14343; --destructive-foreground:#FFFFFF;
  --radius:0.6rem;
  position:absolute; inset:0; height:100vh; overflow-y:auto; overflow-x:hidden;
  background:radial-gradient(1100px 560px at 82% -10%, rgba(12,139,153,.08), transparent 60%), var(--paper);
  color:var(--ink); font-family:var(--sans); letter-spacing:-.011em;
  display:flex; flex-direction:column;
}
.auth-glow{position:absolute; inset:0; pointer-events:none; background:radial-gradient(680px 400px at 8% 108%, rgba(12,139,153,.06), transparent 60%);}
.auth-brand{position:relative; z-index:2; display:inline-flex; align-items:center; gap:9px; padding:20px 26px; color:var(--ink); text-decoration:none; font-weight:600; font-size:15px; letter-spacing:-.02em; align-self:flex-start;}
.auth-logo{height:24px; width:auto; display:block;}
.auth-center{position:relative; z-index:2; flex:1; display:flex; align-items:center; justify-content:center; padding:20px 20px 56px;}
.auth-narrow :where(.max-w-md,.max-w-lg,[class*="max-w-"]){max-width:440px;}
.auth-spin{width:34px; height:34px; border-radius:50%; border:3px solid var(--line-2); border-top-color:var(--teal); animation:authspin .8s linear infinite;}
@keyframes authspin{to{transform:rotate(360deg);}}

/* Choice screen */
.auth-choose{width:100%; max-width:760px; text-align:center; animation:authfade .5s cubic-bezier(.2,.7,.2,1) both;}
.auth-h1{font-family:var(--serif); font-weight:500; font-size:clamp(28px,4.4vw,40px); letter-spacing:-.02em; margin:0; color:var(--ink);}
.auth-sub{color:var(--muted); font-size:15.5px; margin:12px 0 30px;}
.auth-choose-grid{display:grid; grid-template-columns:1fr 1fr; gap:16px;}
@media(max-width:640px){ .auth-choose-grid{grid-template-columns:1fr;} }
.auth-choice{text-align:left; background:var(--paper-2); border:1px solid var(--line); border-radius:16px; padding:24px 22px; cursor:pointer; color:var(--ink); font:inherit; display:flex; flex-direction:column; gap:8px; transition:transform .16s, border-color .2s, box-shadow .2s;}
.auth-choice:hover{transform:translateY(-3px); border-color:rgba(12,139,153,.4); box-shadow:0 22px 44px -26px rgba(12,139,153,.35);}
.auth-choice-ic{width:42px; height:42px; border-radius:11px; display:grid; place-items:center; background:rgba(12,139,153,.1); color:var(--teal); margin-bottom:6px;}
.auth-choice-ic svg{width:20px; height:20px;}
.auth-choice-t{font-family:var(--serif); font-size:21px; font-weight:500; letter-spacing:-.02em;}
.auth-choice-d{color:var(--muted); font-size:14px; line-height:1.5; flex:1;}
.auth-choice-go{display:inline-flex; align-items:center; gap:7px; color:var(--teal); font-size:13.5px; font-weight:560; margin-top:6px;}
.auth-choice-go svg{width:15px; height:15px;}
.auth-signin-link{margin-top:26px; background:none; border:0; color:var(--muted); font:inherit; font-size:14px; cursor:pointer; text-decoration:underline; text-underline-offset:3px;}
.auth-signin-link:hover{color:var(--ink);}
@keyframes authfade{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:none;}}

/* Tame the form components' louder accents so they read as the calm paper look */
.auth-frame [class*="from-primary"][class*="via-purple"], .auth-frame [class*="via-purple-500"]{
  background-image:none !important; -webkit-text-fill-color:currentColor !important; color:var(--ink) !important;
}
.auth-frame .auth-h1{color:var(--ink);}

@media (prefers-reduced-motion: reduce){
  .auth-choose,.auth-choice{animation:none !important; transition:none !important;}
  .auth-spin{animation-duration:1.4s;}
}
`
