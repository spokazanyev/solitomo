// Shim для тестов: реальный @payload-config грузит весь Payload runtime,
// что не нужно (и медленно) в unit-тестах. Возвращаем empty promise — code,
// который реально требует Payload runtime, должен быть mocked отдельно.
//
// Used via vitest.config.ts resolve.alias.
export default Promise.resolve({});
