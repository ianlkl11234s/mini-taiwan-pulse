/**
 * FIPS 10-4 國碼 → ISO 3166-1 alpha-2。
 *
 * 全球情勢（GDELT）候選的 `country_code` 是 FIPS 10-4（`country_code_scheme = "fips10"`，
 * 見 data-collectors `collectors/global_events.py`），直接顯示會被誤讀：CH＝中國（ISO 是瑞士）、
 * AS＝澳洲（ISO 是美屬薩摩亞）、IS＝以色列（ISO 是冰島）。
 *
 * 對照表由 GeoNames `countryInfo.txt`（https://download.geonames.org/export/dump/countryInfo.txt，
 * CC BY 4.0，2026-11-13 取得）的 ISO 與 fips 欄位機械產生，不手編；表外的代碼原樣顯示、不猜。
 */
export const FIPS10_TO_ISO2: Readonly<Record<string, string>> = {
  AA: "AW", // Aruba
  AC: "AG", // Antigua and Barbuda
  AE: "AE", // United Arab Emirates
  AF: "AF", // Afghanistan
  AG: "DZ", // Algeria
  AJ: "AZ", // Azerbaijan
  AL: "AL", // Albania
  AM: "AM", // Armenia
  AN: "AD", // Andorra
  AO: "AO", // Angola
  AQ: "AS", // American Samoa
  AR: "AR", // Argentina
  AS: "AU", // Australia
  AU: "AT", // Austria
  AV: "AI", // Anguilla
  AY: "AQ", // Antarctica
  BA: "BH", // Bahrain
  BB: "BB", // Barbados
  BC: "BW", // Botswana
  BD: "BM", // Bermuda
  BE: "BE", // Belgium
  BF: "BS", // Bahamas
  BG: "BD", // Bangladesh
  BH: "BZ", // Belize
  BK: "BA", // Bosnia and Herzegovina
  BL: "BO", // Bolivia
  BM: "MM", // Myanmar
  BN: "BJ", // Benin
  BO: "BY", // Belarus
  BP: "SB", // Solomon Islands
  BR: "BR", // Brazil
  BT: "BT", // Bhutan
  BU: "BG", // Bulgaria
  BV: "BV", // Bouvet Island
  BX: "BN", // Brunei
  BY: "BI", // Burundi
  CA: "CA", // Canada
  CB: "KH", // Cambodia
  CD: "TD", // Chad
  CE: "LK", // Sri Lanka
  CF: "CG", // Republic of the Congo
  CG: "CD", // Democratic Republic of the Congo
  CH: "CN", // China
  CI: "CL", // Chile
  CJ: "KY", // Cayman Islands
  CK: "CC", // Cocos Islands
  CM: "CM", // Cameroon
  CN: "KM", // Comoros
  CO: "CO", // Colombia
  CQ: "MP", // Northern Mariana Islands
  CS: "CR", // Costa Rica
  CT: "CF", // Central African Republic
  CU: "CU", // Cuba
  CV: "CV", // Cabo Verde
  CW: "CK", // Cook Islands
  CY: "CY", // Cyprus
  DA: "DK", // Denmark
  DJ: "DJ", // Djibouti
  DO: "DM", // Dominica
  DR: "DO", // Dominican Republic
  EC: "EC", // Ecuador
  EG: "EG", // Egypt
  EI: "IE", // Ireland
  EK: "GQ", // Equatorial Guinea
  EN: "EE", // Estonia
  ER: "ER", // Eritrea
  ES: "SV", // El Salvador
  ET: "ET", // Ethiopia
  EZ: "CZ", // Czechia
  FG: "GF", // French Guiana
  FI: "FI", // Finland
  FJ: "FJ", // Fiji
  FK: "FK", // Falkland Islands
  FM: "FM", // Micronesia
  FO: "FO", // Faroe Islands
  FP: "PF", // French Polynesia
  FR: "FR", // France
  FS: "TF", // French Southern Territories
  GA: "GM", // Gambia
  GB: "GA", // Gabon
  GG: "GE", // Georgia
  GH: "GH", // Ghana
  GI: "GI", // Gibraltar
  GJ: "GD", // Grenada
  GK: "GG", // Guernsey
  GL: "GL", // Greenland
  GM: "DE", // Germany
  GP: "GP", // Guadeloupe
  GQ: "GU", // Guam
  GR: "GR", // Greece
  GT: "GT", // Guatemala
  GV: "GN", // Guinea
  GY: "GY", // Guyana
  HA: "HT", // Haiti
  HK: "HK", // Hong Kong
  HM: "HM", // Heard Island and McDonald Islands
  HO: "HN", // Honduras
  HR: "HR", // Croatia
  HU: "HU", // Hungary
  IC: "IS", // Iceland
  ID: "ID", // Indonesia
  IM: "IM", // Isle of Man
  IN: "IN", // India
  IO: "IO", // British Indian Ocean Territory
  IR: "IR", // Iran
  IS: "IL", // Israel
  IT: "IT", // Italy
  IV: "CI", // Ivory Coast
  IZ: "IQ", // Iraq
  JA: "JP", // Japan
  JE: "JE", // Jersey
  JM: "JM", // Jamaica
  JO: "JO", // Jordan
  KE: "KE", // Kenya
  KG: "KG", // Kyrgyzstan
  KN: "KP", // North Korea
  KR: "KI", // Kiribati
  KS: "KR", // South Korea
  KT: "CX", // Christmas Island
  KU: "KW", // Kuwait
  KV: "XK", // Kosovo
  KZ: "KZ", // Kazakhstan
  LA: "LA", // Laos
  LE: "LB", // Lebanon
  LG: "LV", // Latvia
  LH: "LT", // Lithuania
  LI: "LR", // Liberia
  LO: "SK", // Slovakia
  LS: "LI", // Liechtenstein
  LT: "LS", // Lesotho
  LU: "LU", // Luxembourg
  LY: "LY", // Libya
  MA: "MG", // Madagascar
  MB: "MQ", // Martinique
  MC: "MO", // Macao
  MD: "MD", // Moldova
  MF: "YT", // Mayotte
  MG: "MN", // Mongolia
  MH: "MS", // Montserrat
  MI: "MW", // Malawi
  MJ: "ME", // Montenegro
  MK: "MK", // North Macedonia
  ML: "ML", // Mali
  MN: "MC", // Monaco
  MO: "MA", // Morocco
  MP: "MU", // Mauritius
  MR: "MR", // Mauritania
  MT: "MT", // Malta
  MU: "OM", // Oman
  MV: "MV", // Maldives
  MX: "MX", // Mexico
  MY: "MY", // Malaysia
  MZ: "MZ", // Mozambique
  NC: "NC", // New Caledonia
  NE: "NU", // Niue
  NF: "NF", // Norfolk Island
  NG: "NE", // Niger
  NH: "VU", // Vanuatu
  NI: "NG", // Nigeria
  NL: "NL", // The Netherlands
  NN: "SX", // Sint Maarten
  NO: "NO", // Norway
  NP: "NP", // Nepal
  NR: "NR", // Nauru
  NS: "SR", // Suriname
  NT: "AN", // Netherlands Antilles
  NU: "NI", // Nicaragua
  NZ: "NZ", // New Zealand
  OD: "SS", // South Sudan
  PA: "PY", // Paraguay
  PC: "PN", // Pitcairn
  PE: "PE", // Peru
  PK: "PK", // Pakistan
  PL: "PL", // Poland
  PM: "PA", // Panama
  PO: "PT", // Portugal
  PP: "PG", // Papua New Guinea
  PS: "PW", // Palau
  PU: "GW", // Guinea-Bissau
  QA: "QA", // Qatar
  RE: "RE", // Reunion
  RI: "RS", // Serbia
  RM: "MH", // Marshall Islands
  RN: "MF", // Saint Martin
  RO: "RO", // Romania
  RP: "PH", // Philippines
  RQ: "PR", // Puerto Rico
  RS: "RU", // Russia
  RW: "RW", // Rwanda
  SA: "SA", // Saudi Arabia
  SB: "PM", // Saint Pierre and Miquelon
  SC: "KN", // Saint Kitts and Nevis
  SE: "SC", // Seychelles
  SF: "ZA", // South Africa
  SG: "SN", // Senegal
  SH: "SH", // Saint Helena
  SI: "SI", // Slovenia
  SL: "SL", // Sierra Leone
  SM: "SM", // San Marino
  SN: "SG", // Singapore
  SO: "SO", // Somalia
  SP: "ES", // Spain
  ST: "LC", // Saint Lucia
  SU: "SD", // Sudan
  SV: "SJ", // Svalbard and Jan Mayen
  SW: "SE", // Sweden
  SX: "GS", // South Georgia and the South Sandwich Islands
  SY: "SY", // Syria
  SZ: "CH", // Switzerland
  TB: "BL", // Saint Barthelemy
  TD: "TT", // Trinidad and Tobago
  TH: "TH", // Thailand
  TI: "TJ", // Tajikistan
  TK: "TC", // Turks and Caicos Islands
  TL: "TK", // Tokelau
  TN: "TO", // Tonga
  TO: "TG", // Togo
  TP: "ST", // Sao Tome and Principe
  TS: "TN", // Tunisia
  TT: "TL", // Timor Leste
  TU: "TR", // Turkey
  TV: "TV", // Tuvalu
  TW: "TW", // Taiwan
  TX: "TM", // Turkmenistan
  TZ: "TZ", // Tanzania
  UC: "CW", // Curacao
  UG: "UG", // Uganda
  UK: "GB", // United Kingdom
  UP: "UA", // Ukraine
  US: "US", // United States
  UV: "BF", // Burkina Faso
  UY: "UY", // Uruguay
  UZ: "UZ", // Uzbekistan
  VC: "VC", // Saint Vincent and the Grenadines
  VE: "VE", // Venezuela
  VI: "VG", // British Virgin Islands
  VM: "VN", // Vietnam
  VQ: "VI", // U.S. Virgin Islands
  VT: "VA", // Vatican
  WA: "NA", // Namibia
  WE: "PS", // Palestinian Territory
  WF: "WF", // Wallis and Futuna
  WI: "EH", // Western Sahara
  WS: "WS", // Samoa
  WZ: "SZ", // Eswatini
  YI: "CS", // Serbia and Montenegro
  YM: "YE", // Yemen
  ZA: "ZM", // Zambia
  ZI: "ZW", // Zimbabwe
};

/** 顯示用國碼：FIPS 10-4 轉成 ISO alpha-2；其他代碼系統或對不到的原樣回傳。 */
export function displayCountryCode(code: string | null | undefined, scheme: string | null | undefined): string | null {
  if (!code) return null;
  if (scheme !== "fips10") return code;
  return FIPS10_TO_ISO2[code.trim().toUpperCase()] ?? code;
}
