// vite-plugin-pwa's virtual:pwa-register/react module only exists inside
// Vite's own build pipeline (it's generated, not a real file). Jest runs
// outside Vite, so jest.config.cts maps the import to this stand-in.
const noop = (): void => undefined;

export function useRegisterSW() {
  return {
    needRefresh: [false, noop] as [boolean, (v: boolean) => void],
    offlineReady: [false, noop] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => undefined,
  };
}
