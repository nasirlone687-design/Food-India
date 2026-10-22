/// <reference types="google.maps" />
/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export type UseAutocompleteSuggestionsReturn = {
  suggestions: google.maps.places.AutocompleteSuggestion[];
  isLoading: boolean;
  resetSession: () => void;
};

/**
 * A reusable hook that retrieves autocomplete suggestions from the Google Places API.
 * Uses the modern Autocomplete Data API (AutocompleteSuggestion.fetchAutocompleteSuggestions).
 */
export function useAutocompleteSuggestions(
  inputString: string,
  requestOptions: Partial<google.maps.places.AutocompleteRequest> = {}
): UseAutocompleteSuggestionsReturn {
  const placesLib = useMapsLibrary('places');

  // stores the current sessionToken
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // the suggestions based on the specified input
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);

  // indicates if there is currently an incomplete request to the places API
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!placesLib) return;

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;

    // CRITICAL: Create a new session token if one does not exist.
    // This token is reused across suggestion requests until a Place is selected.
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const request: google.maps.places.AutocompleteRequest = {
      ...requestOptions,
      input: inputString,
      sessionToken: sessionTokenRef.current
    };

    if (inputString === '') {
      if (suggestions.length > 0) setSuggestions([]);
      return;
    }

    setIsLoading(true);

    // Modern, promise-based API call
    AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
      .then((res: { suggestions: google.maps.places.AutocompleteSuggestion[] }) => {
        setSuggestions(res.suggestions || []);
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error("Error fetching autocomplete suggestions:", err);
        setIsLoading(false);
      });
  }, [placesLib, inputString]);

  return {
    suggestions,
    isLoading,
    // CRITICAL: Session must be reset after a successful fetchFields call on a selected place.
    resetSession: () => {
      sessionTokenRef.current = null;
      setSuggestions([]);
    }
  };
}
