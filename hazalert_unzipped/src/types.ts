export interface Zone {
  id: string;
  name: string;
  status: 'mandatory' | 'shelter_in_place' | 'watch' | 'safe';
  color: string;
  polyPaths: { lat: number; lng: number }[];
  description: string;
}

export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  features: string[]; // ['pet-friendly', 'ada']
  capacityInfo: string;
  phone: string;
}

export interface RoadClosure {
  id: string;
  name: string;
  lat: number;
  lng: number;
  reason: string;
}

export interface ChecklistItem {
  priority: number;
  task: string;
  why: string;
  estimatedTime: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
