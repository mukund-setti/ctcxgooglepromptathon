import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Locate } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { loadGoogleMaps } from '../lib/mapsLoader.js';
import { geocode, reverseGeocode } from '../lib/geocode.js';

export default function AddressBar({ onResolved }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Wire Places Autocomplete to the input once Maps is loaded.
  useEffect(() => {
    let autocomplete;
    let listener;
    loadGoogleMaps()
      .then((google) => {
        if (!inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['geometry', 'formatted_address'],
          types: ['geocode'],
          componentRestrictions: { country: 'us' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;
          const point = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          onResolved({
            ...point,
            formattedAddress: place.formatted_address || value,
          });
        });
      })
      .catch((err) => console.warn('Autocomplete unavailable:', err.message));

    return () => {
      if (listener) listener.remove?.();
    };
    // onResolved intentionally not in deps — caller passes a stable callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await geocode(value.trim());
      if (!result) {
        setError('No results found for that address.');
      } else {
        onResolved(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported in this browser.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const addr = await reverseGeocode(point);
          setValue(addr);
          onResolved({ ...point, formattedAddress: addr });
        } catch {
          onResolved({ ...point, formattedAddress: 'Your location' });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t.addressPlaceholder}
            aria-label={t.addressPlaceholder}
            className="w-full pl-10 pr-3 py-3 rounded-lg bg-slate-800 border border-slate-700 text-base focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[48px]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold inline-flex items-center justify-center gap-2 min-h-[48px]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? t.geocoding : t.check}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-100 inline-flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Locate className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t.useMyLocation}</span>
        </button>
      </div>
      {error && (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </form>
  );
}
