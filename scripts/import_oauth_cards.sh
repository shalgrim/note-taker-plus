#!/bin/bash
#
# ONE-TIME SCRIPT: Import OAuth Anki cards into Note Taker Plus
#
# Background:
#   On 2026-03-16 we needed to import 21 OAuth flashcards from an Anki export
#   (Oauth.apkg) into production. There was no import tooling, so this script
#   was hand-built by extracting card content from the apkg and hardcoding
#   curl calls to the POST /cards API.
#
# How the cards were extracted from the .apkg:
#   1. Unzip the .apkg (it's a zip archive)
#   2. Decompress collection.anki21b with: zstd -d collection.anki21b -o collection.sqlite
#   3. Query: sqlite3 collection.sqlite "SELECT flds FROM notes;"
#   4. Fields are separated by \x1f (unit separator); field 1 = front, field 2 = back
#   5. Line breaks in card content are <br> tags
#
# Shortcomings:
#   - Cards are hardcoded — not reusable for other .apkg files
#   - No dry-run mode
#   - Tags are hardcoded to ["oauth"]
#   - No duplicate detection
#   - Requires jq
#
# See issue #13 for the generalizable replacement.
#
# Usage: NOTE_TAKER_PLUS_API_KEY_PROD=your-key ./import_oauth_cards.sh [API_URL]

API_URL="${1:-https://note-taker-plus-production.up.railway.app}"
API_URL="${API_URL%/}"  # strip trailing slash

if [ -z "$NOTE_TAKER_PLUS_API_KEY_PROD" ]; then
  echo "Set NOTE_TAKER_PLUS_API_KEY_PROD env var first:"
  echo "  export NOTE_TAKER_PLUS_API_KEY_PROD=your-key"
  exit 1
fi

create_card() {
  local front="$1"
  local back="$2"
  local payload
  payload=$(jq -n --arg f "$front" --arg b "$back" \
    '{front: $f, back: $b, tags: ["oauth"]}')
  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/cards" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $NOTE_TAKER_PLUS_API_KEY_PROD" \
    -d "$payload")
  local http_code
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" = "201" ]; then
    echo "OK: $front"
  else
    echo "FAIL ($http_code): $front"
    echo "$response" | head -1
  fi
}

echo "Importing 21 OAuth cards to $API_URL..."
echo

create_card "What are the three main entities in OAuth?" \
  "1. Resource Owner (the user)
2. Client (your application)
3. Authorization Server (e.g., Google)"

create_card "What's the difference between client_id and client_secret?" \
  "client_id: Public identifier for your app, can be in frontend code
client_secret: Private credential, must stay on backend only"

create_card "Walk through the OAuth authorization code flow" \
  "1. User clicks \"Connect\"
2. Redirect to authorization server with client_id, redirect_uri, scope
3. User logs in and approves
4. Auth server redirects back with authorization code
5. Backend exchanges code + client_secret for tokens
6. Receive access_token and refresh_token"

create_card "Why must the code exchange happen on the backend?" \
  "1. client_secret must never be exposed to frontend
2. Access token shouldn't be in browser (XSS risk, extensions, DevTools)
3. Safer storage - can encrypt tokens in database"

create_card "What security purpose does redirect_uri registration serve?" \
  "Prevents redirect attacks - attacker can't set redirect_uri to their own site to steal the authorization code"

create_card "Can an attacker use an intercepted authorization code?" \
  "No, because:
1. They don't have the client_secret needed for exchange
2. redirect_uri must match what's registered with auth server"

create_card "What is PKCE and what problem does it solve?" \
  "Proof Key for Code Exchange - prevents authorization code interception attacks, especially for mobile/SPA apps without client_secret"

create_card "How does PKCE work?" \
  "1. Generate random code_verifier
2. Hash it to create code_challenge
3. Send code_challenge with auth request
4. Auth server stores the hash
5. Send original code_verifier when exchanging code
6. Server verifies hash matches"

create_card "Why can't an attacker reverse the PKCE code_challenge?" \
  "SHA256 hashing is one-way - computationally infeasible to reverse the hash back to the original code_verifier"

create_card "Should you hash or encrypt OAuth tokens in your database?" \
  "Encrypt (not hash) - you need to decrypt and use the actual token value to make API calls. Use AES-256 with key in secure location."

create_card "What happens when you get a 401 from an API call?" \
  "1. Try refreshing the access token using refresh_token
2. Retry original request with new access token
3. If refresh fails, send user through OAuth flow again"

create_card "When you use a refresh token, what do you get back?" \
  "New access_token, and possibly a new refresh_token (depends on provider - Google sometimes rotates them)"

create_card "Does the user need to be involved when refreshing tokens?" \
  "No - it's entirely backend-to-backend, which allows apps to maintain access indefinitely"

create_card "What happens if you need to request additional OAuth scopes later?" \
  "User must go through the OAuth flow again - authorization server will show consent screen with new permissions"

create_card "What are access tokens used for?" \
  "Making API calls to access user's resources (e.g., reading their calendar)"

create_card "What are refresh tokens used for?" \
  "Getting new access tokens when they expire, without user re-authentication"

create_card "What information is sent in the initial authorization redirect?" \
  "client_id, redirect_uri, scope, response_type=code, state (for CSRF protection)"

create_card "What's included in the token exchange request?" \
  "code (authorization code), client_id, client_secret, redirect_uri, grant_type=authorization_code"

create_card "Why is the authorization code short-lived?" \
  "Security - limits the window for interception attacks. Codes typically expire in minutes."

create_card "Why can't mobile apps and SPAs keep a client_secret secure?" \
  "All their code runs on the user's device:
- Mobile: App binary can be decompiled/reverse-engineered
- SPA: JavaScript is visible in browser DevTools
- No backend means the secret must be embedded in client code
- If one user extracts it, they can impersonate your entire app"

create_card "What's the difference between OAuth and OpenID Connect?" \
  "OAuth is for authorization (accessing resources). OpenID Connect adds authentication layer on top of OAuth for user identity/login."

echo
echo "Done!"
