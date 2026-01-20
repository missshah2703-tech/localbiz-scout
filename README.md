<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run LocalBizHunt (Google Maps only)

This app uses the Google Maps Places API to find and analyze local businesses. There is no Gemini / GenAI dependency anymore.

## Run Locally

**Prerequisites:** Node.js, a Google Maps Places API key

1. Install dependencies:
   `npm install`
2. Create [backend/.env](backend/.env) and set your Maps key:
   `GOOGLE_MAPS_API_KEY=YOUR_PLACES_API_KEY_HERE`
3. Start backend:
   `cd backend && npm run dev`
4. In another terminal, start frontend from project root:
   `npm run dev`
