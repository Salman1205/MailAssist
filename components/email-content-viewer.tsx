"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"
import {
    prepareEmailHtml,
    EMAIL_FIT_CSS,
    isDarkSurface,
    DARK_INK,
    DARK_MUTED,
    DARK_LINK,
    DARK_PANEL,
} from "@/lib/email-dark"

interface EmailContentViewerProps {
    content: string
    emailId?: string
    attachments?: any[]
    className?: string
}

export function EmailContentViewer({ content, emailId, attachments, className }: EmailContentViewerProps) {
    const [processedContent, setProcessedContent] = useState("")
    // Derived synchronously from `content` (not state) so the canvas theme and
    // the rendered body are always computed from the same content in the same
    // render — no wrong-theme flash when switching between HTML and plain-text mail.
    const isPlainTextContent = useMemo(
        () => content ? !/<\s*(p|div|br|table|img|ul|ol|li|span|style|body|html|blockquote)/i.test(content) : false,
        [content]
    )
    const [iframeHeight, setIframeHeight] = useState(200)
    const [loading, setLoading] = useState(false)
    const [remoteImagesAllowed, setRemoteImagesAllowed] = useState(true)
    const [blockedRemoteCount, setBlockedRemoteCount] = useState(0)
    // Dark mode: `surface` is the real background colour of the card this viewer
    // sits in, read from the DOM, so the email canvas matches whatever theme the
    // app is on instead of a hard-coded hex that only matches one of them.
    const [surface, setSurface] = useState<string>("#ffffff")
    const [showOriginal, setShowOriginal] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const isDark = isDarkSurface(surface)

    // Reset per-email view state when switching emails.
    useEffect(() => {
        setRemoteImagesAllowed(true)
        setBlockedRemoteCount(0)
        setShowOriginal(false)
    }, [emailId])

    // Resolve the background the email canvas should sit on, and re-resolve it
    // when the theme flips (class change on <html>, or OS-level preference change).
    //
    // The app is in dark mode when <html> has the `.dark` class (next-themes) —
    // this is the authoritative signal. We do NOT rely solely on reading a painted
    // background colour up the tree, because the app's dark background is a CSS
    // *gradient* (`.dark body { background: linear-gradient(...) }`), which reports
    // as `transparent` to getComputedStyle().backgroundColor. That made the viewer
    // fall through to white and render every email on a glaring white sheet in dark
    // mode. We still try to read a real solid surface for an exact colour match,
    // but fall back to a proper dark/light default based on the `.dark` class.
    const readSurface = useCallback(() => {
        const root = document.documentElement
        const rootDark =
            root.classList.contains("dark") || root.getAttribute("data-theme") === "dark"

        let node: HTMLElement | null = containerRef.current
        while (node) {
            const bg = getComputedStyle(node).backgroundColor
            const parts = bg.match(/rgba?\(([^)]+)\)/)
            const alpha = parts ? parseFloat(parts[1].split(",")[3] ?? "1") : 1
            // Only trust a solid colour that agrees with the app theme — a stray
            // light panel found in dark mode (or vice-versa) must not win.
            if (bg && bg !== "transparent" && alpha > 0.2) {
                if (isDarkSurface(bg) === rootDark) {
                    setSurface(bg)
                    return
                }
            }
            node = node.parentElement
        }
        // No matching solid surface (e.g. the dark gradient body) — use the app's
        // known dark/light canvas.
        setSurface(rootDark ? "#0F141A" : "#ffffff")
    }, [])

    useLayoutEffect(() => {
        readSurface()
        const mo = new MutationObserver(readSurface)
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
        const mq = window.matchMedia("(prefers-color-scheme: dark)")
        mq.addEventListener?.("change", readSurface)
        return () => {
            mo.disconnect()
            mq.removeEventListener?.("change", readSurface)
        }
    }, [readSurface])

    useEffect(() => {
        if (!content) {
            setProcessedContent("")
            setLoading(false)
            return
        }

        const isPlainText = isPlainTextContent
        let normalizedContent = content

        if (isPlainText) {
            normalizedContent = normalizedContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')

            normalizedContent = normalizedContent.replace(
                /\b(https?:\/\/[^\s<>"\]]+)/gi,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            )
            normalizedContent = normalizedContent.replace(
                /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
                '<a href="mailto:$1">$1</a>'
            )
            normalizedContent = normalizedContent.replace(
                /\b(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
                '<a href="tel:$1">$1</a>'
            )
            normalizedContent = normalizedContent.replace(/\n/g, '<br>')
        }

        const clean = DOMPurify.sanitize(normalizedContent, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['style', 'center', 'font', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'div', 'span', 'p', 'br', 'hr', 'img', 'a', 'ul', 'ol', 'li', 'blockquote', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            ADD_ATTR: ['style', 'target', 'href', 'src', 'width', 'height', 'align', 'valign', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'class', 'id', 'alt', 'title'],
            ADD_URI_SAFE_ATTR: ['src', 'href'],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'svg', 'canvas', 'video', 'audio'],
            FORBID_ATTR: ['onmouseover', 'onclick', 'onerror', 'onload', 'onmouseenter', 'onmouseleave']
        })

        setLoading(true)

        let processed = clean
        let remoteImageCount = 0

        const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAP///////ywAAAAAAQABAAACAUwAOw=="

        if (emailId && attachments?.length) {
            attachments.forEach(att => {
                const nameWithoutExt = att.filename?.replace(/\.[^.]+$/, '') || ''
                const contentId = att.contentId || att.id

                const patterns = [
                    `cid:${att.id}`,
                    `cid:${contentId}`,
                    `cid:${att.filename}`,
                    `cid:${nameWithoutExt}`,
                    `<${att.id}>`,
                    `<${contentId}>`,
                    `<${att.filename}>`,
                    `<${nameWithoutExt}>`
                ].filter(Boolean).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

                let replacementSrc: string
                if (att.data) {
                    replacementSrc = `data:${att.mimeType || 'application/octet-stream'};base64,${att.data}`
                } else {
                    replacementSrc = `/api/emails/${emailId}/attachments/${att.id}`
                }

                const cidRegex = new RegExp(`src=["'](?:${patterns.join('|')})["']`, 'gi')
                processed = processed.replace(cidRegex, `src="${replacementSrc}"`)
            })
        }

        processed = processed.replace(
            /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
            (match, beforeSrc, srcValue, afterSrc) => {
                const hasLoading = /loading=/i.test(beforeSrc + afterSrc)
                const hasDecoding = /decoding=/i.test(beforeSrc + afterSrc)
                const isHttp = /^https?:\/\//i.test(srcValue)

                if (isHttp) {
                    remoteImageCount += 1

                    if (!remoteImagesAllowed) {
                        return `<img ${beforeSrc}src="${transparentPixel}" data-remote-src="${encodeURIComponent(srcValue)}" data-remote-blocked="true" alt="Remote image blocked" ${hasLoading ? '' : 'loading="lazy" '} ${hasDecoding ? '' : 'decoding="async" '} ${afterSrc}>`
                    }

                    const proxiedSrc = `/api/proxy/image?url=${encodeURIComponent(srcValue)}`
                    return `<img ${beforeSrc}src="${proxiedSrc}" ${hasLoading ? '' : 'loading="lazy" '} ${hasDecoding ? '' : 'decoding="async" '} ${afterSrc}>`
                }

                if (srcValue.toLowerCase().startsWith('cid:')) {
                    const altMatch = (beforeSrc + afterSrc).match(/\balt=["']([^"']*)["']/i)
                    const label = altMatch ? altMatch[1] : 'Inline image unavailable'
                    const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    return `<span class="cid-placeholder" role="img" aria-label="${escaped}">${escaped}</span>`
                }

                return `<img ${beforeSrc}src="${srcValue}" ${hasLoading ? '' : 'loading="lazy" '} ${hasDecoding ? '' : 'decoding="async" '} ${afterSrc}>`
            }
        )

        // Hide tracking pixels (1x1 images)
        processed = processed.replace(
            /<img\s+([^>]*?)width=["']1["']\s*height=["']1["']([^>]*)>/gi,
            '<img $1width="1" height="1" style="display:none!important" $2>'
        )
        processed = processed.replace(
            /<img\s+([^>]*?)height=["']1["']\s*width=["']1["']([^>]*)>/gi,
            '<img $1height="1" width="1" style="display:none!important" $2>'
        )

        setBlockedRemoteCount(remoteImageCount)

        processed = processed.replace(
            /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi,
            (match, attrs, href) => {
                const isExternal = /^https?:\/\//i.test(href) && !href.includes(window.location.hostname)
                const hasTarget = /target=/i.test(attrs)

                let newAttrs = attrs
                if (!hasTarget) {
                    newAttrs += ' target="_blank" rel="noopener noreferrer"'
                }
                if (isExternal) {
                    newAttrs += ' data-external="true"'
                }
                return `<a ${newAttrs}>`
            }
        )

        // Collapse quoted history into a native <details> element. This MUST be
        // script-free: the email iframe is sandboxed WITHOUT allow-scripts (a
        // security requirement), so an onclick-based toggle would silently do
        // nothing — which is exactly why the old "[...]" button never opened.
        // <details>/<summary> expands natively with no JS.
        processed = processed.replace(
            /(<blockquote[^>]*>[\s\S]*?<\/blockquote>)/gi,
            '<details class="gmail-quote"><summary class="gmail-quote-toggle"></summary>$1</details>'
        )

        setProcessedContent(processed)
    }, [content, emailId, attachments, remoteImagesAllowed, isPlainTextContent])

    const waitForImages = (iframeDoc: Document): Promise<void> => {
        return new Promise((resolve) => {
            const images = iframeDoc.querySelectorAll('img')
            if (images.length === 0) {
                resolve()
                return
            }
            let loadedCount = 0
            const checkAllLoaded = () => {
                loadedCount++
                if (loadedCount === images.length) resolve()
            }
            images.forEach(img => {
                if (img.complete) checkAllLoaded()
                else {
                    img.onload = checkAllLoaded
                    img.onerror = checkAllLoaded
                }
            })
        })
    }

    const measureHeight = () => {
        const iframe = iframeRef.current
        if (!iframe) return
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
            if (!iframeDoc) return
            // Measure the BODY only: once the iframe is sized tall, documentElement
            // fills it and html.scrollHeight never shrinks back, which is what left
            // a large blank gap under short emails.
            const body = iframeDoc.body
            const contentHeight = body?.scrollHeight || iframeDoc.documentElement?.scrollHeight || 0
            const minHeight = 56
            setIframeHeight(Math.max(contentHeight + 16, minHeight))
        } catch (error) {
            console.error('Error updating iframe height:', error)
        }
    }

    // ---- Canvas theme -------------------------------------------------------
    // Light theme: unchanged behaviour (email renders on its authored paper).
    // Dark theme, adapted (default): colours are remapped onto the app surface.
    // Dark theme, "Original": the authored email on a white sheet, inset in the
    // card so it reads as a document rather than a blown-out panel.
    const adapt = isDark && !showOriginal
    const canvasBg = isDark ? surface : (isPlainTextContent ? surface : '#fafafa')
    const fallbackText = isDark ? DARK_INK : '#1f2937'
    const fallbackLink = isDark ? DARK_LINK : '#2563eb'
    const colorScheme = isDark ? 'dark' : 'light'
    const quoteText = isDark ? DARK_MUTED : '#718096'
    const quoteBorder = isDark ? 'rgba(255,255,255,0.20)' : '#cbd5e0'
    const quoteBtnBg = isDark ? 'rgba(255,255,255,0.10)' : '#e5e7eb'
    const quoteBtnText = isDark ? DARK_LINK : '#0b57d0'
    const shimmer = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'

    // Layout is normalised in both themes (absolute mastheads, baked-in heights,
    // fixed pixel widths); colour is remapped only when the canvas is dark.
    const bodyHtml = useMemo(
        () => prepareEmailHtml(processedContent, { dark: adapt }),
        [adapt, processedContent]
    )

    const iframeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root { color-scheme: ${colorScheme}; }
                * { box-sizing: border-box; }
                html, body { margin: 0; padding: 0; background: ${canvasBg}; }
                body {
                    padding: ${showOriginal && isDark ? '14px' : '24px'};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    color: ${fallbackText};
                    background: ${canvasBg};
                    -webkit-user-select: text;
                    user-select: text;
                }
                /* "Show original" sheet: authored email kept on paper, but inset and
                   rounded so it sits in the dark card instead of fighting it. */
                .sheet {
                    background: #ffffff;
                    color: #1f2937;
                    border-radius: 12px;
                    padding: 18px;
                    overflow: hidden;
                    box-shadow: 0 12px 28px rgba(0,0,0,0.45);
                }
                .email-body { max-width: 100%; }
                /* pre-wrap belongs to plain-text mail only. Applying it to HTML mail
                   turns every newline between tags into visible whitespace, which is
                   what made table-based emails render with huge random gaps. */
                .email-body.plain-text { white-space: pre-wrap; word-break: break-word; }
                .email-body > div:not([style]) { margin: 0 0 1em 0; }
                .email-body > div[style*="margin-left"] {
                    margin-left: 0 !important;
                    padding-left: 0 !important;
                    text-indent: 0 !important;
                }
                .email-body > p:not([style]) { margin: 0 0 1em 0; }
                .email-body > ul:not([style]), .email-body > ol:not([style]) { padding-left: 20px; margin: 0 0 1em 0; }
                img { border-radius: 6px; }
                ${EMAIL_FIT_CSS}
                td, th { padding: 2px 4px; }
                pre, code { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
                hr { border: 0; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.10)' : '#e5e7eb'}; }
                .cid-placeholder {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    min-height: 44px;
                    border: 1px dashed ${isDark ? 'rgba(255,255,255,0.18)' : '#d1d5db'};
                    background: ${isDark ? DARK_PANEL : '#f3f4f6'};
                    color: ${isDark ? DARK_MUTED : '#4b5563'};
                    border-radius: 8px;
                    font-size: 13px;
                    font-style: italic;
                    line-height: 1.4;
                    margin: 4px 0;
                }
                img[data-remote-blocked="true"] {
                    background: ${isDark
                        ? 'repeating-linear-gradient(45deg, #1B212B, #1B212B 10px, #232B36 10px, #232B36 20px)'
                        : 'repeating-linear-gradient(45deg, #f7f7f7, #f7f7f7 10px, #e5e5e5 10px, #e5e5e5 20px)'};
                    border: 1px dashed ${isDark ? 'rgba(255,255,255,0.18)' : '#c4c4c4'};
                    color: ${isDark ? DARK_MUTED : '#555'};
                    min-height: 48px;
                }
                a:not([style*="color"]) { color: ${fallbackLink}; }
                a:hover { text-decoration: underline; }
                a[data-external="true"]::after { content: " ↗"; font-size: 0.75em; opacity: 0.6; }
                blockquote:not([style*="border"]) {
                    margin: 0 0 1em 0;
                    padding-left: 12px;
                    border-left: 3px solid ${quoteBorder};
                    color: ${quoteText};
                }
                /* Native, script-free expandable quoted history (Gmail-style). */
                details.gmail-quote { margin: 10px 0; }
                summary.gmail-quote-toggle {
                    cursor: pointer;
                    list-style: none;
                    display: inline-flex;
                    align-items: center;
                    background: ${quoteBtnBg};
                    color: ${quoteBtnText};
                    border-radius: 6px;
                    padding: 3px 10px;
                    font-size: 12px;
                    font-weight: 500;
                    user-select: none;
                    transition: opacity .15s;
                }
                summary.gmail-quote-toggle:hover { opacity: 0.85; }
                summary.gmail-quote-toggle::-webkit-details-marker { display: none; }
                summary.gmail-quote-toggle::marker { content: ""; }
                summary.gmail-quote-toggle::after { content: "Show quoted text"; }
                details.gmail-quote[open] > summary.gmail-quote-toggle::after { content: "Hide quoted text"; }
                details.gmail-quote > blockquote { margin-top: 10px; }
            </style>
        </head>
        <body>
${showOriginal && isDark ? '<div class="sheet">' : ''}<div class="email-body${isPlainTextContent ? ' plain-text' : ''}">${bodyHtml}</div>${showOriginal && isDark ? '</div>' : ''}
        </body>
        </html>
    `

    // Auto-resize the iframe to its content.
    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe || !processedContent) return

        const loadingFallback = setTimeout(() => setLoading(false), 1500)
        const timer = setTimeout(measureHeight, 10)

        const scheduleAfterImages = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                if (!iframeDoc) return
                waitForImages(iframeDoc).then(() => {
                    measureHeight()
                    setLoading(false)
                })
            } catch {
                setLoading(false)
            }
        }
        const imagesTimer = setTimeout(scheduleAfterImages, 100)

        let resizeObserver: ResizeObserver | null = null
        const setupObserver = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                if (!iframeDoc?.body) return
                resizeObserver = new ResizeObserver(() => measureHeight())
                resizeObserver.observe(iframeDoc.body)
            } catch (error) {
                console.error('Error setting up ResizeObserver:', error)
            }
        }
        const observerTimer = setTimeout(setupObserver, 200)

        return () => {
            clearTimeout(timer)
            clearTimeout(imagesTimer)
            clearTimeout(observerTimer)
            clearTimeout(loadingFallback)
            resizeObserver?.disconnect()
        }
    }, [processedContent])

    // Write the email HTML into the iframe imperatively rather than via srcDoc:
    // srcDoc races the onLoad handler, which used to leave the frame invisible.
    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return
        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document
            if (!doc) return
            doc.open()
            doc.write(iframeHtml)
            doc.close()
            setLoading(false)
            requestAnimationFrame(measureHeight)
        } catch (error) {
            console.error('Error writing email iframe content:', error)
            setLoading(false)
        }
    }, [iframeHtml])

    // The revert control is only meaningful for styled HTML mail on a dark theme.
    const showThemeToggle = isDark && !isPlainTextContent && !!processedContent

    return (
        <div
            ref={containerRef}
            className={cn("email-content-viewer w-full overflow-hidden rounded-lg", className)}
            aria-busy={loading}
        >
            {blockedRemoteCount > 0 && !remoteImagesAllowed && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
                    <span>
                        <span className="font-medium">{blockedRemoteCount}</span> remote image{blockedRemoteCount === 1 ? '' : 's'} blocked for privacy.
                    </span>
                    <button
                        onClick={() => setRemoteImagesAllowed(true)}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-amber-700"
                    >
                        Load remote images
                    </button>
                </div>
            )}

            {showThemeToggle && (
                <div className="flex justify-end px-1 pb-2">
                    <button
                        type="button"
                        onClick={() => setShowOriginal(v => !v)}
                        className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground hover:border-foreground/25"
                        title={showOriginal ? "Adapt this email to the dark theme" : "Show the email as the sender designed it"}
                    >
                        {showOriginal ? "Adapt to dark" : "Original"}
                    </button>
                </div>
            )}

            <div className="relative overflow-hidden" style={{ background: canvasBg }}>
                {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col gap-3 p-6" style={{ background: canvasBg }}>
                        <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: shimmer }} />
                        <div className="h-3 w-11/12 rounded animate-pulse" style={{ background: shimmer, animationDelay: '80ms' }} />
                        <div className="h-3 w-5/6 rounded animate-pulse" style={{ background: shimmer, animationDelay: '160ms' }} />
                        <div className="h-3 w-3/5 rounded animate-pulse" style={{ background: shimmer, animationDelay: '240ms' }} />
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    sandbox="allow-same-origin"
                    className="w-full border-0 block"
                    style={{
                        height: `${iframeHeight}px`,
                        minHeight: '48px',
                        background: canvasBg,
                    }}
                    onLoad={() => {
                        measureHeight()
                        setLoading(false)
                    }}
                    title="Email content"
                />
            </div>
        </div>
    )
}
