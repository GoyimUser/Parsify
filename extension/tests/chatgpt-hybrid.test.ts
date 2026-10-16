// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatGPTHybridController, isSafeChatGPTTextBlock } from "../src/chatgpt-hybrid";
import { defaults } from "../src/settings";

function fixture(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

async function finishStyleLoads() {
  document.querySelectorAll<HTMLElement>(".pmv-host").forEach(host => {
    host.shadowRoot?.querySelectorAll("link").forEach(link => link.dispatchEvent(new Event("load")));
  });
  await Promise.resolve();
  await Promise.resolve();
}

const hybridResponse = `
  <article data-testid="conversation-turn-assistant">
    <h4 data-conversation-role="assistant">ChatGPT said:</h4>
    <div data-markdown-text-style="assistant-message">
      <div data-dil-message-id="lesson-1">
        <h2 data-d-component="title">آزمون کوتاه مفهومی</h2>
        <p data-d-component="text" id="safe-prose">فرمول $1.8 + |6| + 7/9$ را با دقت بخوانید.</p>
        <div data-d-component="box" id="native-diagram"><svg aria-label="diagram"><path d="M0 0"></path></svg><p>نمودارِ بومی</p></div>
        <div data-d-component="box" id="native-quiz">
          <p>کدام گزینه درست است؟</p>
          <div data-d-component="radio-group">
            <button role="radio" data-state="unchecked">گزینهٔ اول</button>
            <button role="radio" data-state="unchecked">گزینهٔ دوم</button>
          </div>
          <button data-d-component="button">بررسی پاسخ‌ها</button>
        </div>
        <div data-d-component="table" id="native-table"><table><tbody><tr><td>۱۲</td><td>مقدار</td></tr></tbody></table></div>
        <blockquote data-d-component="text" id="safe-quote">نکتهٔ مهم: $n^2$</blockquote>
      </div>
    </div>
  </article>`;

describe("ChatGPT hybrid boundaries", () => {
  let controller: ChatGPTHybridController | undefined;
  afterEach(() => {
    controller?.stop();
    controller = undefined;
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("accepts only plain semantic text blocks and rejects ChatGPT native islands", () => {
    const root = fixture(hybridResponse);
    const prose = root.querySelector<HTMLElement>("#safe-prose")!;
    const quote = root.querySelector<HTMLElement>("#safe-quote")!;
    const quiz = root.querySelector<HTMLElement>("#native-quiz")!;
    const diagram = root.querySelector<HTMLElement>("#native-diagram")!;
    const table = root.querySelector<HTMLElement>("#native-table")!;
    expect(isSafeChatGPTTextBlock(prose)).toBe(true);
    expect(isSafeChatGPTTextBlock(quote)).toBe(true);
    expect(isSafeChatGPTTextBlock(quiz)).toBe(false);
    expect(isSafeChatGPTTextBlock(diagram)).toBe(false);
    expect(isSafeChatGPTTextBlock(table)).toBe(false);
  });

  it("enhances safe Persian prose while preserving native quizzes, diagrams and tables", async () => {
    document.body.innerHTML = hybridResponse;
    const root = document.querySelector<HTMLElement>('[data-markdown-text-style="assistant-message"]')!;
    const prose = document.querySelector<HTMLElement>("#safe-prose")!;
    const quote = document.querySelector<HTMLElement>("#safe-quote")!;
    const quiz = document.querySelector<HTMLElement>("#native-quiz")!;
    const diagram = document.querySelector<HTMLElement>("#native-diagram")!;
    const table = document.querySelector<HTMLElement>("#native-table")!;
    const initialRadioStates = Array.from(quiz.querySelectorAll("[role=radio]"), radio => radio.getAttribute("data-state"));

    controller = new ChatGPTHybridController(defaults, file => file);
    controller.start();
    await finishStyleLoads();

    const proseHost = prose.nextElementSibling as HTMLElement;
    expect(proseHost.classList.contains("pmv-host")).toBe(true);
    expect(proseHost.dataset.pmvChatgptSegment).toBe("true");
    expect(prose.style.display).toBe("none");
    expect(quote.style.display).toBe("none");
    expect(proseHost.shadowRoot?.querySelector(".reader-tools")).toBeNull();
    expect(proseHost.shadowRoot?.querySelector(".katex-html")?.textContent).toContain("۱.۸");
    expect(proseHost.shadowRoot?.querySelector(".katex-html")?.textContent).toContain("۶");
    expect(proseHost.shadowRoot?.querySelector(".katex-html")?.textContent).toContain("۷");

    expect(quiz.style.display).toBe("");
    expect(quiz.classList.contains("pmv-chatgpt-native")).toBe(true);
    expect(quiz.dataset.pmvNativeKind).toBe("quiz");
    expect(quiz.querySelectorAll("[role=radio]")).toHaveLength(2);
    expect(Array.from(quiz.querySelectorAll("[role=radio]"), radio => radio.getAttribute("data-state"))).toEqual(initialRadioStates);
    expect(quiz.querySelector(".pmv-host")).toBeNull();
    expect(diagram.dataset.pmvNativeKind).toBe("diagram");
    expect(table.dataset.pmvNativeKind).toBe("table");
    expect(root.dataset.pmvChatgptHybrid).toBe("true");
    expect(root.style.getPropertyValue("--pmv-persian-font")).toContain("Vazirmatn");

    controller.setSettings({ ...defaults, persianFont: "B Nazanin" });
    expect(root.style.getPropertyValue("--pmv-persian-font")).toContain("B Nazanin");
    controller.setSettings({ ...defaults, enabled: false });
    expect(prose.style.display).toBe("");
    expect(document.querySelector(".pmv-host")).toBeNull();
    expect(quiz.classList.contains("pmv-chatgpt-native")).toBe(false);
    expect(root.dataset.pmvChatgptHybrid).toBeUndefined();
  });

  it("keeps a stream safe when a prose block becomes a native interactive component", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = hybridResponse;
    const prose = document.querySelector<HTMLElement>("#safe-prose")!;
    controller = new ChatGPTHybridController(defaults, file => file);
    controller.start();
    await finishStyleLoads();
    expect(prose.style.display).toBe("none");

    prose.innerHTML = 'این بخش در حال تبدیل است <button role="button">کنترل بومی</button>';
    await vi.advanceTimersByTimeAsync(150);
    expect(prose.style.display).toBe("");
    expect(prose.nextElementSibling?.classList.contains("pmv-host")).toBe(false);
    expect(prose.dataset.pmvNativeKind).toBe("interactive");
  });
});
