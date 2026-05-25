// Shim для тестового окружения: реальный "server-only" блокирует client-side imports,
// но в тестах это безопасно. Vitest подменяет через alias.
export {};
