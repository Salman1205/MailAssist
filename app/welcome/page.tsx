"use client"

import { useEffect, useState } from "react"
import { ArrowRight, ArrowUpRight, Check, Moon, Sun } from "lucide-react"

export default function WelcomePage() {
  const [connecting, setConnecting] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  // Respect the app/system preference on first paint, still user-toggleable.
  useEffect(() => {
    try {
      const prefersDark =
        document.documentElement.classList.contains("dark") ||
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
      setTheme(prefersDark ? "dark" : "light")
    } catch {
      /* keep light */
    }
  }, [])

  // Scroll-triggered reveals (Apple-style: subtle, once).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in")
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const go = (href: string) => () => {
    window.location.href = href
  }

  const handleGmailConnect = async () => {
    try {
      setConnecting(true)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("show_inbox_skeleton_on_return", "true")
      }
      const res = await fetch("/api/auth/gmail")
      if (!res.ok) throw new Error("Failed to get auth URL")
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch {
      setConnecting(false)
      if (typeof window !== "undefined") sessionStorage.removeItem("show_inbox_skeleton_on_return")
    }
  }

  return (
    <div className="ma-root" data-theme={theme}>
      <style>{CSS}</style>

      {/* Top bar */}
      <header className="ma-bar">
        <div className="ma-wrap ma-bar-in">
          <div className="ma-brand">
            <img src="/amanii_logo.png" alt="MailAssist" className="ma-logo" />
            <span className="ma-word">MailAssist</span>
          </div>
          <nav className="ma-nav">
            <a className="ma-link" href="#how">How it works</a>
            <a className="ma-link" href="#plans">Plans</a>
            <button
              className="ma-theme"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="ma-theme-i" /> : <Moon className="ma-theme-i" />}
            </button>
            <button className="ma-signin" onClick={go("/auth/landing?view=login")}>Sign in</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="ma-hero ma-wrap">
        <div className="ma-hero-copy">
          <div className="ma-eyebrow load load-1">Shared inbox for support teams</div>
          <h1 className="ma-h1">
            <span className="ma-line load load-2">Every email becomes</span>
            <span className="ma-line load load-3">a ticket. <em>Nothing</em></span>
            <span className="ma-line load load-4">slips through.</span>
          </h1>
          <p className="ma-sub load load-5">
            MailAssist turns your team's Gmail into one calm, shared helpdesk — every
            message sorted, assigned, and drafted in your voice. A self-healing inbox
            that guarantees no customer email ever goes missing.
          </p>
          <div className="ma-cta load load-6">
            <button className="ma-btn ma-btn-primary" onClick={go("/auth/landing?view=register")}>
              Set up your team <ArrowRight className="ma-btn-i" />
            </button>
            <button className="ma-btn ma-btn-ghost" onClick={go("/auth/landing?view=register-personal")}>
              Start solo
            </button>
          </div>
          <div className="ma-trust load load-7">
            <span className="ma-dot" /> Connects to Gmail in seconds
            <span className="ma-sep">·</span> No credit card
          </div>
        </div>

        {/* Signature: self-animating triage console */}
        <div className="ma-console load load-4" aria-hidden>
          <div className="ma-c-bar">
            <span className="ma-c-dot" /><span className="ma-c-dot" /><span className="ma-c-dot" />
            <span className="ma-c-title">Shared inbox — live</span>
            <span className="ma-c-live"><span className="ma-c-live-dot" /> triaging</span>
          </div>
          <div className="ma-c-body">
            <div className="ma-c-col">
              <div className="ma-c-h">Incoming</div>
              <div className="ma-raw ma-raw-1"><span className="ma-raw-from">order help</span><span className="ma-raw-sub">Where is my order #4021?</span></div>
              <div className="ma-raw ma-raw-2"><span className="ma-raw-from">refund</span><span className="ma-raw-sub">Charger stopped working…</span></div>
              <div className="ma-raw ma-raw-3"><span className="ma-raw-from">wholesale</span><span className="ma-raw-sub">Bulk pricing for 200 units</span></div>
              <div className="ma-raw ma-raw-4"><span className="ma-raw-from">newsletter</span><span className="ma-raw-sub">Weekly digest…</span></div>
            </div>
            <div className="ma-c-flow"><ArrowRight className="ma-c-arrow" /></div>
            <div className="ma-c-col">
              <div className="ma-c-h">Sorted &amp; assigned</div>
              <div className="ma-tk ma-tk-1">
                <span className="ma-tag ma-tag-teal">Orders</span>
                <span className="ma-tk-sub">Where is my order #4021?</span>
                <span className="ma-av">AM</span>
              </div>
              <div className="ma-tk ma-tk-2">
                <span className="ma-tag ma-tag-amber">Returns</span>
                <span className="ma-tk-sub">Charger stopped working…</span>
                <span className="ma-av">JT</span>
              </div>
              <div className="ma-draft ma-tk-3">
                <span className="ma-draft-label">AI draft · in your voice</span>
                <span className="ma-draft-text">Hi Alex — your order #4021 shipped today<span className="ma-cursor" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="how" className="ma-wrap ma-caps" data-reveal>
        <div className="ma-caps-grid">
          {[
            { k: "01", t: "Auto-sorted queue", d: "Every incoming email becomes a ticket, labeled to the right workstream and routed to the right person — no manual filing.", m: "inbox → tickets" },
            { k: "02", t: "Drafts in your voice", d: "AI reads the thread and writes a reply that sounds like your team, ready to send or edit. Fast answers, still human.", m: "draft · 1.2s" },
            { k: "03", t: "Nothing slips", d: "A self-healing sync re-scans every mailbox on a schedule, so a missed notification never means a missed customer.", m: "0 lost / 30d" },
          ].map((c) => (
            <div className="ma-cap" key={c.k}>
              <div className="ma-cap-k">{c.k}</div>
              <h3 className="ma-cap-t">{c.t}</h3>
              <p className="ma-cap-d">{c.d}</p>
              <div className="ma-cap-m">{c.m}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Statement band */}
      <section className="ma-band" data-reveal>
        <div className="ma-wrap">
          <p className="ma-band-p">
            Support inboxes get loud. MailAssist keeps yours <em>quiet</em> — the queue
            triages itself, replies write themselves, and your team spends its time on the
            conversations that actually need a person.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="ma-wrap ma-plans" data-reveal>
        <div className="ma-plans-head">
          <h2 className="ma-h2">Two ways to start</h2>
          <p className="ma-h2-sub">Bring your own Gmail. Upgrade to a team whenever you're ready.</p>
        </div>
        <div className="ma-plans-grid">
          <div className="ma-plan">
            <div className="ma-plan-name">Solo</div>
            <p className="ma-plan-for">For one inbox and one person.</p>
            <ul className="ma-plan-list">
              {["Connect your Gmail", "AI learns your writing style", "Personalized drafts", "No team setup"].map((f) => (
                <li key={f}><Check className="ma-check" /> {f}</li>
              ))}
            </ul>
            <button className="ma-btn ma-btn-ghost ma-plan-btn" onClick={go("/auth/landing?view=register-personal")}>
              Start solo
            </button>
          </div>
          <div className="ma-plan ma-plan-feature">
            <div className="ma-plan-badge">For teams</div>
            <div className="ma-plan-name">Business</div>
            <p className="ma-plan-for">A shared helpdesk for the whole support team.</p>
            <ul className="ma-plan-list">
              {[
                "Multiple mailboxes, one queue",
                "Roles, assignment & approvals",
                "AI workstream labeling & guardrails",
                "Shopify, notes, analytics & knowledge base",
                "Self-healing sync — no email left behind",
              ].map((f) => (
                <li key={f}><Check className="ma-check ma-check-teal" /> {f}</li>
              ))}
            </ul>
            <button className="ma-btn ma-btn-primary ma-plan-btn" onClick={go("/auth/landing?view=register")}>
              Set up your team <ArrowRight className="ma-btn-i" />
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ma-final" data-reveal>
        <div className="ma-wrap ma-final-in">
          <h2 className="ma-final-h">Give your inbox back to your customers.</h2>
          <div className="ma-cta">
            <button className="ma-btn ma-btn-onDark" onClick={go("/auth/landing?view=register")}>
              Set up your team <ArrowRight className="ma-btn-i" />
            </button>
            <button className="ma-btn ma-btn-onDark-ghost" onClick={handleGmailConnect} disabled={connecting}>
              {connecting ? "Opening Gmail…" : "Connect Gmail"} <ArrowUpRight className="ma-btn-i" />
            </button>
          </div>
        </div>
      </section>

      <footer className="ma-wrap ma-foot">
        <span className="ma-brand"><img src="/amanii_logo.png" alt="MailAssist" className="ma-logo" /> MailAssist</span>
        <span className="ma-foot-r">The self-healing shared inbox.</span>
      </footer>
    </div>
  )
}

const CSS = `
.ma-root{
  --paper:#F6F5F1; --paper-2:#FFFFFF; --ink:#15181C; --muted:#5B6169; --faint:#8B9099;
  --line:#E4E1D9; --line-2:#D8D4CA; --teal:#0C8B99; --teal-deep:#0A6E79; --amber:#C9803A;
  --btn-bg:#15181C; --btn-fg:#FFFFFF; --bar-bg:rgba(246,245,241,.82);
  --console:#0E1116; --console-2:#171C24; --console-line:rgba(255,255,255,.08);
  --serif:var(--font-fraunces),"Fraunces",Georgia,"Times New Roman",serif;
  --sans:var(--font-geist),ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:var(--font-geist-mono),ui-monospace,"SF Mono",Menlo,monospace;
  position:absolute; inset:0; height:100vh; overflow-y:auto; overflow-x:hidden;
  background:var(--paper); color:var(--ink); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; letter-spacing:-0.011em;
}
.ma-wrap{max-width:1160px; margin:0 auto; padding-left:28px; padding-right:28px;}

/* Top bar */
.ma-bar{position:sticky; top:0; z-index:40; background:var(--bar-bg); backdrop-filter:blur(12px); border-bottom:1px solid var(--line);}
.ma-bar-in{display:flex; align-items:center; justify-content:space-between; height:62px;}
.ma-brand{display:inline-flex; align-items:center; gap:9px; font-weight:600; font-size:16px; letter-spacing:-0.02em;}
.ma-logo{height:26px; width:auto; display:block;}
.ma-nav{display:flex; align-items:center; gap:22px;}
.ma-link{color:var(--muted); font-size:14px; text-decoration:none; transition:color .18s;}
.ma-link:hover{color:var(--ink);}
.ma-theme{display:grid; place-items:center; width:36px; height:36px; border-radius:999px; border:1px solid var(--line-2); background:transparent; color:var(--muted); cursor:pointer; transition:all .18s;}
.ma-theme:hover{color:var(--ink); border-color:var(--ink);}
.ma-theme-i{width:16px; height:16px;}
.ma-signin{border:1px solid var(--line-2); background:var(--paper-2); color:var(--ink); font:inherit; font-size:14px; font-weight:520; padding:8px 16px; border-radius:999px; cursor:pointer; transition:all .18s;}
.ma-signin:hover{border-color:var(--ink); transform:translateY(-1px);}
@media(max-width:640px){ .ma-nav .ma-link{display:none;} }

/* Hero */
.ma-hero{display:grid; grid-template-columns:1.05fr 1fr; gap:56px; align-items:center; padding-top:78px; padding-bottom:96px;}
@media(max-width:900px){ .ma-hero{grid-template-columns:1fr; gap:40px; padding-top:52px; padding-bottom:64px;} }
.ma-eyebrow{display:inline-block; font-size:12.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--teal-deep); background:rgba(12,139,153,.08); border:1px solid rgba(12,139,153,.18); padding:6px 13px; border-radius:999px;}
.ma-h1{font-family:var(--serif); font-weight:500; font-size:clamp(40px,5.6vw,68px); line-height:1.02; letter-spacing:-0.02em; margin:22px 0 0;}
.ma-h1 .ma-line{display:block;}
.ma-h1 em{font-style:italic; color:var(--teal);}
.ma-sub{margin:24px 0 0; font-size:17.5px; line-height:1.6; color:var(--muted); max-width:33em;}
.ma-cta{display:flex; gap:12px; margin-top:30px; flex-wrap:wrap;}
.ma-btn{display:inline-flex; align-items:center; gap:9px; font:inherit; font-size:15px; font-weight:560; border-radius:999px; padding:12px 22px; cursor:pointer; border:1px solid transparent; transition:transform .16s, box-shadow .2s, background .2s, border-color .2s;}
.ma-btn-i{width:16px; height:16px;}
.ma-btn-primary{background:var(--btn-bg); color:var(--btn-fg); box-shadow:0 1px 2px rgba(0,0,0,.18);}
.ma-btn-primary:hover{transform:translateY(-2px); box-shadow:0 10px 24px -12px rgba(0,0,0,.5);}
.ma-btn-ghost{background:transparent; color:var(--ink); border-color:var(--line-2);}
.ma-btn-ghost:hover{border-color:var(--ink); transform:translateY(-2px);}
.ma-trust{margin-top:20px; font-size:13.5px; color:var(--faint); display:flex; align-items:center; gap:9px;}
.ma-dot{width:6px; height:6px; border-radius:50%; background:var(--teal);}
.ma-sep{opacity:.5;}

/* Console signature */
.ma-console{border-radius:16px; background:linear-gradient(180deg,var(--console-2),var(--console)); border:1px solid rgba(0,0,0,.12); box-shadow:0 40px 80px -32px rgba(20,24,30,.5), 0 2px 6px rgba(20,24,30,.12); overflow:hidden;}
.ma-c-bar{display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--console-line);}
.ma-c-dot{width:10px; height:10px; border-radius:50%; background:rgba(255,255,255,.16);}
.ma-c-title{color:rgba(255,255,255,.55); font-size:12.5px; margin-left:8px; font-family:var(--mono); letter-spacing:-.02em;}
.ma-c-live{margin-left:auto; display:inline-flex; align-items:center; gap:6px; font-size:11px; color:#5fd0c4; font-family:var(--mono);}
.ma-c-live-dot{width:6px; height:6px; border-radius:50%; background:#3fbfae; box-shadow:0 0 0 0 rgba(63,191,174,.6); animation:mapulse 2s infinite;}
.ma-c-body{display:grid; grid-template-columns:1fr 40px 1fr; gap:0; padding:16px; min-height:266px;}
.ma-c-col{display:flex; flex-direction:column; gap:9px;}
.ma-c-h{font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.35); margin-bottom:2px; font-weight:600;}
.ma-c-flow{display:flex; align-items:center; justify-content:center;}
.ma-c-arrow{width:18px; height:18px; color:rgba(255,255,255,.3);}
.ma-raw{background:rgba(255,255,255,.04); border:1px solid var(--console-line); border-radius:9px; padding:9px 11px; display:flex; flex-direction:column; gap:3px; opacity:0; transform:translateX(-8px); animation:maRawIn .5s forwards;}
.ma-raw-from{font-size:10.5px; color:rgba(255,255,255,.4); font-family:var(--mono);}
.ma-raw-sub{font-size:12.5px; color:rgba(255,255,255,.82); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ma-raw-1{animation-delay:.2s} .ma-raw-2{animation-delay:.5s} .ma-raw-3{animation-delay:.8s} .ma-raw-4{animation-delay:1.1s; opacity:.5}
.ma-tk{background:rgba(255,255,255,.05); border:1px solid var(--console-line); border-radius:9px; padding:9px 11px; display:flex; align-items:center; gap:9px; opacity:0; transform:translateY(8px); animation:maTkIn .55s forwards;}
.ma-tk-1{animation-delay:1s} .ma-tk-2{animation-delay:1.35s} .ma-tk-3{animation-delay:1.8s}
.ma-tag{font-size:10.5px; font-weight:650; padding:3px 8px; border-radius:6px; white-space:nowrap;}
.ma-tag-teal{background:rgba(63,191,174,.16); color:#6fe0d2;}
.ma-tag-amber{background:rgba(201,128,58,.18); color:#e6a86e;}
.ma-tk-sub{font-size:12.5px; color:rgba(255,255,255,.82); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ma-av{width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,#0c8b99,#7c6cf0); color:#fff; font-size:9.5px; font-weight:650; display:grid; place-items:center; flex-shrink:0;}
.ma-draft{background:linear-gradient(180deg,rgba(63,191,174,.09),rgba(255,255,255,.03)); border:1px solid rgba(63,191,174,.2); border-radius:9px; padding:10px 12px; display:flex; flex-direction:column; gap:5px; opacity:0; transform:translateY(8px); animation:maTkIn .55s forwards;}
.ma-draft-label{font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#5fd0c4; font-weight:600;}
.ma-draft-text{font-size:12.5px; color:rgba(255,255,255,.9); line-height:1.4;}
.ma-cursor{display:inline-block; width:2px; height:13px; background:#5fd0c4; margin-left:2px; transform:translateY(2px); animation:mablink 1s steps(1) infinite; animation-delay:2.4s;}
@media(max-width:520px){ .ma-c-body{grid-template-columns:1fr; gap:14px;} .ma-c-flow{transform:rotate(90deg); height:16px;} }

/* Capabilities */
.ma-caps{padding-bottom:20px;}
.ma-caps-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:14px; overflow:hidden;}
@media(max-width:820px){ .ma-caps-grid{grid-template-columns:1fr;} }
.ma-cap{background:var(--paper); padding:30px 26px; display:flex; flex-direction:column;}
.ma-cap-k{font-family:var(--mono); font-size:12px; color:var(--teal); letter-spacing:.05em;}
.ma-cap-t{font-family:var(--serif); font-weight:500; font-size:22px; letter-spacing:-.02em; margin:12px 0 8px;}
.ma-cap-d{font-size:14.5px; line-height:1.58; color:var(--muted); margin:0 0 18px; flex:1;}
.ma-cap-m{font-family:var(--mono); font-size:11.5px; color:var(--faint); border-top:1px dashed var(--line-2); padding-top:12px;}

/* Statement band */
.ma-band{padding:64px 0; margin-top:40px;}
.ma-band-p{font-family:var(--serif); font-weight:400; font-size:clamp(24px,3.2vw,36px); line-height:1.32; letter-spacing:-.02em; max-width:20em;}
.ma-band-p em{font-style:italic; color:var(--teal);}

/* Plans */
.ma-plans{padding-top:24px; padding-bottom:80px;}
.ma-plans-head{text-align:center; margin-bottom:34px;}
.ma-h2{font-family:var(--serif); font-weight:500; font-size:clamp(28px,3.6vw,40px); letter-spacing:-.02em; margin:0;}
.ma-h2-sub{color:var(--muted); font-size:15.5px; margin:10px 0 0;}
.ma-plans-grid{display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:840px; margin:0 auto;}
@media(max-width:760px){ .ma-plans-grid{grid-template-columns:1fr;} }
.ma-plan{background:var(--paper-2); border:1px solid var(--line); border-radius:16px; padding:28px 26px; display:flex; flex-direction:column;}
.ma-plan-feature{border-color:rgba(12,139,153,.35); box-shadow:0 24px 50px -30px rgba(12,139,153,.4); position:relative;}
.ma-plan-badge{position:absolute; top:-11px; left:26px; background:var(--teal); color:#fff; font-size:11px; font-weight:650; letter-spacing:.04em; padding:4px 11px; border-radius:999px;}
.ma-plan-name{font-family:var(--serif); font-size:24px; font-weight:500; letter-spacing:-.02em;}
.ma-plan-for{color:var(--muted); font-size:14px; margin:4px 0 18px;}
.ma-plan-list{list-style:none; padding:0; margin:0 0 22px; display:flex; flex-direction:column; gap:11px; flex:1;}
.ma-plan-list li{display:flex; align-items:flex-start; gap:9px; font-size:14.5px; color:var(--ink);}
.ma-check{width:17px; height:17px; color:var(--faint); flex-shrink:0; margin-top:1px;}
.ma-check-teal{color:var(--teal);}
.ma-plan-btn{width:100%; justify-content:center;}

/* Final CTA — always a dark band (fixed colors, theme-independent) */
.ma-final{background:#0B0E12; color:#fff; padding:76px 0;}
.ma-final-in{text-align:center; display:flex; flex-direction:column; align-items:center; gap:26px;}
.ma-final-h{font-family:var(--serif); font-weight:500; font-size:clamp(28px,4vw,46px); line-height:1.08; letter-spacing:-.02em; max-width:16em; margin:0; color:#fff;}
.ma-btn-onDark{background:#fff; color:#14171B;}
.ma-btn-onDark:hover{transform:translateY(-2px); box-shadow:0 12px 28px -12px rgba(0,0,0,.6);}
.ma-btn-onDark-ghost{background:transparent; color:#fff; border-color:rgba(255,255,255,.28);}
.ma-btn-onDark-ghost:hover{border-color:#fff; transform:translateY(-2px);}
.ma-btn-onDark-ghost:disabled{opacity:.6; cursor:default;}

/* Footer */
.ma-foot{display:flex; align-items:center; justify-content:space-between; padding-top:26px; padding-bottom:40px; color:var(--faint); font-size:13.5px;}
.ma-foot .ma-brand{color:var(--ink); font-size:14px;}
.ma-foot-r{font-style:italic; font-family:var(--serif);}

/* Reveal + load animation */
[data-reveal]{opacity:0; transform:translateY(22px); transition:opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1);}
[data-reveal].in{opacity:1; transform:none;}
.load{opacity:0; transform:translateY(14px); animation:maLoad .8s cubic-bezier(.2,.7,.2,1) forwards;}
.load-1{animation-delay:.05s} .load-2{animation-delay:.14s} .load-3{animation-delay:.22s} .load-4{animation-delay:.3s}
.load-5{animation-delay:.42s} .load-6{animation-delay:.52s} .load-7{animation-delay:.6s}
@keyframes maLoad{to{opacity:1; transform:none;}}
@keyframes maRawIn{to{opacity:1; transform:none;}}
@keyframes maTkIn{to{opacity:1; transform:none;}}
@keyframes mablink{50%{opacity:0;}}
@keyframes mapulse{0%{box-shadow:0 0 0 0 rgba(63,191,174,.5);} 70%{box-shadow:0 0 0 7px rgba(63,191,174,0);} 100%{box-shadow:0 0 0 0 rgba(63,191,174,0);}}

/* ---------- Dark mode ---------- */
.ma-root[data-theme="dark"]{
  --paper:#0E1216; --paper-2:#161B22; --ink:#EAEDF1; --muted:#98A0AA; --faint:#6B7280;
  --line:rgba(255,255,255,.09); --line-2:rgba(255,255,255,.17);
  --btn-bg:#FFFFFF; --btn-fg:#14171B; --bar-bg:rgba(14,18,22,.82);
}
.ma-root[data-theme="dark"] .ma-eyebrow{background:rgba(12,139,153,.16); border-color:rgba(12,139,153,.3); color:#4fc4d2;}
.ma-root[data-theme="dark"] .ma-signin{background:rgba(255,255,255,.05);}
.ma-root[data-theme="dark"] .ma-plan-feature{box-shadow:0 24px 50px -30px rgba(12,139,153,.55);}
.ma-root[data-theme="dark"] .ma-console{box-shadow:0 40px 80px -32px rgba(0,0,0,.7);}
.ma-root[data-theme="dark"] .ma-h1 em,
.ma-root[data-theme="dark"] .ma-band-p em{color:#3fbfae;}

@media (prefers-reduced-motion: reduce){
  .load,[data-reveal],.ma-raw,.ma-tk,.ma-draft{animation:none !important; opacity:1 !important; transform:none !important; transition:none !important;}
  .ma-cursor,.ma-c-live-dot{animation:none !important;}
}
`
