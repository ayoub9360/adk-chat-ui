export function getAdkConfig(env: Record<string, string | undefined>) {
  const appName = env.ADK_APP_NAME?.trim()
  if (!appName) {
    throw new Error(
      "Set ADK_APP_NAME in .env.local to the name of your ADK application."
    )
  }
  let url: URL
  try {
    url = new URL(env.ADK_API_URL?.trim() || "http://127.0.0.1:8000")
  } catch {
    throw new Error("ADK_API_URL must be a valid HTTP or HTTPS URL.")
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "ADK_API_URL must be an HTTP or HTTPS URL without credentials, query parameters or a fragment. Use ADK_API_TOKEN for a Bearer token."
    )
  }
  return {
    appName,
    baseUrl: url.toString().replace(/\/$/, ""),
    token: env.ADK_API_TOKEN?.trim(),
  }
}
