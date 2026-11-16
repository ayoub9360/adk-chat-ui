"use client"

import { useChat } from "@ai-sdk/react"

import { type ChatUIMessage } from "@/lib/chat"
import { ChatMessage } from "@/components/chat-message"
import { PromptForm } from "@/components/prompt-form"
import { StatusIcon } from "@/components/status-icon"
import { Suggestions } from "@/components/suggestions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"

export function Chat({ agentName }: { agentName: string }) {
  const { messages, sendMessage, status, stop, error } =
    useChat<ChatUIMessage>()

  const isBusy = status === "submitted" || status === "streaming"

  const lastMessage = messages.at(-1)

  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chat with your agent</EmptyTitle>
              <EmptyDescription>
                Connected agent: {agentName}. Ask a question to start a
                conversation.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Suggestions
                onSelect={(prompt) => sendMessage({ text: prompt })}
              />
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-6">
                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <ChatMessage
                      message={message}
                      isStreaming={isBusy && message.id === lastMessage?.id}
                    />
                  </MessageScrollerItem>
                ))}
                {status === "submitted" && (
                  <MessageScrollerItem messageId="thinking">
                    <Message>
                      <MessageContent>
                        <Trace>
                          <TraceLine status="running">
                            <TraceIcon>
                              <StatusIcon status="running" />
                            </TraceIcon>
                            <TraceTitle>Generating response</TraceTitle>
                          </TraceLine>
                        </Trace>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-6 pb-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <PromptForm
          agentName={agentName}
          isBusy={isBusy}
          onSubmit={(text) => sendMessage({ text })}
          onStop={() => stop()}
        />
      </div>
    </div>
  )
}
