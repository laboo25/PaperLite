import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Check if the application is running inside a Tauri container.
 */
export async function isTauriEnvironment(): Promise<boolean> {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Minimize the Tauri desktop window.
 */
export async function minimizeWindow(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    if (appWindow && typeof appWindow.minimize === 'function') {
      await appWindow.minimize();
      return;
    }
  } catch (err) {
    console.info('Tauri minimize fallback/info:', err);
  }

  if (typeof window !== 'undefined') {
    const tWindow = (window as any).__TAURI__?.window;
    if (tWindow?.getCurrentWindow) {
      try {
        await tWindow.getCurrentWindow().minimize();
        return;
      } catch {}
    }
    if (tWindow?.appWindow?.minimize) {
      try {
        await tWindow.appWindow.minimize();
        return;
      } catch {}
    }
  }
}

/**
 * Toggle maximize / restore for the Tauri desktop window.
 */
export async function toggleMaximizeWindow(): Promise<boolean> {
  try {
    const appWindow = getCurrentWindow();
    if (appWindow && typeof appWindow.toggleMaximize === 'function') {
      await appWindow.toggleMaximize();
      return await appWindow.isMaximized();
    }
  } catch (err) {
    console.info('Tauri toggleMaximize fallback/info:', err);
  }

  if (typeof window !== 'undefined') {
    const tWindow = (window as any).__TAURI__?.window;
    if (tWindow?.getCurrentWindow) {
      try {
        const cur = tWindow.getCurrentWindow();
        await cur.toggleMaximize();
        return await cur.isMaximized();
      } catch {}
    }
    if (tWindow?.appWindow?.toggleMaximize) {
      try {
        await tWindow.appWindow.toggleMaximize();
        return await tWindow.appWindow.isMaximized();
      } catch {}
    }

    // Browser fullscreen fallback
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      await document.exitFullscreen().catch(() => {});
      return false;
    }
  }
  return false;
}

/**
 * Check whether the Tauri desktop window is currently maximized.
 */
export async function isWindowMaximized(): Promise<boolean> {
  try {
    const appWindow = getCurrentWindow();
    if (appWindow && typeof appWindow.isMaximized === 'function') {
      return await appWindow.isMaximized();
    }
  } catch {
    // fallback
  }

  if (typeof window !== 'undefined') {
    const tWindow = (window as any).__TAURI__?.window;
    if (tWindow?.getCurrentWindow) {
      try {
        return await tWindow.getCurrentWindow().isMaximized();
      } catch {}
    }
    if (tWindow?.appWindow?.isMaximized) {
      try {
        return await tWindow.appWindow.isMaximized();
      } catch {}
    }
    return !!document.fullscreenElement;
  }
  return false;
}

/**
 * Close the Tauri desktop window and terminate the app session.
 */
export async function closeWindow(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    if (appWindow && typeof appWindow.close === 'function') {
      await appWindow.close();
      return;
    }
  } catch (err) {
    console.info('Tauri close fallback/info:', err);
  }

  if (typeof window !== 'undefined') {
    const tWindow = (window as any).__TAURI__?.window;
    if (tWindow?.getCurrentWindow) {
      try {
        await tWindow.getCurrentWindow().close();
        return;
      } catch {}
    }
    if (tWindow?.appWindow?.close) {
      try {
        await tWindow.appWindow.close();
        return;
      } catch {}
    }
    window.close();
  }
}

/**
 * Initiate window dragging when clicking and moving the title bar / control bar.
 */
export async function startDraggingWindow(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    if (appWindow && typeof appWindow.startDragging === 'function') {
      await appWindow.startDragging();
      return;
    }
  } catch {
    // fallback
  }

  if (typeof window !== 'undefined') {
    const tWindow = (window as any).__TAURI__?.window;
    if (tWindow?.getCurrentWindow) {
      try {
        await tWindow.getCurrentWindow().startDragging();
        return;
      } catch {}
    }
    if (tWindow?.appWindow?.startDragging) {
      try {
        await tWindow.appWindow.startDragging();
        return;
      } catch {}
    }
  }
}

