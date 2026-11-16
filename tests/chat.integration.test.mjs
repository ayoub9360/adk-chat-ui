import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { readUIMessageStream } from "ai"

const baseUrl = process.env.ADK_CHAT_TEST_URL

// Run against tests/fixtures/fixture_agent, not a model-backed user agent.
test("ADK fixture: tools, partial text, session memory and HTTP validation", { skip: !baseUrl, timeout: 30000 }, async () => {
  const page = await fetch(baseUrl)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /ADK Chat/)
  const id = randomUUID()
  const marker = `message-${randomUUID()}`
  const messages = []

  async function send(text) {
    messages.push({ id: randomUUID(), role: "user", parts: [{ type: "text", text }] })
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, messages, trigger: "submit-message" }),
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type"), /text\/event-stream/)
    const raw = await response.text()
    const chunks = raw.split(/\r?\n/)
      .filter(line => line.startsWith("data: ") && line !== "data: [DONE]")
      .map(line => JSON.parse(line.slice(6)))
    assert.equal(chunks.some(chunk => chunk.type === "error"), false, raw)
    assert.ok(chunks.filter(chunk => chunk.type === "text-delta").length >= 2)
    assert.equal(chunks.at(-1).type, "finish")
    const stream = new ReadableStream({ start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    } })
    let final
    for await (const message of readUIMessageStream({ stream, terminateOnError: true })) final = message
    assert.ok(final)
    messages.push(final)
    return final
  }

  const first = await send(`remember: ${marker}`)
  const call = first.parts.find(part => part.type === "dynamic-tool" && part.toolName === "echo_message")
  assert.ok(call, "Expected the fixture's generic echo tool")
  assert.equal(call.state, "output-available")
  assert.deepEqual(call.input, { message: marker })
  assert.deepEqual(call.output, { status: "success", message: marker })
  const messageText = message => message.parts.filter(part => part.type === "text").map(part => part.text).join("")
  assert.equal(messageText(first), `Stored: ${marker}`)

  const second = await send("recall")
  assert.equal(messageText(second), marker)
  assert.equal(second.parts.some(part => part.type === "dynamic-tool"), false)
  const invalid = await fetch(`${baseUrl}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })
  assert.equal(invalid.status, 400)
})
