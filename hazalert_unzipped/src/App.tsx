import React, { useState, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary 
} from '@vis.gl/react-google-maps';
import { 
  AlertTriangle, 
  Compass, 
  Check, 
  Volume2, 
  VolumeX, 
  Mic, 
  HelpCircle, 
  Clock, 
  Navigation, 
  MapPin, 
  Search, 
  Info, 
  X, 
  Users, 
  Layers, 
  FileText, 
  ChevronRight, 
  Activity, 
  Smartphone, 
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Modules & static constants
import { Zone, Shelter, RoadClosure, ChecklistItem, ChatMessage } from './types';
import { MOCK_ZONES, MOCK_SHELTERS, MOCK_CLOSURES, getZonePriority } from './mockData';
import { UI_TRANSLATIONS, SUPPORTED_LANGUAGES } from './translations';
import { useSpeechSynthesis } from './useSpeechSynthesis';

// Geocoordinate boundaries and transformations for Keyless Sandbox GIS Engine
const MIN_LAT = 33.72;
const MAX_LAT = 33.84;
const MIN_LNG = -118.08;
const MAX_LNG = -117.92;

const getXY = (lat: number, lng: number) => {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100;
  const y = (1 - (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 100;
  return { x, y };
};

const convertXYToLatLng = (svgX: number, svgY: number) => {
  const lng = MIN_LNG + (svgX / 100) * (MAX_LNG - MIN_LNG);
  const lat = MIN_LAT + (1 - svgY / 100) * (MAX_LAT - MIN_LAT);
  return { lat, lng };
};

// Map Key integration configuration using Constitutional design patterns
export default function App() {
  const [bypassed, setBypassed] = useState(false);
  const [mapsAuthFailed, setMapsAuthFailed] = useState(false);
  const [localKey, setLocalKey] = useState<string>(() => {
    return localStorage.getItem('HAZALERT_LOCAL_GOOGLE_MAP_KEY') || '';
  });

  useEffect(() => {
    // Catch Google Maps platform key failure callbacks globally
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps authentication failed (InvalidKeyMapError). Switching automatically to Sandbox Map.");
      setMapsAuthFailed(true);
    };

    const handleBypass = () => {
      setBypassed(true);
    };
    window.addEventListener('bypass_key_for_sandbox', handleBypass);
    return () => {
      window.removeEventListener('bypass_key_for_sandbox', handleBypass);
    };
  }, []);

  const envKey =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    '';

  const API_KEY = localKey || envKey;
  const hasValidKey = typeof API_KEY === 'string' && API_KEY.startsWith('AIzaSy') && API_KEY.length > 20;

  const runSandbox = !hasValidKey || bypassed || mapsAuthFailed;
  const effectiveKey = hasValidKey ? API_KEY : "AIzaSyFakeKeyButNeededForContext";

  return (
    <APIProvider apiKey={effectiveKey} version="weekly" libraries={['geometry', 'places']}>
      <MainDashboard 
        isSandboxOnly={runSandbox} 
        mapsAuthFailed={mapsAuthFailed}
        currentApiKey={API_KEY}
        onSaveLocalKey={(key: string) => {
          if (key) {
            localStorage.setItem('HAZALERT_LOCAL_GOOGLE_MAP_KEY', key);
            setLocalKey(key.trim());
            setMapsAuthFailed(false);
            setBypassed(false);
            setTimeout(() => {
              window.location.reload();
            }, 300);
          } else {
            localStorage.removeItem('HAZALERT_LOCAL_GOOGLE_MAP_KEY');
            setLocalKey('');
            setMapsAuthFailed(false);
            setBypassed(false);
            setTimeout(() => {
              window.location.reload();
            }, 300);
          }
        }}
        onToggleKeyless={() => {
          if (runSandbox) {
            setBypassed(false);
            setMapsAuthFailed(false);
          } else {
            setBypassed(true);
          }
        }} 
      />
    </APIProvider>
  );
}

// Inner Component with API/Sandbox access
function MainDashboard({ 
  isSandboxOnly = false, 
  mapsAuthFailed = false, 
  currentApiKey = '',
  onSaveLocalKey,
  onToggleKeyless 
}: { 
  isSandboxOnly?: boolean; 
  mapsAuthFailed?: boolean; 
  currentApiKey?: string;
  onSaveLocalKey: (key: string) => void;
  onToggleKeyless?: () => void 
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const geocodingServiceRef = useRef<google.maps.Geocoder | null>(null);

  // Internationalization translation settings
  const [currentLang, setCurrentLang] = useState<string>('en-US');
  const [langValue, setLangValue] = useState<string>('en');
  const [mapEngine, setMapEngine] = useState<'google' | 'sandbox'>(isSandboxOnly ? 'sandbox' : 'google');
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [keyInput, setKeyInput] = useState(currentApiKey);

  // Sync if isSandboxOnly changes
  useEffect(() => {
    if (isSandboxOnly) {
      setMapEngine('sandbox');
    }
  }, [isSandboxOnly]);

  // Sync keyInput if currentApiKey changes
  useEffect(() => {
    setKeyInput(currentApiKey);
  }, [currentApiKey]);

  // Only open key setup overlay if auth explicitly failed (not on missing key)
  useEffect(() => {
    if (mapsAuthFailed) {
      setShowKeySetup(true);
    }
  }, [mapsAuthFailed]);

  // Auto handle show_key_setup_procedures event
  useEffect(() => {
    const handleShowSetup = () => {
      setShowKeySetup(true);
    };
    window.addEventListener('show_key_setup_procedures', handleShowSetup);
    return () => {
      window.removeEventListener('show_key_setup_procedures', handleShowSetup);
    };
  }, []);
  const dictionary = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS['en-US'];

  // Global variables: search inputs and geolocation variables
  const [addressInput, setAddressInput] = useState<string>('');
  const [userLatLng, setUserLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'mandatory' | 'shelter_in_place' | 'watch' | 'safe'>('safe');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [isInsideDangerZone, setIsInsideDangerZone] = useState(false);

  // Places Autocomplete integration
  const autocompleteContainerRef = useRef<HTMLInputElement | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.Autocomplete | null>(null);

  // Active Map Settings
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [selectedClosure, setSelectedClosure] = useState<RoadClosure | null>(null);
  const [selectedZoneInfo, setSelectedZoneInfo] = useState<Zone | null>(null);
  const [routingShelter, setRoutingShelter] = useState<Shelter | null>(null);

  // Checked/Interactive household states
  const [activeTab, setActiveTab] = useState<'guidance' | 'checklist' | 'shelters' | 'assistant'>('guidance');
  const [hasPets, setHasPets] = useState<string>('None');
  const [hasChildren, setHasChildren] = useState<string>('None');
  const [hasElderly, setHasElderly] = useState<boolean>(false);
  const [hasMeds, setHasMeds] = useState<boolean>(false);
  const [evacTime, setEvacTime] = useState<string>('10 min');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});
  const [generatingChecklist, setGeneratingChecklist] = useState<boolean>(false);

  // Chatbot Assistant AI configuration
  const [userInputMessage, setUserInputMessage] = useState<string>('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([
    {
      id: 'default-1',
      sender: 'assistant',
      text: "Hello! I am your GKN Aerospace incident warning safety assistant. Enter your address above to check warning zone polygons, or ask me chemical mitigation questions.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Voice Speech support
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const { speak, stop, speaking } = useSpeechSynthesis();

  // Directions routing references
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Standard Test Address shortcuts
  const testAddresses = [
    { label: 'GKN Leak Core (Red)', address: '12345 Brookhurst St, Garden Grove, CA', status: 'mandatory' },
    { label: 'Shelter In Place (Yellow)', address: '9100 Garden Grove Blvd, Garden Grove, CA', status: 'shelter_in_place' },
    { label: 'Watch Zone (Orange)', address: '8200 Katella Ave, Stanton, CA', status: 'watch' },
    { label: 'Disneyland Sec (Green)', address: '1 Disneyland Way, Anaheim, CA', status: 'safe' }
  ];

  // Geocoding & Address Service Initializer
  useEffect(() => {
    if (geocodingLib && !geocodingServiceRef.current) {
      geocodingServiceRef.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  // Set up Places Autocomplete
  useEffect(() => {
    if (placesLib && autocompleteContainerRef.current && !autocompleteService) {
      const autocomplete = new google.maps.places.Autocomplete(autocompleteContainerRef.current, {
        componentRestrictions: { country: 'US' },
        fields: ['address_components', 'geometry', 'formatted_address'],
        types: ['address']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const targetLoc = { lat, lng };
          setAddressInput(place.formatted_address || '');
          handleLocationSelected(targetLoc);
        }
      });

      setAutocompleteService(autocomplete);
    }
  }, [placesLib, autocompleteContainerRef.current, autocompleteService]);

  // Ray-casting point-in-polygon algorithm (works without Google Maps geometry library)
  const pointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Handle Location Analysis & Polygon Intersection Checks
  const handleLocationSelected = (latLng: { lat: number; lng: number }) => {
    setUserLatLng(latLng);
    
    // Pan and Center the map viewport nicely
    if (map) {
      map.panTo(latLng);
      map.setZoom(14);
    }

    let detectedStatus: 'mandatory' | 'shelter_in_place' | 'watch' | 'safe' = 'safe';
    let matchedZone: Zone | null = null;

    // Evaluate in order of risk priority (Red > Yellow > Orange)
    const sortedZones = [...MOCK_ZONES].sort(
      (a, b) => getZonePriority(b.status) - getZonePriority(a.status)
    );

    // Try Google geometry library first, fall back to ray-casting
    const useGoogleGeometry = typeof google !== 'undefined' && google.maps?.geometry?.poly?.containsLocation;

    for (const zone of sortedZones) {
      let contains = false;
      if (useGoogleGeometry) {
        const googlePoint = new google.maps.LatLng(latLng.lat, latLng.lng);
        const polygon = new google.maps.Polygon({ paths: zone.polyPaths });
        contains = google.maps.geometry.poly.containsLocation(googlePoint, polygon);
      } else {
        contains = pointInPolygon(latLng, zone.polyPaths);
      }
      if (contains) {
        detectedStatus = zone.status;
        matchedZone = zone;
        break; // Found highest risk zone first, stop check
      }
    }

    applyStatusEvaluation(detectedStatus, matchedZone, latLng);
  };

  // Legacy fallback kept for compatibility — now uses ray-casting too
  const evaluateLocationFallback = (latLng: { lat: number; lng: number }) => {
    let detectedStatus: 'mandatory' | 'shelter_in_place' | 'watch' | 'safe' = 'safe';
    let matchedZone: Zone | null = null;

    const sortedZones = [...MOCK_ZONES].sort(
      (a, b) => getZonePriority(b.status) - getZonePriority(a.status)
    );

    for (const zone of sortedZones) {
      if (pointInPolygon(latLng, zone.polyPaths)) {
        detectedStatus = zone.status;
        matchedZone = zone;
        break;
      }
    }
    applyStatusEvaluation(detectedStatus, matchedZone, latLng);
  };

  // Set the final status state and announce for screenreaders
  const applyStatusEvaluation = (
    status: 'mandatory' | 'shelter_in_place' | 'watch' | 'safe',
    zone: Zone | null,
    loc: google.maps.LatLngLiteral
  ) => {
    setCurrentStatus(status);
    setActiveZone(zone);
    setIsInsideDangerZone(status !== 'safe');

    // Compile guidance update
    let stateTitle = '';
    let stateDesc = '';
    
    if (status === 'mandatory') {
      stateTitle = dictionary.statusMandatoryTitle;
      stateDesc = dictionary.statusMandatoryDesc;
      // Trigger automatic route search to nearest shelter
      findAndRouteToNearestShelter(loc, ['pet-friendly', 'ada']);
    } else if (status === 'shelter_in_place') {
      stateTitle = dictionary.statusSipTitle;
      stateDesc = dictionary.statusSipDesc;
      clearPolylines();
    } else if (status === 'watch') {
      stateTitle = dictionary.statusWatchTitle;
      stateDesc = dictionary.statusWatchDesc;
      clearPolylines();
    } else {
      stateTitle = dictionary.statusSafeTitle;
      stateDesc = dictionary.statusSafeDesc;
      clearPolylines();
    }

    // Voice announcement logic
    if (voiceEnabled) {
      speak(`${stateTitle}. ${stateDesc}. ${dictionary.enterAddress}`, currentLang);
    }
  };

  // Find Nearest compatible shelter and compute directions route avoiding mandatory zone center
  const findAndRouteToNearestShelter = (loc: google.maps.LatLngLiteral, preferredSpecs: string[]) => {
    let nearest: Shelter | null = null;
    let minDistance = Infinity;

    // Magnolia High or Stanton has Pets permit
    for (const shelter of MOCK_SHELTERS) {
      const dist = Math.hypot(shelter.lat - loc.lat, shelter.lng - loc.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = shelter;
      }
    }

    if (nearest) {
      setRoutingShelter(nearest);
      computeEvacRoute(loc, nearest);
    }
  };

  const computeEvacRoute = (origin: google.maps.LatLngLiteral, destination: Shelter) => {
    if (!routesLib || !map) return;
    clearPolylines();

    try {
      routesLib.Route.computeRoutes({
        origin: origin,
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: 'DRIVING',
        fields: ['path', 'viewport']
      }).then(({ routes }) => {
        if (routes?.[0]) {
          const newPolylines = routes[0].createPolylines();
          // Style evacuation line safely
          newPolylines.forEach(p => {
            p.setOptions({
              strokeColor: '#3b82f6',
              strokeOpacity: 0.85,
              strokeWeight: 6,
              zIndex: 999
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;

          if (routes[0].viewport) {
            map.fitBounds(routes[0].viewport);
          }
        }
      }).catch(err => {
        console.error('Routing computation error:', err);
      });
    } catch (e) {
      console.warn('Trouble executing Route.computeRoutes', e);
    }
  };

  const clearPolylines = () => {
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    setRoutingShelter(null);
  };

  // Address Geocoding Action
  const performGeocoding = async (addr: string) => {
    if (!addr.trim()) return;
    
    // Try Google Maps Geocoder service first
    if (geocodingServiceRef.current) {
      try {
        geocodingServiceRef.current.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const latLngPos = { lat: loc.lat(), lng: loc.lng() };
            setAddressInput(results[0].formatted_address || addr);
            handleLocationSelected(latLngPos);
          } else {
            console.warn('Geocoding service returned status:', status);
            // Only use mock for known demo addresses, otherwise try REST API
            if (isDemoAddress(addr)) {
              mockAddressLocate(addr);
            } else {
              geocodeViaRest(addr);
            }
          }
        });
        return;
      } catch (err) {
        console.warn('Geocoding service error:', err);
      }
    }
    
    // Fallback: check if it's a demo address first, then try REST API
    if (isDemoAddress(addr)) {
      mockAddressLocate(addr);
    } else {
      geocodeViaRest(addr);
    }
  };

  // Check if address matches known demo shortcuts
  const isDemoAddress = (addr: string): boolean => {
    const canonical = addr.toLowerCase();
    return canonical.includes('brookhurst') || canonical.includes('12345') ||
           canonical.includes('garden grove') || canonical.includes('9100') ||
           canonical.includes('katella') || canonical.includes('8200') ||
           canonical.includes('disney') || canonical.includes('92802');
  };

  // REST Geocoding API fallback (works even if JS geocoder isn't loaded)
  const geocodeViaRest = async (addr: string) => {
    const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
    if (!mapsKey) {
      console.warn('No Maps API key for REST geocoding. Using demo lookup only.');
      setStatusMessage('Could not geocode address. Try a demo address or use "Use My Location".');
      return;
    }
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${mapsKey}`
      );
      const data = await resp.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const loc = data.results[0].geometry.location;
        setAddressInput(data.results[0].formatted_address || addr);
        handleLocationSelected({ lat: loc.lat, lng: loc.lng });
      } else {
        console.warn('REST Geocoding failed:', data.status);
        setStatusMessage('Could not find that address. Try a more specific address or use "Use My Location".');
      }
    } catch (err) {
      console.warn('REST Geocoding fetch error:', err);
      setStatusMessage('Geocoding unavailable. Try "Use My Location" or a demo address.');
    }
  };

  // Demo address lookup — ONLY for known test addresses, no catch-all default
  const mockAddressLocate = (addr: string) => {
    const canonical = addr.toLowerCase();
    if (canonical.includes('brookhurst') || canonical.includes('12345')) {
      handleLocationSelected({ lat: 33.785, lng: -118.01 });
    } else if (canonical.includes('garden grove') || canonical.includes('9100')) {
      handleLocationSelected({ lat: 33.779, lng: -117.98 });
    } else if (canonical.includes('katella') || canonical.includes('8200')) {
      handleLocationSelected({ lat: 33.801, lng: -118.03 });
    } else if (canonical.includes('disney') || canonical.includes('1 Disneyland') || canonical.includes('92802')) {
      handleLocationSelected({ lat: 33.8122, lng: -117.9190 });
    }
    // No default — don't silently map unknown addresses to the danger zone
  };

  // Geolocate resident
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAddressInput('Current Geolocation Location Coordinates');
          handleLocationSelected(latLng);
        },
        (error) => {
          console.warn('Geolocation access failed. Mocking user location.', error);
          // Auto fallbacks to Garden Grove core
          handleLocationSelected({ lat: 33.7912, lng: -117.995 });
        }
      );
    } else {
      handleLocationSelected({ lat: 33.7912, lng: -117.995 });
    }
  };

  // Call Gemini checklist generator
  const triggerChecklistGeneration = async () => {
    setGeneratingChecklist(true);
    try {
      const summaryString = `Pets: ${hasPets}, Children: ${hasChildren}, Elderly/Support Required: ${hasElderly}, Essential Medications: ${hasMeds}, Available Exit limit: ${evacTime}`;
      const response = await fetch('/api/gemini/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: summaryString })
      });
      const data = await response.json();
      if (data.success && data.list && data.list.length > 0) {
        setChecklistItems(data.list);
        setCompletedTasks({}); // Reset
      } else {
        throw new Error('Fallback required');
      }
    } catch (err) {
      console.warn('Failed querying Gemini API, utilizing offline high-fidelity emergency generator', err);
      // Premium Offline High-Fidelity Fallback Logic
      const offlineList: ChecklistItem[] = [
        { priority: 1, task: 'Gather essential medicine prescriptions', why: 'Essential for health maintenance in case evacuation centers can not dispense immediate drugs.', estimatedTime: '1 minute' },
        { priority: 2, task: 'Pack pet carriers, leashes, food & records', why: 'Keep dogs and cats secure; centers require secure cages.', estimatedTime: '3 minutes' },
        { priority: 3, task: 'Disconnect or seal whole-house fan ventilation', why: 'Prevents raw outside methyl methacrylate fumes from leaking into building envelope.', estimatedTime: '2 minutes' },
        { priority: 4, task: 'Load packed baggage into vehicle trunk', why: 'Keeps transport corridors flowing cleanly before gridlocks manifest downstream.', estimatedTime: '4 minutes' }
      ];
      setChecklistItems(offlineList);
    } finally {
      setGeneratingChecklist(false);
    }
  };

  // Call Gemini Assistant AI bot
  const sendChatMessage = async (presetText?: string) => {
    const textSend = presetText || userInputMessage;
    if (!textSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatLog(prev => [...prev, userMsg]);
    if (!presetText) setUserInputMessage('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textSend,
          history: chatLog.slice(-4), // Send localized dynamic sliding window to preserve server token limits
          language: SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.label || 'English',
          languageCode: currentLang,
          userLocation: addressInput,
          userLatLng: userLatLng,
          currentStatus: currentStatus,
          household: {
            pets: hasPets,
            children: hasChildren,
            elderly: hasElderly,
            meds: hasMeds,
            evacTime: evacTime
          }
        })
      });
      const data = await response.json();
      
      if (data.success && data.text) {
        const assistantMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatLog(prev => [...prev, assistantMsg]);
        
        if (voiceEnabled) {
          speak(data.text, currentLang);
        }
      } else {
        throw new Error('API failure');
      }
    } catch (error) {
      console.warn('Assistant error. Providing safe fallback response.', error);
      const fallbackText = "Important public safety update: The Garden Grove chemical GKN Aerospace incident involves Methyl Methacrylate. Remain indoors unless located in MANDATORY RED warning zones. Please secure air handling vents. For urgent physical symptoms dial 911 immediately.";
      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatLog(prev => [...prev, assistantMsg]);
      if (voiceEnabled) {
        speak(fallbackText, currentLang);
      }
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Multi-language Translations dynamically via GC proxy
  const handleLanguageChange = async (targetLang: string) => {
    setCurrentLang(targetLang);
    const selectedObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
    setLangValue(selectedObj?.value || 'en');
  };

  // Percent Complete calculator
  const checklistProgress = checklistItems.length > 0 
    ? Math.round((Object.keys(completedTasks).length / checklistItems.length) * 100)
    : 0;

  // Toggle complete state of task checklist
  const handleToggleTask = (priority: number) => {
    setCompletedTasks(prev => ({
      ...prev,
      [priority]: !prev[priority]
    }));
  };

  // Reset demo or trigger geolocation defaults on mount
  useEffect(() => {
    handleGetCurrentLocation();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col antialiased">
      
      {isSandboxOnly && (
        <div className="bg-gradient-to-r from-emerald-950 to-slate-950 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-emerald-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="truncate">Active standalone Keyless GIS Sandbox Mode. Setup Google Maps Platform secrets to unlock satellite features.</span>
          </div>
          <button 
            onClick={() => setShowKeySetup(true)}
            className="underline hover:text-emerald-300 font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer transition-all shrink-0 ml-4 animate-pulse"
          >
            How to Setup Key ⚙️
          </button>
        </div>
      )}

      {/* HEADER SECTION (64px) */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 md:px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-red-600 rounded-lg blur-sm animate-pulse"></div>
            <div className="relative p-2 bg-red-600 rounded-lg border border-red-500/20 text-white flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <span className="font-mono font-bold text-lg tracking-wider text-slate-100 block">HAZALERT</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono -mt-1 md:block hidden">GKN Emergency Portal</span>
          </div>
        </div>

        {/* Live Status Banner (middle segment of header) */}
        <div className="hidden lg:flex items-center gap-2 py-1 px-3 bg-red-950/40 border border-red-500/10 rounded-full max-w-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs text-red-200 font-mono truncate max-w-sm">
            {dictionary.liveEmergency}
          </span>
        </div>

        {/* Global toggles */}
        <div className="flex items-center gap-3">
          {/* TTS Speech voice toggle selector */}
          <button
            onClick={() => {
              if (voiceEnabled) {
                stop();
                setVoiceEnabled(false);
              } else {
                setVoiceEnabled(true);
                speak(`${dictionary.voiceModeOn}. ${dictionary.enterAddress}`, currentLang);
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono transition-all duration-200 ${
              voiceEnabled 
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:bg-slate-700'
            }`}
            aria-label="Toggle voice output"
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-4 h-4 animate-bounce" />
                <span className="hidden sm:inline">{dictionary.voiceModeOn}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">{dictionary.voiceModeOff}</span>
              </>
            )}
          </button>

          {/* Translation Locale Dropdown */}
          <div className="relative">
            <select
              value={currentLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 hover:border-slate-600 font-mono text-xs text-slate-200 py-1.5 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select preferred language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label} ({lang.code.split('-')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* EMERGENCY NOTIFICATION BANNER FOR MOBILE/TABLET */}
      <div className="block lg:hidden bg-red-950/60 border-b border-red-500/20 text-center py-2 px-3 text-xs text-red-300 font-mono">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping mr-2"></span>
        {dictionary.liveEmergency}
      </div>

      {/* HERO SECTION (200px equivalent section) */}
      <section className="bg-slate-900 border-b border-slate-800 p-4 md:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Geolocation input on left (8 cols desktop) */}
          <div className="lg:col-span-7 space-y-3">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="w-6 h-6 text-blue-500" />
              <span>{dictionary.title}</span>
              <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">Incident Portal</span>
            </h1>
            <p className="text-slate-400 text-xs font-mono">
              {dictionary.enterAddress}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  ref={autocompleteContainerRef}
                  type="text"
                  placeholder={dictionary.searchPlaceholder}
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm text-slate-100 rounded-md py-3 pl-10 pr-3 shadow-inner placeholder:text-slate-500 focus:outline-none"
                />
                <Search className="w-5 h-5 text-slate-500 absolute left-3 top-3.5" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => performGeocoding(addressInput)}
                  className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-mono text-xs font-bold py-3 px-5 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 shadow-lg shadow-blue-900/20 min-h-[44px]"
                >
                  <Activity className="w-4 h-4" />
                  <span>Analyze</span>
                </button>

                <button
                  onClick={handleGetCurrentLocation}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs py-3 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 min-h-[44px]"
                  title={dictionary.useMyLocation}
                >
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span className="hidden sm:inline">{dictionary.useMyLocation}</span>
                </button>
              </div>
            </div>

            {/* Address suggestion test triggers */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono self-center">Demo Triggers:</span>
              {testAddresses.map((addr) => (
                <button
                  key={addr.label}
                  onClick={() => {
                    setAddressInput(addr.address);
                    performGeocoding(addr.address);
                  }}
                  className="bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:border-slate-600 text-[10px] px-2.5 py-1 rounded transition-all font-mono"
                >
                  {addr.label}
                </button>
              ))}
            </div>
          </div>

          {/* Large Action Status Notification Card on Right (5 cols desktop) */}
          <div className="lg:col-span-5 h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStatus}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                aria-live="assertive"
                className={`relative overflow-hidden rounded-lg p-5 border shadow-xl flex flex-col justify-between h-full min-h-[140px] ${
                  currentStatus === 'mandatory'
                    ? 'bg-gradient-to-br from-red-950 via-red-900 to-red-950 border-red-500/40 text-white animate-pulse-glow'
                    : currentStatus === 'shelter_in_place'
                    ? 'bg-gradient-to-br from-yellow-950 via-yellow-905/70 to-yellow-950 border-yellow-500/40 text-yellow-100'
                    : currentStatus === 'watch'
                    ? 'bg-gradient-to-br from-orange-950 via-orange-900/80 to-orange-950 border-orange-500/40 text-orange-200'
                    : 'bg-gradient-to-br from-teal-950 via-slate-900 to-teal-950 border-emerald-500/30 text-emerald-200'
                }`}
              >
                {/* Diagonal stripes on danger cards */}
                {isInsideDangerZone && (
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #fff, #fff 10px, transparent 10px, transparent 20px)'
                  }}></div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">Current Threat Status</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isInsideDangerZone ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight uppercase font-mono">
                      {currentStatus === 'mandatory' && `🚨 ${dictionary.statusMandatoryTitle}`}
                      {currentStatus === 'shelter_in_place' && `⚠️ ${dictionary.statusSipTitle}`}
                      {currentStatus === 'watch' && `👀 ${dictionary.statusWatchTitle}`}
                      {currentStatus === 'safe' && `✅ ${dictionary.statusSafeTitle}`}
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      {currentStatus === 'mandatory' && dictionary.statusMandatoryDesc}
                      {currentStatus === 'shelter_in_place' && dictionary.statusSipDesc}
                      {currentStatus === 'watch' && dictionary.statusWatchDesc}
                      {currentStatus === 'safe' && dictionary.statusSafeDesc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[60%]">
                    {currentStatus === 'mandatory' && `Nearest Shelter Active Routing`}
                    {currentStatus === 'shelter_in_place' && `Seal HVAC Immediately`}
                    {currentStatus === 'watch' && `Prepare Emergency Supplies`}
                    {currentStatus === 'safe' && `Outside Dangerous Contaminants`}
                  </span>

                  <button
                    onClick={() => {
                      if (currentStatus === 'mandatory') {
                        setActiveTab('shelters');
                        if (userLatLng) {
                          findAndRouteToNearestShelter(userLatLng, ['pet-friendly', 'ada']);
                        }
                      } else if (currentStatus === 'shelter_in_place') {
                        setActiveTab('guidance');
                        speak(dictionary.statusSipText, currentLang);
                      } else if (currentStatus === 'watch') {
                        setActiveTab('checklist');
                      } else {
                        // Watch mode trigger
                        setCurrentStatus('watch');
                        setActiveTab('checklist');
                      }
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-900 border border-transparent font-mono text-[10px] font-bold px-3 py-1.5 rounded uppercase self-end shadow cursor-pointer transition-all shrink-0 min-h-[32px]"
                  >
                    {currentStatus === 'mandatory' && dictionary.statusMandatoryAction}
                    {currentStatus === 'shelter_in_place' && dictionary.statusSipAction}
                    {currentStatus === 'watch' && dictionary.statusWatchAction}
                    {currentStatus === 'safe' && dictionary.statusSafeAction}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </section>

      {/* MAIN DIVISION: 60% MAPS GRID + 40% TABS SYSTEM */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MAP SECTION PANEL (60% equivalent -> 7 cols) */}
        <section className="lg:col-span-7 flex flex-col border border-slate-800 bg-slate-900 rounded-lg overflow-hidden min-h-[450px]">
          {/* Map Dashboard Controls */}
          <div className="h-12 bg-slate-950/80 border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="text-slate-300 font-bold hidden sm:inline">Interactive Evacuation Grid</span>
            </div>

            {/* Simulated/Core Engine Selectors */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-0.5 rounded">
              {isSandboxOnly ? (
                <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] tracking-tight uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span>Sandbox Engine (Keyless)</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setMapEngine('google')}
                    className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all cursor-pointer ${
                      mapEngine === 'google' 
                        ? 'bg-blue-600 text-white shadow' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Google Map
                  </button>
                  <button
                    onClick={() => setMapEngine('sandbox')}
                    className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all cursor-pointer ${
                      mapEngine === 'sandbox' 
                        ? 'bg-emerald-600 text-white shadow' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sandbox
                  </button>
                </>
              )}
            </div>
            
            {/* Wind conditions metrics */}
            <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
              <span>{dictionary.windLabel}</span>
            </div>
          </div>

          {/* GOOGLE MAPS RENDERING VIEW CONTAINER */}
          <div className="flex-1 relative min-h-[380px]" style={{ height: '100vw', maxHeight: '500px', lgHeight: 'auto' }}>
            {mapEngine === 'google' ? (
              <Map
                defaultCenter={{ lat: 33.784, lng: -118.005 }} // Centered near Garden Grove / GKN Aerospace center locus
                defaultZoom={12}
                mapId="HAZALERT_TACTICAL_MAP_V1"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%', minHeight: '380px' }}
              >
                {/* User Location Marker Pin (Large Pulsing Blue Center) */}
                {userLatLng && (
                  <AdvancedMarker position={userLatLng}>
                    <div className="relative flex items-center justify-center p-2">
                      <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-50 animate-ping"></div>
                      <div className="relative w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow flex items-center justify-center text-white">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Road Closures rendering markers */}
                {MOCK_CLOSURES.map((closure) => (
                  <AdvancedMarker
                    key={closure.id}
                    position={{ lat: closure.lat, lng: closure.lng }}
                    onClick={() => setSelectedClosure(closure)}
                  >
                    <div className="flex items-center justify-center bg-red-655 hover:bg-red-700 bg-red-600 border-2 border-slate-900 shadow-lg text-white font-mono text-xs leading-none font-bold p-1 rounded cursor-pointer h-8 w-8">
                      ❌
                    </div>
                  </AdvancedMarker>
                ))}

                {/* Shelter locations marker mapping pins */}
                {MOCK_SHELTERS.map((shelter) => (
                  <AdvancedMarker
                    key={shelter.id}
                    position={{ lat: shelter.lat, lng: shelter.lng }}
                    onClick={() => {
                      setSelectedShelter(shelter);
                      // Open matching Shelters listing pane on left
                      setActiveTab('shelters');
                    }}
                  >
                    <div className="flex items-center justify-center bg-slate-900 border-2 border-indigo-500 hover:border-white shadow-xl rounded-md px-1.5 py-1 text-xs select-none cursor-pointer">
                      <span className="text-sm mr-1">🏥</span>
                      <span className="font-mono text-[9px] text-indigo-300 font-bold tracking-tight">
                        {shelter.id === 'shelter_mag' ? 'MAGNOLIA' : shelter.id === 'shelter_ggcc' ? 'GG-CTR' : 'STANTON'}
                      </span>
                    </div>
                  </AdvancedMarker>
                ))}

                {/* Zone Polygons rendering overlay. We represent polylines to highlight edges since drawing full standard shapes directly works well */}
                {MOCK_ZONES.map((zone) => (
                  <ZonePolygonRendering key={zone.id} zone={zone} onClick={() => setSelectedZoneInfo(zone)} />
                ))}

                {/* Selected Shelter Info window details */}
                {selectedShelter && (
                  <InfoWindow
                    position={{ lat: selectedShelter.lat, lng: selectedShelter.lng }}
                    onCloseClick={() => setSelectedShelter(null)}
                  >
                    <div className="p-2 text-slate-900 font-sans max-w-xs space-y-1">
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span>🏥</span> {selectedShelter.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">{selectedShelter.address}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedShelter.features.includes('pet-friendly') && (
                          <span className="bg-slate-100 text-[10px] text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold">
                            {dictionary.petFriendlySymbol}
                          </span>
                        )}
                        {selectedShelter.features.includes('ada') && (
                          <span className="bg-slate-100 text-[10px] text-indigo-800 border border-indigo-100 px-1.5 py-0.5 rounded font-mono font-bold">
                            {dictionary.adaAccessibleSymbol}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-bold pt-1">{selectedShelter.capacityInfo}</p>
                      <button
                        onClick={() => {
                          if (userLatLng) {
                            computeEvacRoute(userLatLng, selectedShelter);
                            setSelectedShelter(null);
                          }
                        }}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] font-bold py-1.5 rounded uppercase cursor-pointer"
                      >
                        {dictionary.routeToShelter}
                      </button>
                    </div>
                  </InfoWindow>
                )}

                {/* Road Closures Popups */}
                {selectedClosure && (
                  <InfoWindow
                    position={{ lat: selectedClosure.lat, lng: selectedClosure.lng }}
                    onCloseClick={() => setSelectedClosure(null)}
                  >
                    <div className="p-2 text-slate-900 font-sans max-w-xs">
                      <h4 className="font-bold text-xs text-red-655 flex items-center gap-1">
                        ⛔ ROAD CLOSED INDEX
                      </h4>
                      <p className="text-xs font-bold mt-1 text-slate-800">{selectedClosure.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{selectedClosure.reason}</p>
                    </div>
                  </InfoWindow>
                )}

                {/* Zone descriptions Explanations window */}
                {selectedZoneInfo && (
                  <InfoWindow
                    position={selectedZoneInfo.polyPaths[0]}
                    onCloseClick={() => setSelectedZoneInfo(null)}
                  >
                    <div className="p-2 text-slate-900 font-sans max-w-xs space-y-1">
                      <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5" style={{ color: selectedZoneInfo.color }}>
                        <span>🚨</span> {selectedZoneInfo.name}
                      </h3>
                      <p className="text-xs text-slate-705 text-slate-700">{selectedZoneInfo.description}</p>
                      <p className="text-[10px] text-slate-400 italic pt-1">Vector polygons mapped inside GKN Aerospace perimeter corridors.</p>
                    </div>
                  </InfoWindow>
                )}

              </Map>
            ) : (
              <div 
                className="w-full h-full min-h-[380px] bg-slate-950 relative overflow-hidden select-none font-mono"
                style={{ minHeight: '380px' }}
              >
                {/* SVG Tactical Vector Canvas */}
                <svg 
                  className="absolute inset-0 w-full h-full cursor-crosshair text-slate-800"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    const pctX = (clickX / rect.width) * 100;
                    const pctY = (clickY / rect.height) * 100;
                    const coords = convertXYToLatLng(pctX, pctY);
                    handleLocationSelected(coords);
                  }}
                >
                  {/* Grid Lines */}
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((gridX) => (
                    <line key={`gx-${gridX}`} x1={`${gridX}%`} y1="0%" x2={`${gridX}%`} y2="100%" stroke="rgba(51, 65, 85, 0.25)" strokeDasharray="4 4" />
                  ))}
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((gridY) => (
                    <line key={`gy-${gridY}`} x1="0%" y1={`${gridY}%`} x2="100%" y2={`${gridY}%`} stroke="rgba(51, 65, 85, 0.25)" strokeDasharray="4 4" />
                  ))}

                  <text x="2%" y="5%" fill="#475569" className="text-[9px]">GKN INCIDENT GRID [S-{MIN_LAT.toFixed(2)} W-{(0-MIN_LNG).toFixed(2)}]</text>
                  <text x="98%" y="95%" textAnchor="end" fill="#475569" className="text-[9px]">TACTICAL STANDALONE CORE</text>

                  {/* Warning Polygons (rendered bottom-up -> watch, sip, mandatory) */}
                  {[...MOCK_ZONES].reverse().map((zone) => {
                    const pointsStr = zone.polyPaths.map(pt => {
                      const { x, y } = getXY(pt.lat, pt.lng);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <polygon
                        key={zone.id}
                        points={pointsStr}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedZoneInfo(zone);
                        }}
                        fill={zone.color}
                        fillOpacity={0.15}
                        stroke={zone.color}
                        strokeWidth={1.5}
                        strokeDasharray={zone.status === 'watch' ? '4,4' : undefined}
                        className="cursor-pointer transition-all hover:fill-opacity-25"
                      />
                    );
                  })}

                  {/* Routing Evacuation line overlay */}
                  {userLatLng && routingShelter && (() => {
                    const originXY = getXY(userLatLng.lat, userLatLng.lng);
                    const destXY = getXY(routingShelter.lat, routingShelter.lng);
                    return (
                      <g>
                        <line
                          x1={`${originXY.x}%`}
                          y1={`${originXY.y}%`}
                          x2={`${destXY.x}%`}
                          y2={`${destXY.y}%`}
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeOpacity="0.8"
                          strokeDasharray="6,6"
                        />
                        {/* Pulse slider */}
                        <circle cx={`${originXY.x}%`} cy={`${originXY.y}%`} r="5" fill="#3b82f6">
                          <animate
                            attributeName="cx"
                            from={`${originXY.x}%`}
                            to={`${destXY.x}%`}
                            dur="3s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="cy"
                            from={`${originXY.y}%`}
                            to={`${destXY.y}%`}
                            dur="3s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </g>
                    );
                  })()}
                </svg>

                {/* User Beacon Pin marker */}
                {userLatLng && (() => {
                  const { x, y } = getXY(userLatLng.lat, userLatLng.lng);
                  return (
                    <div 
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-2 pointer-events-none"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div className="absolute w-8 h-8 bg-blue-500 rounded-full blur-sm opacity-50 animate-ping"></div>
                      <div className="relative w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow flex items-center justify-center text-white">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Closures */}
                {MOCK_CLOSURES.map((closure) => {
                  const { x, y } = getXY(closure.lat, closure.lng);
                  return (
                    <button
                      key={closure.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClosure(closure);
                      }}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center bg-red-655 hover:scale-110 active:scale-95 bg-red-600 border border-slate-900 shadow-md text-[10px] p-0.5 rounded cursor-pointer h-7 w-7 transition-all shrink-0"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      ❌
                    </button>
                  );
                })}

                {/* Shelters */}
                {MOCK_SHELTERS.map((shelter) => {
                  const { x, y } = getXY(shelter.lat, shelter.lng);
                  return (
                    <button
                      key={shelter.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShelter(shelter);
                        setActiveTab('shelters');
                      }}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 hover:bg-slate-850 hover:border-white border-2 border-indigo-500 shadow-lg text-[9px] px-1.5 py-0.5 rounded select-none cursor-pointer flex items-center gap-0.5 shrink-0"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <span>🏥</span>
                      <span className="font-mono text-[8px] text-indigo-300 font-bold tracking-tight">
                        {shelter.id === 'shelter_mag' ? 'MAGNOLIA' : shelter.id === 'shelter_ggcc' ? 'GG-CTR' : 'STANTON'}
                      </span>
                    </button>
                  );
                })}

                {/* Overlay details cards for Sandbox Mode */}
                {selectedShelter && (
                  <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 bg-slate-900/95 border border-slate-800 rounded-lg p-3 max-w-xs text-xs space-y-1.5 shadow-2xl pointer-events-auto z-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>🏥</span> {selectedShelter.name}
                      </h3>
                      <button onClick={() => setSelectedShelter(null)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">{selectedShelter.address}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedShelter.features.includes('pet-friendly') && (
                        <span className="bg-emerald-500/10 text-[9px] text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold animate-pulse">
                          {dictionary.petFriendlySymbol}
                        </span>
                      )}
                      {selectedShelter.features.includes('ada') && (
                        <span className="bg-indigo-500/10 text-[9px] text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold">
                          {dictionary.adaAccessibleSymbol}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-yellow-500 font-bold pt-1">{selectedShelter.capacityInfo}</p>
                    <button
                      onClick={() => {
                        if (userLatLng) {
                          computeEvacRoute(userLatLng, selectedShelter);
                          setSelectedShelter(null);
                        } else {
                          const fallbackLoc = { lat: 33.791, lng: -118.001 };
                          setUserLatLng(fallbackLoc);
                          computeEvacRoute(fallbackLoc, selectedShelter);
                          setSelectedShelter(null);
                        }
                      }}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] font-bold py-1.5 rounded uppercase cursor-pointer"
                    >
                      {dictionary.routeToShelter}
                    </button>
                  </div>
                )}

                {selectedClosure && (
                  <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-slate-800 rounded-lg p-3 max-w-xs text-xs space-y-1.5 shadow-2xl pointer-events-auto z-50">
                    <div className="flex items-center justify-between font-mono">
                      <h4 className="font-bold text-red-400 flex items-center gap-1">
                        ⛔ ROAD CLOSED INDEX
                      </h4>
                      <button onClick={() => setSelectedClosure(null)} className="text-slate-400 hover:text-slate-100 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="font-bold text-slate-200">{selectedClosure.name}</p>
                    <p className="text-[10px] text-slate-400 italic">{selectedClosure.reason}</p>
                  </div>
                )}

                {selectedZoneInfo && (
                  <div className="absolute top-4 left-4 bg-slate-900/95 border border-slate-800 rounded-lg p-3 max-w-xs text-xs space-y-1.5 shadow-2xl pointer-events-auto z-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: selectedZoneInfo.color }}>
                        <span>🚨</span> {selectedZoneInfo.name}
                      </h3>
                      <button onClick={() => setSelectedZoneInfo(null)} className="text-slate-400 hover:text-slate-100 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-slate-200">{selectedZoneInfo.description}</p>
                    <p className="text-[9px] text-slate-500 italic pt-1">Vector polygons mapped inside GKN Aerospace perimeter corridors.</p>
                  </div>
                )}

                {/* Reminders to click address on map */}
                {!userLatLng && (
                  <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2 text-center select-none pointer-events-none p-4 bg-slate-950/80 border border-slate-850 rounded-lg shadow-xl backdrop-blur-sm z-10">
                    <MapPin className="w-8 h-8 text-blue-500 animate-bounce mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-200">TACTICAL SANDBOX READY</p>
                    <p className="text-[9px] text-slate-400 max-w-xs mx-auto mt-1">
                      Pick any GKN scenario address shortcut above, or simply click anywhere directly on the map surface to simulate warning diagnostics.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Map Legend Floating Overlay corner controls */}
            <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800/80 rounded-lg p-3 max-w-[200px] pointer-events-auto space-y-2 text-[10px] font-mono shadow-2xl">
              <span className="font-bold text-slate-300 block uppercase border-b border-slate-800 pb-1">Zone Legend Map</span>
              <div className="space-y-1.5">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-0.5 rounded"
                  onClick={() => setSelectedZoneInfo(MOCK_ZONES[0])}
                >
                  <span className="w-3 h-3 bg-red-600 rounded shrink-0"></span>
                  <span className="text-slate-200">Mandatory (Red)</span>
                </div>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-0.5 rounded"
                  onClick={() => setSelectedZoneInfo(MOCK_ZONES[1])}
                >
                  <span className="w-3 h-3 bg-yellow-500 rounded shrink-0"></span>
                  <span className="text-slate-200">SIP (Yellow)</span>
                </div>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-0.5 rounded"
                  onClick={() => setSelectedZoneInfo(MOCK_ZONES[2])}
                >
                  <span className="w-3 h-3 bg-orange-500 rounded shrink-0"></span>
                  <span className="text-slate-200">Watch (Orange)</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-900 text-slate-400">
                  <span>🏥</span>
                  <span>Evacuation Shelters</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-red-500 font-bold text-xs">❌</span>
                  <span>Active Road Block</span>
                </div>
              </div>
            </div>

            {/* Float actions: zoom controller / reset positioning */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  if (map) {
                    map.setZoom(12);
                    map.panTo({ lat: 33.784, lng: -118.005 });
                  }
                }}
                className="p-2 bg-slate-900/95 border border-slate-800 text-slate-200 hover:text-white rounded-md flex items-center justify-center shadow-lg transition"
                title={dictionary.recenterMap}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Details directions routes summary overlay */}
          {routingShelter && (
            <div className="bg-slate-950/95 border-t border-slate-800 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-600/10 text-blue-400 rounded border border-blue-500/20">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Active Directional Assistance Router</span>
                  <span className="text-slate-200 font-bold block">{routingShelter.name}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-[10px]">{routingShelter.capacityInfo}</span>
                <button
                  onClick={clearPolylines}
                  className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition text-[10px]"
                >
                  Clear Route
                </button>
              </div>
            </div>
          )}

        </section>

        {/* SIDE PANELS WITH COMPREHENSIVE TAB GROUPS (40% equivalent -> 5 cols) */}
        <section className="lg:col-span-5 flex flex-col border border-slate-800 bg-slate-900 rounded-lg overflow-hidden min-h-[450px]">
          
          {/* Tabs Navigation Header Section */}
          <nav className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 p-1">
            <button
              onClick={() => setActiveTab('guidance')}
              className={`flex-1 py-3 text-center font-mono text-[10px] md:text-xs font-bold uppercase transition tracking-wider border-b-2 cursor-pointer ${
                activeTab === 'guidance' ? 'text-blue-405 border-blue-500 text-blue-400' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              📋 {dictionary.guidanceTab.split(' ')[0]}
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`flex-1 py-3 text-center font-mono text-[10px] md:text-xs font-bold uppercase transition tracking-wider border-b-2 cursor-pointer ${
                activeTab === 'checklist' ? 'text-blue-405 border-blue-500 text-blue-400' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              ✅ {dictionary.checklistTab.split(' ')[0]}
            </button>
            <button
              onClick={() => setActiveTab('shelters')}
              className={`flex-1 py-3 text-center font-mono text-[10px] md:text-xs font-bold uppercase transition tracking-wider border-b-2 cursor-pointer ${
                activeTab === 'shelters' ? 'text-blue-405 border-blue-500 text-blue-400' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              🏥 {dictionary.sheltersTab.split(' ')[0]}
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className={`flex-1 py-3 text-center font-mono text-[10px] md:text-xs font-bold uppercase transition tracking-wider border-b-2 cursor-pointer relative ${
                activeTab === 'assistant' ? 'text-blue-405 border-blue-500 text-blue-400' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              💬 {dictionary.assistantTab.split(' ')[0]}
              <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            </button>
          </nav>

          {/* ACTIVE CONTENT VIEWER AREA */}
          <div className="flex-1 p-4 md:p-5 overflow-y-auto max-h-[500px]">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: GUIDANCE */}
              {activeTab === 'guidance' && (
                <motion.div
                  key="guidance"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-xs font-sans text-slate-300"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="font-mono text-xs font-bold uppercase text-slate-200">Incident Safety Instructions</span>
                  </div>

                  {/* Status Dependent Guidance Section */}
                  <div className="p-4 rounded border border-slate-800 bg-slate-950 font-mono text-xs text-slate-400 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Recommended Protection Checklist:</span>
                      <button
                        onClick={() => {
                          const txt = currentStatus === 'mandatory' ? dictionary.statusMandatoryText : currentStatus === 'shelter_in_place' ? dictionary.statusSipText : dictionary.statusWatchText;
                          speak(txt, currentLang);
                        }}
                        className="text-slate-400 hover:text-white"
                        title="Speak aloud"
                      >
                        🔊 Hear Instructions
                      </button>
                    </div>

                    <p className="text-slate-200 leading-relaxed">
                      {currentStatus === 'mandatory' && dictionary.statusMandatoryText}
                      {currentStatus === 'shelter_in_place' && dictionary.statusSipText}
                      {currentStatus === 'watch' && dictionary.statusWatchText}
                      {currentStatus === 'safe' && dictionary.statusSafeText}
                    </p>

                    <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Status Level: {currentStatus.toUpperCase()}</span>
                      <span>Updated 2 Mins ago</span>
                    </div>
                  </div>

                  {/* Chemical facts info panels */}
                  <div className="space-y-2 mt-4">
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Chemical Fact Sheet: Methyl Methacrylate</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="p-2 border border-slate-800 rounded bg-slate-950">
                        <span className="text-slate-500 block">Common Name / Formula</span>
                        <span className="text-slate-200 font-bold">MMA / C₅H₈O₂</span>
                      </div>
                      <div className="p-2 border border-slate-800 rounded bg-slate-950">
                        <span className="text-slate-500 block">Scent Markers</span>
                        <span className="text-slate-200 font-bold">Sweet, Acrid, Fruity Odor</span>
                      </div>
                      <div className="p-2 border border-slate-800 rounded bg-slate-950">
                        <span className="text-slate-500 block">Exposure Hazards</span>
                        <span className="text-slate-200 font-bold">Irritates eyes, skin, respiratory membranes</span>
                      </div>
                      <div className="p-2 border border-slate-800 rounded bg-slate-950">
                        <span className="text-slate-500 block">Thermal Limits</span>
                        <span className="text-slate-200 font-bold">High Expansion, Rupture Risk</span>
                      </div>
                    </div>
                    
                    <div className="border border-yellow-500/10 rounded-lg p-3.5 bg-yellow-950/20 text-[11px] leading-relaxed">
                      <span className="text-yellow-400 font-bold block mb-1">🚨 Warning: Exposure Action plan</span>
                      If you experience eye tearing, persistent coughing, raw burning sensation on skin or throat, evacuate immediate outer wind bounds and seek clean atmosphere sectors.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: CHECKLIST */}
              {activeTab === 'checklist' && (
                <motion.div
                  key="checklist"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-xs font-sans text-slate-300"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-xs font-bold uppercase text-slate-200">Household Safety Checklist</span>
                  </div>

                  {/* Input questionnaire builder */}
                  {checklistItems.length === 0 ? (
                    <div className="space-y-3 font-mono">
                      <p className="text-[11px] text-slate-400">
                        Answer 5 quick household parameters to let Gemini AI generate custom evacuation instructions for your precise safety needs.
                      </p>

                      <div className="space-y-3 p-4 border border-slate-800 bg-slate-950 rounded-lg">
                        {/* Pets options */}
                        <div>
                          <label className="text-[10px] text-slate-500 block uppercase font-bold mb-1">{dictionary.householdPets}</label>
                          <select
                            value={hasPets}
                            onChange={(e) => setHasPets(e.target.value)}
                            className="bg-slate-900 border border-slate-700 py-1.5 px-3 rounded w-full text-slate-200"
                          >
                            <option value="None">None</option>
                            <option value="Dogs">Dogs</option>
                            <option value="Cats">Cats</option>
                            <option value="Other">Other pets</option>
                          </select>
                        </div>

                        {/* Children options */}
                        <div>
                          <label className="text-[10px] text-slate-500 block uppercase font-bold mb-1">{dictionary.householdChildren}</label>
                          <select
                            value={hasChildren}
                            onChange={(e) => setHasChildren(e.target.value)}
                            className="bg-slate-900 border border-slate-700 py-1.5 px-3 rounded w-full text-slate-200"
                          >
                            <option value="None">None</option>
                            <option value="Infant">Infant (requires formula/diapers)</option>
                            <option value="Toddler">Toddler</option>
                            <option value="School-age">School-age</option>
                          </select>
                        </div>

                        {/* Switch support */}
                        <div className="flex justify-between items-center py-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold">{dictionary.householdElderly}</label>
                          <button
                            onClick={() => setHasElderly(!hasElderly)}
                            className={`px-3 py-1 text-[10px] rounded border transition font-bold ${hasElderly ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
                          >
                            {hasElderly ? 'Yes' : 'No'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center py-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold">{dictionary.householdMeds}</label>
                          <button
                            onClick={() => setHasMeds(!hasMeds)}
                            className={`px-3 py-1 text-[10px] rounded border transition font-bold ${hasMeds ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
                          >
                            {hasMeds ? 'Yes' : 'No'}
                          </button>
                        </div>

                        {/* Time deadline specs */}
                        <div>
                          <label className="text-[10px] text-slate-500 block uppercase font-bold mb-1">{dictionary.evacTimeLimit}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['10 min', '30 min', 'Shelter in place'].map((time) => (
                              <button
                                key={time}
                                onClick={() => setEvacTime(time)}
                                className={`py-1.5 rounded text-[10px] border transition ${evacTime === time ? 'bg-blue-600/20 text-blue-400 border-blue-500/45 font-bold' : 'bg-slate-900 text-slate-400 border-slate-850 border-slate-800'}`}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          onClick={triggerChecklistGeneration}
                          disabled={generatingChecklist}
                          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold py-3 px-4 rounded shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {generatingChecklist ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>{dictionary.loadingChecklist}</span>
                            </>
                          ) : (
                            <span>{dictionary.generateChecklist}</span>
                          )}
                        </button>

                      </div>
                    </div>
                  ) : (
                    // Display Checklist Output
                    <div className="space-y-4">
                      {/* Live progress details */}
                      <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          <span>Checklist Progress Tracker</span>
                          <span className="font-bold text-slate-200">{checklistProgress}% Completed</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${checklistProgress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Task elements map */}
                      <div className="space-y-3 font-mono">
                        {checklistItems.map((item, index) => (
                          <div 
                            key={item.priority}
                            className={`p-3 border rounded transition-all flex gap-3 items-start ${
                              completedTasks[item.priority] 
                                ? 'bg-slate-950/40 border-slate-900 text-slate-500' 
                                : 'bg-slate-950 border-slate-800 text-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!!completedTasks[item.priority]}
                              onChange={() => handleToggleTask(item.priority)}
                              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 accent-blue-600 shrink-0 cursor-pointer"
                              aria-label={`Mark task completed: ${item.task}`}
                            />
                            
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <span className={`text-[11px] font-bold block ${completedTasks[item.priority] ? 'line-through' : ''}`}>
                                  {index + 1}. {item.task}
                                </span>
                                <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.2 rounded shrink-0">
                                  {item.estimatedTime}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 block leading-normal">
                                {item.why}
                              </span>
                            </div>

                            {/* Speak block element */}
                            <button
                              onClick={() => speak(`${item.task}. ${item.why}`, currentLang)}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                              title="Hear task aloud"
                            >
                              🔊
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex justify-between gap-2">
                        <button
                          onClick={() => setChecklistItems([])}
                          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 hover:underline"
                        >
                          Modify Household Settings
                        </button>

                        <button
                          onClick={() => {
                            const completedCount = Object.keys(completedTasks).length;
                            speak(`You have completed ${completedCount} of ${checklistItems.length} essential evacuation items. Keep up the good progress.`, currentLang);
                          }}
                          className="text-[10px] font-mono text-blue-400 hover:text-blue-300"
                        >
                          Speak Progress Update
                        </button>
                      </div>

                    </div>
                  )}

                </motion.div>
              )}

              {/* TAB 3: SHELTERS */}
              {activeTab === 'shelters' && (
                <motion.div
                  key="shelters"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-xs font-sans text-slate-300"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-xs font-bold uppercase text-slate-200">Active Emergency Shelters</span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400">
                    If you are situated in Red mandatory or Acrid sectors, evacuate immediately to safe locations. Select a refuge below to highlight on the interactive vector map:
                  </p>

                  <div className="space-y-3 font-mono">
                    {MOCK_SHELTERS.map((shelter) => (
                      <div 
                        key={shelter.id}
                        onClick={() => {
                          setSelectedShelter(shelter);
                          if (map) {
                            map.panTo({ lat: shelter.lat, lng: shelter.lng });
                            map.setZoom(15);
                          }
                        }}
                        className={`p-3 border rounded-lg transition-all cursor-pointer ${
                          routingShelter?.id === shelter.id 
                            ? 'bg-blue-955/40 border-blue-500/40 text-blue-100 ring-1 ring-blue-500/20' 
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-[11px] block text-slate-100">{shelter.name}</span>
                          <span className="text-[9px] text-emerald-400 uppercase font-bold shrink-0">Open</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{shelter.address}</span>
                        
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {shelter.features.map(feat => (
                            <span 
                              key={feat}
                              className="bg-slate-900 border border-slate-800 text-[9px] text-slate-400 px-1.5 py-0.5 rounded font-bold"
                            >
                              {feat === 'pet-friendly' ? dictionary.petFriendlySymbol : dictionary.adaAccessibleSymbol}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-900/50 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 font-bold">{shelter.capacityInfo}</span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (userLatLng) {
                                computeEvacRoute(userLatLng, shelter);
                              } else {
                                alert('Please declare address above to calculate directions.');
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold py-1 px-2.5 rounded transition uppercase"
                          >
                            Route Safe Path
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: CHATBOT ASSISTANT */}
              {activeTab === 'assistant' && (
                <motion.div
                  key="assistant"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-xs font-sans text-slate-300 flex flex-col h-full"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-blue-400" />
                      <span className="font-mono text-xs font-bold uppercase text-slate-200">Incident AI Assistant</span>
                    </div>
                    <span className="text-[9px] bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-mono">Gemini-3.5 Active</span>
                  </div>

                  {/* Suggestion Starter chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => sendChatMessage(dictionary.starterQ1)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded text-[9px] px-2 py-1 font-mono transition"
                    >
                      {dictionary.starterQ1}
                    </button>
                    <button
                      onClick={() => sendChatMessage(dictionary.starterQ2)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded text-[9px] px-2 py-1 font-mono transition"
                    >
                      {dictionary.starterQ2}
                    </button>
                    <button
                      onClick={() => sendChatMessage(dictionary.starterQ3)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded text-[9px] px-2 py-1 font-mono transition"
                    >
                      {dictionary.starterQ3}
                    </button>
                  </div>

                  {/* Chat scrolling viewport */}
                  <div className="flex-1 bg-slate-950 p-3 rounded-lg border border-slate-800 h-[280px] overflow-y-auto space-y-3 min-h-[220px]">
                    {chatLog.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex flex-col space-y-0.5 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[9px] text-slate-500 font-mono">
                          {msg.sender === 'user' ? 'Resident' : 'HazAlert AI'} • {msg.timestamp}
                        </span>
                        
                        <div className="flex items-end gap-1.5 max-w-[85%]">
                          <div className={`p-2.5 rounded-lg text-[11px] leading-relaxed font-mono ${
                            msg.sender === 'user' 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                          }`}>
                            {msg.text}
                          </div>
                          
                          {msg.sender === 'assistant' && (
                            <button
                              onClick={() => speak(msg.text, currentLang)}
                              className="text-slate-500 hover:text-slate-300 text-[10px] self-end p-1 hover:bg-slate-900 rounded"
                              title="Speak response"
                            >
                              🔊
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>●</span>
                        <span>Gemini analyzing chemical incident boundaries...</span>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInputMessage}
                      onChange={(e) => setUserInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendChatMessage();
                      }}
                      placeholder={dictionary.chatPlaceholder}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded font-mono text-xs text-white p-2.5 focus:outline-none min-h-[44px]"
                    />
                    <button
                      onClick={() => sendChatMessage()}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold px-4 rounded transition cursor-pointer shrink-0 min-h-[44px]"
                    >
                      Send
                    </button>
                  </div>

                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Social good disclaimer footer inside tab body */}
          <footer className="bg-slate-950/80 border-t border-slate-800 p-3.5 text-center text-[9px] text-slate-500 leading-normal font-mono">
            {dictionary.emergencyDisclaimer}
          </footer>

        </section>

      </main>

      {/* Key Setup Procedures Modal Overlay */}
      {showKeySetup && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in pointer-events-auto">
          <div className="max-w-md w-full border border-slate-800 bg-slate-900 rounded-lg p-6 relative overflow-hidden shadow-2xl space-y-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-slate-100 font-mono text-sm uppercase tracking-wider">HazAlert Key Activation</h3>
              </div>
              <button 
                onClick={() => setShowKeySetup(false)}
                className="text-slate-400 hover:text-slate-100 cursor-pointer p-0.5 rounded transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 font-mono">
              <p>
                An active Google Maps Platform API key is required to render emergency evacuation warnings, vector polygons, route optimization vectors, and resident lookup services.
              </p>

              {/* Faulty Key Warn notice */}
              {mapsAuthFailed && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-[11px] leading-normal space-y-1">
                  <span className="font-bold uppercase tracking-wider block">⚠️ Faulty API Key Detected (Auth Error)</span>
                  <p>
                    Google Maps Platform rejected the current key. Please paste a corrected API key below to re-validate, or clear it to continue in simulated Sandbox mode.
                  </p>
                </div>
              )}

              {/* API Key Override Input Form */}
              <div className="space-y-2 border border-slate-800 rounded p-4 bg-slate-950/50">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Quick Bypass / Change API Key:
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AIzaSy... (Paste key here)"
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded font-mono text-xs text-slate-100 px-3 py-2.5 focus:outline-none placeholder-slate-700 h-10"
                  />
                  {currentApiKey && (
                    <button
                      onClick={() => {
                        setKeyInput('');
                        onSaveLocalKey('');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 font-bold text-[10px] uppercase rounded transition-all border border-slate-700/50 cursor-pointer h-10"
                      title="Clear Stored Key"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveLocalKey(keyInput)}
                    disabled={!keyInput.trim() || keyInput.trim() === currentApiKey}
                    className={`flex-1 font-bold py-2 rounded text-center text-[10px] uppercase cursor-pointer transition-all ${
                      keyInput.trim() && keyInput.trim() !== currentApiKey
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg animate-pulse'
                        : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
                    }`}
                  >
                    Save & Validate Key
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 italic block">
                  Stored securely in browser local state to avoid server reboot delays.
                </p>
              </div>

              <div className="border border-slate-800/80 rounded p-4 bg-slate-950 space-y-3">
                <h4 className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Configure System Environment Key:</h4>
                <ol className="list-decimal list-inside space-y-2 text-[10px] text-slate-400 font-sans">
                  <li>
                    <a 
                      href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 underline hover:text-blue-300 inline-flex items-center gap-1 font-mono font-bold"
                    >
                      Obtain raw API Key <ChevronRight className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Click standard <span className="text-slate-200 font-bold">Settings (⚙️ gear icon, top-right corner)</span>.</li>
                  <li>Choose <span className="text-slate-200 font-bold">Secrets</span>, and record secret name: <code className="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">GOOGLE_MAPS_PLATFORM_KEY</code>.</li>
                  <li>Paste the key and press Enter. The compilation server reboots automatically.</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowKeySetup(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-200 font-bold py-2 rounded text-center cursor-pointer transition-all border border-slate-700/50 uppercase tracking-wider text-[11px]"
                >
                  Continue in Sandbox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component wrapper which handles drawing stripes pattern and coordinates logic on Google Map Canvas
function ZonePolygonRendering({ zone, onClick }: { zone: Zone; onClick: () => void; key?: string }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map || !zone) return;

    // Build google lat/lng polygon bounds vector
    const gPoly = new google.maps.Polygon({
      paths: zone.polyPaths,
      strokeColor: zone.color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: zone.color,
      fillOpacity: 0.25,
      map: map,
      zIndex: zone.status === 'mandatory' ? 3 : zone.status === 'shelter_in_place' ? 2 : 1
    });

    // Implement clickable event handlers safely
    google.maps.event.addListener(gPoly, 'click', () => {
      onClick();
    });

    polygonRef.current = gPoly;

    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
    };

  }, [map, zone]);

  return null;
}
