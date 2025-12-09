"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import KnowledgeBaseManager from "@/components/knowledge-base"
import GuardrailsManager from "@/components/guardrails-manager"

export default function AISettings() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Card className="border border-border/80 shadow-sm bg-card/70">
        <CardHeader>
          <CardTitle>AI Customization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Manage Knowledge Base snippets and AI Guardrails in one place.</div>
          <div>KB: reusable snippets with tags; Guardrails: tone, rules, banned words, topic rules.</div>
        </CardContent>
      </Card>

      <GuardrailsManager />
      <KnowledgeBaseManager />
    </div>
  )
}

