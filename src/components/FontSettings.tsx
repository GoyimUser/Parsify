import { codeFonts, normalizeCodeFont } from "../lib/code-preferences";
import { fontOptions, englishFontOptions, type FontPreferences } from "../lib/font-preferences";
export { defaultFontPreferences, normalizeFontPreferences, type FontPreferences } from "../lib/font-preferences";

type Props = {
  preferences: FontPreferences;
  onChange: (preferences: FontPreferences) => void;
  onClose: () => void;
};

export function FontSettings({ preferences, onChange, onClose }: Props) {
  return <div className="font-settings-backdrop" role="presentation">
    <section className="font-settings" role="dialog" aria-modal="true" aria-labelledby="font-settings-title">
      <header>
        <h2 id="font-settings-title">تنظیمات قلم</h2>
        <p>قلم متن و متنِ درون فرمول را جداگانه انتخاب کنید.</p>
      </header>
      <label>
        قلم اصلی سند
        <select value={preferences.documentFont} onChange={(event) => onChange({ ...preferences, documentFont: event.target.value })}>
          {fontOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        قلم متن انگلیسی سند
        <select value={preferences.englishProseFont} onChange={(event) => onChange({ ...preferences, englishProseFont: event.target.value })}>
          {englishFontOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        قلم متن در فرمول‌های لاتک
        <select value={preferences.mathTextFont} onChange={(event) => onChange({ ...preferences, mathTextFont: event.target.value })}>
          {fontOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="font-settings-note">قلم انگلیسی فقط نثر لاتین مارک‌داون را تغییر می‌دهد. قلم متنِ فرمول فقط برای <code>\text&#123;...&#125;</code> و موارد مشابه است؛ ارقام یاس و نمادهای استاندارد لاتک ثابت می‌مانند.</p>
      <label>قلم بلوک‌های کد
        <select aria-label="Code block font" value={preferences.codeFont} onChange={event => onChange({ ...preferences, codeFont: normalizeCodeFont(event.target.value) })}>
          {codeFonts.map(font => <option key={font} value={font}>{font === "monospace" ? "System Monospace" : font}</option>)}
        </select>
      </label>
      <label className="code-ligatures-setting"><input type="checkbox" checked={preferences.codeLigatures} onChange={event => onChange({ ...preferences, codeLigatures: event.target.checked })} />Font Ligatures — اتصال نویسه‌های کد</label>
      <p className="font-settings-note">Ubuntu Mono همراه برنامه است. قلم‌های دیگر باید روی دستگاه نصب باشند؛ در غیر این صورت Ubuntu Mono نمایش داده می‌شود. لیگچر فقط در قلم‌های پشتیبان مانند Fira Code فعال می‌شود.</p>
      <footer><button className="primary" onClick={onClose}>انجام شد</button></footer>
    </section>
  </div>;
}
