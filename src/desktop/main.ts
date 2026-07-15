import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";

import {
  startDashboard,
  type DashboardServer,
} from "../interface/dashboard-server.js";
import { createRuntime, type Runtime } from "../runtime.js";
import { errorMessage } from "../shared/errors.js";
import { WorkerService } from "../worker/worker-service.js";

let mainWindow: BrowserWindow | null = null;
let runtime: Runtime | null = null;
let dashboard: DashboardServer | null = null;
let worker: WorkerService | null = null;
let quitting = false;

app.setName("MoneyPrinter");
app.setAppUserModelId("com.kaio.moneyprinter");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => focusMainWindow());
  app.on("activate", () => {
    if (mainWindow === null && dashboard !== null) {
      mainWindow = createMainWindow(dashboard.url);
    } else {
      focusMainWindow();
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
  app.on("before-quit", (event) => {
    if (quitting) {
      return;
    }
    event.preventDefault();
    quitting = true;
    void shutdown().finally(() => app.exit(0));
  });

  void app.whenReady().then(startApplication).catch(handleStartupFailure);
}

async function startApplication(): Promise<void> {
  process.env.MPV2_DATA_DIRECTORY ??= join(app.getPath("userData"), "data");
  installApplicationMenu();

  runtime = createRuntime();
  dashboard = await startDashboard(runtime, {
    port: 0,
    assetDirectory: app.isPackaged
      ? join(process.resourcesPath, "interface-web")
      : fileURLToPath(new URL("../interface-web", import.meta.url)),
  });
  worker = new WorkerService(runtime);
  void worker.start().catch((error: unknown) => {
    runtime?.logger.fatal({ error }, "Embedded worker crashed");
    if (!quitting) {
      dialog.showErrorBox(
        "MoneyPrinter worker stopped",
        `${errorMessage(error)}\n\nRestart MoneyPrinter to resume background jobs.`,
      );
    }
  });

  mainWindow = createMainWindow(dashboard.url);
}

function createMainWindow(applicationUrl: string): BrowserWindow {
  const applicationOrigin = new URL(applicationUrl).origin;
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: "#f5f4ef",
    title: "MoneyPrinter",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 17 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      navigateOnDragDrop: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!hasOrigin(url, applicationOrigin)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  void window.loadURL(applicationUrl);
  return window;
}

function openExternalUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      void shell.openExternal(url.href);
    }
  } catch {
    // Ignore malformed URLs from untrusted page content.
  }
}

function hasOrigin(value: string, expectedOrigin: string): boolean {
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function focusMainWindow(): void {
  if (mainWindow === null) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function installApplicationMenu(): void {
  app.setAboutPanelOptions({
    applicationName: "MoneyPrinter",
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: "Licensed under AGPL-3.0",
  });
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" as const }]
      : [{ role: "fileMenu" as const }]),
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function shutdown(): Promise<void> {
  const activeWindow = mainWindow;
  const activeWorker = worker;
  const activeDashboard = dashboard;
  const activeRuntime = runtime;
  mainWindow = null;
  worker = null;
  dashboard = null;
  runtime = null;

  if (activeWindow !== null && !activeWindow.isDestroyed()) {
    activeWindow.destroy();
  }
  try {
    await activeWorker?.stop("application-quit");
  } catch (error) {
    activeRuntime?.logger.error({ error }, "Could not stop embedded worker");
  }
  try {
    await activeDashboard?.close();
  } catch (error) {
    activeRuntime?.logger.error({ error }, "Could not stop dashboard server");
  }
  activeRuntime?.close();
}

async function handleStartupFailure(error: unknown): Promise<void> {
  dialog.showErrorBox("MoneyPrinter could not start", errorMessage(error));
  quitting = true;
  await shutdown();
  app.exit(1);
}
