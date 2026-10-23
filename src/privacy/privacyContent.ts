/**
 * 隱私說明頁（/privacy）三語內文。
 *
 * 內容依據（改內容前先查這些地方是否還一致）：
 * - 登入：src/lib/auth.ts（Google OAuth only，經 Supabase Auth）
 * - 使用紀錄：src/lib/sessionTracker.ts＋gis-platform migrations/472（不帶帳號、保留 90 天）
 * - AI 金鑰：src/lib/keyVault.ts（記憶體／sessionStorage／localStorage）
 * - 第三方：nginx.conf 主站 CSP（Report-Only）connect-src／img-src／frame-src，
 *   以及直接向日本機關伺服器請求的圖層（src/data/jmaTypes.ts、src/hooks/useJpWaterLayers.ts）
 * - 刪除帳號：gis-platform `delete_my_account()` RPC
 *
 * 不放進 src/i18n/locales：長文只在這頁用，避免把整頁塞進介面字串 parity。
 */
import type { Locale } from "../i18n/locales";

export const PRIVACY_UPDATED = "2026-10-23";
export const ISSUES_URL = "https://github.com/ianlkl11234s/mini-taiwan-pulse/issues";

export interface PrivacySection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  items?: readonly string[];
  /** 清單之後的補充段落 */
  notes?: readonly string[];
}

export interface PrivacyDoc {
  title: string;
  eyebrow: string;
  updatedLabel: string;
  langSwitchLabel: string;
  backToMap: string;
  contactLink: string;
  sections: readonly PrivacySection[];
}

const zh: PrivacyDoc = {
  title: "隱私說明",
  eyebrow: "Mini Taiwan Pulse",
  updatedLabel: "最後更新：",
  langSwitchLabel: "語言",
  backToMap: "回到地圖",
  contactLink: "到 GitHub 開 issue",
  sections: [
    {
      id: "about",
      heading: "關於本站",
      paragraphs: [
        "Mini Taiwan Pulse 是個人開發的開源專案，用開放資料把台灣的交通、環境與城市動態畫在地圖上。",
        "不需要登入就能使用地圖。只有想保存收藏、場景或地點時才需要登入。",
      ],
    },
    {
      id: "sign-in",
      heading: "登入",
      paragraphs: [
        "本站只提供 Google 登入，透過 Supabase Auth 處理。登入時我們取得的是 Google 提供的 email、顯示名稱與頭像。",
        "這些資料只用來辨識你的帳號、保存你的收藏、場景與地點。不會用於廣告，也不會出售或提供給他人。",
      ],
    },
    {
      id: "member-data",
      heading: "會員資料存在哪裡",
      paragraphs: [
        "你的圖層收藏、場景與地點存在本站使用的 Supabase 資料庫。資料庫設有權限規則，每個人只讀寫得到自己的資料。",
        "沒有登入時，圖層收藏只存在你這個瀏覽器裡，不會上傳。",
      ],
    },
    {
      id: "usage",
      heading: "使用紀錄",
      paragraphs: [
        "為了了解大家怎麼使用地圖，本站會記錄匿名的使用統計。每次載入頁面會產生一組隨機 ID，紀錄內容包括：",
      ],
      items: [
        "瀏覽器的 user agent 與螢幕尺寸",
        "開關圖層、切換模式、點擊了哪一類圖徵（只記圖層類型，不記點擊位置）",
        "地圖視角（中心點、縮放與傾斜，每 5 秒最多一筆）",
      ],
      notes: [
        "這些紀錄不與你的帳號綁定，保留 90 天後刪除。",
        "網站主機與 CDN 可能依一般慣例記錄 IP 位址等連線日誌。",
        "網站透過 Cloudflare Web Analytics 統計整體流量（例如頁面瀏覽次數），它不使用 cookie，也不追蹤個人。除此之外，本站沒有使用 Google Analytics 或其他廣告、追蹤工具。",
      ],
    },
    {
      id: "ai",
      heading: "AI 對話（自備金鑰）",
      paragraphs: [
        "AI 對話使用你自己填入的 API 金鑰。金鑰只存在你的瀏覽器：依你的選擇放在記憶體（關閉分頁即消失）、sessionStorage 或 localStorage，不會送到本站伺服器。",
        "對話內容由你的瀏覽器直接送到你選的服務（Anthropic、OpenAI 或 Google），不經過本站伺服器。這些服務如何處理資料，依其各自的隱私政策。",
      ],
    },
    {
      id: "third-parties",
      heading: "會連到的第三方服務",
      paragraphs: [
        "使用地圖時，你的瀏覽器會直接連到下列服務。它們會收到一般的連線資訊（例如 IP 位址與瀏覽器資訊），並依各自政策處理：",
      ],
      items: [
        "Supabase：資料庫、登入與即時資料",
        "Mapbox：底圖與地圖圖磚，並會把地圖使用統計送到 events.mapbox.com",
        "Cloudflare R2（data.itsmigu.com 等）：靜態資料與統計檔",
        "Protomaps：部分地圖的字型與圖示",
        "YouTube：部分即時影像以嵌入播放器呈現",
        "各政府機關的開放資料伺服器：部分圖層的影像（例如監視器畫面）、圖磚與圖例會直接向來源機關載入，包括日本氣象廳、國土地理院等日本機關",
      ],
    },
    {
      id: "storage",
      heading: "瀏覽器儲存",
      paragraphs: ["本站在你的瀏覽器裡存放以下幾類資料，都是網站運作需要的，不使用廣告 cookie："],
      items: [
        "介面設定：語言、底圖、面板狀態等",
        "收藏與登入狀態：未登入時的圖層收藏、登入工作階段",
        "快取：加快重複載入的資料",
        "AI 金鑰：只有你選擇保存時才會存放（見上方「AI 對話」）",
      ],
    },
    {
      id: "delete",
      heading: "刪除帳號",
      paragraphs: [
        "登入後，在「會員專區」最下方可以自行刪除帳號。刪除會立即移除你的帳號、圖層收藏、場景、地點與存取紀錄，無法復原。",
        "如果你曾用同一個帳號在 tree-report 送出樹木通報，通報內容會保留，但不再與你連結。",
      ],
    },
    {
      id: "contact",
      heading: "聯絡",
      paragraphs: ["對隱私有疑問或想提出請求，請到專案的 GitHub 頁面開 issue。"],
    },
  ],
};

