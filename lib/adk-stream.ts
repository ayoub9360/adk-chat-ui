import type { UIMessageChunk } from "ai"

type AdkPart = {
  text?: string
  thought?: boolean
  functionCall?: { id?: string; name: string; args?: unknown }
  functionResponse?: { id?: string; name: string; response?: unknown }
}
export type AdkEvent = {
  author?: string
  partial?: boolean
  error?: string
  errorCode?: string
  errorMessage?: string
  content?: { parts?: AdkPart[] }
}

// SSE frames can span network chunks, use CRLF, and contain multiple data lines.
export async function* readAdkEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n")
        if (data && data !== "[DONE]") yield JSON.parse(data) as AdkEvent
      }
      if (done) {
        const data = buffer
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
        if (data && data !== "[DONE]") yield JSON.parse(data) as AdkEvent
        break
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function forwardAdkEvents(
  body: ReadableStream<Uint8Array>,
  write: (chunk: UIMessageChunk) => void
) {
  let textId: string | undefined
  let partialText = ""
  const calls = new Map<string, string>()
  const closeText = () => {
    if (textId) write({ type: "text-end", id: textId })
    textId = undefined
    partialText = ""
  }
  try {
    for await (const event of readAdkEvents(body)) {
      if (event.error || event.errorCode || event.errorMessage) {
        throw new Error(
          "The ADK agent returned an error. Check the ADK server logs."
        )
      }
      if (event.author === "user") continue
      const parts = event.content?.parts ?? []
      const text = parts
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("")
      if (text) {
        if (!textId) {
          textId = crypto.randomUUID()
          write({ type: "text-start", id: textId })
        }
        if (!event.partial && partialText && !text.startsWith(partialText)) {
          throw new Error(
            "The final ADK text does not match the received fragments."
          )
        }
        // ADK repeats the accumulated partial text in its final event.
        const delta = event.partial
          ? text
          : text.startsWith(partialText)
            ? text.slice(partialText.length)
            : partialText
              ? ""
              : text
        if (delta) write({ type: "text-delta", id: textId, delta })
        if (event.partial) partialText += text
      }
      if (!event.partial) closeText()
      for (const part of parts) {
        if (part.functionCall && !event.partial) {
          const call = part.functionCall
          const id = call.id ?? crypto.randomUUID()
          calls.set(id, call.name)
          write({
            type: "tool-input-available",
            toolCallId: id,
            toolName: call.name,
            input: call.args ?? {},
            dynamic: true,
          })
        }
        if (part.functionResponse) {
          const result = part.functionResponse
          const id =
            result.id ??
            [...calls].find(([, name]) => name === result.name)?.[0]
          if (id && calls.has(id)) {
            write({
              type: "tool-output-available",
              toolCallId: id,
              output: result.response ?? {},
              dynamic: true,
            })
            calls.delete(id)
          }
        }
      }
    }
  } finally {
    closeText()
  }
}
