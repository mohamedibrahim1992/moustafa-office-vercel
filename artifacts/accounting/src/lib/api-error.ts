export function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { status?: number; data?: { error?: string } };
  if (anyErr?.data?.error) return anyErr.data.error;
  return fallback;
}

export function getErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}
