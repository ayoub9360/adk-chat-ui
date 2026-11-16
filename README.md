# ADK Chat

An independent chat interface for [Google ADK](https://adk.dev/) agents, built with Next.js, the AI SDK, and shadcn components. Adapted from the [shadcn chatbot template](https://github.com/shadcn-ui/chatbot-template).

The frontend communicates exclusively with the ADK server's HTTP API. No agent implementation, model, or domain-specific tool code is imported into this application. The interface is in English.

## Getting started

Requirements: Node.js 22.12 or later, pnpm 9 or later, and an agent exposed through a compatible ADK server.

After cloning the repository, run these commands from its root:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Configure `.env.local`:

```dotenv
ADK_API_URL=http://127.0.0.1:8000
ADK_APP_NAME=my_agent
```

`my_agent` is the application name exposed by the ADK server, usually the name of the Python directory containing `agent.py`. It does not necessarily match the name of `root_agent`, and it is not the model name. You can check it with `GET /list-apps` on the ADK server.

Start the server from the parent directory of your agent application:

```bash
adk api_server --host 127.0.0.1 --port 8000 .
```

This command assumes ADK and the agent's dependencies are installed in the agent's own Python environment. An `adk web` server exposing the same routes also works.

Then start the frontend:

```bash
pnpm dev --hostname 127.0.0.1 --port 3000
```

Open `http://localhost:3000` on the machine running the frontend. For a remote installation, use a tunnel or proxy appropriate for your environment. The addresses `localhost` and `127.0.0.1` refer to the machine or container running the relevant process.

For an optimized build:

```bash
pnpm build
pnpm start --hostname 127.0.0.1 --port 3000
```

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `ADK_APP_NAME` | Yes | ADK application name. There is no default agent. |
| `ADK_API_URL` | No | HTTP or HTTPS base URL reachable from the Next.js server. Defaults to `http://127.0.0.1:8000`. Proxy path prefixes are supported. |
| `ADK_API_TOKEN` | No | Bearer token, if required by a proxy in front of ADK. |

These variables stay on the server. Model provider keys remain in the agent project. No Vercel AI Gateway key is needed. Without `ADK_APP_NAME`, the page displays setup instructions and `/api/chat` returns HTTP 503. Restart the frontend after changing its configuration.

## Features and compatibility

| Feature | Supported |
| --- | --- |
| Text messages and SSE streaming responses | Yes |
| Markdown, code blocks, and copying | Yes |
| Tool calls with arbitrary names and outputs | Yes, without declaring tools in the frontend |
| JSON input and output details | Yes, expandable and copyable |
| Tool activity during generation | Yes, every call remains visible |
| Compact display after a response | Yes, an expandable group with the call count |
| Conversation context | Yes, managed by the ADK session |
| Custom tool presentation | Yes, optional and local to the frontend |
| Attachments, audio, video, and artifacts | No |
| Interactive approvals and long-running tool resumption | No |
| Listing and restoring conversations | No |
| Authentication and multi-user isolation | No |

The tested API contract is that of **ADK Python 2.14.1**, using:

- `GET /apps/{app}/users/{user}/sessions/{session}`;
- `POST /apps/{app}/users/{user}/sessions` with `sessionId`;
- `POST /run_sse`, with `appName`, `userId`, `sessionId`, `newMessage`, and `streaming`.

Other versions or servers may work if they follow this contract, but have not been tested. The agent controls which model and tools run. See the [ADK API server documentation](https://adk.dev/runtime/api-server/) for reference.

## Generic tool rendering

Unknown tools are displayed automatically with a readable name, a generic icon, and their raw data. Calls remain in arrival order, with any intervening text kept in place. The counter represents the number of calls, including repeated calls to the same tool.

ADK does not define a universal schema for domain-specific results. By default, the frontend distinguishes between "Running", "Result received", a transport "Error", and "Interrupted". It does not infer domain-specific success from an arbitrary `status` field.

To customize a tool, edit only the `tools` table in `lib/tool-config.ts`. For example, for a tool returning `{ ok: boolean, items: unknown[] }`:

```ts
import { SearchIcon, type LucideIcon } from "lucide-react"
import type { ToolPresentation } from "@/lib/tool-display"

const tools: Record<string, ToolPresentation & { icon?: LucideIcon }> = {
  lookup_records: {
    label: "Document search",
    icon: SearchIcon,
    summary(output) {
      if (!output || typeof output !== "object" || !("items" in output)) return
      if (!Array.isArray(output.items)) return
      return `${output.items.length} document(s)`
    },
    resultState(output) {
      if (!output || typeof output !== "object" || !("ok" in output)) return
      if (output.ok === true) return { status: "success", label: "Done" }
      if (output.ok === false) return { status: "warning", label: "Needs review" }
    },
  },
}
```

Keep the file's `getToolPresentation` function. All properties are optional. Presentation states are `running`, `success`, `warning`, `error`, `interrupted`, and `neutral`. Transport errors take precedence over domain-specific result rules. Customizations are trusted code compiled into the frontend and must not contain secrets.

## Sessions and usage

The browser calls `/api/chat` on Next.js, which creates or reuses an ADK session and forwards only the latest user message. No direct CORS access to ADK is needed. The conversation ID becomes the session ID, using the generic technical user `agent-local`.

Messages remain in the current page: reloading or clicking "New chat" starts a new session in the interface. Retention of previous sessions depends on the ADK server's storage. Stopping the stream does not guarantee cancellation of an action the agent has already executed.

This application is intended for personal use, locally or on a trusted network. It does not provide user sign-in, quotas, or per-session authorization. `ADK_API_TOKEN` can protect the proxy's access to ADK, but does not authenticate frontend visitors. Add these controls before providing shared public access.

## Testing

```bash
pnpm test
pnpm typecheck
pnpm build
```

Unit tests cover configuration, fragmented SSE decoding, UTF-8, partial and final responses, thought filtering, tool calls, errors, customizations, and message grouping.

The integration test uses a test agent included in `tests/fixtures/fixture_agent`. This agent is deterministic, requires no model or API key, and makes no external service calls during execution. It emits events for an `echo_message` tool, remembers a message, and produces text chunks.

With Python 3.11 or later and [uv](https://docs.astral.sh/uv/), start the test server from the repository root in a first terminal:

```bash
uv run --no-project --with-requirements tests/requirements-adk.txt adk api_server --host 127.0.0.1 --port 8010 tests/fixtures
```

In a second terminal, start the frontend with the fixture settings:

```bash
ADK_API_URL=http://127.0.0.1:8010 ADK_APP_NAME=fixture_agent pnpm dev --hostname 127.0.0.1 --port 3010
```

In a third terminal:

```bash
ADK_CHAT_TEST_URL=http://127.0.0.1:3010 pnpm test
```

The test checks the UI protocol, tool events, the absence of duplicated text, context across two turns, and HTTP validation. Without `ADK_CHAT_TEST_URL`, it is skipped. The initial dependency download requires network access.

## Project structure

- `app/api/chat/route.ts`: HTTP validation, sessions, and the ADK proxy.
- `lib/adk-config.ts`: server configuration validation.
- `lib/adk-stream.ts`: ADK SSE conversion to the AI SDK protocol.
- `lib/tool-display.ts`: generic states and grouping.
- `lib/tool-config.ts`: optional tool customization.
- `components/parts/tool-trace.tsx`: shadcn rendering of tool calls.
- `tests/fixtures/`: independent ADK test agent.

## License and origin

MIT license. The [LICENSE](LICENSE) file preserves the attribution of the original [shadcn-ui/chatbot-template](https://github.com/shadcn-ui/chatbot-template).
