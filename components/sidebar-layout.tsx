"use client"

import { useState, ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface SidebarLayoutProps {
  children: ReactNode
  defaultCollapsed?: boolean
  width?: {
    collapsed: string
    expanded: string
  }
}

/**
 * Reusable sidebar layout component with collapse/expand functionality.
 * Provides a smooth transition between collapsed (icons only) and expanded (full labels) states.
 * Inspired by Gorgias and Linear design patterns.
 */
export function useSidebarState(defaultCollapsed = true) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  
  return {
    isCollapsed,
    toggleCollapse: () => setIsCollapsed(!isCollapsed),
    setCollapsed: setIsCollapsed,
  }
}

export default function SidebarLayout({
  children,
  defaultCollapsed = true,
  width = { collapsed: "w-20", expanded: "w-60" },
}: SidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  return (
    <aside
      className={`
        hidden md:flex flex-col h-screen bg-card border-r border-border
        transition-all duration-300 ease-out
        ${isCollapsed ? width.collapsed : width.expanded}
      `}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {typeof children === "function"
          ? (children as any)({ isCollapsed })
          : children}
      </div>

      {/* Toggle button - positioned at bottom */}
      <div className="flex-shrink-0 flex items-center justify-center p-3 border-t border-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="
            h-10 w-10 flex items-center justify-center rounded-lg
            text-muted-foreground hover:bg-secondary hover:text-foreground
            transition-all duration-200 ease-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  )
}
