import type { Metadata } from "next"

import { getAdkConfig } from "@/lib/adk-config"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Chat } from "@/components/chat"

export const metadata: Metadata = {
  title: "ADK Chat",
  description: "A chat interface for a Google ADK agent.",
}

export const dynamic = "force-dynamic"

export default function Page() {
  let config
  try {
    config = getAdkConfig(process.env)
  } catch (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <Alert>
          <AlertTitle>Configure your ADK agent</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    )
  }
  return <Chat agentName={config.appName} />
}
