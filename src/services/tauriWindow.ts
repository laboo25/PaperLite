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
    await appWindow.minimize();
  } catch (err) {
    console.info('Tauri minimize fallback/info:', err);
  }
}

/**
 * Toggle maximize / restore for the Tauri desktop window.
 */
export async function toggleMaximizeWindow(): Promise<boolean> {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    return await appWindow.isMaximized();
  } catch (err) {
    console.info('Tauri toggleMaximize fallback/info:', err);
    // Browser fallback
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      await document.exitFullscreen().catch(() => {});
      return false;
    }
  }
}

/**
 * Check whether the Tauri desktop window is currently maximized.
 */
export async function isWindowMaximized(): Promise<boolean> {
  try {
    const appWindow = getCurrentWindow();
    return await appWindow.isMaximized();
  } catch {
    return !!document.fullscreenElement;
  }
}

/**
 * Close the Tauri desktop window and terminate the app session.
 */
export async function closeWindow(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  } catch (err) {
    console.info('Tauri close fallback/info:', err);
    window.close();
  }
}

/**
 * Initiate window dragging when clicking and moving the title bar.
 */
export async function startDraggingWindow(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  } catch {
    // Ignored in standard browser mode
  }
}
