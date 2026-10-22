import React, { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, Loader2, ExternalLink, Copy, Check, Info } from 'lucide-react';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import {
  requestLiveGpsLocation,
  reverseGeocodeStructured,
  lookupLocationByPinOrCity,
  getGoogleMapsCoordUrl,
  getGoogleMapsDirectionsUrl,
  loadSavedLiveGpsLocation,
  saveGpsLocationToFirestore,
  isLegacyFakeCoordinate,
} from '../utils/gps';
import { copyToClipboardSafe, reportGlobalButtonStatus } from '../context/ErrorLogContext';

export interface SelectedLocationPayload {
  latitude: number;
  longitude: number;
  address: string;
  googleMapsLink: string;
  state?: string;
  city?: string;
  district?: string;
  pincode?: string;
}

interface LocationPickerProps {
  onLocationSelect: (location: SelectedLocationPayload) => void;
  initialLocation?: { lat: number; lng: number };
  initialAddress?: string;
  label?: string;
  autoLocate?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation,
  initialAddress = '',
  label = 'Select Location',
  autoLocate = false,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [markerLocation, setMarkerLocation] = useState(() => {
    if (
      initialLocation &&
      typeof initialLocation.lat === 'number' &&
      typeof initialLocation.lng === 'number' &&
      !isLegacyFakeCoordinate(initialLocation.lat, initialLocation.lng)
    ) {
      return initialLocation;
    }
    const saved = loadSavedLiveGpsLocation();
    if (saved) {
      return { lat: saved.latitude, lng: saved.longitude };
    }
    return { lat: 20.5937, lng: 78.9629 };
  });
  const [address, setAddress] = useState(initialAddress);
  const [accuracyMeters, setAccuracyMeters] = useState<number | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualLatInput, setManualLatInput] = useState('');
  const [manualLngInput, setManualLngInput] = useState('');

  const { suggestions, resetSession, isLoading: suggestionsLoading } = useAutocompleteSuggestions(searchQuery);

  useEffect(() => {
    if (markerLocation && Number.isFinite(markerLocation.lat) && Number.isFinite(markerLocation.lng)) {
      setManualLatInput(markerLocation.lat.toString());
      setManualLngInput(markerLocation.lng.toString());
    }
  }, [markerLocation.lat, markerLocation.lng]);

  // Sync when initialLocation changes
  useEffect(() => {
    if (
      initialLocation &&
      typeof initialLocation.lat === 'number' &&
      typeof initialLocation.lng === 'number' &&
      !Number.isNaN(initialLocation.lat) &&
      !Number.isNaN(initialLocation.lng) &&
      !isLegacyFakeCoordinate(initialLocation.lat, initialLocation.lng)
    ) {
      setMarkerLocation(initialLocation);
    }
  }, [initialLocation?.lat, initialLocation?.lng]);

  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
    }
  }, [initialAddress]);

  // Handle Live GPS Locate Me via native browser geolocation popup
  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    setFallbackNotice(null);
    try {
      const gps = await requestLiveGpsLocation();
      const newLocation = { lat: gps.latitude, lng: gps.longitude };
      setMarkerLocation(newLocation);
      setAccuracyMeters(gps.accuracy);
      map?.panTo(newLocation);
      const addr = gps.address || `GPS (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`;
      setAddress(addr);
      if (gps.pincode) {
        setSearchQuery(gps.pincode);
      }
      await saveGpsLocationToFirestore(gps);
      onLocationSelect({
        latitude: gps.latitude,
        longitude: gps.longitude,
        address: addr,
        googleMapsLink: getGoogleMapsCoordUrl(gps.latitude, gps.longitude),
        state: gps.state,
        city: gps.city,
        district: gps.district,
        pincode: gps.pincode,
      });
    } catch (err: any) {
      setFallbackNotice(
        err?.message ||
          'Please allow Location access in your browser popup to auto-fill live coordinates and PIN code.'
      );
    } finally {
      setIsLocating(false);
    }
  }, [map, onLocationSelect]);

  useEffect(() => {
    if (
      autoLocate ||
      !initialLocation ||
      isLegacyFakeCoordinate(initialLocation.lat, initialLocation.lng)
    ) {
      handleLocateMe();
    }
  }, [autoLocate]);

  // Handle Suggestion Click
  const handleSuggestionClick = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;

      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['location', 'formattedAddress'],
      });

      const location = place.location;
      if (location) {
        const newLoc = { lat: location.lat(), lng: location.lng() };
        setMarkerLocation(newLoc);
        setAccuracyMeters(undefined);
        map?.panTo(newLoc);
        const geo = await reverseGeocodeStructured(newLoc.lat, newLoc.lng);
        const finalAddr = place.formattedAddress || geo.address || '';
        setAddress(finalAddr);
        setSearchQuery('');
        setShowSuggestions(false);
        resetSession();

        await saveGpsLocationToFirestore({
          latitude: newLoc.lat,
          longitude: newLoc.lng,
          address: finalAddr,
          city: geo.city,
          district: geo.district,
          state: geo.state,
          pincode: geo.pincode,
          googleMapsUrl: getGoogleMapsCoordUrl(newLoc.lat, newLoc.lng),
          capturedAt: new Date().toISOString(),
          source: 'device_gps',
        });

        onLocationSelect({
          latitude: newLoc.lat,
          longitude: newLoc.lng,
          address: finalAddr,
          googleMapsLink: getGoogleMapsCoordUrl(newLoc.lat, newLoc.lng),
          state: geo.state,
          city: geo.city,
          district: geo.district,
          pincode: geo.pincode,
        });
      }
    },
    [placesLib, map, resetSession, onLocationSelect]
  );

  // Core coordinate updater: pans map, reverse-geocodes to exact Indian address, saves & notifies parent
  const updateLocationFromCoords = useCallback(
    async (newLoc: { lat: number; lng: number }) => {
      setMarkerLocation(newLoc);
      setAccuracyMeters(undefined);
      map?.panTo(newLoc);
      const geo = await reverseGeocodeStructured(newLoc.lat, newLoc.lng);
      const addr = geo.address || `GPS (${newLoc.lat.toFixed(6)}, ${newLoc.lng.toFixed(6)})`;
      setAddress(addr);
      if (geo.pincode) {
        setSearchQuery(geo.pincode);
      }
      await saveGpsLocationToFirestore({
        latitude: newLoc.lat,
        longitude: newLoc.lng,
        address: addr,
        city: geo.city,
        district: geo.district,
        state: geo.state,
        pincode: geo.pincode,
        googleMapsUrl: getGoogleMapsCoordUrl(newLoc.lat, newLoc.lng),
        capturedAt: new Date().toISOString(),
        source: 'device_gps',
      });
      onLocationSelect({
        latitude: newLoc.lat,
        longitude: newLoc.lng,
        address: addr,
        googleMapsLink: getGoogleMapsCoordUrl(newLoc.lat, newLoc.lng),
        state: geo.state,
        city: geo.city,
        district: geo.district,
        pincode: geo.pincode,
      });
    },
    [map, onLocationSelect]
  );

  const handleApplyManualCoords = useCallback(async () => {
    const lat = parseFloat(manualLatInput);
    const lng = parseFloat(manualLngInput);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return;
    await updateLocationFromCoords({ lat, lng });
  }, [manualLatInput, manualLngInput, updateLocationFromCoords]);

  // Handle Marker Drag End
  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        updateLocationFromCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    },
    [updateLocationFromCoords]
  );

  // Handle Map Click/Tap: Move location pin to touched position
  const handleMapClick = useCallback(
    (e: any) => {
      if (e?.detail?.latLng) {
        updateLocationFromCoords({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
      } else if (e?.latLng) {
        const lat = typeof e.latLng.lat === 'function' ? e.latLng.lat() : e.latLng.lat;
        const lng = typeof e.latLng.lng === 'function' ? e.latLng.lng() : e.latLng.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          updateLocationFromCoords({ lat, lng });
        }
      }
    },
    [updateLocationFromCoords]
  );

  const handleUseTypedAddress = async () => {
    if (!searchQuery.trim()) return;
    setIsLocating(true);
    try {
      const resolved = await lookupLocationByPinOrCity(searchQuery.trim());
      const newLoc = { lat: resolved.latitude, lng: resolved.longitude };
      setMarkerLocation(newLoc);
      map?.panTo(newLoc);
      setAddress(resolved.formattedAddress || searchQuery.trim());
      setShowSuggestions(false);
      setFallbackNotice(null);
      await saveGpsLocationToFirestore({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        address: resolved.formattedAddress || searchQuery.trim(),
        city: resolved.city,
        district: resolved.district,
        state: resolved.state,
        pincode: resolved.pincode,
        googleMapsUrl: getGoogleMapsCoordUrl(resolved.latitude, resolved.longitude),
        capturedAt: new Date().toISOString(),
        source: 'device_gps',
      });
      onLocationSelect({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        address: resolved.formattedAddress || searchQuery.trim(),
        googleMapsLink: getGoogleMapsCoordUrl(resolved.latitude, resolved.longitude),
        state: resolved.state,
        city: resolved.city,
        district: resolved.district,
        pincode: resolved.pincode,
      });
      reportGlobalButtonStatus({
        buttonName: 'Search / Set Address or PIN',
        backendPath: 'Firestore: deviceLocations & Indian PIN/City Geocoder',
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Resolved "${searchQuery.trim()}" → ${resolved.city}, ${resolved.state} (${resolved.pincode})`,
        suggestion: 'Click "Save Kitchen, Delivery & Hours" to save this address to Firestore.',
      });
    } finally {
      setIsLocating(false);
    }
  };

  const coordText = `${markerLocation.lat.toFixed(6)}, ${markerLocation.lng.toFixed(6)}`;
  const googleMapsCoordLink = getGoogleMapsCoordUrl(markerLocation.lat, markerLocation.lng);
  const googleMapsDirLink = getGoogleMapsDirectionsUrl(markerLocation.lat, markerLocation.lng);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label className="block text-sm font-bold text-gray-700">{label}</label>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            <span>{isLocating ? 'Locating...' : 'Pickup Live GPS Location'}</span>
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm font-medium"
              placeholder="Enter 6-digit PIN (e.g. 110001, 400001), City, or Address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUseTypedAddress();
                }
              }}
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            {suggestionsLoading && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 text-orange-500 animate-spin" />
            )}
          </div>
          <button
            type="button"
            onClick={handleUseTypedAddress}
            disabled={!searchQuery.trim() || isLocating}
            className="px-3.5 py-2 bg-slate-900 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-orange-600 shrink-0 transition-colors"
          >
            Lookup PIN / City
          </button>
        </div>

        {/* Manual Latitude & Longitude Coordinates Entry Row */}
        <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
            Or Enter GPS Coordinates Manually
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={manualLatInput}
              onChange={(e) => setManualLatInput(e.target.value)}
              placeholder="Latitude (e.g. 28.6139)"
              className="flex-1 h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <input
              type="number"
              step="any"
              value={manualLngInput}
              onChange={(e) => setManualLngInput(e.target.value)}
              placeholder="Longitude (e.g. 77.2090)"
              className="flex-1 h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <button
              type="button"
              onClick={handleApplyManualCoords}
              disabled={!manualLatInput.trim() || !manualLngInput.trim()}
              className="px-3 h-9 bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-colors"
            >
              Set Lat/Lng
            </button>
          </div>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                type="button"
                key={index}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-100 last:border-0 flex items-start space-x-3"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  {suggestion.placePrediction?.text.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {fallbackNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-1">
            <p className="font-bold">{fallbackNotice}</p>
            <p className="text-[11px] text-amber-800">
              Tip: Type any Indian PIN code above (e.g., <strong>110001</strong> Delhi, <strong>400001</strong> Mumbai, <strong>560001</strong> Bengaluru, <strong>190001</strong> Srinagar) and click <strong>Lookup PIN / City</strong> to auto-fill State, City, District & Coordinates.
            </p>
          </div>
        </div>
      )}

      {/* Manual Pin Placement Notice */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
        <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
        <div className="space-y-0.5">
          <p className="font-bold">Device location not accessible or want exact spot?</p>
          <p className="text-[11px] text-blue-800">
            Set location manually: <strong>tap anywhere on the map</strong> or <strong>drag the red pin</strong> to pick your exact coordinates and address.
          </p>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden h-[260px] border border-gray-200 shadow-inner">
        {/* Floating guidance badge */}
        <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 bg-white/95 backdrop-blur-sm shadow-md rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pointer-events-none border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Tap map or drag pin to set exact spot</span>
        </div>

        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={markerLocation}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          <AdvancedMarker
            position={markerLocation}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        </Map>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute bottom-4 right-4 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 z-10"
          title="Pickup Live GPS Location"
        >
          {isLocating ? (
            <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
          ) : (
            <Navigation className="h-6 w-6 text-orange-500" />
          )}
        </button>
      </div>

      {/* Live Coordinates & Google Maps Coordinate Link Box */}
      <div className="p-3.5 bg-orange-50/90 border border-orange-200/80 rounded-2xl space-y-2">
        {address && (
          <div className="flex items-start space-x-2.5">
            <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-950 leading-relaxed font-bold">
              {address}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-orange-200/60">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700">
            <span>GPS: {coordText}</span>
            {accuracyMeters !== undefined && (
              <span className="text-[10px] text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                ±{Math.round(accuracyMeters)}m
              </span>
            )}
            <button
              type="button"
              onClick={async () => {
                await copyToClipboardSafe(coordText);
                setCopiedCoords(true);
                setTimeout(() => setCopiedCoords(false), 2000);
              }}
              className="p-1 bg-white hover:bg-orange-100 rounded border border-orange-200 text-orange-700"
              title="Copy Coordinates"
            >
              {copiedCoords ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={googleMapsCoordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in Google Maps ({markerLocation.lat.toFixed(4)}, {markerLocation.lng.toFixed(4)})</span>
            </a>
            <a
              href={googleMapsDirLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Directions</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
