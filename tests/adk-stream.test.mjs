import assert from "node:assert/strict"
import { test } from "node:test"
import { forwardAdkEvents, readAdkEvents } from "../lib/adk-stream.ts"

function stream(events) {
  return new Blob([events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join("")]).stream()
}

test("SSE handles fragmented UTF-8, CRLF, comments and a final unterminated frame", async () => {
  const bytes = new TextEncoder().encode(': ping\r\n\r\ndata: {"author":"test-🚀"}\r\n\r\ndata: {"author":"end"}')
  const body = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
    controller.close()
  } })
  const result = []
  for await (const event of readAdkEvents(body)) result.push(event)
  assert.deepEqual(result, [{ author: "test-🚀" }, { author: "end" }])
})

test("partial and final ADK events produce one response without duplicate text", async () => {
  const chunks = []
  await forwardAdkEvents(stream([
    { partial: true, content: { parts: [{ text: "Hel" }] } },
    { partial: true, content: { parts: [{ text: "lo" }] } },
    { content: { parts: [{ text: "Hello!" }] } },
    { content: { parts: [{ text: "Second response." }] } },
  ]), chunk => chunks.push(chunk))
  assert.equal(chunks.filter(c => c.type === "text-delta").map(c => c.delta).join(""), "Hello!Second response.")
  assert.equal(chunks.filter(c => c.type === "text-start").length, 2)
  assert.equal(chunks.filter(c => c.type === "text-end").length, 2)
})

test("thoughts and user echoes stay private, tools preserve their call IDs and results", async () => {
  const chunks = []
  await forwardAdkEvents(stream([
    { author: "user", content: { parts: [{ text: "question" }] } },
    { content: { parts: [{ thought: true, text: "reasoning" }] } },
    { content: { parts: [{ functionCall: { id: "call-1", name: "echo_message", args: { text: "Hello" } } }] } },
    { content: { parts: [{ functionResponse: { id: "call-1", name: "echo_message", response: { found: true } } }] } },
    { content: { parts: [{ text: "Hello" }] } },
  ]), chunk => chunks.push(chunk))
  assert.deepEqual(chunks[0], { type: "tool-input-available", toolCallId: "call-1", toolName: "echo_message", input: { text: "Hello" }, dynamic: true })
  assert.equal(chunks[1].type, "tool-output-available")
  assert.equal(chunks.filter(c => c.type === "text-delta").map(c => c.delta).join(""), "Hello")
})

for (const event of [{ error: "failure" }, { errorCode: "MODEL_ERROR", errorMessage: "secret details" }]) {
  test(`ADK stream errors propagate safely (${Object.keys(event)[0]})`, async () => {
    await assert.rejects(forwardAdkEvents(stream([event]), () => {}), /error/)
  })
}

test("a broken stream closes the active text segment and cancels its reader", async () => {
  const chunks = []
  await assert.rejects(forwardAdkEvents(stream([
    { partial: true, content: { parts: [{ text: "Start" }] } },
    { error: "failure" },
  ]), chunk => chunks.push(chunk)))
  assert.equal(chunks.at(-1).type, "text-end")
})
