import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ConnectScreen } from "./components/ConnectScreen";
import { HAProvider, useHA } from "./context/HAContext";
import { AutomationsPage } from "./pages/AutomationsPage";
import { CamerasPage } from "./pages/CamerasPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SensorsPage } from "./pages/SensorsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VoicePage } from "./pages/VoicePage";

function AppRoutes() {
  const { status, connect, error } = useHA();

  if (status !== "connected" && status !== "connecting") {
    return <ConnectScreen onConnect={connect} error={error} />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="cameras" element={<CamerasPage />} />
        <Route path="sensors" element={<SensorsPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HAProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HAProvider>
  );
}
