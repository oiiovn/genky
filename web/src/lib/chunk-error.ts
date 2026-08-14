const KEY = "genky_chunk_reload";

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError" ||
    /loading chunk \d+ failed/i.test(message) ||
    /failed to load chunk/i.test(message)
  );
}

export function reloadOnceOnChunkError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  if (sessionStorage.getItem(KEY)) return false;
  sessionStorage.setItem(KEY, "1");
  window.location.reload();
  return true;
}
