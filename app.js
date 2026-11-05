"use strict";
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // web/src/lib/errors.ts
  var SpassError = class extends Error {
    constructor(code, message) {
      super(message);
      __publicField(this, "code");
      this.code = code;
      this.name = "SpassError";
    }
  };
  var WRONG_PASSWORD = "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password.";

  // web/src/lib/bytes.ts
  function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  function asBuffer(bytes) {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
  }

  // web/src/lib/header.ts
  var TYPE_TOKEN = /^(true|false|passwords?|credentials?|cards?|address(es)?|identit(y|ies)|notes?|secure_notes?)$/i;
  function looksLikeSpassPlaintext(text) {
    const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
    if (lines.length < 3) return false;
    const [first, second] = lines;
    let headerOk = false;
    if (first === "samsung_pass_export" && /^version:\s*\S+$/i.test(second)) headerOk = true;
    if (/^\d{1,4}$/.test(first)) {
      const tokens = second.split(/[;,]/).map((token) => token.trim()).filter(Boolean);
      headerOk = tokens.length > 0 && tokens.every((token) => TYPE_TOKEN.test(token));
    }
    if (!headerOk) return false;
    return lines.slice(2).some((line) => line === "next_table");
  }

  // web/src/lib/crypto.ts
  var SALT_BYTES = 20;
  var IV_BYTES = 16;
  var ITERATIONS = 7e4;
  var encoder = new TextEncoder();
  async function deriveKey(password, salt, usage) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: asBuffer(salt), iterations: ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-CBC", length: 256 },
      false,
      [usage]
    );
  }
  async function decryptSpass(fileText, password) {
    const compact = fileText.replace(/^\uFEFF/, "").replace(/\s+/g, "");
    if (!compact) throw new SpassError("format", "That file is empty.");
    let raw;
    try {
      raw = base64ToBytes(compact);
    } catch {
      throw new SpassError(
        "format",
        "This is not a Samsung Pass .spass file. Export again from Samsung Pass, or pick the .spass file rather than a screenshot."
      );
    }
    if (raw.length < SALT_BYTES + IV_BYTES + 16) {
      throw new SpassError("format", "This file is too small to be a Samsung Pass export.");
    }
    if ((raw.length - SALT_BYTES - IV_BYTES) % 16 !== 0) {
      throw new SpassError("format", "This file is not a complete Samsung Pass export.");
    }
    const salt = raw.subarray(0, SALT_BYTES);
    const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const ciphertext = raw.subarray(SALT_BYTES + IV_BYTES);
    let plain;
    try {
      const key = await deriveKey(password, salt, "decrypt");
      plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv: asBuffer(iv) }, key, asBuffer(ciphertext));
    } catch {
      throw new SpassError("password", WRONG_PASSWORD);
    }
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
    } catch {
      throw new SpassError("password", WRONG_PASSWORD);
    }
    if (!looksLikeSpassPlaintext(text)) throw new SpassError("password", WRONG_PASSWORD);
    return text;
  }

  // web/src/lib/parse.ts
  var DEFAULT_TYPES = ["passwords", "cards", "addresses", "notes"];
  var TYPE_ALIASES = {
    password: "passwords",
    passwords: "passwords",
    credential: "passwords",
    credentials: "passwords",
    card: "cards",
    cards: "cards",
    address: "addresses",
    addresses: "addresses",
    identity: "addresses",
    identities: "addresses",
    note: "notes",
    notes: "notes",
    secure_note: "notes",
    secure_notes: "notes"
  };
  var HEADER_HINTS = {
    passwords: ["password_value", "username_value", "origin_url", "host_url"],
    cards: ["card_number", "name_on_card", "expiration_month", "security_code"],
    addresses: ["street_address", "postal_code", "country_code"],
    notes: ["note_title", "note_detail"]
  };
  var NULL_SENTINEL = "&&&NULL&&&";
  function splitLines(text) {
    const parts = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    return parts;
  }
  function parseDataTypes(line) {
    const tokens = line.split(/[;,]/).map((token) => token.trim().toLowerCase()).filter(Boolean);
    if (tokens.length === 0) return [];
    if (tokens.every((token) => token === "true" || token === "false")) {
      const enabled = [];
      tokens.slice(0, DEFAULT_TYPES.length).forEach((token, index) => {
        if (token === "true") enabled.push(DEFAULT_TYPES[index]);
      });
      return enabled;
    }
    const parsed = [];
    for (const token of tokens) {
      const alias = TYPE_ALIASES[token];
      if (alias) parsed.push(alias);
    }
    return parsed;
  }
  function readHeader(lines) {
    const first = (lines[0] ?? "").trim();
    const second = (lines[1] ?? "").trim();
    if (first === "samsung_pass_export" && second.toLowerCase().startsWith("version:")) {
      return { version: second, dataTypes: [], rest: lines.slice(2) };
    }
    return { version: first, dataTypes: parseDataTypes(second), rest: lines.slice(2) };
  }
  function splitTables(lines) {
    const tables = [];
    let current = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === "next_table") {
        if (current.length) tables.push(current);
        current = [];
        continue;
      }
      if (current.length === 0 && !line.includes(";")) continue;
      current.push(line);
    }
    if (current.length) tables.push(current);
    return tables;
  }
  function parseSemicolonRecords(input) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (inQuotes) {
        if (c === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        continue;
      }
      if (c === ";") {
        row.push(field);
        field = "";
        continue;
      }
      if (c === "\n" || c === "\r") {
        if (c === "\r" && input[i + 1] === "\n") i++;
        row.push(field);
        if (!(row.length === 1 && row[0] === "")) rows.push(row);
        row = [];
        field = "";
        continue;
      }
      field += c;
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
    }
    return rows;
  }
  function isPrintable(text) {
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 9 || code === 10 || code === 13 || code === 32) continue;
      if (code < 32 || code === 127) return false;
    }
    return true;
  }
  function decodeField(field) {
    if (field === "" || field === NULL_SENTINEL) return "";
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(field)) return field;
    const body = field.replace(/=+$/, "");
    if (body.length % 4 === 1) return field;
    const padded = body + "=".repeat((4 - body.length % 4) % 4);
    try {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text && isPrintable(text)) return text === NULL_SENTINEL ? "" : text;
    } catch {
    }
    return field;
  }
  function inferType(headers) {
    const set = new Set(headers);
    for (const [type, hints] of Object.entries(HEADER_HINTS)) {
      if (hints.some((hint) => set.has(hint))) return type;
    }
    return null;
  }
  function parseTable(type, lines) {
    const records = parseSemicolonRecords(lines.join("\n"));
    if (records.length === 0) return { type, headers: [], rows: [] };
    const headers = records[0].map((header) => header.trim());
    if (headers.length === 0 || headers.some((header) => !header)) {
      throw new SpassError("format", "This export has a table Samsung Pass didn't finish writing.");
    }
    const rows = [];
    for (const fields of records.slice(1)) {
      const width = Math.max(headers.length, fields.length);
      while (headers.length < width) headers.push(`extra_${headers.length + 1}`);
      const row = {};
      for (let i = 0; i < headers.length; i++) row[headers[i]] = decodeField(fields[i] ?? "");
      rows.push(row);
    }
    return { type, headers, rows };
  }
  function parseSpassText(decrypted) {
    const lines = splitLines(decrypted);
    if (lines.length < 3) throw new SpassError("format", "This file does not look like a Samsung Pass export.");
    const { version, dataTypes, rest } = readHeader(lines);
    const chunks = splitTables(rest);
    if (chunks.length === 0) throw new SpassError("format", "The file unlocked, but it has no password tables.");
    const tables = chunks.map((chunk, index) => {
      const headers = parseSemicolonRecords(chunk[0])[0]?.map((header) => header.trim()) ?? [];
      const type = inferType(headers) ?? dataTypes[index] ?? `table_${index + 1}`;
      return parseTable(type, chunk);
    });
    return { version, tables };
  }

  // web/src/lib/sites.ts
  var APP_SITES = {
    "com.facebook.katana": "https://facebook.com",
    "com.facebook.orca": "https://messenger.com",
    "com.instagram.android": "https://instagram.com",
    "com.twitter.android": "https://x.com",
    "com.zhiliaoapp.musically": "https://tiktok.com",
    "com.ss.android.ugc.trill": "https://tiktok.com",
    "com.google.android.gm": "https://mail.google.com",
    "com.google.android.youtube": "https://youtube.com",
    "com.google.android.apps.maps": "https://maps.google.com",
    "com.whatsapp": "https://web.whatsapp.com",
    "com.snapchat.android": "https://snapchat.com",
    "com.spotify.music": "https://spotify.com",
    "com.netflix.mediaclient": "https://netflix.com",
    "com.amazon.mShop.android.shopping": "https://amazon.com",
    "com.amazon.avod.thirdpartyclient": "https://primevideo.com",
    "com.amazon.kindle": "https://amazon.com",
    "com.audible.application": "https://audible.com",
    "com.paypal.android.p2pmobile": "https://paypal.com",
    "com.ebay.mobile": "https://ebay.com",
    "com.linkedin.android": "https://linkedin.com",
    "com.pinterest": "https://pinterest.com",
    "com.reddit.frontpage": "https://reddit.com",
    "com.discord": "https://discord.com",
    "com.slack": "https://slack.com",
    "com.microsoft.office.outlook": "https://outlook.live.com",
    "com.microsoft.teams": "https://teams.microsoft.com",
    "com.microsoft.office.word": "https://office.com",
    "com.dropbox.android": "https://dropbox.com",
    "com.ubercab": "https://uber.com",
    "com.ubercab.eats": "https://ubereats.com",
    "com.airbnb.android": "https://airbnb.com",
    "com.venmo": "https://venmo.com",
    "com.chase.sig.android": "https://chase.com",
    "com.wf.wellsfargomobile": "https://wellsfargo.com",
    "com.infonow.bofa": "https://bankofamerica.com",
    "com.citi.citimobile": "https://citi.com",
    "com.capitalone.mobile": "https://capitalone.com",
    "com.americanexpress.android.acctsvcs.us": "https://americanexpress.com",
    "com.ally.MobileBanking": "https://ally.com",
    "com.schwab.mobile": "https://schwab.com",
    "com.fidelity.android": "https://fidelity.com",
    "com.robinhood.android": "https://robinhood.com",
    "com.coinbase.android": "https://coinbase.com",
    "org.telegram.messenger": "https://telegram.org",
    "com.viber.voip": "https://viber.com",
    "com.skype.raider": "https://skype.com",
    "com.yahoo.mobile.client.android.mail": "https://mail.yahoo.com",
    "com.disney.disneyplus": "https://disneyplus.com",
    "com.hulu.plus": "https://hulu.com",
    "com.wbd.stream": "https://max.com",
    "com.soundcloud.android": "https://soundcloud.com",
    "com.apple.android.music": "https://music.apple.com",
    "com.walmart.android": "https://walmart.com",
    "com.target.ui": "https://target.com",
    "com.bestbuy.android": "https://bestbuy.com",
    "com.starbucks.mobilecard": "https://starbucks.com",
    "com.dd.doordash": "https://doordash.com",
    "com.grubhub.android": "https://grubhub.com",
    "com.booking": "https://booking.com",
    "com.expedia.bookings": "https://expedia.com",
    "com.delta.mobile.android": "https://delta.com",
    "com.united.mobile.android": "https://united.com",
    "com.aa.android": "https://aa.com",
    "com.southwestairlines.mobile": "https://southwest.com",
    "com.etsy.android": "https://etsy.com",
    "com.zillow.android.zillowmap": "https://zillow.com",
    "com.duolingo": "https://duolingo.com",
    "com.android.vending": "https://play.google.com",
    "com.google.android.apps.walletnfcrel": "https://pay.google.com",
    "com.google.android.apps.docs": "https://docs.google.com",
    "com.google.android.apps.photos": "https://photos.google.com",
    "com.bitwarden": "https://bitwarden.com",
    "com.x8bit.bitwarden": "https://bitwarden.com",
    "com.lastpass.lpandroid": "https://lastpass.com",
    "com.onepassword.android": "https://1password.com",
    "com.dashlane": "https://dashlane.com",
    "proton.android.pass": "https://proton.me",
    "ch.protonmail.android": "https://proton.me",
    "com.github.android": "https://github.com",
    "com.todoist": "https://todoist.com",
    "com.evernote": "https://evernote.com",
    "com.nytimes.android": "https://nytimes.com",
    "com.samsung.android.spay": "https://samsung.com",
    "com.sec.android.app.sbrowser": "https://samsung.com"
  };
  var BY_LOWER = /* @__PURE__ */ new Map();
  for (const [pkg, url] of Object.entries(APP_SITES)) BY_LOWER.set(pkg.toLowerCase(), url);
  function siteForPackage(pkg) {
    const key = pkg.trim().toLowerCase();
    return key ? BY_LOWER.get(key) ?? "" : "";
  }
  function extractPackage(value) {
    const trimmed = value.trim();
    const android = trimmed.match(/^android(?:app)?:\/\/([^/\s]+)/i);
    if (android) return android[1];
    if (/^[A-Za-z][\w]*(\.[\w-]+){2,}$/.test(trimmed)) return trimmed;
    return "";
  }

  // web/src/lib/model.ts
  function clean(value) {
    const v = (value ?? "").replace(/\u0000/g, "").trim();
    return v === "&&&NULL&&&" ? "" : v;
  }
  function pick(row, keys) {
    for (const key of keys) {
      const value = clean(row[key]);
      if (value) return value;
    }
    return "";
  }
  var BARE_DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i;
  function normalizeUserUrl(input) {
    const value = input.trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (BARE_DOMAIN.test(value)) return `https://${value}`;
    return "";
  }
  function resolveUrl(raw, packageName) {
    const pkg = packageName || extractPackage(raw);
    const mapped = pkg ? siteForPackage(pkg) : "";
    if (mapped) return { url: mapped, needsSite: false, appLabel: pkg };
    if (/^https?:\/\//i.test(raw)) return { url: raw, needsSite: false, appLabel: "" };
    if (pkg) return { url: "", needsSite: true, appLabel: pkg };
    const normalized = normalizeUserUrl(raw);
    if (normalized) return { url: normalized, needsSite: false, appLabel: "" };
    return { url: "", needsSite: true, appLabel: "" };
  }
  function otpFields(otp, name, username) {
    const value = otp.trim();
    if (!value) return { otp: "", otpUri: "" };
    if (value.toLowerCase().startsWith("otpauth://")) return { otp: value, otpUri: value };
    const secret = value.replace(/\s+/g, "");
    if (/^[A-Za-z2-7]+=*$/.test(secret) && secret.replace(/=/g, "").length >= 16) {
      const label = encodeURIComponent(username ? `${name}:${username}` : name || "Account");
      const issuer = encodeURIComponent(name || "Account");
      return { otp: value, otpUri: `otpauth://totp/${label}?secret=${secret.replace(/=/g, "").toUpperCase()}&issuer=${issuer}` };
    }
    return { otp: value, otpUri: "" };
  }
  function table(parsed, type) {
    return parsed.tables.find((item) => item.type === type) ?? null;
  }
  function toVault(parsed, alreadyPlain = false) {
    const passwordTable = table(parsed, "passwords");
    const logins = [];
    (passwordTable?.rows ?? []).forEach((row, index) => {
      const packageName = pick(row, ["package_name", "app_package", "package"]);
      const rawUrl = pick(row, ["host_url", "origin_url", "url", "action_url"]);
      const resolved = resolveUrl(rawUrl, packageName);
      const username = pick(row, ["username_value", "username", "email", "user_id"]);
      const password = pick(row, ["password_value", "password"]);
      const note = pick(row, ["credential_memo", "note", "notes", "memo"]);
      const name = pick(row, ["title", "name", "display_name"]) || resolved.appLabel || rawUrl || username;
      const otp = otpFields(pick(row, ["otp", "totp", "otp_secret", "one_time_password"]), name, username);
      if (!username && !password && !resolved.url && !note && !otp.otp && !name) return;
      logins.push({
        id: `login-${index}`,
        name,
        url: resolved.url,
        username,
        password,
        note,
        otp: otp.otp,
        otpUri: otp.otpUri,
        needsSite: resolved.needsSite,
        appLabel: resolved.appLabel
      });
    });
    const cards = (table(parsed, "cards")?.rows ?? []).map((row, index) => ({
      id: `card-${index}`,
      nickname: pick(row, ["reserved_5", "card_name", "nickname", "name"]) || "Card",
      holder: pick(row, ["name_on_card", "cardholder_name", "holder"]),
      number: pick(row, ["card_number", "number"]),
      expMonth: pick(row, ["expiration_month", "exp_month"]),
      expYear: pick(row, ["expiration_year", "exp_year"]),
      code: pick(row, ["security_code", "cvv", "cvc"]),
      note: pick(row, ["card_memo", "memo", "note", "notes"])
    })).filter((card) => card.holder || card.number || card.nickname !== "Card");
    const addresses = (table(parsed, "addresses")?.rows ?? []).map((row, index) => ({
      id: `address-${index}`,
      name: pick(row, ["name", "full_name", "first_name"]),
      company: pick(row, ["company", "company_name"]),
      street: pick(row, ["street_address", "address1", "address", "street"]),
      city: pick(row, ["city"]),
      state: pick(row, ["state", "region", "province"]),
      postal: pick(row, ["postal_code", "zip", "zipcode"]),
      country: pick(row, ["country_code", "country"]),
      phone: pick(row, ["phone", "phone_number", "tel"]),
      email: pick(row, ["email"])
    })).filter((item) => item.name || item.street || item.city);
    const notes = (table(parsed, "notes")?.rows ?? []).map((row, index) => ({
      id: `note-${index}`,
      title: pick(row, ["note_title", "title", "name"]) || "Note",
      body: pick(row, ["note_detail", "note", "notes", "detail", "content"])
    })).filter((item) => item.title !== "Note" || item.body);
    const known = /* @__PURE__ */ new Set(["passwords", "cards", "addresses", "notes"]);
    const otherTables = parsed.tables.filter((item) => !known.has(item.type) && item.rows.length > 0);
    return { version: parsed.version, logins, cards, addresses, notes, passwordTable, otherTables, alreadyPlain };
  }
  function setManualSite(login, input) {
    login.url = normalizeUserUrl(input);
    login.needsSite = login.url === "";
  }
  function vaultCount(vault) {
    return vault.logins.length + vault.cards.length + vault.addresses.length + vault.notes.length;
  }
  var PLACEHOLDER_TITLE = "no title";
  var PLACEHOLDER_USERNAME = "no username";
  var PLACEHOLDER_URL = "no url";
  function formatRequiresUrl(_format) {
    return true;
  }
  function resolvedTitle(login) {
    const name = login.name.trim() || (login.appLabel ?? "").trim();
    if (name) return name;
    try {
      const host = new URL(login.url).hostname.replace(/^www\./, "");
      if (host) return host;
    } catch {
    }
    return login.username.trim();
  }
  function displayTitle(login) {
    return resolvedTitle(login) || PLACEHOLDER_TITLE;
  }
  function loginGaps(login, format) {
    const gaps = [];
    if (!resolvedTitle(login)) gaps.push("title");
    if (!login.username.trim()) gaps.push("username");
    if (formatRequiresUrl(format) && !login.url.trim()) gaps.push("url");
    return gaps;
  }
  var GAP_LABEL = { title: "title", username: "username", url: "website" };
  function incompleteLogins(logins, format) {
    return logins.filter((login) => loginGaps(login, format).length > 0);
  }
  function applyPlaceholders(login, format) {
    if (!resolvedTitle(login)) login.name = PLACEHOLDER_TITLE;
    if (!login.username.trim()) login.username = PLACEHOLDER_USERNAME;
    if (formatRequiresUrl(format) && !login.url.trim()) {
      login.url = PLACEHOLDER_URL;
      login.needsSite = false;
    }
  }
  function csvUsername(login) {
    return login.username.trim() || PLACEHOLDER_USERNAME;
  }
  function csvUrl(login, format) {
    if (login.url.trim()) return login.url;
    return formatRequiresUrl(format) ? PLACEHOLDER_URL : "";
  }

  // web/src/lib/csv.ts
  var FORMULA_LEAD = /^[=+\-@\t\r]/;
  function cell(value, formulaSafe = true) {
    let v = value;
    if (formulaSafe && FORMULA_LEAD.test(v)) v = `'${v}`;
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }
  function toCsv(headers, rows, rawColumns = [], bom = true, omitHeader = false) {
    const raw = headers.map((header) => rawColumns.includes(header));
    const head = headers.map((header) => cell(header, false)).join(",");
    const body = rows.map((row) => headers.map((_, i) => cell(row[i] ?? "", !raw[i])).join(","));
    const lines = omitHeader ? body : [head, ...body];
    return lines.length ? `${bom ? "\uFEFF" : ""}${lines.join("\r\n")}\r
` : "";
  }
  function noteWithOtp(note, otp) {
    if (!otp) return note;
    if (note.includes(otp)) return note;
    const line = `OTP: ${otp}`;
    return note ? `${note}
${line}` : line;
  }
  function loginsToCsv(logins, notes, format) {
    if (format === "1password") {
      return toCsv(
        // 1Password's official layout: headerless Title,Website,Username,Password,Notes (labelled once in their UI).
        ["Title", "Website", "Username", "Password", "Notes"],
        logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, noteWithOtp(l.note, l.otpUri || l.otp)]),
        ["Password"],
        false,
        true
      );
    }
    if (format === "apple") {
      return toCsv(
        ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"],
        logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, l.otpUri ? l.note : noteWithOtp(l.note, l.otp), l.otpUri]),
        ["Password", "OTPAuth"],
        false
      );
    }
    if (format === "bitwarden") {
      const headers = [
        "folder",
        "favorite",
        "type",
        "name",
        "notes",
        "fields",
        "reprompt",
        "login_uri",
        "login_username",
        "login_password",
        "login_totp"
      ];
      const loginRows = logins.map((l) => [
        "",
        "0",
        "login",
        displayTitle(l),
        l.note,
        "",
        "0",
        csvUrl(l, format),
        csvUsername(l),
        l.password,
        l.otpUri || l.otp
      ]);
      const noteRows = notes.map((n) => ["", "0", "note", n.title.trim() || "Note", n.body, "", "0", "", "", "", ""]);
      return toCsv(headers, [...loginRows, ...noteRows], ["login_password", "login_totp"], false);
    }
    return toCsv(
      ["name", "url", "username", "password", "note"],
      logins.map((l) => [displayTitle(l), csvUrl(l, format), csvUsername(l), l.password, noteWithOtp(l.note, l.otp)]),
      ["password"],
      false
    );
  }
  function cardsToCsv(cards) {
    return toCsv(
      ["nickname", "name_on_card", "number", "exp_month", "exp_year", "security_code", "note"],
      cards.map((c) => [c.nickname, c.holder, c.number, c.expMonth, c.expYear, c.code, c.note]),
      ["number", "exp_month", "exp_year", "security_code"]
    );
  }
  function addressesToCsv(addresses) {
    return toCsv(
      ["name", "company", "street", "city", "state", "postal_code", "country", "phone", "email"],
      addresses.map((a) => [a.name, a.company, a.street, a.city, a.state, a.postal, a.country, a.phone, a.email]),
      ["phone"]
    );
  }
  function notesToCsv(notes) {
    return toCsv(["title", "details"], notes.map((n) => [n.title, n.body]));
  }

  // web/src/lib/formats.ts
  var FORMATS = [
    { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "Import at my.1password.com \u2192 Import \u2192 CSV. On the Label step pick, left to right: Title, Website, Username, Password, Notes. One-time codes are in Notes." },
    { id: "google", label: "Google", fileName: "samsung-pass-google.csv", hint: "Chrome \u2192 Password Manager \u2192 Settings \u2192 Import. One-time codes go in the note." },
    { id: "apple", label: "Apple", fileName: "samsung-pass-apple.csv", hint: "Settings \u2192 Apps \u2192 Passwords \u2192 Import passwords. One-time codes go in OTPAuth." },
    { id: "bitwarden", label: "Bitwarden", fileName: "samsung-pass-bitwarden.csv", hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate." }
  ];
  var DEFAULT_FORMAT = "1password";
  function isFormatId(value) {
    return FORMATS.some((format) => format.id === value);
  }
  function fileNameFor(format) {
    return FORMATS.find((item) => item.id === format).fileName;
  }

  // web/src/lib/unlock.ts
  function isPlaintextExport(text) {
    return looksLikeSpassPlaintext(text);
  }
  async function unlockText(fileText, password) {
    const text = fileText.replace(/^\uFEFF/, "");
    if (isPlaintextExport(text)) {
      const vault2 = toVault(parseSpassText(text), true);
      if (vaultCount(vault2) === 0) throw new SpassError("format", "The file opened, but it has no logins, cards, addresses, or notes.");
      return vault2;
    }
    if (!password) throw new SpassError("empty", "Enter the export password you set in Samsung Pass.");
    if (!globalThis.crypto?.subtle) throw new SpassError("format", "This browser can't unlock files. Open the page in Chrome.");
    const plain = await decryptSpass(text, password);
    const vault = toVault(parseSpassText(plain), false);
    if (vaultCount(vault) === 0) throw new SpassError("format", "The file unlocked, but it has no logins, cards, addresses, or notes.");
    return vault;
  }

  // web/src/ui/assets/spcc-mark.ts
  var SPCC_MARK_PNG = "data:image/png;base64,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";

  // web/src/ui/dom.ts
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === "function") node.addEventListener(key.replace(/^on/, ""), value);
      else if (key === "class") node.className = String(value);
      else if (value === true) node.setAttribute(key, "");
      else if (value !== false) node.setAttribute(key, String(value));
    }
    for (const child of children) {
      if (child === null) continue;
      node.append(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICON_PATHS = {
    lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z",
    more_vert: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
    folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
    visibility: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
    visibility_off: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    check_circle: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
    progress_activity: "M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8z"
  };
  var ICON_NAMES = Object.keys(ICON_PATHS);
  function icon(name) {
    const span = el("span", { class: "icon", "aria-hidden": "true", "data-icon": name }, []);
    const d = ICON_PATHS[name];
    if (d) {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("focusable", "false");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
      span.append(svg);
    }
    return span;
  }
  function pRingMark(size = 56) {
    const span = el("span", { class: "mark", "data-mark": "p-ring", role: "img", "aria-label": "Spcc logo" }, []);
    const img = document.createElement("img");
    img.src = SPCC_MARK_PNG;
    img.alt = "";
    img.width = size;
    img.height = size;
    img.setAttribute("aria-hidden", "true");
    img.setAttribute("draggable", "false");
    span.append(img);
    return span;
  }

  // web/src/ui/platform.ts
  function bridge() {
    const candidate = globalThis.passBridge;
    return candidate && typeof candidate.postMessage === "function" ? candidate : null;
  }
  var SAVE_TIMEOUT_MS = 6e4;
  var androidPlatform = (b) => ({
    save(fileName, csv) {
      return new Promise((resolve) => {
        let settled = false;
        const settle = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          b.onmessage = null;
          resolve(ok);
        };
        const timer = setTimeout(() => settle(false), SAVE_TIMEOUT_MS);
        b.onmessage = (event) => {
          try {
            const reply = JSON.parse(event.data);
            if (reply.type === "saved") settle(reply.ok === true);
          } catch {
            settle(false);
          }
        };
        b.postMessage(JSON.stringify({ type: "save", fileName, csv }));
      });
    }
  });
  var webPlatform = {
    async save(fileName, csv) {
      try {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
      } catch {
        return false;
      }
    }
  };
  function detectPlatform() {
    const b = bridge();
    return b ? androidPlatform(b) : webPlatform;
  }

  // web/src/ui/prefs.ts
  var FORMAT_KEY = "passtocsv.format";
  function loadFormat() {
    try {
      const stored = globalThis.localStorage?.getItem(FORMAT_KEY);
      return isFormatId(stored) ? stored : DEFAULT_FORMAT;
    } catch {
      return DEFAULT_FORMAT;
    }
  }
  function storeFormat(format) {
    try {
      globalThis.localStorage?.setItem(FORMAT_KEY, format);
    } catch {
    }
  }

  // web/src/ui/app.ts
  function freshState(format) {
    return {
      file: null,
      password: "",
      showPassword: false,
      format,
      status: "form",
      error: null,
      vault: null,
      query: "",
      revealed: /* @__PURE__ */ new Set(),
      saved: false,
      sheet: null,
      snackbar: "",
      externalPending: false,
      siteDrafts: /* @__PURE__ */ new Map()
    };
  }
  function readFileText(file) {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
  function isSpassFileName(name) {
    return /\.spass$/i.test(name.trim());
  }
  function mount(root2, options = {}) {
    const platform = options.platform ?? detectPlatform();
    let state = freshState(loadFormat());
    const wipe = () => {
      state = freshState(state.format);
      render();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && !state.externalPending && state.vault) wipe();
    });
    const canConvert = () => state.file !== null && state.password.length > 0 && state.status !== "working";
    async function convert() {
      if (!state.file) return;
      state.status = "working";
      state.error = null;
      render();
      try {
        const text = await readFileText(state.file);
        state.vault = await unlockText(text, state.password);
        state.status = "done";
      } catch (error) {
        state.status = "form";
        const err = error instanceof SpassError ? error : new SpassError("format", "Something went wrong reading this file.");
        state.error = { field: err.code === "format" ? "file" : "password", message: err.message };
      }
      render();
    }
    function primaryCsv() {
      const vault = state.vault;
      return { fileName: fileNameFor(state.format), csv: loginsToCsv(vault.logins, vault.notes, state.format) };
    }
    function openSaveSheet() {
      state.sheet = { kind: "save", ...primaryCsv() };
      render();
    }
    function beginPrimarySave() {
      const vault = state.vault;
      if (!vault || state.externalPending) return;
      const incomplete = incompleteLogins(vault.logins, state.format);
      if (incomplete.length) {
        state.sheet = {
          kind: "incomplete",
          items: incomplete.map((l) => ({ title: resolvedTitle(l) || PLACEHOLDER_TITLE, gaps: loginGaps(l, state.format).map((g) => GAP_LABEL[g]) }))
        };
        render();
        return;
      }
      openSaveSheet();
    }
    function keepIncomplete() {
      const vault = state.vault;
      if (!vault) return;
      for (const login of incompleteLogins(vault.logins, state.format)) applyPlaceholders(login, state.format);
      openSaveSheet();
    }
    function deleteIncomplete() {
      const vault = state.vault;
      if (!vault) return;
      const drop = new Set(incompleteLogins(vault.logins, state.format).map((l) => l.id));
      vault.logins = vault.logins.filter((l) => !drop.has(l.id));
      openSaveSheet();
    }
    async function confirmSave(fileName, csv) {
      if (state.externalPending) return;
      state.sheet = null;
      state.externalPending = true;
      render();
      const ok = await platform.save(fileName, csv);
      state.externalPending = false;
      state.saved = state.saved || ok;
      state.snackbar = ok ? `Saved ${fileName}. Delete it after you import.` : "Couldn't save the file. Nothing was written.";
      render();
    }
    function topBar() {
      return el("header", { class: "appbar" }, [
        el("div", { class: "lockup", "data-testid": "lockup" }, [
          pRingMark(48),
          el("div", { class: "lockup-panel" }, [
            el("h1", { class: "lockup-title" }, ["Spcc"]),
            el("p", { class: "lockup-sub" }, ["Spass to CSV Converter"])
          ])
        ]),
        el("button", { class: "icon-btn", type: "button", "aria-label": "About and privacy", onclick: () => {
          state.sheet = { kind: "about" };
          render();
        } }, [icon("more_vert")])
      ]);
    }
    function currentPhase() {
      if (state.sheet?.kind === "save" || state.sheet?.kind === "incomplete" || state.saved) return "save";
      return state.vault ? "unlock" : "file";
    }
    function phaseRail() {
      const phase = currentPhase();
      const order = ["file", "unlock", "save"];
      const labels = { file: "1 \xB7 File", unlock: "2 \xB7 Unlock", save: "3 \xB7 Save" };
      const at = order.indexOf(phase);
      return el(
        "ol",
        { class: "rail", "aria-label": "Progress", "data-testid": "rail" },
        order.map((p, i) => el("li", {
          class: i === at ? "pill active" : i < at ? "pill done" : "pill",
          "data-phase": p,
          "aria-current": i === at ? "step" : "false"
        }, [labels[p]]))
      );
    }
    function trustStrip() {
      return el("p", { class: "trust", role: "note", "data-testid": "trust" }, [icon("lock"), "Stays on this phone \xB7 nothing uploaded"]);
    }
    function fieldError(field) {
      return state.error?.field === field ? el("p", { class: "error", role: "alert" }, [state.error.message]) : null;
    }
    function fileCard() {
      const input = el("input", { type: "file", accept: ".spass", id: "spass-file", class: "visually-hidden" });
      input.addEventListener("click", () => {
        state.externalPending = true;
        window.addEventListener("focus", () => setTimeout(() => {
          state.externalPending = false;
        }, 1e3), { once: true });
      });
      input.addEventListener("cancel", () => {
        state.externalPending = false;
      });
      input.addEventListener("change", () => {
        state.externalPending = false;
        const picked = input.files?.[0] ?? null;
        if (picked && !isSpassFileName(picked.name)) {
          state.file = null;
          state.error = { field: "file", message: "Choose a .spass export from Samsung Pass." };
          input.value = "";
        } else {
          state.file = picked;
          state.error = null;
        }
        render();
      });
      return el("section", { class: "card" }, [
        el("h2", { class: "label-large" }, ["Export file"]),
        input,
        el("label", { for: "spass-file", class: "btn outline" }, [icon("folder"), state.file ? "Change file" : "Choose .spass file"]),
        state.file ? el("p", { class: "filename", "data-testid": "filename" }, [state.file.name]) : null,
        fieldError("file")
      ]);
    }
    function passwordCard() {
      const input = el("input", {
        type: state.showPassword ? "text" : "password",
        id: "spass-password",
        autocomplete: "off",
        spellcheck: "false",
        "aria-describedby": "pw-help"
      });
      input.value = state.password;
      input.addEventListener("input", () => {
        state.password = input.value;
        const btn = root2.querySelector("[data-testid=convert]");
        if (btn) btn.disabled = !canConvert();
      });
      return el("section", { class: "card" }, [
        el("label", { for: "spass-password", class: "label-large" }, ["Export password"]),
        el("div", { class: "field-row" }, [
          input,
          el("button", { type: "button", class: "icon-btn", "aria-label": state.showPassword ? "Hide password" : "Show password", onclick: () => {
            state.showPassword = !state.showPassword;
            render();
          } }, [icon(state.showPassword ? "visibility_off" : "visibility")])
        ]),
        el("p", { id: "pw-help", class: "helper" }, ["The password you set when exporting \u2014 not your Samsung account password."]),
        fieldError("password")
      ]);
    }
    function formatCard() {
      const hint = FORMATS.find((f) => f.id === state.format).hint;
      return el("section", { class: "card" }, [
        el("h2", { class: "label-large" }, ["Save as"]),
        el(
          "div",
          { class: "chips", role: "radiogroup", "aria-label": "Password manager" },
          FORMATS.map((f) => el("button", {
            type: "button",
            role: "radio",
            class: f.id === state.format ? "chip selected" : "chip",
            "aria-checked": f.id === state.format ? "true" : "false",
            "data-format": f.id,
            onclick: () => {
              state.format = f.id;
              storeFormat(f.id);
              render();
            }
          }, [f.label]))
        ),
        el("p", { class: "helper" }, [hint])
      ]);
    }
    function unlockedSummary() {
      const name = state.file?.name ?? "export.spass";
      const formatLabel = FORMATS.find((f) => f.id === state.format).label;
      return el("section", { class: "summary", "data-testid": "unlocked-summary" }, [
        el("div", { class: "summary-main" }, [
          el("p", { class: "summary-file", "data-testid": "filename" }, [name]),
          el(
            "div",
            { class: "chips compact", role: "radiogroup", "aria-label": "Password manager" },
            FORMATS.map((f) => el("button", {
              type: "button",
              role: "radio",
              class: f.id === state.format ? "chip selected" : "chip",
              "aria-checked": f.id === state.format ? "true" : "false",
              "data-format": f.id,
              onclick: () => {
                state.format = f.id;
                storeFormat(f.id);
                render();
              }
            }, [f.label]))
          ),
          el("p", { class: "helper" }, [`Saving as ${formatLabel}`])
        ]),
        el("button", {
          type: "button",
          class: "btn outline summary-change",
          "data-testid": "change-file",
          onclick: () => {
            state.vault = null;
            state.status = "form";
            state.saved = false;
            state.revealed = /* @__PURE__ */ new Set();
            state.siteDrafts = /* @__PURE__ */ new Map();
            state.query = "";
            state.error = null;
            render();
          }
        }, ["Change"])
      ]);
    }
    function countsRow(vault) {
      const item = (n, label) => el("div", { class: "count" }, [el("strong", {}, [String(n)]), el("span", {}, [label])]);
      return el("section", { class: "counts", "data-testid": "counts" }, [
        item(vault.logins.length, "logins"),
        item(vault.cards.length, "cards"),
        item(vault.addresses.length, "addresses"),
        item(vault.notes.length, "notes")
      ]);
    }
    function loginRow(login) {
      const shown = state.revealed.has(login.id);
      const title = login.name.trim() || login.appLabel.trim() || login.username.trim() || "no title";
      const site = login.needsSite ? (() => {
        const input = el("input", { type: "url", id: `site-${login.id}`, class: "site-input", placeholder: "Website (optional)", "aria-label": `Website for ${title}` });
        input.value = state.siteDrafts.get(login.id) ?? "";
        input.addEventListener("input", () => {
          state.siteDrafts.set(login.id, input.value);
        });
        input.addEventListener("change", () => {
          setManualSite(login, input.value);
          if (!login.needsSite) state.siteDrafts.delete(login.id);
          render();
        });
        return el("div", {}, [input, el("p", { class: "helper" }, ["No website in the export. Left blank unless you type one."])]);
      })() : login.url ? el("p", { class: "site" }, [login.url]) : null;
      return el("li", { class: "login", "data-testid": "login" }, [
        el("div", { class: "login-head" }, [
          el("strong", { class: "login-title" }, [title]),
          el("button", { type: "button", class: "icon-btn", "aria-label": shown ? "Hide password" : "Show password", onclick: () => {
            shown ? state.revealed.delete(login.id) : state.revealed.add(login.id);
            render();
          } }, [icon(shown ? "visibility_off" : "visibility")])
        ]),
        el("p", { class: "muted login-user" }, [login.username || "no username"]),
        el("p", { class: "mono" }, [shown ? login.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"]),
        site
      ]);
    }
    function results(vault) {
      const q = state.query.trim().toLowerCase();
      const list = el(
        "ul",
        { class: "list", "data-testid": "login-list" },
        vault.logins.filter((l) => !q || `${l.name} ${l.username} ${l.url}`.toLowerCase().includes(q)).map(loginRow)
      );
      const search = el("input", { type: "search", class: "search", placeholder: "Search logins", "aria-label": "Search logins" });
      search.value = state.query;
      search.addEventListener("input", () => {
        state.query = search.value;
        const next = results(vault).querySelector("[data-testid=login-list]");
        root2.querySelector("[data-testid=login-list]")?.replaceWith(next);
      });
      const extras = [];
      const extra = (label, fileName, csv) => el("button", { type: "button", class: "btn outline", onclick: () => {
        state.sheet = { kind: "save", fileName, csv };
        render();
      } }, [icon("download"), label]);
      if (vault.cards.length) extras.push(extra("Save cards", "samsung-pass-cards.csv", cardsToCsv(vault.cards)));
      if (vault.addresses.length) extras.push(extra("Save addresses", "samsung-pass-addresses.csv", addressesToCsv(vault.addresses)));
      if (vault.notes.length && state.format !== "bitwarden") extras.push(extra("Save notes", "samsung-pass-notes.csv", notesToCsv(vault.notes)));
      return el("section", { class: "card results", "data-testid": "results" }, [
        countsRow(vault),
        search,
        list,
        extras.length ? el("div", { class: "extras" }, extras) : null,
        state.saved ? el("p", { class: "reminder", role: "status" }, [icon("delete"), "Delete the CSV after you import it. It holds your passwords in plain text."]) : null
      ]);
    }
    function stickyBar() {
      return el("footer", { class: "sticky" }, [
        el("button", { type: "button", class: "btn outline", "data-testid": "clear", onclick: () => {
          state.sheet = { kind: "clear" };
          render();
        } }, [icon("delete"), "Clear"]),
        el("button", { type: "button", class: "btn filled", "data-testid": "save", onclick: beginPrimarySave }, [icon("download"), "Save CSV"])
      ]);
    }
    function sheet() {
      const s = state.sheet;
      if (!s) return null;
      const close = () => {
        state.sheet = null;
        render();
      };
      let body;
      if (s.kind === "incomplete") {
        const n = s.items.length;
        const noun = n === 1 ? "login" : "logins";
        const CAP = 50;
        const list = el(
          "ul",
          { class: "gap-list", "data-testid": "incomplete-list" },
          s.items.slice(0, CAP).map((it) => el("li", {}, [el("span", { class: "strong" }, [it.title]), el("span", { class: "muted" }, [` \u2014 no ${it.gaps.join(", no ")}`])]))
        );
        const more = n > CAP ? el("p", { class: "muted" }, [`\u2026and ${n - CAP} more`]) : null;
        body = [
          el("h2", { class: "title-large" }, ["Incomplete logins"]),
          el("p", {}, [
            `${n} ${noun} ${n === 1 ? "is" : "are"} missing a title, username, or website for ${FORMATS.find((f) => f.id === state.format).label}:`
          ]),
          list,
          more,
          el("p", {}, ["Delete them, or keep them with clear placeholders (no title / no username / no url). Passwords stay empty when missing."]),
          el("div", { class: "sheet-actions stack" }, [
            el("button", { type: "button", class: "btn danger", "data-testid": "incomplete-delete", onclick: deleteIncomplete }, [`Delete ${n} ${noun}`]),
            el("button", { type: "button", class: "btn filled", "data-testid": "incomplete-keep", onclick: keepIncomplete }, ["Keep with placeholders"]),
            el("button", { type: "button", class: "btn outline", onclick: close }, ["Cancel"])
          ])
        ];
      } else if (s.kind === "save") {
        body = [
          el("h2", { class: "title-large" }, ["Save plaintext CSV?"]),
          el("p", {}, [`${s.fileName} will contain your passwords in plain text. Anyone with the file can read them.`]),
          el("p", { class: "strong" }, ["Import it into your password manager, then delete it."]),
          el("div", { class: "sheet-actions" }, [
            el("button", { type: "button", class: "btn outline", onclick: close }, ["Cancel"]),
            el("button", { type: "button", class: "btn filled", "data-testid": "confirm-save", onclick: () => void confirmSave(s.fileName, s.csv) }, ["Save"])
          ])
        ];
      } else if (s.kind === "clear") {
        body = [
          el("h2", { class: "title-large" }, ["Clear everything?"]),
          el("p", {}, ["Removes the unlocked data, the chosen file, and the password from this screen."]),
          el("div", { class: "sheet-actions" }, [
            el("button", { type: "button", class: "btn outline", onclick: close }, ["Cancel"]),
            el("button", { type: "button", class: "btn danger", "data-testid": "confirm-clear", onclick: wipe }, ["Clear"])
          ])
        ];
      } else {
        body = [
          el("h2", { class: "title-large" }, ["About & privacy"]),
          el("p", {}, ["Spcc (Spass to CSV Converter) converts a Samsung Pass .spass export on this device. Nothing is uploaded. No accounts, analytics, or telemetry. The Android app may contact Google Play only to check for and apply updates (Play In-App Updates); conversion stays on-device and the WebView has no network access."]),
          el("p", { class: "muted" }, ["Not affiliated with Samsung."]),
          el("div", { class: "sheet-actions" }, [el("button", { type: "button", class: "btn filled", onclick: close }, ["Done"])])
        ];
      }
      return el("div", { class: "scrim", onclick: (e) => {
        if (e.target === e.currentTarget) close();
      } }, [
        el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "data-testid": `sheet-${s.kind}` }, [el("div", { class: "handle", "aria-hidden": "true" }), ...body])
      ]);
    }
    function render() {
      const active = document.activeElement;
      const focusId = active && root2.contains(active) ? active.id : "";
      const sel = focusId && active && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
      paint();
      if (focusId) {
        const next = document.getElementById(focusId);
        if (next) {
          next.focus();
          try {
            if (sel && sel[0] !== null) next.setSelectionRange(sel[0], sel[1]);
          } catch {
          }
        }
      }
    }
    function paint() {
      const vault = state.vault;
      const convertBtn = el(
        "button",
        { type: "button", class: "btn filled wide", "data-testid": "convert", onclick: () => void convert() },
        [state.status === "working" ? "Unlocking\u2026" : "Convert"]
      );
      convertBtn.disabled = !canConvert();
      const chrome = el("div", { class: "chrome" }, [
        topBar(),
        phaseRail(),
        trustStrip(),
        vault ? unlockedSummary() : null
      ]);
      const pane = el("div", { class: "pane", "data-testid": "pane" }, vault ? [results(vault)] : [fileCard(), passwordCard(), formatCard(), convertBtn]);
      root2.replaceChildren(
        el("div", { class: "app" }, [
          el("div", { class: "shell" }, [chrome, pane]),
          vault ? stickyBar() : null
        ]),
        sheet() ?? el("span"),
        state.snackbar ? el("div", { class: "snackbar", role: "status", "data-testid": "snackbar" }, [state.snackbar]) : el("span")
      );
      if (state.snackbar) {
        const text = state.snackbar;
        setTimeout(() => {
          if (state.snackbar === text) {
            state.snackbar = "";
            render();
          }
        }, 4e3);
      }
    }
    render();
    return { wipe };
  }

  // web/src/main.ts
  var root = document.getElementById("app");
  if (root) mount(root);
})();
