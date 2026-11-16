import type { ChatUIMessage } from "./chat"

export type ToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: "dynamic-tool" }
>
export type ToolStatus =
  "running" | "success" | "warning" | "error" | "interrupted" | "neutral"

export type ToolPresentation = {
  label?: string
  summary?: (output: unknown) => string | undefined
  resultState?: (
    output: unknown
  ) => { status: ToolStatus; label: string } | undefined
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function getToolDisplay(
  part: ToolPart,
  isStreaming: boolean,
  presentation: ToolPresentation = {}
) {
  const output = record(part.output)
  const title = presentation.label ?? part.toolName.replace(/[_-]+/g, " ")
  let state: { status: ToolStatus; label: string }
  if (part.state === "output-error") {
    state = { status: "error", label: "Error" }
  } else if (part.state === "output-denied") {
    state = { status: "neutral", label: "Denied" }
  } else if (
    part.state === "approval-requested" ||
    part.state === "approval-responded"
  ) {
    state = { status: "warning", label: "Approval required" }
  } else if (part.state !== "output-available") {
    state = isStreaming
      ? { status: "running", label: "Running" }
      : { status: "interrupted", label: "Interrupted" }
  } else {
    // Tool outputs have no universal business-status schema in ADK.
    state = presentation.resultState?.(part.output) ?? {
      status: "neutral",
      label: "Result received",
    }
  }
  const message =
    part.state === "output-error"
      ? part.errorText
      : typeof output.message === "string"
        ? output.message
        : undefined
  const summary =
    part.state === "output-available"
      ? presentation.summary?.(part.output)
      : undefined
  return { title, ...state, summary, message }
}

export type MessageBlock =
  | {
      type: "text"
      part: Extract<ChatUIMessage["parts"][number], { type: "text" }>
    }
  | { type: "tools"; parts: ToolPart[] }

export function groupMessageParts(
  parts: ChatUIMessage["parts"]
): MessageBlock[] {
  const blocks: MessageBlock[] = []
  let tools: ToolPart[] | undefined
  for (const part of parts) {
    if (part.type === "dynamic-tool") {
      if (!tools) {
        tools = []
        blocks.push({ type: "tools", parts: tools })
      }
      tools.push(part)
    } else if (part.type !== "step-start") {
      tools = undefined
      if (part.type === "text") blocks.push({ type: "text", part })
    }
  }
  return blocks
}
