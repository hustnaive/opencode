export class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM stream inactive for ${timeoutMs / 1000}s`)
    this.name = "StreamTimeoutError"
  }
}

export async function* withActivityTimeout<T>(
  iterable: AsyncIterable<T>,
  timeoutMs: number,
): AsyncGenerator<T> {
  const iterator = iterable[Symbol.asyncIterator]()
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout>
      const result = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new StreamTimeoutError(timeoutMs)),
            timeoutMs,
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
