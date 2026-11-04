# CR6 Presence (selfbot)

Sets your own Discord Rich Presence over the gateway with your user token — no desktop app
needs to be open, so it can sit on a VPS and stay up 24/7.

```
Playing  CR6
  Almost A Legend Call Me CR6
  ❄️
  [ ❄️ Add me ]  ← opens your friend link
```

> ⚠️ **Selfbots are against Discord's Terms of Service.** Automating a user account can get the
> account terminated, and this project needs your token. Use it on an account you can afford to
> lose. If you want the zero-risk version, ask me for the desktop RPC build instead — it shows
> the same card without touching a token.

## 1. Token

Copy `.env.example` to `.env` and fill in your own token:

```
DISCORD_TOKEN=your_token_here
```

Modern account tokens contain dots (`xxx.yyy.zzz`) — that's normal, paste the whole string.

`.env` is gitignored. Don't paste the token anywhere else (not in `config.json`, not in chat,
not in a screenshot).

## 2. Application ID

Buttons and the "Playing …" label need an app:

1. https://discord.com/developers/applications → **New Application** (any name).
2. **General Information** → copy the **Application ID** → `config.applicationId`.

## 3. Your pfp

Right-click your avatar in Discord → **Copy Image Link**, then:

```json
"pfp": "https://cdn.discordapp.com/avatars/....png"
```

At startup the image is registered with your application through Discord's external-assets
endpoint — that registration is what produces an `mp:external/…` path the client will actually
render. The console prints `Avatar registered with Discord: …` on success, or the reason it
failed. The image has to be publicly reachable over https.

Alternatively upload it under your app's **Rich Presence → Art Assets** and use the asset key
(`"pfp": "myart"`) — no registration needed, and the most reliable option.

## 4. Your friend link

```json
"button": { "label": "❄️ Add me", "url": "https://discord.com/users/YOUR_ID" }
```

That link opens your profile with **Add Friend** ready to click. URLs must be `http(s)`.

## 5. Run

```bash
npm install
npm start
```

Keep the process alive. `Ctrl+C` logs out cleanly.

## config.json

| Field | Meaning |
| --- | --- |
| `applicationId` | Your Application ID (**required**) |
| `name` | The "Playing …" line |
| `details` | Description line — `Almost A Legend Call Me CR6` |
| `state` | Second text line, this is where ❄️ reliably renders |
| `pfp` | Avatar URL or asset key for the big image |
| `button.label` / `button.url` | The one button (max 2; label ≤ 32 chars) |
| `showTimer` | `true` adds an elapsed timer |
| `type` | `playing` / `watching` / `listening` / `competing` — the verb before your name |
| `status` | `online` / `idle` / `dnd` / `invisible` — the dot next to your avatar |

For example, to show up as *Watching* while idle:

```json
"type": "watching",
"status": "idle"
```

Check everything without logging in:

```bash
npm run dry-run
```

## Notes

- **Buttons are only visible to other people.** Discord's own docs say you cannot see buttons
  on your own Rich Presence. If the label looks like plain text to you, check your profile from
  an alt account before assuming it is broken.
- **Button labels are plain text** — Discord usually drops the ❄️ from the label, which is why
  ❄️ also sits in `state`, where it does render.
- The activity is re-sent on every reconnect, so a dropped WiFi or sleep cycle recovers by
  itself.
- If Discord asks you to verify or logs the session out, that's the selfbot risk above.
