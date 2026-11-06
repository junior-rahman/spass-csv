/** Curated Android package → website map. Unknown packages stay blank. Never infer "<name>.com". */
export const APP_SITES: Readonly<Record<string, string>> = {
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
  "com.samsung.android.spay": "https://samsung.com"
};

const BY_LOWER = new Map<string, string>();
for (const [pkg, url] of Object.entries(APP_SITES)) BY_LOWER.set(pkg.toLowerCase(), url);

export function siteForPackage(pkg: string): string {
  const key = pkg.trim().toLowerCase();
  return key ? BY_LOWER.get(key) ?? "" : "";
}

export function extractPackage(value: string): string {
  const trimmed = value.trim();
  const android = trimmed.match(/^android(?:app)?:\/\/([^/\s]+)/i);
  if (android) return android[1];
  if (/^[A-Za-z][\w]*(\.[\w-]+){2,}$/.test(trimmed)) return trimmed;
  return "";
}
