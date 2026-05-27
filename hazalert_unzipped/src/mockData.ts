import { Zone, Shelter, RoadClosure } from './types';

export const MOCK_ZONES: Zone[] = [
  {
    id: 'mandatory_1',
    name: 'Mandatory Evacuation Zone (Red)',
    status: 'mandatory',
    color: '#dc2626',
    polyPaths: [
      { lat: 33.8021, lng: -118.0456 }, // Ball Rd & Valley View
      { lat: 33.8016, lng: -117.9651 }, // Ball Rd & Dale
      { lat: 33.7431, lng: -117.9642 }, // Trask Ave & Dale
      { lat: 33.7439, lng: -118.0461 }  // Trask Ave & Valley View
    ],
    description: 'Mandatory evacuation ordered. Extreme hazard. GKN Aerospace facility nearby consists of active runaway threat. Leave immediately.'
  },
  {
    id: 'shelter_1',
    name: 'Shelter-in-Place Zone (Yellow)',
    status: 'shelter_in_place',
    color: '#eab308',
    polyPaths: [
      { lat: 33.7876, lng: -118.0195 }, // Orangewood & Knott 
      { lat: 33.7871, lng: -117.9652 }, // Orangewood & Dale
      { lat: 33.7745, lng: -117.9648 }, // Garden Grove Blvd & Dale
      { lat: 33.7749, lng: -118.0201 }  // Garden Grove Blvd & Knott
    ],
    description: 'Shelter in place ordered. High hazard. Head indoors, seal all doors/windows, disable HVAC recirculate systems immediately.'
  },
  {
    id: 'watch_1',
    name: 'Preparedness Watch Zone (Orange)',
    status: 'watch',
    color: '#f97316',
    polyPaths: [
      { lat: 33.8165, lng: -118.0645 }, // Expand outwards
      { lat: 33.8155, lng: -117.9421 },
      { lat: 33.7291, lng: -117.9405 },
      { lat: 33.7311, lng: -118.0652 }
    ],
    description: 'Evacuation Alert Warning. Be prepared to leave at a moment notice. Pre-pack items, pack medications, keep fuel or charge levels full.'
  }
];

export const MOCK_SHELTERS: Shelter[] = [
  {
    id: 'shelter_mag',
    name: 'Magnolia High School Shelter',
    lat: 33.8152,
    lng: -117.9798,
    address: '2450 W Ball Rd, Anaheim, CA 92804',
    features: ['pet-friendly', 'ada'],
    capacityInfo: 'Capacity: 450/800 available',
    phone: '(714) 220-4000'
  },
  {
    id: 'shelter_ggcc',
    name: 'Garden Grove Community Center',
    lat: 33.7792,
    lng: -117.9392,
    address: '11300 Stanford Ave, Garden Grove, CA 92840',
    features: ['ada'],
    capacityInfo: 'Capacity: 120/500 available (No Pets Allowed)',
    phone: '(714) 741-5200'
  },
  {
    id: 'shelter_stan',
    name: 'Stanton Recreation Center',
    lat: 33.8011,
    lng: -117.9985,
    address: '7800 Katella Ave, Stanton, CA 90680',
    features: ['pet-friendly', 'ada'],
    capacityInfo: 'Capacity: 195/300 available',
    phone: '(714) 379-9222'
  }
];

export const MOCK_CLOSURES: RoadClosure[] = [
  {
    id: 'closure_1',
    name: 'Road Closed: Valley View St at Lampson Ave',
    lat: 33.7797,
    lng: -118.0458,
    reason: 'Hazmat Incident Perimeter Restriction'
  },
  {
    id: 'closure_2',
    name: 'Road Closed: Knott St at Chapman Ave',
    lat: 33.7885,
    lng: -118.0202,
    reason: 'Debris & Fire Response Support Vehicle Entry Only'
  }
];

// Helper to determine zone with highest priority risk
// mandatory (RED) > shelter_in_place (YELLOW) > watch (ORANGE) > safe (GREEN)
export function getZonePriority(status: string): number {
  switch (status) {
    case 'mandatory': return 3;
    case 'shelter_in_place': return 2;
    case 'watch': return 1;
    default: return 0;
  }
}
