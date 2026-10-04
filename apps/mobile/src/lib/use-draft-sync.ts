import type { WorkspaceSummary } from '@paytsek/contracts';
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { reportHealth, restoreCollectorFilters } from './collector';
import { syncWorkspace } from './sync-coordinator';

/** Foreground reconnect/resume retries supplement durable SQLite; no startup ledger fetch. */
export function useDraftSync(workspace: WorkspaceSummary | null) {
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive && workspace && AppState.currentState === 'active' && onlineManager.isOnline()) {
        void syncWorkspace(workspace).catch(() => { /* Keep saved proofs; expose retry through sync status. */ });
      }
    };
    const applyNetwork = (state: Network.NetworkState) => {
      if (!alive) return;
      onlineManager.setOnline(state.isConnected === true && state.isInternetReachable !== false);
      run();
    };
    const health = () => {
      if (Platform.OS === 'android') void restoreCollectorFilters().then(reportHealth).catch(() => undefined);
    };
    focusManager.setFocused(AppState.currentState === 'active');
    if (AppState.currentState === 'active') health();
    void Network.getNetworkStateAsync().then(applyNetwork).catch(run);
    const network = Network.addNetworkStateListener(applyNetwork);
    const app = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
      if (state === 'active') { health(); run(); }
    });
    // Retries are bounded, foreground-only and idle without pending drafts.
    const retry = setInterval(run, 60_000);
    return () => { alive = false; clearInterval(retry); network.remove(); app.remove(); };
  }, [workspace]);
}
