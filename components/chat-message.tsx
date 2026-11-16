"use client"

import { groupMessageParts } from "@/lib/tool-display"
import { ToolTrace } from "@/components/parts/tool-trace"
import type { ChatUIMessage } from "@/lib/chat"
import { MessageActions } from "@/components/message-actions"
import { TextPart } from "@/components/parts/text-part"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"

export function ChatMessage({
  message,
  isStreaming = false,
}: {
  message: ChatUIMessage
  isStreaming?: boolean
}) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>{text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }
  return (
    <Message align="start">
      <MessageContent>
        {groupMessageParts(message.parts).map((block, index) =>
          block.type === "text" ? (
            <TextPart key={`text-${index}`} part={block.part} />
          ) : (
            <ToolTrace
              key={block.parts[0].toolCallId}
              parts={block.parts}
              isStreaming={isStreaming}
            />
          )
        )}
        {!isStreaming && text && <MessageActions text={text} />}
      </MessageContent>
    </Message>
  )
}
