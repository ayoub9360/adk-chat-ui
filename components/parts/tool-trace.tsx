"use client"

import { useState } from "react"
import { getToolPresentation } from "@/lib/tool-config"
import {
  CheckIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
  SquareIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react"

import {
  getToolDisplay,
  type ToolPart,
  type ToolStatus,
} from "@/lib/tool-display"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

const statusIcons = {
  running: LoaderCircleIcon,
  error: CircleAlertIcon,
  warning: TriangleAlertIcon,
  interrupted: SquareIcon,
  success: CheckIcon,
  neutral: CircleDashedIcon,
}

function ToolStatusIcon({ status }: { status: ToolStatus }) {
  const Icon = statusIcons[status]
  return (
    <Icon
      className={
        status === "running"
          ? "animate-spin motion-reduce:animate-none"
          : undefined
      }
    />
  )
}

function ToolJson({
  title,
  value,
  error = false,
}: {
  title: string
  value: unknown
  error?: boolean
}) {
  const text = JSON.stringify(value, null, 2) ?? "No data"
  return (
    <CodeBlock size="sm" variant={error ? "destructive" : "default"}>
      <CodeBlockHeader>
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={text} aria-label={`Copy ${title}`} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent className="max-h-64" wrap aria-label={title}>
        {text}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function ToolCall({
  part,
  isStreaming,
}: {
  part: ToolPart
  isStreaming: boolean
}) {
  const presentation = getToolPresentation(part.toolName)
  const display = getToolDisplay(part, isStreaming, presentation)
  const [open, setOpen] = useState<boolean | undefined>(undefined)
  const isError = display.status === "error"
  const ToolIcon = presentation.icon ?? WrenchIcon
  return (
    <TraceCollapsible open={open ?? isError} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger className="w-full items-start py-1">
        <TraceLine
          status={
            display.status === "running"
              ? "running"
              : isError
                ? "error"
                : undefined
          }
          className="w-full flex-wrap gap-x-2 gap-y-1"
        >
          <TraceIcon>
            <ToolIcon />
          </TraceIcon>
          <TraceTitle className="flex-1 text-left" title={display.title}>
            {display.title}
          </TraceTitle>
          <span
            className={`flex items-center gap-1 text-xs ${display.status === "warning" ? "text-amber-700 dark:text-amber-400" : ""}`}
          >
            <TraceIcon className="size-3.5">
              <ToolStatusIcon status={display.status} />
            </TraceIcon>
            {display.label}
          </span>
          {display.summary && (
            <span
              className="w-full truncate pl-6 text-left text-xs text-muted-foreground"
              title={display.summary}
            >
              {display.summary}
            </span>
          )}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="space-y-3">
        <p className="font-mono text-xs">{part.toolName}</p>
        {display.message && (
          <p className={isError ? "text-sm text-destructive" : "text-sm"}>
            {display.message}
          </p>
        )}
        {part.state === "output-available" && (
          <ToolJson title="Result" value={part.output} error={isError} />
        )}
        {part.state === "output-error" && (
          <ToolJson title="Error" value={part.errorText} error />
        )}
        {part.input !== undefined && (
          <ToolJson title="Parameters" value={part.input} />
        )}
        {display.status === "running" && (
          <p className="text-xs">Waiting for the result…</p>
        )}
        {display.status === "interrupted" && (
          <p className="text-xs">
            No result was received before the stream was interrupted.
          </p>
        )}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

export function ToolTrace({
  parts,
  isStreaming,
}: {
  parts: ToolPart[]
  isStreaming: boolean
}) {
  const [open, setOpen] = useState(false)
  const displays = parts.map((part) =>
    getToolDisplay(part, isStreaming, getToolPresentation(part.toolName))
  )
  const running = displays.filter(
    (display) => display.status === "running"
  ).length
  const errors = displays.filter((display) => display.status === "error").length
  const warnings = displays.filter(
    (display) => display.status === "warning"
  ).length
  const interrupted = displays.filter(
    (display) => display.status === "interrupted"
  ).length
  const status = errors
    ? "error"
    : running
      ? "running"
      : warnings
        ? "warning"
        : interrupted
          ? "interrupted"
          : "neutral"
  const calls = (
    <Trace>
      {parts.map((part) => (
        <ToolCall key={part.toolCallId} part={part} isStreaming={isStreaming} />
      ))}
    </Trace>
  )
  const grouped = !isStreaming
  const summary = [
    running && `${running} running`,
    errors && `${errors} failed`,
    warnings && `${warnings} to review`,
    interrupted && `${interrupted} interrupted`,
  ]
    .filter(Boolean)
    .join(", ")
  return (
    <Trace>
      <TraceCollapsible open={!grouped || open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger
          hidden={!grouped}
          className={grouped ? "py-1" : "hidden"}
        >
          <TraceLine
            status={errors ? "error" : running ? "running" : undefined}
            className="flex-wrap"
          >
            <TraceIcon>
              <ToolStatusIcon status={status} />
            </TraceIcon>
            <TraceTitle>
              {parts.length} {parts.length === 1 ? "tool used" : "tools used"}
              {summary ? `, ${summary}` : ""}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent
          className={grouped ? undefined : "m-0 border-0 p-0"}
        >
          {calls}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
