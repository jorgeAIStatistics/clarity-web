# Clarity — Web Front-End (the "face")

This is a Vite + React wrapper around your Clarity component (`src/Clarity.jsx`).
It fetches live profiles from your deployed API (the "brain") at:

    https://clarity-engine-api.onrender.com/api/profile

That URL is set inside src/Clarity.jsx as API_BASE.

## See it locally (2 minutes)

    npm install
    npm run dev

Opens http://localhost:5173 automatically. The local face talks to the live
Render API, so you'll see real graded profiles.

NOTE ON FIRST LOAD: the free Render API spins down when idle and takes up to
~50 seconds to wake. The first compound you open may hang, then be fast after.

NOTE ON CORS: the browser will block localhost -> onrender.com requests unless
your Flask app (app.py) sends CORS headers. If profiles fail to load with a
"CORS" error in the browser console, add flask-cors to app.py:

    from flask_cors import CORS
    CORS(app)

## Deploy it as a public site

    npm run build          # outputs static files to dist/

Then deploy dist/ as a Static Site on Render (New > Static Site), or drag it
into Vercel / Netlify. Set the publish directory to `dist` and the build
command to `npm run build`.
