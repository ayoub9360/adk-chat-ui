import type { UIMessage } from "ai"

export type ChatUIMessage = UIMessage
export type TextMessagePart = Extract<
  ChatUIMessage["parts"][number],
  { type: "text" }
>
