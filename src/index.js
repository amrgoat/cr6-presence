#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import discord from "discord.js-selfbot-v13";

const { Client, RichPresence } = discord;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "config.json");
const DRY_RUN = process.argv.includes("--dry-run");
const STATUSES = ["online", "idle", "dnd", "invisible"];
// Discord activity types: what the card says before your name.
const PRESENCE_TYPES = { playing: 0, listening: 2, watching: 3, competing: 5 };

const log = (...args) => console.log("•", ...args);

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    fail("config.json not found next to package.json.");
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (err) {
    fail(`config.json is not valid JSON: ${err.message}`);
  }

  const cfg = {
    applicationId: String(process.env.APPLICATION_ID ?? raw.applicationId ?? "").trim(),
    name: String(raw.name ?? "CR6").trim(),
    details: String(raw.details ?? "Almost A Legend Call Me CR6").trim(),
    state: String(raw.state ?? "❄️").trim(),
    pfp: String(process.env.PFP ?? raw.pfp ?? "").trim(),
    buttonLabel: String(raw.button?.label ?? "❄️ Add me").trim(),
    buttonUrl: String(process.env.FRIEND_LINK ?? raw.button?.url ?? "").trim(),
    showTimer: raw.showTimer !== false,
    status: String(process.env.STATUS ?? raw.status ?? "online").trim().toLowerCase(),
    type: String(process.env.TYPE ?? raw.type ?? "playing").trim().toLowerCase(),
  };

  if (!/^\d{17,20}$/.test(cfg.applicationId)) {
    fail(
      "config.applicationId must be your Discord Application ID (17-20 digits).\n" +
        "  Create one at https://discord.com/developers/applications → General Information.",
    );
  }

  if (!cfg.buttonUrl || !/^https?:\/\//i.test(cfg.buttonUrl)) {
    fail(
      'config.button.url must be an http(s) link — e.g. "https://discord.com/users/YOUR_ID".',
    );
  }

  if (cfg.buttonLabel.length > 32) fail("config.button.label must be 32 characters or fewer.");
  if (cfg.name.length > 128 || cfg.details.length > 128) fail("name/details must be ≤128 chars.");
  if (cfg.state.length > 128) fail("state must be 128 characters or fewer.");
  if (!STATUSES.includes(cfg.status)) fail(`config.status must be one of: ${STATUSES.join(", ")}.`);
  if (!(cfg.type in PRESENCE_TYPES)) {
    fail(`config.type must be one of: ${Object.keys(PRESENCE_TYPES).join(", ")}.`);
  }
  if (!cfg.pfp) log("config.pfp is empty — the card will show without an icon.");

  return cfg;
}

function loadToken() {
  const fromEnv = process.env.DISCORD_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    process.loadEnvFile?.(join(ROOT, ".env"));
  } catch {
    // no .env file, fall through
  }

  const fromFile = process.env.DISCORD_TOKEN?.trim();
  if (fromFile) return fromFile;

  const tokenFile = join(ROOT, "token.txt");
  if (existsSync(tokenFile)) return readFileSync(tokenFile, "utf8").trim();

  return "";
}

function buildPresence(client, cfg) {
  const presence = new RichPresence(client)
    .setType(PRESENCE_TYPES[cfg.type])
    .setName(cfg.name)
    .setDetails(cfg.details)
    .setApplicationId(cfg.applicationId)
    .setButtons({ name: cfg.buttonLabel, url: cfg.buttonUrl });

  if (cfg.state) presence.setState(cfg.state);
  if (cfg.showTimer) presence.setStartTimestamp(new Date());

  if (cfg.pfp) {
    try {
      presence.setAssetsLargeImage(cfg.pfp);
    } catch {
      // Non-Discord https image: resolved through the external asset proxy after login.
    }
    presence.setAssetsLargeText(cfg.details);
  }

  return presence;
}

async function resolveExternalPfp(client, cfg, presence) {
  if (!cfg.pfp || presence.assets?.largeImage) return;
  if (!/^https?:\/\//i.test(cfg.pfp)) return;

  try {
    const [asset] = await RichPresence.getExternal(client, cfg.applicationId, cfg.pfp);
    if (asset?.external_asset_path) {
      presence.setAssetsLargeImage(asset.external_asset_path);
      log("Resolved external avatar through Discord's image proxy.");
    }
  } catch (err) {
    log(`Could not resolve external avatar (${err.message}) — using no icon.`);
  }
}

const cfg = loadConfig();

if (DRY_RUN) {
  const client = new Client({ checkUpdate: false });
  const presence = buildPresence(client, cfg);
  log("config is valid. Presence payload that would be sent:");
  console.log(JSON.stringify(presence.toJSON(), null, 2));
  log(`token: ${loadToken() ? "found" : "NOT set (add DISCORD_TOKEN to .env)"}`);
  process.exit(0);
}

const token = loadToken();
if (!token) {
  fail(
    "No token found.\n" +
      "  Copy .env.example to .env and set DISCORD_TOKEN=your_own_token.\n" +
      "  Never paste the token into chat, config.json or a commit.",
  );
}
if (/\s/.test(token)) {
  fail("That token contains whitespace — copy it again with no line breaks.");
}

const client = new Client({ checkUpdate: false });

client.on("ready", async () => {
  const presence = buildPresence(client, cfg);
  await resolveExternalPfp(client, cfg, presence);

  try {
    client.user.setPresence({ activities: [presence], status: cfg.status });
    log(`Logged in as ${client.user.tag} — presence is live.`);
    log(
      `${cfg.type} "${cfg.name}" / "${cfg.details}" / ${cfg.state || "no state"} / ${cfg.status} / button → ${cfg.buttonUrl}`,
    );
  } catch (err) {
    console.error(`✖ Could not set presence: ${err.message}`);
  }
});

client.on("error", (err) => console.error(`✖ Client error: ${err?.message ?? err}`));

client.on("disconnect", () => log("Disconnected — reconnecting…"));

process.on("SIGINT", () => {
  log("Shutting down.");
  client.destroy();
  process.exit(0);
});

log(`Connecting to Discord gateway (app ${cfg.applicationId})…`);

client.login(token).catch((err) => {
  const message = String(err?.message ?? err);
  if (/token/i.test(message)) {
    fail(`Login failed: ${message}\n  Check DISCORD_TOKEN in .env — it must be your own account token.`);
  }
  fail(`Login failed: ${message}`);
});
