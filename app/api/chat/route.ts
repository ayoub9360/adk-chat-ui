import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { z } from "zod"

import { getAdkConfig } from "@/lib/adk-config"
import { forwardAdkEvents } from "@/lib/adk-stream"

export const maxDuration = 300

const requestSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  trigger: z.literal("submit-message").optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(
          z
            .object({ type: z.string(), text: z.string().optional() })
            .passthrough()
        ),
      })
    )
    .min(1)
    .max(1000),
})

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null))
  const last = parsed.success ? parsed.data.messages.at(-1) : undefined
  const text = last?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim()
  if (
    !parsed.success ||
    last?.role !== "user" ||
    !text ||
    text.length > 32000
  ) {
    return Response.json(
      { error: "Invalid message (maximum 32,000 characters)." },
      { status: 400 }
    )
  }

  let config
  try {
    config = getAdkConfig(process.env)
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 503 })
  }
  const { baseUrl, appName, token } = config
  const userId = "agent-local"
  const sessionId = parsed.data.id
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const sessionsPath = `${baseUrl}/apps/${encodeURIComponent(appName)}/users/${userId}/sessions`
  const options = { headers, signal: req.signal, cache: "no-store" as const }

  try {
    const session = await fetch(
      `${sessionsPath}/${encodeURIComponent(sessionId)}`,
      options
    )
    if (session.status === 404) {
      const created = await fetch(sessionsPath, {
        ...options,
        method: "POST",
        body: JSON.stringify({ sessionId, state: {} }),
      })
      if (!created.ok)
        throw new Error(
          `Could not create the ADK session (HTTP ${created.status}).`
        )
    } else if (!session.ok) {
      throw new Error(
        `Could not access the ADK session (HTTP ${session.status}).`
      )
    }

    const upstream = await fetch(`${baseUrl}/run_sse`, {
      ...options,
      method: "POST",
      body: JSON.stringify({
        appName,
        userId,
        sessionId,
        newMessage: { role: "user", parts: [{ text }] },
        streaming: true,
      }),
    })
    if (!upstream.ok || !upstream.body) {
      throw new Error(`Could not run the ADK agent (HTTP ${upstream.status}).`)
    }
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start", messageId: crypto.randomUUID() })
        await forwardAdkEvents(upstream.body!, (chunk) => writer.write(chunk))
        writer.write({ type: "finish" })
      },
      onError: () =>
        "The ADK stream was interrupted. Check the ADK server and start a new chat if needed.",
    })
    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 })
    const message =
      error instanceof TypeError
        ? "Could not reach the ADK API. Check ADK_API_URL and start the ADK server."
        : error instanceof Error
          ? error.message
          : "ADK connection error."
    return Response.json({ error: message }, { status: 502 })
  }
}
