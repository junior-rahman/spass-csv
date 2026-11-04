"use strict";
(() => {
  // src/lib/spass/bytes.ts
  function bytesToBase64(bytes) {
    let binary = "";
    const step = 32768;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
  }
  function base64ToBytes(b642) {
    const binary = atob(b642);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  function asBuffer(bytes) {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
  }

  // src/lib/spass/errors.ts
  var SpassError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.code = code;
      this.name = "SpassError";
    }
  };

  // src/lib/spass/crypto.ts
  var SALT_BYTES = 20;
  var IV_BYTES = 16;
  var ITERATIONS = 7e4;
  var encoder = new TextEncoder();
  var decoder = new TextDecoder("utf-8", { fatal: true });
  async function deriveKey(password, salt, usage) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
      "deriveKey"
    ]);
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
      plain = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: asBuffer(iv) },
        key,
        asBuffer(ciphertext)
      );
    } catch {
      throw new SpassError(
        "password",
        "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password."
      );
    }
    let text;
    try {
      text = decoder.decode(plain);
    } catch {
      throw new SpassError(
        "password",
        "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password."
      );
    }
    if (!text.includes("next_table") && !text.includes(";")) {
      throw new SpassError(
        "password",
        "Couldn't unlock this file. Use the password you set while exporting, not your Samsung account password."
      );
    }
    return text;
  }
  async function encryptSpass(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(password, salt, "encrypt");
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: asBuffer(iv) },
      key,
      asBuffer(encoder.encode(plaintext))
    );
    const cipherBytes = new Uint8Array(cipher);
    const out = new Uint8Array(SALT_BYTES + IV_BYTES + cipherBytes.length);
    out.set(salt, 0);
    out.set(iv, SALT_BYTES);
    out.set(cipherBytes, SALT_BYTES + IV_BYTES);
    return bytesToBase64(out);
  }

  // src/lib/spass/csv.ts
  function cell(value) {
    if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
  function toCsv(headers, rows) {
    const lines = [headers, ...rows].map((row) => row.map((value) => cell(value ?? "")).join(","));
    return `\uFEFF${lines.join("\r\n")}\r
`;
  }
  function googleNote(note, otp) {
    if (!otp) return note;
    if (note.includes(otp)) return note;
    const line = `OTP: ${otp}`;
    return note ? `${note}
${line}` : line;
  }
  function loginsToCsv(logins, notes, format) {
    if (format === "apple") {
      return toCsv(
        ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"],
        logins.map((login) => [
          login.name,
          login.url,
          login.username,
          login.password,
          login.note,
          login.otpUri
        ])
      );
    }
    if (format === "bitwarden") {
      const loginRows = logins.map((login) => [
        "",
        "0",
        "login",
        login.name,
        googleNote(login.note, login.otpUri ? "" : login.otp),
        "",
        "0",
        login.url,
        login.username,
        login.password,
        login.otpUri || login.otp
      ]);
      const noteRows = notes.map((note) => ["", "0", "note", note.title, note.body, "", "0", "", "", "", ""]);
      return toCsv(
        [
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
        ],
        [...loginRows, ...noteRows]
      );
    }
    return toCsv(
      ["name", "url", "username", "password", "note"],
      logins.map((login) => [
        login.name,
        login.url,
        login.username,
        login.password,
        googleNote(login.note, login.otp)
      ])
    );
  }
  function cardsToCsv(cards) {
    return toCsv(
      ["nickname", "name_on_card", "number", "exp_month", "exp_year", "security_code", "note"],
      cards.map((card) => [
        card.nickname,
        card.holder,
        card.number,
        card.expMonth,
        card.expYear,
        card.code,
        card.note
      ])
    );
  }
  function addressesToCsv(addresses) {
    return toCsv(
      ["name", "company", "street", "city", "state", "postal_code", "country", "phone", "email"],
      addresses.map((item) => [
        item.name,
        item.company,
        item.street,
        item.city,
        item.state,
        item.postal,
        item.country,
        item.phone,
        item.email
      ])
    );
  }
  function notesToCsv(notes) {
    return toCsv(
      ["title", "details"],
      notes.map((note) => [note.title, note.body])
    );
  }
  function tableToCsv(table2) {
    return toCsv(
      table2.headers,
      table2.rows.map((row) => table2.headers.map((header) => row[header] ?? ""))
    );
  }
  function fileNameFor(format) {
    if (format === "apple") return "samsung-pass-apple.csv";
    if (format === "bitwarden") return "samsung-pass-bitwarden.csv";
    return "samsung-pass-google.csv";
  }
  function saveTextFile(filename, contents) {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // src/lib/spass/sites.ts
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

  // src/lib/spass/model.ts
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
  function normalizeUserUrl(input) {
    const value = input.trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
    return value;
  }
  function resolveUrl(raw, packageName) {
    const pkg = packageName || extractPackage(raw);
    const mapped = pkg ? siteForPackage(pkg) : "";
    if (mapped) return { url: mapped, needsSite: false, appLabel: pkg };
    if (/^https?:\/\//i.test(raw)) return { url: raw, needsSite: false, appLabel: "" };
    if (pkg) return { url: "", needsSite: true, appLabel: pkg };
    const normalized = normalizeUserUrl(raw);
    if (/^https?:\/\//i.test(normalized)) return { url: normalized, needsSite: false, appLabel: "" };
    if (!raw) return { url: "", needsSite: true, appLabel: "" };
    return { url: raw, needsSite: true, appLabel: "" };
  }
  function otpFields(otp, name, username) {
    const value = otp.trim();
    if (!value) return { otp: "", otpUri: "" };
    if (value.toLowerCase().startsWith("otpauth://")) return { otp: value, otpUri: value };
    const secret = value.replace(/\s+/g, "");
    if (/^[A-Za-z2-7]+=*$/.test(secret) && secret.replace(/=/g, "").length >= 16) {
      const label = encodeURIComponent(username ? `${name}:${username}` : name || "Account");
      const issuer = encodeURIComponent(name || "Account");
      const uri = `otpauth://totp/${label}?secret=${secret.replace(/=/g, "").toUpperCase()}&issuer=${issuer}`;
      return { otp: value, otpUri: uri };
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
        needsSite: resolved.needsSite || !/^https?:\/\//i.test(resolved.url),
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
    return {
      version: parsed.version,
      logins,
      cards,
      addresses,
      notes,
      passwordTable,
      otherTables,
      alreadyPlain
    };
  }

  // src/lib/spass/parse.ts
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
    const norm = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const parts = norm.split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    return parts;
  }
  function parseDataTypes(line) {
    const tokens = line.replace(/,/g, ";").split(";").map((token) => token.trim().toLowerCase()).filter(Boolean);
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
    if (records.length === 0) {
      return { type, headers: [], rows: [] };
    }
    const headers = records[0].map((header) => header.trim());
    if (headers.length === 0 || headers.some((header) => !header)) {
      throw new SpassError("format", "This export has a table Samsung Pass didn't finish writing.");
    }
    const rows = [];
    for (const fields of records.slice(1)) {
      const width = Math.max(headers.length, fields.length);
      while (headers.length < width) headers.push(`extra_${headers.length + 1}`);
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = decodeField(fields[i] ?? "");
      }
      rows.push(row);
    }
    return { type, headers, rows };
  }
  function parseSpassText(decrypted) {
    const lines = splitLines(decrypted);
    if (lines.length < 3) {
      throw new SpassError("format", "This file does not look like a Samsung Pass export.");
    }
    const { version, dataTypes, rest } = readHeader(lines);
    const chunks = splitTables(rest);
    if (chunks.length === 0) {
      throw new SpassError("format", "The file unlocked, but it has no password tables.");
    }
    const tables = chunks.map((chunk, index) => {
      const headers = parseSemicolonRecords(chunk[0])[0]?.map((header) => header.trim()) ?? [];
      const inferred = inferType(headers);
      const type = inferred ?? dataTypes[index] ?? `table_${index + 1}`;
      return parseTable(type, chunk);
    });
    return { version, tables };
  }
  function isPlaintextExport(text) {
    return text.includes("next_table") && text.includes(";");
  }

  // src/lib/spass/unlock.ts
  function b64(value) {
    return bytesToBase64(new TextEncoder().encode(value));
  }
  function samplePlaintext() {
    const login = [
      "title;host_url;username_value;password_value;credential_memo;otp",
      [
        b64("Sample Mail"),
        b64("https://mail.example.test"),
        b64("ada@example.test"),
        b64("sample-mailbox-pass"),
        b64("Fake entry for the preview"),
        b64("otpauth://totp/Sample:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Sample")
      ].join(";"),
      [
        b64("Sample Bank"),
        b64("com.chase.sig.android"),
        b64("j.lee"),
        b64("not-a-real-password"),
        "",
        ""
      ].join(";")
    ];
    const card = [
      "name_on_card;card_number;expiration_month;expiration_year;security_code;reserved_5",
      [b64("Ada Example"), b64("4242424242424242"), b64("09"), b64("2030"), b64("123"), b64("Sample Visa")].join(";")
    ];
    const address = [
      "name;street_address;city;state;postal_code;country_code",
      [b64("Ada Example"), b64("1 Sample Street"), b64("Sample City"), b64("NY"), b64("10001"), b64("US")].join(";")
    ];
    const note = [
      "note_title;note_detail",
      [b64("Router note"), b64("This is sample text, not a real secret.")].join(";")
    ];
    return [
      "25",
      "true;true;true;true",
      "false",
      "next_table",
      ...login,
      "next_table",
      ...card,
      "next_table",
      ...address,
      "next_table",
      ...note,
      ""
    ].join("\n");
  }
  async function unlockText(fileText, password) {
    const text = fileText.replace(/^\uFEFF/, "");
    if (isPlaintextExport(text)) {
      const vault2 = toVault(parseSpassText(text), true);
      if (vault2.logins.length + vault2.cards.length + vault2.addresses.length + vault2.notes.length === 0) {
        throw new SpassError("format", "The file opened, but it has no logins, cards, addresses, or notes.");
      }
      return { vault: vault2 };
    }
    if (!password) {
      throw new SpassError("empty", "Enter the export password you set in Samsung Pass.");
    }
    if (!crypto?.subtle) {
      throw new SpassError("format", "This browser can't unlock files. Open the page in Chrome.");
    }
    const plain = await decryptSpass(text, password);
    const vault = toVault(parseSpassText(plain), false);
    if (vault.logins.length + vault.cards.length + vault.addresses.length + vault.notes.length === 0) {
      throw new SpassError("format", "The file unlocked, but it has no logins, cards, addresses, or notes.");
    }
    return { vault };
  }

  // src/standalone/app.ts
  var FORMATS = [
    {
      id: "google",
      label: "Google",
      hint: "Chrome \u2192 Password Manager \u2192 Settings \u2192 Import. One-time codes go in the note."
    },
    {
      id: "apple",
      label: "Apple",
      hint: "Settings \u2192 Apps \u2192 Passwords \u2192 Import passwords."
    },
    {
      id: "bitwarden",
      label: "Bitwarden",
      hint: "Import as Bitwarden (csv). Logins and notes are in this file. Cards are separate."
    }
  ];
  function siteReady(value) {
    const v = value.trim();
    return /^https?:\/\//i.test(v) || /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(v);
  }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) node.append(child);
    return node;
  }
  function mount(root2) {
    let fileText = "";
    let fileName = "";
    let password = "";
    let showPassword = false;
    let phase = "form";
    let vault = null;
    let sample = false;
    let format = "google";
    let query = "";
    const revealed = {};
    let confirmClear = false;
    let error = "";
    const canShare = typeof navigator.share === "function";
    const shell = el("main", { class: "shell" });
    root2.replaceChildren(shell);
    function draw() {
      shell.replaceChildren();
      shell.append(header());
      if (phase !== "done") shell.append(formView());
      else if (vault) shell.append(resultView(vault));
      shell.append(footer());
    }
    function header() {
      return el("header", { class: "head" }, [
        el("div", {}, [
          el("h1", {}, ["Samsung Pass to CSV"]),
          el("p", { class: "muted" }, ["Unlock the export on this phone. Nothing is uploaded."])
        ])
      ]);
    }
    function formView() {
      const pass = el("input", {
        id: "export-password",
        type: showPassword ? "text" : "password",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false"
      });
      pass.value = password;
      pass.addEventListener("input", () => {
        password = pass.value;
      });
      const fileInput = el("input", { type: "file", accept: ".spass,.txt,text/plain" });
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        fileName = file.name;
        void file.text().then((text) => {
          fileText = text;
          error = "";
          draw();
        });
      });
      const picker = el("label", { class: "btn ghost" }, [
        fileInput,
        fileName ? "Choose a different file" : "Choose .spass file"
      ]);
      const eye = el(
        "button",
        { type: "button", class: "btn icon", "aria-label": showPassword ? "Hide password" : "Show password" },
        [showPassword ? "Hide" : "Show"]
      );
      eye.addEventListener("click", () => {
        showPassword = !showPassword;
        draw();
      });
      const submit = el("button", { type: "submit", class: "btn primary" }, [
        phase === "working" ? "Unlocking on this phone\u2026" : "Convert"
      ]);
      submit.disabled = phase === "working";
      const form = el("form", { class: "card" });
      form.append(
        el("ol", { class: "steps" }, [
          el("li", {}, ["Open Samsung Pass \u2192 Settings \u2192 Export data."]),
          el("li", {}, ["Choose what to include and set an export password."]),
          el("li", {}, ["Save the .spass file. Check Downloads if it is not obvious."]),
          el("li", {}, ["Pick that file here and type the same password."])
        ]),
        el("label", { class: "field" }, [
          "Export file",
          picker,
          fileName ? el("p", { class: "muted" }, [fileName]) : ""
        ]),
        el("label", { class: "field", for: "export-password" }, [
          "Export password",
          el("div", { class: "row" }, [pass, eye]),
          el("p", { class: "faint" }, ["The password you created for the export, not your Samsung account."])
        ])
      );
      if (error) form.append(el("p", { class: "danger", role: "alert" }, [error]));
      form.append(submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!fileText) {
          error = "Choose the .spass file first.";
          draw();
          return;
        }
        void convert(fileText, password, false);
      });
      return form;
    }
    function buildList(current) {
      const q = query.trim().toLowerCase();
      const shown = current.logins.filter((login) => {
        if (!q) return true;
        return [login.name, login.username, login.url, login.appLabel].join("\n").toLowerCase().includes(q);
      });
      const list = el("ul", { class: "list" });
      if (shown.length === 0) {
        list.append(el("li", { class: "muted" }, ["No logins match that search."]));
        return list;
      }
      for (const login of shown) list.append(loginCard(current, login));
      return list;
    }
    function resultView(current) {
      const wrap = el("section", { class: "stack" });
      if (sample) {
        wrap.append(el("p", { class: "card note" }, ["Sample data only. These are not your passwords."]));
      }
      const hint = FORMATS.find((item) => item.id === format)?.hint ?? "";
      const missing = current.logins.filter((login) => !siteReady(login.url)).length;
      const counts = [
        `${current.logins.length} ${current.logins.length === 1 ? "login" : "logins"}`,
        current.cards.length ? `${current.cards.length} ${current.cards.length === 1 ? "card" : "cards"}` : "",
        current.addresses.length ? `${current.addresses.length} ${current.addresses.length === 1 ? "address" : "addresses"}` : "",
        current.notes.length ? `${current.notes.length} ${current.notes.length === 1 ? "note" : "notes"}` : ""
      ].filter(Boolean).join(" \xB7 ");
      const radios = el("div", { class: "seg", role: "radiogroup" });
      for (const item of FORMATS) {
        const button = el("button", { type: "button", class: item.id === format ? "on" : "" }, [item.label]);
        button.addEventListener("click", () => {
          format = item.id;
          draw();
        });
        radios.append(button);
      }
      const save = el("button", { type: "button", class: "btn primary" }, ["Save CSV"]);
      save.addEventListener("click", () => savePrimary(current));
      const actions = el("div", { class: "stack" }, [save]);
      if (canShare) {
        const share = el("button", { type: "button", class: "btn ghost" }, ["Share"]);
        share.addEventListener("click", () => void sharePrimary(current));
        actions.append(share);
      }
      const panel = el("div", { class: "card" }, [
        el("p", { class: "strong" }, [counts]),
        el("p", { class: "label" }, ["Save as"]),
        radios,
        el("p", { class: "muted" }, [hint]),
        actions
      ]);
      if (missing > 0) {
        panel.append(
          el("p", { class: "danger" }, [
            `${missing} ${missing === 1 ? "login has" : "logins have"} no website. Google skips those until you add one below.`
          ])
        );
      }
      wrap.append(panel);
      const extras = el("div", { class: "wrap" });
      if (current.cards.length) extras.append(extraButton("Save cards", "samsung-pass-cards.csv", cardsToCsv(current.cards)));
      if (current.addresses.length) {
        extras.append(extraButton("Save addresses", "samsung-pass-addresses.csv", addressesToCsv(current.addresses)));
      }
      if (current.notes.length && format !== "bitwarden") {
        extras.append(extraButton("Save notes", "samsung-pass-notes.csv", notesToCsv(current.notes)));
      }
      if (current.passwordTable) {
        extras.append(extraButton("Save every column", "samsung-pass-full-table.csv", tableToCsv(current.passwordTable)));
      }
      wrap.append(extras);
      const search = el("input", { type: "search", placeholder: "Search name, username, or site" });
      search.value = query;
      let list = buildList(current);
      search.addEventListener("input", () => {
        query = search.value;
        const next = buildList(current);
        list.replaceWith(next);
        list = next;
      });
      wrap.append(el("label", { class: "field" }, ["Review", search]));
      wrap.append(list);
      if (confirmClear) {
        const yes = el("button", { type: "button", class: "btn primary" }, ["Clear now"]);
        yes.addEventListener("click", reset);
        const keep = el("button", { type: "button", class: "btn ghost" }, ["Keep"]);
        keep.addEventListener("click", () => {
          confirmClear = false;
          draw();
        });
        wrap.append(el("div", { class: "row" }, [yes, keep]));
      } else {
        const clear = el("button", { type: "button", class: "btn ghost" }, ["Clear from this screen"]);
        clear.addEventListener("click", () => {
          confirmClear = true;
          draw();
        });
        wrap.append(clear);
      }
      const again = el("button", { type: "button", class: "link" }, ["Convert another file"]);
      again.addEventListener("click", reset);
      wrap.append(again);
      return wrap;
    }
    function loginCard(current, login) {
      const open = revealed[login.id] === true;
      const eye = el(
        "button",
        { type: "button", class: "btn icon", "aria-label": open ? "Hide password" : "Show password" },
        [open ? "Hide" : "Show"]
      );
      eye.addEventListener("click", () => {
        revealed[login.id] = !open;
        draw();
      });
      const card = el("li", { class: "card" }, [
        el("div", { class: "row spread" }, [
          el("div", {}, [
            el("p", { class: "strong" }, [login.name]),
            el("p", { class: "muted" }, [login.username || "No username"])
          ]),
          eye
        ]),
        el("p", { class: "mono" }, [open ? login.password || "No password" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"])
      ]);
      if (!siteReady(login.url)) {
        const input = el("input", {
          inputmode: "url",
          placeholder: "example.com",
          spellcheck: "false"
        });
        input.value = login.url;
        input.addEventListener("input", () => {
          const value = input.value;
          vault = {
            ...current,
            logins: current.logins.map(
              (item) => item.id === login.id ? { ...item, url: value, needsSite: !siteReady(value) } : item
            )
          };
        });
        card.append(el("label", { class: "field" }, ["Website", input]));
      } else {
        card.append(el("p", { class: "faint" }, [normalizeUserUrl(login.url)]));
      }
      return card;
    }
    function extraButton(label, name, csv) {
      const button = el("button", { type: "button", class: "btn ghost slim" }, [label]);
      button.addEventListener("click", () => saveTextFile(name, csv));
      return button;
    }
    function prepared(current) {
      return current.logins.map((login) => ({ ...login, url: normalizeUserUrl(login.url) }));
    }
    function savePrimary(current) {
      saveTextFile(fileNameFor(format), loginsToCsv(prepared(current), current.notes, format));
    }
    async function sharePrimary(current) {
      const name = fileNameFor(format);
      const csv = loginsToCsv(prepared(current), current.notes, format);
      const file = new File([csv], name, { type: "text/csv" });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
      saveTextFile(name, csv);
    }
    function footer() {
      if (phase === "done") {
        return el("p", { class: "faint" }, ["Delete the CSV after you import it. This page does not keep a copy."]);
      }
      const sampleButton = el("button", { type: "button", class: "link" }, [
        "Preview with sample data"
      ]);
      sampleButton.disabled = phase === "working";
      sampleButton.addEventListener("click", () => {
        void (async () => {
          const encrypted = await encryptSpass(samplePlaintext(), "sample");
          await convert(encrypted, "sample", true);
        })();
      });
      return el("div", { class: "stack" }, [
        sampleButton,
        el("p", { class: "faint" }, [
          "Decryption happens in this browser tab. Passwords stay here until you clear them or leave. Not affiliated with Samsung."
        ])
      ]);
    }
    async function convert(text, pass, isSample) {
      phase = "working";
      error = "";
      draw();
      try {
        const opened = await unlockText(text, pass);
        vault = opened.vault;
        sample = isSample;
        phase = "done";
        query = "";
        confirmClear = false;
        for (const key of Object.keys(revealed)) delete revealed[key];
      } catch (err) {
        phase = "form";
        error = err instanceof SpassError ? err.message : "Couldn't read that file.";
      }
      draw();
    }
    function reset() {
      fileText = "";
      fileName = "";
      password = "";
      showPassword = false;
      phase = "form";
      vault = null;
      sample = false;
      error = "";
      query = "";
      confirmClear = false;
      for (const key of Object.keys(revealed)) delete revealed[key];
      draw();
    }
    draw();
  }
  var root = document.getElementById("app");
  if (root) mount(root);
})();
