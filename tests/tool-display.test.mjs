import assert from "node:assert/strict"
import { test } from "node:test"
import { getToolDisplay, groupMessageParts } from "../lib/tool-display.ts"

const tool = (output, fields = {}) => ({ type: "dynamic-tool", toolName: "lookup_records", toolCallId: "call-1", input: { query: "example" }, state: "output-available", output, ...fields })

test("transport errors are errors, received outputs have no assumed business schema", () => {
  for (const output of [null, "result", 42, [], { status: "error" }, { status: "custom" }, { status: "constructor" }]) {
    const display = getToolDisplay(tool(output), false)
    assert.equal(display.label, "Result received")
    assert.equal(display.status, "neutral")
    assert.equal(display.summary, undefined)
  }
  const display = getToolDisplay(tool(undefined, { state: "output-error", errorText: "Service unavailable" }), false)
  assert.equal(display.status, "error")
  assert.equal(display.message, "Service unavailable")
})

test("pending tools follow the stream while received outputs stay complete", () => {
  assert.equal(getToolDisplay(tool(undefined, { state: "input-available" }), true).status, "running")
  assert.equal(getToolDisplay(tool(undefined, { state: "input-available" }), false).status, "interrupted")
  assert.equal(getToolDisplay(tool({}), true).label, "Result received")
  assert.equal(getToolDisplay(tool(undefined, { state: "output-denied" }), false).label, "Denied")
})

test("unknown tool names are readable and cannot resolve prototype properties", () => {
  assert.equal(getToolDisplay(tool({}), false).title, "lookup records")
  assert.equal(getToolDisplay(tool({}, { toolName: "constructor" }), false).title, "constructor")
})

test("optional presentation overrides control labels, summaries and business states", () => {
  const config = {
    label: "Document search",
    summary: output => `${output.items.length} documents`,
    resultState: output => output.ok ? { status: "success", label: "Completed" } : { status: "warning", label: "Needs review" },
  }
  const success = getToolDisplay(tool({ ok: true, items: [{}, {}] }), false, config)
  assert.equal(success.title, "Document search")
  assert.equal(success.summary, "2 documents")
  assert.equal(success.status, "success")
  assert.equal(getToolDisplay(tool({ ok: false, items: [] }), false, config).status, "warning")
  assert.equal(getToolDisplay(tool(undefined, { state: "output-error" }), false, config).status, "error")
  assert.equal(getToolDisplay(tool(undefined, { state: "input-available" }), true, config).summary, undefined)
})

test("groups preserve text positions, parallel calls and IDs across step markers", () => {
  const first = tool({})
  const second = tool({}, { toolCallId: "call-2" })
  const text = { type: "text", text: "Intermediate text" }
  const third = tool({}, { toolCallId: "call-3" })
  const groups = groupMessageParts([first, { type: "step-start" }, second, text, third])
  assert.deepEqual(groups.map(group => group.type), ["tools", "text", "tools"])
  assert.deepEqual(groups[0].parts.map(part => part.toolCallId), ["call-1", "call-2"])
  assert.equal(groups[1].part, text)
  assert.deepEqual(groups[2].parts, [third])
  assert.deepEqual(groupMessageParts([first, { type: "source-url", sourceId: "source-1", url: "https://example.com" }, second]).map(group => group.parts.length), [1, 1])
})
