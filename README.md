# LA Fire Evacuation Router 🚨

The LA Fire Evacuation Router is a real-time emergency response tool that helps residents find the safest route to nearby shelters during wildfire emergencies by displaying active fires, emergency shelters, and calculating evacuation routes that avoid dangerous areas.

## Features

- 🔥 Real-time fire detection using NASA FIRMS data
- 🗺️ Interactive map showing active fires and emergency shelters
- 📍 Live geolocation tracking
- 🚗 Smart evacuation routing that avoids fire-affected areas
- 💻 Offline capability for emergency situations
- 🏥 Information about shelter capacity and facilities

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/yourusername/wildfireevacrouter
cd wildfireevacrouter

```

2. Add environment variables in (both are free) `.env.local`:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NEXT_PUBLIC_NASA_FIRMS_KEY=your_nasa_firms_key
```

3. Run development server:
```bash
npm run dev
```

## Stack

- Next.js
- TypeScript
- Mapbox GL JS
- NASA FIRMS API
- Tailwind CSS

