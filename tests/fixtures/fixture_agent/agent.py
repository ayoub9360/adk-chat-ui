"""Deterministic ADK fixture: streaming, tool events and session state, no LLM."""

from collections.abc import AsyncGenerator
from uuid import uuid4

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai import types


def echo_message(message: str) -> dict[str, str]:
    return {"status": "success", "message": message}


class FixtureAgent(BaseAgent):
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        text = "".join(part.text or "" for part in ctx.user_content.parts or [])
        if text == "recall":
            reply = ctx.session.state.get("stored_message", "No message stored.")
        else:
            message = text.removeprefix("remember:").strip()
            call_id = str(uuid4())
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(function_call=types.FunctionCall(
                        id=call_id, name="echo_message", args={"message": message}
                    ))],
                ),
            )
            result = echo_message(message)
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                content=types.Content(
                    role="user",
                    parts=[types.Part(function_response=types.FunctionResponse(
                        id=call_id, name="echo_message", response=result
                    ))],
                ),
                actions=EventActions(state_delta={"stored_message": message}),
            )
            reply = f"Stored: {message}"

        event_id = str(uuid4())
        midpoint = len(reply) // 2
        for fragment in (reply[:midpoint], reply[midpoint:]):
            yield Event(
                id=event_id,
                invocation_id=ctx.invocation_id,
                author=self.name,
                partial=True,
                content=types.Content(role="model", parts=[types.Part(text=fragment)]),
            )
        yield Event(
            id=event_id,
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(role="model", parts=[types.Part(text=reply)]),
        )


root_agent = FixtureAgent(name="fixture_agent", description="Local integration test fixture.")
