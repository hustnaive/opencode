export class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM stream inactive for ${timeoutMs / 1000}s`)
    this.name = "StreamTimeoutError"
  }
}

export type TimeoutControl = { paused: boolean }

export async function* withActivityTimeout<T>(
  iterable: AsyncIterable<T>,
  timeoutMs: number,
  control?: TimeoutControl,
): AsyncGenerator<T> {
  const iterator = iterable[Symbol.asyncIterator]()
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout>
      const result = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          // When paused (e.g. waiting for user input), disable timeout
          const effectiveTimeout = control?.paused ? 24 * 60 * 60 * 1000 : timeoutMs
          timer = setTimeout(
            () => reject(new StreamTimeoutError(timeoutMs)),
            effectiveTimeout,
          )
          if (typeof timer === "object" && "unref" in timer) timer.unref()
        }),
      ]).finally(() => clearTimeout(timer!))
      if (result.done) return
      yield result.value
    }
  } finally {
    await iterator.return?.()?.catch?.(() => {})
  }
}