const en: PrivacyDoc = {
  title: "Privacy notice",
  eyebrow: "Mini Taiwan Pulse",
  updatedLabel: "Last updated: ",
  langSwitchLabel: "Language",
  backToMap: "Back to the map",
  contactLink: "Open an issue on GitHub",
  sections: [
    {
      id: "about",
      heading: "About this site",
      paragraphs: [
        "Mini Taiwan Pulse is an open-source project built by one individual. It uses open data to show Taiwan's transport, environment and city activity on a map.",
        "You can use the map without signing in. Signing in is only needed to save favorites, scenes or places.",
      ],
    },
    {
      id: "sign-in",
      heading: "Signing in",
      paragraphs: [
        "The only sign-in option is Google, handled through Supabase Auth. When you sign in, we receive the email address, display name and profile picture that Google provides.",
        "We use them only to identify your account and keep your favorites, scenes and places. They are not used for advertising and are never sold or shared.",
      ],
    },
    {
      id: "member-data",
      heading: "Where member data is stored",
      paragraphs: [
        "Your layer favorites, scenes and places are stored in the Supabase database this site uses. Access rules ensure each person can only read and write their own data.",
        "If you are not signed in, layer favorites stay in your browser and are not uploaded.",
      ],
    },
    {
      id: "usage",
      heading: "Usage records",
      paragraphs: [
        "To understand how the map is used, the site keeps anonymous usage statistics. Each page load creates a random ID, and the records include:",
      ],
      items: [
        "Your browser's user agent and screen size",
        "Turning layers on or off, switching modes, and which type of map feature you clicked (the layer type only, not where you clicked)",
        "The map view (center, zoom and tilt), at most one record every 5 seconds",
      ],
      notes: [
        "These records are not linked to your account and are deleted after 90 days.",
        "As is usual, the web host and CDN may keep connection logs such as IP addresses.",
        "The site uses Cloudflare Web Analytics to count overall traffic (such as page views). It does not use cookies and does not track individuals. Apart from that, this site does not use Google Analytics or any other advertising or tracking tools.",
      ],
    },
    {
      id: "ai",
      heading: "AI chat (bring your own key)",
      paragraphs: [
        "AI chat uses an API key you enter yourself. The key stays in your browser only: in memory (gone when you close the tab), sessionStorage or localStorage, depending on what you choose. It is never sent to this site's servers.",
        "Your browser sends the conversation directly to the service you choose (Anthropic, OpenAI or Google), not through this site's servers. Each service handles data under its own privacy policy.",
      ],
    },
    {
      id: "third-parties",
      heading: "Third-party services your browser connects to",
      paragraphs: [
        "While you use the map, your browser connects directly to the services below. They receive ordinary connection information (such as your IP address and browser details) and handle it under their own policies:",
      ],
      items: [
        "Supabase: database, sign-in and live data",
        "Mapbox: basemap and map tiles; it also sends map usage statistics to events.mapbox.com",
        "Cloudflare R2 (data.itsmigu.com and others): static data and statistics files",
        "Protomaps: fonts and icons for some maps",
        "YouTube: some live video is shown in an embedded player",
        "Government open-data servers: some layers load images (such as traffic camera snapshots), tiles and legends directly from the source agency, including Japanese agencies such as the Japan Meteorological Agency and the Geospatial Information Authority of Japan",
      ],
    },
    {
      id: "storage",
      heading: "Browser storage",
      paragraphs: ["The site stores the following kinds of data in your browser. All of it is needed for the site to work, and no advertising cookies are used:"],
      items: [
        "Interface settings: language, basemap, panel state and similar",
        "Favorites and sign-in state: layer favorites when signed out, and your sign-in session",
        "Cache: data kept to make repeat visits faster",
        "AI keys: only if you choose to save them (see “AI chat” above)",
      ],
    },
    {
      id: "delete",
      heading: "Deleting your account",
      paragraphs: [
        "Once signed in, you can delete your account yourself at the bottom of the Member area. Deletion immediately removes your account, layer favorites, scenes, places and access records, and cannot be undone.",
        "If you used the same account to submit tree reports on tree-report, those reports are kept but are no longer linked to you.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      paragraphs: ["For privacy questions or requests, please open an issue on the project's GitHub page."],
    },
  ],
};

const ja: PrivacyDoc = {
  title: "プライバシーについて",
  eyebrow: "Mini Taiwan Pulse",
  updatedLabel: "最終更新：",
  langSwitchLabel: "言語",
  backToMap: "地図に戻る",
  contactLink: "GitHub で issue を作成",
  sections: [
    {
      id: "about",
      heading: "このサイトについて",
      paragraphs: [
        "Mini Taiwan Pulse は個人が開発しているオープンソースのプロジェクトです。オープンデータを使い、台湾の交通・環境・都市の動きを地図に表示しています。",
        "地図はログインしなくても利用できます。ログインが必要なのは、お気に入り・シーン・地点を保存したいときだけです。",
      ],
    },
    {
      id: "sign-in",
      heading: "ログイン",
      paragraphs: [
        "ログインは Google のみで、Supabase Auth を通じて処理します。ログイン時に受け取るのは、Google が提供するメールアドレス・表示名・プロフィール画像です。",
        "これらはアカウントの識別と、お気に入り・シーン・地点の保存にのみ使います。広告には使わず、販売や第三者への提供もしません。",
      ],
    },
    {
      id: "member-data",
      heading: "会員データの保存先",
      paragraphs: [
        "レイヤーのお気に入り・シーン・地点は、このサイトが使う Supabase のデータベースに保存されます。アクセス権限のルールにより、各ユーザーは自分のデータしか読み書きできません。",
        "ログインしていない場合、レイヤーのお気に入りはお使いのブラウザ内にのみ保存され、送信されません。",
      ],
    },
    {
      id: "usage",
      heading: "利用記録",
      paragraphs: [
        "地図の使われ方を把握するため、匿名の利用統計を記録しています。ページを読み込むたびにランダムな ID が作られ、次の内容を記録します。",
      ],
      items: [
        "ブラウザの user agent と画面サイズ",
        "レイヤーのオン・オフ、モードの切り替え、クリックした地物の種類（レイヤーの種類のみで、クリックした位置は記録しません）",
        "地図の表示範囲（中心・ズーム・傾き。5 秒に最大 1 件）",
      ],
      notes: [
        "これらの記録はアカウントとひも付けず、90 日後に削除します。",
        "一般的な運用として、ウェブサーバーと CDN が IP アドレスなどの接続ログを記録する場合があります。",
        "サイト全体のアクセス数（ページビューなど）の集計に Cloudflare Web Analytics を使っています。Cookie は使わず、個人を追跡することもありません。それ以外に、Google Analytics などの広告・トラッキングツールは使っていません。",
      ],
    },
    {
      id: "ai",
      heading: "AI チャット（自分の API キーを使用）",
      paragraphs: [
        "AI チャットでは、ご自身で入力した API キーを使います。キーはお使いのブラウザ内にのみ保存され、選択に応じてメモリ（タブを閉じると消えます）、sessionStorage、localStorage のいずれかに置かれます。このサイトのサーバーには送信されません。",
        "会話はブラウザから選択したサービス（Anthropic、OpenAI、Google）へ直接送られ、このサイトのサーバーを経由しません。各サービスでのデータの扱いは、それぞれのプライバシーポリシーに従います。",
      ],
    },
    {
      id: "third-parties",
      heading: "接続する外部サービス",
      paragraphs: [
        "地図の利用中、ブラウザは次のサービスに直接接続します。各サービスは IP アドレスやブラウザ情報などの一般的な接続情報を受け取り、それぞれのポリシーに従って扱います。",
      ],
      items: [
        "Supabase：データベース、ログイン、リアルタイムデータ",
        "Mapbox：ベースマップと地図タイル。地図の利用統計を events.mapbox.com に送信します",
        "Cloudflare R2（data.itsmigu.com など）：静的データと統計ファイル",
        "Protomaps：一部の地図のフォントとアイコン",
        "YouTube：一部のライブ映像を埋め込みプレーヤーで表示",
        "各国の行政機関のオープンデータサーバー：一部のレイヤーは画像（監視カメラの画像など）・タイル・凡例を提供元の機関から直接読み込みます。気象庁・国土地理院など日本の機関も含みます",
      ],
    },
    {
      id: "storage",
      heading: "ブラウザへの保存",
      paragraphs: ["このサイトはブラウザに次の種類のデータを保存します。いずれもサイトの動作に必要なもので、広告用の cookie は使いません。"],
      items: [
        "画面の設定：言語、ベースマップ、パネルの状態など",
        "お気に入りとログイン状態：未ログイン時のレイヤーのお気に入り、ログインセッション",
        "キャッシュ：再訪時の読み込みを速くするためのデータ",
        "AI の API キー：保存を選んだ場合のみ（上記「AI チャット」を参照）",
      ],
    },
    {
      id: "delete",
      heading: "アカウントの削除",
      paragraphs: [
        "ログイン後、「会員エリア」の一番下からご自身でアカウントを削除できます。削除するとアカウント、レイヤーのお気に入り、シーン、地点、アクセス記録がすぐに消去され、元に戻せません。",
        "同じアカウントで tree-report から樹木の通報を送ったことがある場合、通報の内容は残りますが、あなたとのひも付けは解除されます。",
      ],
    },
    {
      id: "contact",
      heading: "お問い合わせ",
      paragraphs: ["プライバシーに関するご質問やご要望は、プロジェクトの GitHub ページで issue を作成してください。"],
    },
  ],
};

export const PRIVACY_DOCS: Readonly<Record<Locale, PrivacyDoc>> = { "zh-TW": zh, en, ja };
