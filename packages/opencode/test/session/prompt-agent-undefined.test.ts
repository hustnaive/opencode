import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("session.prompt agent undefined handling", () => {
  test("does not crash when agent name does not exist in config", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        // Pass a non-existent agent name — this triggers the crash:
        //   prompt.ts createUserMessage(): Agent.get("nonexistent") returns undefined
        //   then `agent.model` throws "undefined is not an object"
        const msg = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "nonexistent-agent",
          noReply: true,
          parts: [{ type: "text", text: "hello" }],
        })

        // After fix: should fall back to default agent and create a valid user message
        if (msg.info.role !== "user") throw new Error("expected user message")
        expect(msg.info.model).toBeDefined()
        expect(msg.info.model.providerID).toBeDefined()
        expect(msg.info.model.modelID).toBeDefined()

        await Session.remove(session.id)
      },
    })
  })

  test("does not crash when agent is undefined (not provided)", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        // No agent specified — should use defaultAgent() fallback
        const msg = await SessionPrompt.prompt({
          sessionID: session.id,
          noReply: true,
          parts: [{ type: "text", text: "hello" }],
        })

        if (msg.info.role !== "user") throw new Error("expected user message")
        expect(msg.info.model).toBeDefined()

        await Session.remove(session.id)
      },
    })
  })
})
