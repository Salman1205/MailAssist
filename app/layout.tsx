import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Fraunces } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
// Characterful serif for display type on the marketing/welcome surface.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" })

export const metadata: Metadata = {
  title: "MailAssist — The self-healing shared inbox",
  description: "Turn your team's Gmail into one calm, AI-drafted helpdesk. Every email sorted, assigned, and answered — nothing missed.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} font-sans antialiased h-screen bg-background text-foreground overflow-hidden`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
