// Выбор голоса и переключатель «озвучивать здесь».
//
// Голоса ставит операционная система, поэтому и список, и выбор — про
// устройство, а не про комнату. Проверяем, что выбранный голос действительно
// доходит до синтеза: иначе список был бы красивой, но мёртвой кнопкой.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import MafiaSettingsForm from "@/components/mafia/MafiaSettingsForm";
import { useVoicePref } from "@/hooks/useVoicePref";
import { DEFAULT_MAFIA_SETTINGS, type MafiaSettings } from "@alias/shared/mafia";

interface FakeUtterance {
  text: string;
  voice: { name: string; voiceURI: string } | null;
}

const spoken: FakeUtterance[] = [];
let cancelled = 0;

const VOICES = [
  { name: "Милена", voiceURI: "ru-milena", lang: "ru-RU" },
  { name: "Дмитрий", voiceURI: "ru-dmitry", lang: "ru-RU" },
  { name: "Daniel", voiceURI: "en-daniel", lang: "en-GB" },
];

beforeEach(() => {
  spoken.length = 0;
  cancelled = 0;
  localStorage.clear();
  vi.stubGlobal("speechSynthesis", {
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: () => {
      cancelled += 1;
    },
    getVoices: () => VOICES,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      lang = "";
      rate = 1;
      volume = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
});

function narratorSettings(): MafiaSettings {
  return {
    ...DEFAULT_MAFIA_SETTINGS,
    narrator: true,
    roles: { ...DEFAULT_MAFIA_SETTINGS.roles },
    timers: { ...DEFAULT_MAFIA_SETTINGS.timers },
    rules: { ...DEFAULT_MAFIA_SETTINGS.rules },
  };
}

function renderForm(value: MafiaSettings = narratorSettings()) {
  render(<MafiaSettingsForm value={value} onChange={vi.fn()} playerCount={8} />);
  return screen.queryByLabelText("Голос ведущего") as HTMLSelectElement | null;
}

describe("выбор голоса", () => {
  it("в списке только русские голоса устройства", () => {
    const select = renderForm();
    const options = Array.from(select!.options).map((o) => o.textContent);
    expect(options).toEqual(["Милена", "Дмитрий"]);
  });

  it("выбора нет, пока ведущий выключен", () => {
    const off = { ...narratorSettings(), narrator: false };
    render(<MafiaSettingsForm value={off} onChange={vi.fn()} playerCount={8} />);
    expect(screen.queryByLabelText("Голос ведущего")).toBeNull();
  });

  it("выбранный голос доходит до синтеза, а не только до списка", () => {
    const select = renderForm();
    fireEvent.change(select!, { target: { value: "ru-dmitry" } });
    // Выбор сразу проговаривается — и подтверждает, и будит синтез на iOS.
    expect(spoken.at(-1)?.voice?.name).toBe("Дмитрий");
  });

  it("выбор переживает перерисовку страницы", () => {
    const select = renderForm();
    fireEvent.change(select!, { target: { value: "ru-dmitry" } });
    screen.getByText("Послушать"); // старое дерево уходит вместе с cleanup
    spoken.length = 0;

    render(<MafiaSettingsForm value={narratorSettings()} onChange={vi.fn()} playerCount={8} />);
    fireEvent.click(screen.getAllByText("Послушать")[1]);
    expect(spoken.at(-1)?.voice?.name).toBe("Дмитрий");
  });

  it("без выбора берётся первый русский", () => {
    renderForm();
    fireEvent.click(screen.getByText("Послушать"));
    expect(spoken.at(-1)?.voice?.name).toBe("Милена");
  });
});

describe("озвучивать на этом устройстве", () => {
  it("по умолчанию говорит хост, остальные молчат", () => {
    const host = renderHook(() => useVoicePref(true));
    expect(host.result.current.on).toBe(true);
    const guest = renderHook(() => useVoicePref(false));
    expect(guest.result.current.on).toBe(false);
  });

  it("включение подтверждается вслух — заодно будит синтез на iOS", () => {
    const { result } = renderHook(() => useVoicePref(false));
    act(() => result.current.toggle("Озвучка включена."));
    expect(result.current.on).toBe(true);
    expect(spoken.at(-1)?.text).toBe("Озвучка включена.");
  });

  it("выключение обрывает начатую реплику", () => {
    const { result } = renderHook(() => useVoicePref(true));
    act(() => result.current.toggle());
    expect(result.current.on).toBe(false);
    expect(cancelled).toBeGreaterThan(0);
  });

  it("выбор устройства сильнее умолчания и переживает перезаход", () => {
    const first = renderHook(() => useVoicePref(true));
    act(() => first.result.current.toggle());
    first.unmount();

    // Хост вернулся в комнату — телефон помнит, что его просили молчать.
    const again = renderHook(() => useVoicePref(true));
    expect(again.result.current.on).toBe(false);
  });
});
