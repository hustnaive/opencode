import { semver } from "bun"
import { text } from "node:stream/consumers"
import { Log } from "../util/log"
import { Process } from "../util/process"

export namespace PackageRegistry {
  const log = Log.create({ service: "bun" })

  function which() {
    return process.execPath
  }

  const INFO_TIMEOUT_MS = 15_000

  export async function info(pkg: string, field: string, cwd?: string): Promise<string | null> {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), INFO_TIMEOUT_MS)
    const result = Process.spawn([which(), "info", pkg, field], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      abort: abort.signal,
      env: {
        ...process.env,
        BUN_BE_BUN: "1",
      },
    })

    try {
      const code = await result.exited
      const stdout = result.stdout ? await text(result.stdout) : ""
      const stderr = result.stderr ? await text(result.stderr) : ""

      if (code !== 0) {
        log.warn("bun info failed", { pkg, field, code, stderr })
        return null
      }

      const value = stdout.trim()
      if (!value) return null
      return value
    } catch (err) {
      log.warn("bun info timed out or aborted", { pkg, field })
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  export async function isOutdated(pkg: string, cachedVersion: string, cwd?: string): Promise<boolean> {
    const latestVersion = await info(pkg, "version", cwd)
    if (!latestVersion) {
      log.warn("Failed to resolve latest version, using cached", { pkg, cachedVersion })
      return false
    }

    const isRange = /[\s^~*xX<>|=]/.test(cachedVersion)
    if (isRange) return !semver.satisfies(latestVersion, cachedVersion)

    return semver.order(cachedVersion, latestVersion) === -1
  }
}
