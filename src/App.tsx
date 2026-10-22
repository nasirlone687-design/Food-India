/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './navigation/AppRoutes';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ErrorLogProvider, AppErrorBoundary } from './context/ErrorLogContext';
import { seedCategories, cleanAllTestDataFromApp, seedSubscriptionPlans } from './firebase/seed';
import {
  startBackgroundGpsTracking,
  loadSavedLiveGpsLocation,
  markSessionConfirmedGps,
  saveGpsLocationToFirestore,
  requestLiveGpsLocation,
} from './utils/gps';

import { APIProvider } from '@vis.gl/react-google-maps';

export default function App() {
  useEffect(() => {
    seedCategories().catch(console.error);
    cleanAllTestDataFromApp().catch(console.warn);
    seedSubscriptionPlans().catch(console.error);

    const saved = loadSavedLiveGpsLocation();
    if (saved) {
      saveGpsLocationToFirestore(saved).catch(() => {});
    }

    // Trigger native browser location popup immediately on app open
    requestLiveGpsLocation()
      .then((coords) => {
        markSessionConfirmedGps();
        saveGpsLocationToFirestore(coords).catch(() => {});
      })
      .catch(() => {});

    // Also trigger native browser location popup on first user gesture if not yet captured
    const triggerBrowserGpsOnGesture = () => {
      if (!loadSavedLiveGpsLocation()) {
        requestLiveGpsLocation()
          .then((coords) => {
            markSessionConfirmedGps();
            saveGpsLocationToFirestore(coords).catch(() => {});
          })
          .catch(() => {});
      }
      window.removeEventListener('click', triggerBrowserGpsOnGesture);
      window.removeEventListener('touchstart', triggerBrowserGpsOnGesture);
    };

    window.addEventListener('click', triggerBrowserGpsOnGesture, { once: true, passive: true });
    window.addEventListener('touchstart', triggerBrowserGpsOnGesture, { once: true, passive: true });

    const stopGps = startBackgroundGpsTracking((coords) => {
      saveGpsLocationToFirestore(coords).catch(() => {});
      markSessionConfirmedGps();
    });
    return () => {
      stopGps();
      window.removeEventListener('click', triggerBrowserGpsOnGesture);
      window.removeEventListener('touchstart', triggerBrowserGpsOnGesture);
    };
  }, []);

  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <AppErrorBoundary>
      <ErrorLogProvider>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <AuthProvider>
            <CartProvider>
              <BrowserRouter>
                <div className="min-h-screen bg-white">
                  <AppRoutes />
                </div>
              </BrowserRouter>
            </CartProvider>
          </AuthProvider>
        </APIProvider>
      </ErrorLogProvider>
    </AppErrorBoundary>
  );
}
