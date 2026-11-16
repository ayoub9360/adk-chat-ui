import type { LucideIcon } from "lucide-react"

import type { ToolPresentation } from "@/lib/tool-display"

// Optional presentation overrides, keyed by the exact ADK tool name.
// Unknown tools work without configuration. See README for an example.
const tools: Record<string, ToolPresentation & { icon?: LucideIcon }> = {}

export function getToolPresentation(name: string) {
  return Object.hasOwn(tools, name) ? tools[name] : {}
}
