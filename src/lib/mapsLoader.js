// Dynamic loader for the Google Maps JS API with the geometry + places libraries.
// Resolves the singleton google object once the script finishes loading.

let loadPromise = null;

export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(
      new Error('Missing VITE_GOOGLE_MAPS_API_KEY — add it to .env'),
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const cbName = `__hazalert_gmaps_cb_${Date.now()}`;
    window[cbName] = () => {
      delete window[cbName];
      resolve(window.google);
    };

    const script = document.createElement('script');
    const params = new URLSearchParams({
      key,
      libraries: 'geometry,places',
      v: 'weekly',
      callback: cbName,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[cbName];
      loadPromise = null;
      reject(new Error('Failed to load Google Maps JS API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
