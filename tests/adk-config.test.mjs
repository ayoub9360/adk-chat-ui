import assert from "node:assert/strict"
import { test } from "node:test"
import { getAdkConfig } from "../lib/adk-config.ts"

test("an explicit application name is required, without any domain default", () => {
  for (const env of [{}, { ADK_APP_NAME: "  " }]) {
    assert.throws(() => getAdkConfig(env), /ADK_APP_NAME/)
  }
  assert.deepEqual(getAdkConfig({ ADK_APP_NAME: " my_agent " }), {
    appName: "my_agent", baseUrl: "http://127.0.0.1:8000", token: undefined,
  })
})

test("configuration preserves proxy path prefixes and trims optional tokens", () => {
  assert.deepEqual(getAdkConfig({ ADK_APP_NAME: "custom_app", ADK_API_URL: "https://example.com/adk/", ADK_API_TOKEN: " example-token " }), {
    appName: "custom_app", baseUrl: "https://example.com/adk", token: "example-token",
  })
})

test("invalid configuration errors do not echo credentials or URLs", () => {
  for (const url of ["invalid", "ftp://example.com", "https://example:example@example.com", "https://example.com?token=example", "https://example.com#example"]) {
    assert.throws(() => getAdkConfig({ ADK_APP_NAME: "my_agent", ADK_API_URL: url }), error => {
      assert.match(error.message, /ADK_API_URL/)
      assert.equal(error.message.includes("example.com"), false)
      return true
    })
  }
})
