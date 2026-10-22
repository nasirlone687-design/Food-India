import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  googleMapsUrl: string;
  capturedAt: string;
  source?: 'device_gps' | 'saved_cache';
  fallbackWarning?: string;
}

export interface PostalLookupResult {
  pincode: string;
  state: string;
  district: string;
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  address?: string;
  googleMapsUrl: string;
}

const LIVE_GPS_STORAGE_KEY = 'food_india_live_gps';
const DEVICE_LOCATION_ID_KEY = 'food_india_device_loc_id';
const SESSION_GPS_CONFIRMED_KEY = 'food_india_session_gps_confirmed';
let backgroundWatchId: number | null = null;

export function getOrCreateDeviceLocationId(): string {
  try {
    let existing = localStorage.getItem(DEVICE_LOCATION_ID_KEY);
    if (!existing) {
      existing = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_LOCATION_ID_KEY, existing);
    }
    return existing;
  } catch {
    return 'dev_default_web';
  }
}

export function hasSessionConfirmedGps(): boolean {
  try {
    const saved = loadSavedLiveGpsLocation();
    return Boolean(saved && sessionStorage.getItem(SESSION_GPS_CONFIRMED_KEY) === 'true');
  } catch {
    return false;
  }
}

export function markSessionConfirmedGps(): void {
  try {
    sessionStorage.setItem(SESSION_GPS_CONFIRMED_KEY, 'true');
  } catch {
    // ignore
  }
}

/**
 * Checks whether a coordinate pair is a legacy hardcoded fake coordinate.
 */
export function isLegacyFakeCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
  if (lat === 0 && lng === 0) return true;
  return (
    (Math.abs(lat - 28.6139) < 0.0008 && Math.abs(lng - 77.209) < 0.0008) ||
    (Math.abs(lat - 28.6315) < 0.0008 && Math.abs(lng - 77.2167) < 0.0008) ||
    (Math.abs(lat - 19.076) < 0.0008 && Math.abs(lng - 72.8777) < 0.0008)
  );
}

/**
 * Saves live GPS coordinates and auto-filled pincode/state/city/district to Firestore
 * (`deviceLocations/{deviceId}`, `users/{uid}`, `customers/{uid}`, and if seller, `sellers/{uid}` & `restaurants/{restId}`).
 */
