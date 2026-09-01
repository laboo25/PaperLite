// Safe Tauri v2 Window Controls Service

export async function isTauriEnvironment(): Promise<boolean> {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export async function minimizeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  } catch (err) {
    console.info('Tauri minimize not available in browser mode:', err);
  }
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    return await appWindow.isMaximized();
  } catch (err) {
    console.info('Tauri toggleMaximize not available in browser mode:', err);
    // Fallback: toggle browser fullscreen
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      await document.exitFullscreen().catch(() => {});
      return false;
    }
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    return await appWindow.isMaximized();
  } catch {
    return !!document.fullscreenElement;
  }
}

export async function closeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.close();
  } catch (err) {
    console.info('Tauri close not available in browser mode:', err);
    window.close();
  }
}

export async function startDraggingWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  } catch {
    // Ignored in browser
  }
}
