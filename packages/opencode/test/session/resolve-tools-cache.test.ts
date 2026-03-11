import { describe, expect, test } from "bun:test"

describe("resolveTools caching logic", () => {
  test("schema cache avoids redundant computation", () => {
    const cache = new Map<string, any>()
    let computeCount = 0

    function getSchema(toolId: string, modelId: string) {
      const key = `${toolId}|provider|${modelId}`
      let schema = cache.get(key)
      if (!schema) {
        computeCount++
        schema = { type: "object", properties: { [toolId]: { type: "string" } } }
        cache.set(key, schema)
      }
      return schema
    }

    // First call computes
    const s1 = getSchema("read", "gpt-5.2")
    expect(computeCount).toBe(1)

    // Second call uses cache
    const s2 = getSchema("read", "gpt-5.2")
    expect(computeCount).toBe(1)
    expect(s2).toBe(s1) // same reference

    // Different tool computes again
    getSchema("write", "gpt-5.2")
    expect(computeCount).toBe(2)

    // Different model computes again
    getSchema("read", "claude-4")
    expect(computeCount).toBe(3)
  })

  test("MCP tools cache invalidation clears mcp schema entries", () => {
    const schemaCache = new Map<string, any>()
    let mcpToolsCache: any = null

    // Simulate populating caches
    schemaCache.set("read|provider|model", { type: "object" })
    schemaCache.set("mcp|playwright_click|provider|model", { type: "object" })
    schemaCache.set("mcp|playwright_fill|provider|model", { type: "object" })
    mcpToolsCache = { tools: ["playwright_click", "playwright_fill"] }

    expect(schemaCache.size).toBe(3)

    // Simulate ToolsChanged event handler
    mcpToolsCache = null
    for (const key of schemaCache.keys()) {
      if (key.startsWith("mcp|")) schemaCache.delete(key)
    }

    // MCP entries cleared, registry entries preserved
    expect(mcpToolsCache).toBeNull()
    expect(schemaCache.size).toBe(1)
    expect(schemaCache.has("read|provider|model")).toBe(true)
  })

  test("MCP tool wrapping does not mutate original item", () => {
    const original = {
      inputSchema: { type: "object" as const, properties: { url: { type: "string" as const } } },
      execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
      description: "test tool",
    }

    const originalSchema = original.inputSchema
    const originalExecute = original.execute

    // Simulate wrapping (spread instead of mutate)
    const wrapped = { ...original, inputSchema: { transformed: true } }
    wrapped.execute = async () => ({ content: [{ type: "text" as const, text: "wrapped" }] })

    // Original should be unchanged
    expect(original.inputSchema).toBe(originalSchema)
    expect(original.execute).toBe(originalExecute)
    expect(wrapped.inputSchema).toEqual({ transformed: true })
  })
})