export async function saveGpsLocationToFirestore(
  coords: GpsCoordinates,
  extra?: { phone?: string; uid?: string; role?: string; restaurantId?: string }
): Promise<void> {
  if (!coords || isLegacyFakeCoordinate(coords.latitude, coords.longitude)) return;

  try {
    const deviceId = getOrCreateDeviceLocationId();
    const uid = extra?.uid || auth.currentUser?.uid || null;
    const googleMapsUrl =
      coords.googleMapsUrl || getGoogleMapsCoordUrl(coords.latitude, coords.longitude);

    const liveGpsRecord = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      ...(coords.accuracy !== undefined ? { accuracy: coords.accuracy } : {}),
      address: coords.address,
      ...(coords.locality ? { locality: coords.locality } : {}),
      ...(coords.city ? { city: coords.city } : {}),
      ...(coords.district ? { district: coords.district } : {}),
      ...(coords.state ? { state: coords.state } : {}),
      ...(coords.pincode ? { pincode: coords.pincode, postalCode: coords.pincode } : {}),
      googleMapsUrl,
      source: 'device_gps' as const,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(
      doc(db, 'deviceLocations', deviceId),
      {
        deviceId,
        ...(uid ? { uid } : {}),
        ...(extra?.phone ? { phone: extra.phone } : {}),
        ...liveGpsRecord,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (uid) {
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          ...(extra?.phone ? { phone: extra.phone } : {}),
          ...(coords.pincode ? { pincode: coords.pincode } : {}),
          ...(coords.city ? { city: coords.city } : {}),
          ...(coords.district ? { district: coords.district } : {}),
          ...(coords.state ? { state: coords.state } : {}),
          liveGps: liveGpsRecord,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const isSellerContext =
        extra?.role === 'seller' ||
        (typeof window !== 'undefined' && window.location.pathname.startsWith('/seller'));

      if (isSellerContext) {
        const restId = extra?.restaurantId || `rest_${uid}`;
        await setDoc(
          doc(db, 'sellers', uid),
          {
            uid,
            sellerId: uid,
            ...(extra?.phone ? { phone: extra.phone, businessPhone: extra.phone } : {}),
            latitude: coords.latitude,
            longitude: coords.longitude,
            googleMapsLink: googleMapsUrl,
            ...(coords.address ? { address: coords.address } : {}),
            ...(coords.city ? { city: coords.city } : {}),
            ...(coords.district ? { district: coords.district } : {}),
            ...(coords.state ? { state: coords.state } : {}),
            ...(coords.pincode ? { pincode: coords.pincode, postalCode: coords.pincode } : {}),
            liveGps: liveGpsRecord,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});

        await setDoc(
          doc(db, 'restaurants', restId),
          {
            restaurantId: restId,
            sellerId: uid,
            latitude: coords.latitude,
            longitude: coords.longitude,
            googleMapsLink: googleMapsUrl,
            ...(coords.address ? { address: coords.address } : {}),
            ...(coords.city ? { city: coords.city, locality: coords.locality || coords.city } : {}),
            ...(coords.district ? { district: coords.district } : {}),
            ...(coords.state ? { state: coords.state } : {}),
            ...(coords.pincode ? { pincode: coords.pincode, postalCode: coords.pincode } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      } else {
        await setDoc(
          doc(db, 'customers', uid),
          {
            uid,
            ...(extra?.phone ? { phone: extra.phone } : {}),
            liveGps: liveGpsRecord,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
    }
  } catch {
    // Non-fatal if offline
  }
}

/**
 * Builds a direct Google Maps URL that drops a pin at the exact latitude & longitude.
 */
export function getGoogleMapsCoordUrl(latitude: number, longitude: number): string {
  const lat = Number(latitude).toFixed(6);
  const lng = Number(longitude).toFixed(6);
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Builds a Google Maps turn-by-turn directions URL from origin to destination coordinates.
 */
export function getGoogleMapsDirectionsUrl(
  destLat: number,
  destLng: number,
  originLat?: number,
  originLng?: number
): string {
  const destination = `${Number(destLat).toFixed(6)},${Number(destLng).toFixed(6)}`;
  if (originLat !== undefined && originLng !== undefined) {
    const origin = `${Number(originLat).toFixed(6)},${Number(originLng).toFixed(6)}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Reverse geocodes live GPS latitude/longitude into a human-readable street address +
 * auto-filled 6-digit Indian PIN code, State, District, City, and Locality.
 */
export async function reverseGeocodeStructured(
  latitude: number,
  longitude: number
): Promise<{
  address: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}> {
  const fallbackLabel = `Live GPS (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
  let address = '';
  let locality: string | undefined;
  let city: string | undefined;
  let district: string | undefined;
  let state: string | undefined;
  let pincode: string | undefined;

  // 1. Primary OpenStreetMap Nominatim High-Detail Reverse Geocode
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
      const addr = data?.address || {};
      locality =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.village ||
        addr.town ||
        addr.city ||
        undefined;
      city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.suburb ||
        addr.county ||
        undefined;
      district = addr.state_district || addr.county || city || undefined;
      state = addr.state || undefined;
      if (addr.postcode) {
        const pinMatch = String(addr.postcode).match(/\d{6}/);
        pincode = pinMatch ? pinMatch[0] : String(addr.postcode).trim();
      }
      if (data && typeof data.display_name === 'string' && data.display_name.trim()) {
        address = data.display_name.trim();
      }
    }
  } catch {
    // Continue to BigDataCloud enrichment
  }

  // 2. Enrich any missing pincode/city/state/district via BigDataCloud Client Reverse Geocoder
  if (!pincode || !city || !state || !district) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        locality = locality || bdc.locality || undefined;
        city = city || bdc.city || bdc.locality || undefined;
        state = state || bdc.principalSubdivision || undefined;
        if (!pincode && bdc.postcode) {
          const pinMatch = String(bdc.postcode).match(/\d{6}/);
          pincode = pinMatch ? pinMatch[0] : String(bdc.postcode).trim();
        }
        if (!district && Array.isArray(bdc.localityInfo?.administrative)) {
          const distEntry = bdc.localityInfo.administrative.find(
            (x: any) => x.adminLevel === 5 || x.adminLevel === 6 || String(x.description || '').toLowerCase().includes('district')
          );
          if (distEntry?.name) district = distEntry.name;
        }
        district = district || city;
        if (!address) {
          address = [locality, city, district, state, pincode].filter(Boolean).join(', ');
        }
      }
    } catch {
      // Ignore
    }
  }

  // 3. If we have a 6-digit Indian PIN code, enrich exact Post Office District & State via India Post API
  if (pincode && /^\d{6}$/.test(pincode) && (!state || !district || !city)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const poRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (poRes.ok) {
        const poJson = await poRes.json();
        const first = Array.isArray(poJson) ? poJson[0] : null;
        if (first && first.Status === 'Success' && Array.isArray(first.PostOffice) && first.PostOffice.length > 0) {
          const po = first.PostOffice[0];
          state = state || po.State || undefined;
          district = district || po.District || undefined;
          city = city || (po.Block && po.Block !== 'NA' ? po.Block : po.Division || po.District) || undefined;
          locality = locality || po.Name || city;
        }
      }
    } catch {
      // Ignore
    }
  }

  // 4. If we have city/locality/district/state but Nominatim didn't include a 6-digit postcode, query India Post by PostOffice name
  if (!pincode && (locality || city)) {
    try {
      const targetBranch = encodeURIComponent((locality || city || '').split(',')[0].trim());
      if (targetBranch.length >= 3) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const branchRes = await fetch(`https://api.postalpincode.in/postoffice/${targetBranch}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (branchRes.ok) {
          const branchJson = await branchRes.json();
          const first = Array.isArray(branchJson) ? branchJson[0] : null;
          if (first && first.Status === 'Success' && Array.isArray(first.PostOffice) && first.PostOffice.length > 0) {
            const matchedPo =
              first.PostOffice.find(
                (po: any) =>
                  !state || String(po.State || '').toLowerCase() === state.toLowerCase()
              ) || first.PostOffice[0];
            if (matchedPo?.Pincode) {
              pincode = String(matchedPo.Pincode);
              state = state || matchedPo.State || undefined;
              district = district || matchedPo.District || undefined;
              city = city || matchedPo.District || undefined;
            }
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  const finalAddress =
    address ||
    [locality, city, district, state, pincode].filter(Boolean).join(', ') ||
    fallbackLabel;

  return {
    address: finalAddress,
    locality: locality || city,
    city,
    district: district || city,
    state,
    pincode,
  };
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  const res = await reverseGeocodeStructured(latitude, longitude);
  return res.address;
}

/**
 * Production mode helper (no-op)
 */
export async function syncNearbyDemoKitchenToUserGps(_latitude: number, _longitude: number): Promise<void> {
  // Production mode: real restaurants only, no demo kitchen updates
  return;
}

/**
 * Looks up Indian PIN code (6 digits) or City/Area query and returns State, District, City, PIN, and coordinates.
 */
export async function lookupLocationByPinOrCity(queryText: string): Promise<PostalLookupResult> {
  const cleaned = queryText.trim();
  const isSixDigitPin = /^\d{6}$/.test(cleaned);

  let state = '';
  let district = '';
  let city = '';
  let locality = '';
  let pincode = isSixDigitPin ? cleaned : '';

  if (isSixDigitPin) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      const first = Array.isArray(json) ? json[0] : null;
      if (first && first.Status === 'Success' && Array.isArray(first.PostOffice) && first.PostOffice.length > 0) {
        const po = first.PostOffice[0];
        state = po.State || '';
        district = po.District || '';
        city = po.Block && po.Block !== 'NA' ? po.Block : po.Division || po.District || '';
        locality = po.Name || city;
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  const searchTerm = isSixDigitPin
    ? `${locality ? `${locality}, ` : ''}${district ? `${district}, ` : ''}${state ? `${state}, ` : ''}${cleaned}, India`
    : `${cleaned}, India`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchTerm
      )}&countrycodes=in&addressdetails=1&limit=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    const nomJson = await nomRes.json();
    if (Array.isArray(nomJson) && nomJson.length > 0) {
      const hit = nomJson[0];
      const lat = parseFloat(hit.lat);
      const lon = parseFloat(hit.lon);
      const addr = hit.address || {};

      const resolvedState = state || addr.state || '';
      const resolvedDistrict = district || addr.state_district || addr.county || addr.city || '';
      const resolvedCity =
        city || addr.city || addr.town || addr.village || addr.suburb || resolvedDistrict;
      const resolvedPin = pincode || addr.postcode || '';
      const formattedAddr =
        hit.display_name || `${resolvedCity}, ${resolvedDistrict}, ${resolvedState} - ${resolvedPin}`;

      return {
        pincode: resolvedPin,
        state: resolvedState,
        district: resolvedDistrict,
        city: resolvedCity,
        locality: locality || resolvedCity,
        latitude: lat,
        longitude: lon,
        formattedAddress: formattedAddr,
        address: formattedAddr,
        googleMapsUrl: getGoogleMapsCoordUrl(lat, lon),
      };
    }
  } catch {
    // Fall through
  }

  throw new Error('Could not find coordinates for that PIN code or city. Please allow browser GPS location or enter a valid 6-digit Indian PIN code.');
}

/**
 * Helper to call navigator.geolocation.getCurrentPosition with a Promise wrapper.
 * Directly triggers the native browser / phone OS location permission popup.
 */
function getBrowserGeolocationPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation API is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Requests live high-accuracy GPS coordinates directly from the user's phone/device hardware
 * via the native browser permission popup (navigator.geolocation.getCurrentPosition).
 * Never uses fake or IP-based fallback coordinates.
 */
export async function requestLiveGpsLocation(extra?: {
  phone?: string;
  uid?: string;
  role?: string;
  restaurantId?: string;
}): Promise<GpsCoordinates> {
  let position: GeolocationPosition;

  // 1st attempt: High-accuracy hardware GPS (fresh fix, maximumAge: 0)
  try {
    position = await getBrowserGeolocationPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  } catch (firstErr: any) {
    // If user explicitly denied permission (code 1), rethrow immediately so browser state is clear
    if (firstErr && firstErr.code === 1) {
      throw new Error(
        'Location permission was blocked in your browser. Please allow Location Access in your browser address bar settings to capture your live GPS coordinates.'
      );
    }
    // 2nd attempt: Standard device geolocation (Wi-Fi/Cellular hardware fix, maximumAge: 0)
    position = await getBrowserGeolocationPosition({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 0,
    });
  }

  const latitude = Number(position.coords.latitude.toFixed(6));
  const longitude = Number(position.coords.longitude.toFixed(6));
  const accuracy = position.coords.accuracy;
  const geo = await reverseGeocodeStructured(latitude, longitude);

  const payload: GpsCoordinates = {
    latitude,
    longitude,
    accuracy,
    address: geo.address,
    locality: geo.locality,
    city: geo.city,
    district: geo.district,
    state: geo.state,
    pincode: geo.pincode,
    googleMapsUrl: getGoogleMapsCoordUrl(latitude, longitude),
    capturedAt: new Date().toISOString(),
    source: 'device_gps',
  };

  try {
    localStorage.setItem(LIVE_GPS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }

  markSessionConfirmedGps();
  saveGpsLocationToFirestore(payload, extra).catch(() => {});
  syncNearbyDemoKitchenToUserGps(latitude, longitude).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('food_india_gps_updated', { detail: payload }));
  }

  return payload;
}

/**
 * Strictly picks up live phone GPS coordinates via the native browser location popup.
 * Never returns fake or IP-based coordinates.
 */
export async function pickupLiveGpsLocation(
  _forceFresh?: boolean,
  extra?: { phone?: string; uid?: string; role?: string; restaurantId?: string }
): Promise<GpsCoordinates> {
  return await requestLiveGpsLocation(extra);
}

export function loadSavedLiveGpsLocation(): GpsCoordinates | null {
  try {
    const raw = localStorage.getItem(LIVE_GPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GpsCoordinates;
    // Automatically purge any legacy fake or IP-fallback cache entry
    if (
      !parsed ||
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      (parsed as any).source === 'fallback_india' ||
      (parsed as any).source === 'network_ip' ||
      isLegacyFakeCoordinate(parsed.latitude, parsed.longitude)
    ) {
      localStorage.removeItem(LIVE_GPS_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Starts continuous live device GPS tracking in the background using the native browser geolocation API.
 * Returns a cleanup function.
 */
export function startBackgroundGpsTracking(
  onUpdate?: (coords: GpsCoordinates) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  // Purge any old fake coordinates immediately on startup
  loadSavedLiveGpsLocation();

  // Trigger native browser location popup immediately
  requestLiveGpsLocation()
    .then((coords) => {
      onUpdate?.(coords);
    })
    .catch(() => {});

  if ('geolocation' in navigator && backgroundWatchId === null) {
    try {
      backgroundWatchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const latitude = Number(pos.coords.latitude.toFixed(6));
          const longitude = Number(pos.coords.longitude.toFixed(6));
          if (isLegacyFakeCoordinate(latitude, longitude)) return;
          const prev = loadSavedLiveGpsLocation();
          if (
            prev &&
            prev.source === 'device_gps' &&
            prev.pincode &&
            Math.abs(prev.latitude - latitude) < 0.0002 &&
            Math.abs(prev.longitude - longitude) < 0.0002
          ) {
            return;
          }
          const geo = await reverseGeocodeStructured(latitude, longitude);
          const payload: GpsCoordinates = {
            latitude,
            longitude,
            accuracy: pos.coords.accuracy,
            address: geo.address,
            locality: geo.locality,
            city: geo.city,
            district: geo.district,
            state: geo.state,
            pincode: geo.pincode,
            googleMapsUrl: getGoogleMapsCoordUrl(latitude, longitude),
            capturedAt: new Date().toISOString(),
            source: 'device_gps',
          };
          try {
            localStorage.setItem(LIVE_GPS_STORAGE_KEY, JSON.stringify(payload));
          } catch {
            // ignore
          }
          markSessionConfirmedGps();
          saveGpsLocationToFirestore(payload).catch(() => {});
          syncNearbyDemoKitchenToUserGps(latitude, longitude).catch(() => {});
          window.dispatchEvent(new CustomEvent('food_india_gps_updated', { detail: payload }));
          onUpdate?.(payload);
        },
        () => {
          // Silently ignore watch errors
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      );
    } catch {
      // Ignore watch setup errors
    }
  }

  return () => {
    if (backgroundWatchId !== null && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(backgroundWatchId);
      } catch {
        // ignore
      }
      backgroundWatchId = null;
    }
  };
}
