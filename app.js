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
      const name = pick(row, ["title", "name", "display_name"]) || resolved.appLabel || rawUrl || username || "Untitled login";
      const otp = otpFields(pick(row, ["otp", "totp", "otp_secret", "one_time_password"]), name, username);
      if (!username && !password && !resolved.url && !note && !otp.otp && name === "Untitled login") return;
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

  // web/src/lib/csv.ts
  var FORMULA_LEAD = /^[=+\-@\t\r]/;
  function cell(value, formulaSafe = true) {
    let v = value;
    if (formulaSafe && FORMULA_LEAD.test(v)) v = `'${v}`;
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }
  function toCsv(headers, rows, rawColumns = []) {
    const raw = headers.map((header) => rawColumns.includes(header));
    const head = headers.map((header) => cell(header, false)).join(",");
    const body = rows.map((row) => headers.map((_, i) => cell(row[i] ?? "", !raw[i])).join(","));
    return `\uFEFF${[head, ...body].join("\r\n")}\r
`;
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
        ["Title", "Website", "Username", "Password", "Notes"],
        logins.map((l) => [l.name || "Login", l.url, l.username, l.password, noteWithOtp(l.note, l.otp)]),
        ["Password"]
      );
    }
    if (format === "apple") {
      return toCsv(
        ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"],
        logins.map((l) => [l.name, l.url, l.username, l.password, l.otpUri ? l.note : noteWithOtp(l.note, l.otp), l.otpUri]),
        ["Password", "OTPAuth"]
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
        l.name,
        l.note,
        "",
        "0",
        l.url,
        l.username,
        l.password,
        l.otpUri || l.otp
      ]);
      const noteRows = notes.map((n) => ["", "0", "note", n.title, n.body, "", "0", "", "", "", ""]);
      return toCsv(headers, [...loginRows, ...noteRows], ["login_password", "login_totp"]);
    }
    return toCsv(
      ["name", "url", "username", "password", "note"],
      logins.map((l) => [l.name, l.url, l.username, l.password, noteWithOtp(l.note, l.otp)]),
      ["password"]
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
    { id: "1password", label: "1Password", fileName: "samsung-pass-1password.csv", hint: "Import this CSV at my.1password.com \u2192 Import \u2192 CSV. One-time codes go in Notes." },
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
    delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
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
      externalPending: false
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
    async function confirmSave(fileName, csv) {
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
        icon("lock"),
        el("h1", { class: "title-large" }, ["Spcc"]),
        el("button", { class: "icon-btn", type: "button", "aria-label": "About and privacy", onclick: () => {
          state.sheet = { kind: "about" };
          render();
        } }, [icon("more_vert")])
      ]);
    }
    function currentPhase() {
      if (state.sheet?.kind === "save" || state.saved) return "save";
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
      return el("p", { class: "trust" }, [icon("lock"), "Stays on this phone \xB7 nothing uploaded"]);
    }
    function fieldError(field) {
      return state.error?.field === field ? el("p", { class: "error", role: "alert" }, [state.error.message]) : null;
    }
    function fileCard() {
      const input = el("input", { type: "file", accept: ".spass,application/octet-stream,text/plain", id: "spass-file", class: "visually-hidden" });
      input.addEventListener("click", () => {
        state.externalPending = true;
      });
      input.addEventListener("change", () => {
        state.externalPending = false;
        state.file = input.files?.[0] ?? null;
        state.error = null;
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
      const site = login.needsSite ? (() => {
        const input = el("input", { type: "url", class: "site-input", placeholder: "Website (optional)", "aria-label": `Website for ${login.name}` });
        input.addEventListener("change", () => {
          setManualSite(login, input.value);
          render();
        });
        return el("div", {}, [input, el("p", { class: "helper" }, ["No website in the export. Left blank unless you type one."])]);
      })() : el("p", { class: "site" }, [login.url]);
      return el("li", { class: "login", "data-testid": "login" }, [
        el("div", { class: "login-head" }, [
          el("strong", {}, [login.name]),
          el("button", { type: "button", class: "icon-btn", "aria-label": shown ? "Hide password" : "Show password", onclick: () => {
            shown ? state.revealed.delete(login.id) : state.revealed.add(login.id);
            render();
          } }, [icon(shown ? "visibility_off" : "visibility")])
        ]),
        el("p", { class: "muted" }, [login.username]),
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
      return el("div", { class: "results" }, [
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
        el("button", { type: "button", class: "btn filled", "data-testid": "save", onclick: () => {
          state.sheet = { kind: "save", ...primaryCsv() };
          render();
        } }, [icon("download"), "Save CSV"])
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
      if (s.kind === "save") {
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
          el("p", {}, ["Spcc (Spass to CSV Converter) converts a Samsung Pass .spass export on this device. Nothing is uploaded. No accounts, analytics, or telemetry. The app never updates itself \u2014 get updates from Google Play or GitHub Releases."]),
          el("p", { class: "muted" }, ["Not affiliated with Samsung."]),
          el("div", { class: "sheet-actions" }, [el("button", { type: "button", class: "btn filled", onclick: close }, ["Done"])])
        ];
      }
      return el("div", { class: "scrim", onclick: (e) => {
        if (e.target === e.currentTarget) close();
      } }, [
        el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "data-testid": `sheet-${s.kind}` }, body)
      ]);
    }
    function render() {
      const vault = state.vault;
      const convertBtn = el(
        "button",
        { type: "button", class: "btn filled wide", "data-testid": "convert", onclick: () => void convert() },
        [state.status === "working" ? "Unlocking\u2026" : "Convert"]
      );
      convertBtn.disabled = !canConvert();
      root2.replaceChildren(
        el("div", { class: "shell" }, [
          topBar(),
          phaseRail(),
          trustStrip(),
          fileCard(),
          passwordCard(),
          formatCard(),
          vault ? null : convertBtn,
          vault ? results(vault) : null
        ]),
        vault ? stickyBar() : el("span"),
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
