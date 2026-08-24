'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('App Error:', error)
    }, [error])

    return (
        <div className="err-root">
            <style>{ERR_CSS}</style>
            <div className="err-glow" aria-hidden />
            <div className="err-card">
                <img src="/amanii_logo.png" alt="MailAssist" className="err-logo" />
                <h2 className="err-h">Something went wrong</h2>
                <p className="err-p">{error.message || 'An unexpected error occurred. You can try again or head back to your inbox.'}</p>
                <div className="err-row">
                    <button className="err-btn err-btn-primary" onClick={() => reset()}>Try again</button>
                    <button className="err-btn err-btn-ghost" onClick={() => (window.location.href = '/')}>Go to inbox</button>
                </div>
            </div>
        </div>
    )
}

const ERR_CSS = `
.err-root{
  --ink:#0E1216; --paper:#EAEDF1; --muted:#98A0AA; --teal:#0C8B99; --teal-2:#3fbfae; --line:rgba(255,255,255,.12);
  --serif:var(--font-fraunces),Georgia,serif; --sans:var(--font-geist),ui-sans-serif,system-ui,sans-serif;
  position:absolute; inset:0; height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
  background:radial-gradient(900px 480px at 80% -10%, rgba(12,139,153,.14), transparent 60%), var(--ink);
  color:var(--paper); font-family:var(--sans); letter-spacing:-.011em;
}
.err-glow{position:absolute; inset:0; pointer-events:none;}
.err-card{position:relative; text-align:center; max-width:460px; display:flex; flex-direction:column; align-items:center; gap:14px;}
.err-logo{height:28px; width:auto; opacity:.95;}
.err-h{font-family:var(--serif); font-weight:500; font-size:30px; letter-spacing:-.02em; margin:6px 0 0;}
.err-p{color:var(--muted); font-size:15px; line-height:1.6; margin:0;}
.err-row{display:flex; gap:12px; margin-top:12px;}
.err-btn{font:inherit; font-size:14.5px; font-weight:560; border-radius:999px; padding:11px 22px; cursor:pointer; border:1px solid transparent; transition:transform .16s, border-color .2s, box-shadow .2s;}
.err-btn-primary{background:#fff; color:#14171B;}
.err-btn-primary:hover{transform:translateY(-2px); box-shadow:0 12px 26px -12px rgba(0,0,0,.6);}
.err-btn-ghost{background:transparent; color:var(--paper); border-color:var(--line);}
.err-btn-ghost:hover{border-color:#fff; transform:translateY(-2px);}
`
