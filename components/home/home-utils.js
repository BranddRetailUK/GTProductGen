export function stagger(index, options = {}) {
  const delayMs = options.delayMs ?? 90;
  const durationMs = options.durationMs;
  return {
    animationDelay: `${index * delayMs}ms`,
    ...(typeof durationMs === "number" ? { animationDuration: `${durationMs}ms` } : {})
  };
}
