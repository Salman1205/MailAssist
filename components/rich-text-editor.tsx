"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Image as ImageIcon, Paperclip, Code, Highlighter, Type } from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  minHeight?: string
  onAttachments?: (files: { id: string; name: string; type: string; size: number; data: string }[]) => void
  className?: string
}

const toPlainText = (html: string) => {
  if (!html) return ""
  const tmp = typeof window !== "undefined" ? document.createElement("div") : null
  if (!tmp) return html
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ""
}

const applyCommand = (command: string, value?: string) => {
  if (typeof document === "undefined") return
  document.execCommand(command, false, value)
}

export default function RichTextEditor({ value, onChange, placeholder = "Type your message...", minHeight = "200px", onAttachments, className = "" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const linkDialogRef = useRef<HTMLDivElement | null>(null)
  
  const [linkInputOpen, setLinkInputOpen] = useState(false)
  const [linkInputValue, setLinkInputValue] = useState("")
  const [linkTextValue, setLinkTextValue] = useState("")
  const [linkHasSelection, setLinkHasSelection] = useState(false)
  const [linkDialogPosition, setLinkDialogPosition] = useState<{ top: number; left: number } | null>(null)
  const [savedRange, setSavedRange] = useState<Range | null>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || ""
    const text = toPlainText(html)
    onChange(html, text)
  }

  const execAndSync = (fn: () => void) => {
    fn()
    handleInput()
  }

  const handleInsertLink = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    
    const range = sel.getRangeAt(0)
    setSavedRange(range)
    
    const selectedText = range.toString().trim()
    setLinkHasSelection(Boolean(selectedText))
    setLinkTextValue(selectedText)
    
    const rect = range.getBoundingClientRect()
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (editorRect) {
      setLinkDialogPosition({
        top: rect.top - editorRect.top - 80,
        left: rect.left - editorRect.left
      })
    }
    
    setLinkInputOpen(true)
    setLinkInputValue("")
  }

  const applyLink = () => {
    if (!linkInputValue.trim()) return
    
    editorRef.current?.focus()
    
    if (savedRange) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedRange)
      }
    }
    
    const url = linkInputValue.startsWith('http') ? linkInputValue : `https://${linkInputValue}`
    
    if (linkHasSelection) {
      execAndSync(() => applyCommand('createLink', url))
    } else {
      const displayText = linkTextValue.trim() || url
      execAndSync(() => {
        const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${displayText}</a>`
        applyCommand('insertHTML', linkHtml)
      })
    }
    
    setLinkInputOpen(false)
    setLinkInputValue("")
    setLinkTextValue("")
    setLinkDialogPosition(null)
    setSavedRange(null)
  }

  useEffect(() => {
    if (!linkInputOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (linkDialogRef.current && !linkDialogRef.current.contains(e.target as Node)) {
        setLinkInputOpen(false)
        setLinkInputValue("")
        setLinkTextValue("")
        setLinkDialogPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [linkInputOpen])

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || !onAttachments) return
    
    const attachmentArray: { id: string; name: string; type: string; size: number; data: string }[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      
      await new Promise((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          attachmentArray.push({
            id: `${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64
          })
          resolve(null)
        }
        reader.readAsDataURL(file)
      })
    }
    
    onAttachments(attachmentArray)
  }

  const toggleHeading = () => {
    execAndSync(() => {
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const node = sel.anchorNode?.parentElement
      if (node?.tagName === 'H3') {
        applyCommand('formatBlock', 'p')
      } else {
        applyCommand('formatBlock', 'h3')
      }
    })
  }

  const makeListFromSelection = (ordered: boolean) => {
    execAndSync(() => applyCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList'))
  }

  const handleClearFormatting = () => {
    execAndSync(() => applyCommand('removeFormat'))
  }

  const handleEditorShortcut = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b') { e.preventDefault(); execAndSync(() => applyCommand('bold')); return }
      if (e.key === 'i') { e.preventDefault(); execAndSync(() => applyCommand('italic')); return }
      if (e.key === 'u') { e.preventDefault(); execAndSync(() => applyCommand('underline')); return }
      if (e.key === 'k') { e.preventDefault(); handleInsertLink(); return }
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1 items-center bg-muted/40 border border-border rounded-lg px-2 py-1.5">
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('bold'))} aria-label="Bold"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('italic'))} aria-label="Italic"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('underline'))} aria-label="Underline"><Underline className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('strikeThrough'))} aria-label="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={toggleHeading} aria-label="Heading"><Type className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('hiliteColor', '#fef08a'))} aria-label="Highlight"><Highlighter className="w-3.5 h-3.5 text-amber-500" /></button>
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => makeListFromSelection(false)} aria-label="Bullet list"><List className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => makeListFromSelection(true)} aria-label="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('formatBlock', 'blockquote'))} aria-label="Quote"><Quote className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('formatBlock', 'pre'))} aria-label="Code block"><Code className="w-3.5 h-3.5" /></button>
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('justifyLeft'))} aria-label="Align left"><AlignLeft className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('justifyCenter'))} aria-label="Align center"><AlignCenter className="w-3.5 h-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => execAndSync(() => applyCommand('justifyRight'))} aria-label="Align right"><AlignRight className="w-3.5 h-3.5" /></button>
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={handleInsertLink} aria-label="Insert link"><LinkIcon className="w-3.5 h-3.5" /></button>
        {onAttachments && (
          <>
            <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => imageInputRef.current?.click()} aria-label="Inline image"><ImageIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent" onClick={() => fileInputRef.current?.click()} aria-label="Attach file"><Paperclip className="w-3.5 h-3.5" /></button>
          </>
        )}
        
        <div className="w-px h-5 bg-border mx-0.5" />
        
        <button type="button" onMouseDown={(e) => e.preventDefault()} className="h-7 px-2.5 inline-flex items-center justify-center rounded hover:bg-accent text-xs font-medium" onClick={handleClearFormatting} aria-label="Clear formatting">Clear</button>
      </div>

      {onAttachments && (
        <>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleAttachFiles(e.target.files)} />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAttachFiles(e.target.files)} />
        </>
      )}

      <div className="relative">
        {linkInputOpen && linkDialogPosition && (
          <div
            ref={linkDialogRef}
            className="absolute z-50 bg-popover border border-border rounded-md p-1.5 shadow-md text-xs"
            style={{
              top: `${linkDialogPosition.top}px`,
              left: `${linkDialogPosition.left}px`,
              minWidth: '280px',
              maxWidth: '320px'
            }}
          >
            <div className="space-y-1">
              {linkHasSelection && linkTextValue && (
                <div className="text-[9px] text-muted-foreground px-1 pb-0.5">
                  <span className="font-medium">Selected:</span> "{linkTextValue}"
                </div>
              )}
              <Input
                value={linkInputValue}
                onChange={(e) => setLinkInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && linkInputValue.trim()) {
                    e.preventDefault()
                    applyLink()
                  } else if (e.key === 'Escape') {
                    setLinkInputOpen(false)
                    setLinkInputValue("")
                    setLinkTextValue("")
                    setLinkDialogPosition(null)
                  }
                }}
                placeholder="URL"
                className="h-7 text-xs px-2"
              />
              {!linkHasSelection && (
                <Input
                  value={linkTextValue}
                  onChange={(e) => setLinkTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && linkInputValue.trim()) {
                      e.preventDefault()
                      applyLink()
                    } else if (e.key === 'Escape') {
                      setLinkInputOpen(false)
                      setLinkInputValue("")
                      setLinkTextValue("")
                      setLinkDialogPosition(null)
                    }
                  }}
                  placeholder="Text (optional)"
                  className="h-7 text-xs px-2"
                />
              )}
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={applyLink} disabled={!linkInputValue.trim()} className="flex-1 h-6 text-[11px] px-2">
                  Insert
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setLinkInputOpen(false); setLinkInputValue(""); setLinkTextValue(""); setLinkDialogPosition(null) }} className="h-6 text-[11px] px-2">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleEditorShortcut}
          className="w-full overflow-y-auto p-4 border-2 border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 prose prose-sm max-w-none"
          style={{ minHeight }}
          aria-label="Rich text editor"
        />
      </div>
    </div>
  )
}
