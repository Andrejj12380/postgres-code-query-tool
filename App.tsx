
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ConnectionsManager from './components/ConnectionsManager';
import ProductsManager from './components/ProductsManager';
import { ViewMode, DbConnection, Product } from './types';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const controllerPort = params.get('controllerPort');
    if (!controllerPort) return;

    const baseUrl = `http://127.0.0.1:${controllerPort}`;
    let shutdownSent = false;
    const controllerHeaders: HeadersInit = {
      'Content-Type': 'text/plain'
    };

    const post = async (path: string, body: string, keepalive = false) => {
      try {
        await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          body,
          headers: controllerHeaders,
          keepalive,
          mode: 'cors',
          cache: 'no-store',
          credentials: 'omit'
        });
      } catch (err) {
        // Swallow network errors – launcher will handle missing heartbeat
        console.warn('Controller request failed', err);
      }
    };

    const sendPing = () => {
      if (shutdownSent) return;
      post('/ping', 'ping', false);
    };

    const sendShutdown = () => {
      if (shutdownSent) return;
      shutdownSent = true;
      if (navigator.sendBeacon) {
        const blob = new Blob(['bye'], { type: 'text/plain' });
        navigator.sendBeacon(`${baseUrl}/shutdown`, blob);
      } else {
        post('/shutdown', 'bye', true);
      }
    };

    // Initial ping + periodic heartbeat
    sendPing();
    const heartbeatId = window.setInterval(sendPing, 5000);

    const handleBeforeUnload = () => {
      window.clearInterval(heartbeatId);
      sendShutdown();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.clearInterval(heartbeatId);
    };
  }, []);

  // Load data from server settings (fallback to localStorage if server unavailable)
  useEffect(() => {
    let cancelled = false;
    let retryTimeout: number | null = null;

    const attemptLoad = async (delayMs = 250) => {
      if (cancelled) return;
      try {
        const resp = await fetch('/api/settings', { cache: 'no-store' });
        if (!resp.ok) {
          throw new Error(`Failed to load settings: ${resp.status}`);
        }
        const json = await resp.json();
        if (cancelled) return;
        setConnections(json.connections || []);
        setProducts(json.products || []);
        setIsInitialized(true);
      } catch (e) {
        if (cancelled) return;
        console.warn('Cannot load settings from server, retrying…', e);
        const nextDelay = Math.min(delayMs * 1.5, 5000);
        retryTimeout = window.setTimeout(() => attemptLoad(nextDelay), nextDelay);
      }
    };

    attemptLoad();

    return () => {
      cancelled = true;
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, []);

  // Save data to server settings and localStorage when it changes (but only after initial load)
  useEffect(() => {
    if (!isInitialized) return;

    const save = async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connections, products })
        });
      } catch (e) {
        console.warn('Cannot persist settings to server', e);
      }
    };

    save();
  }, [connections, products, isInitialized]);

  const renderContent = () => {
    switch (activeView) {
      case ViewMode.DASHBOARD:
        return <Dashboard connections={connections} products={products} />;
      case ViewMode.CONNECTIONS:
        return <ConnectionsManager connections={connections} setConnections={setConnections} />;
      case ViewMode.PRODUCTS:
        return <ProductsManager products={products} setProducts={setProducts} />;
      default:
        return <Dashboard connections={connections} products={products} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
