import { useEffect, useState } from "react";
import { LOCALES, SUPPORTED_LOCALES, type Locale } from "../i18n/locales";
import { ISSUES_URL, PRIVACY_DOCS, PRIVACY_UPDATED } from "./privacyContent";
import { PRIVACY_LOCALE_STORAGE_KEY, htmlLangOf } from "./privacyLocale";

/** 隱私說明頁本體：純靜態內容，不連任何後端。 */
export function PrivacyPage({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const doc = PRIVACY_DOCS[locale];

  useEffect(() => {
    document.documentElement.lang = htmlLangOf(locale);
    document.title = `${doc.title} · Mini Taiwan Pulse`;
  }, [locale, doc.title]);

  const choose = (next: Locale) => {
    setLocale(next);
    try { localStorage.setItem(PRIVACY_LOCALE_STORAGE_KEY, next); } catch { /* 存不了不影響切換 */ }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState(null, "", url);
    } catch { /* 網址更新失敗不影響內容 */ }
  };

  return (
    <div className="privacy-root">
    <main className="privacy-page">
      <header className="privacy-header">
        <div>
          <span className="privacy-eyebrow">{doc.eyebrow}</span>
          <h1>{doc.title}</h1>
          <p className="privacy-updated">{doc.updatedLabel}<time dateTime={PRIVACY_UPDATED}>{PRIVACY_UPDATED}</time></p>
        </div>
        <div className="privacy-seg" role="group" aria-label={doc.langSwitchLabel}>
          {SUPPORTED_LOCALES.map((code) => (
            <button key={code} type="button" lang={htmlLangOf(code)} aria-pressed={code === locale} onClick={() => choose(code)}>
              {LOCALES[code].label}
            </button>
          ))}
        </div>
      </header>
      {doc.sections.map((section) => (
        <section key={section.id} id={section.id} className="privacy-section">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
          {section.items && <ul>{section.items.map((text) => <li key={text}>{text}</li>)}</ul>}
          {section.notes?.map((text) => <p key={text}>{text}</p>)}
          {section.id === "contact" && (
            <p><a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">{doc.contactLink}</a></p>
          )}
        </section>
      ))}
      <footer className="privacy-footer">
        <a href={locale === "zh-TW" ? "/" : `/?lang=${locale}`}>{doc.backToMap}</a>
      </footer>
    </main>
    </div>
  );
}
