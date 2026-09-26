"use client";

// Реплика ведущего текстом. У части телефонов русского голоса нет, и стол
// должен уметь играть, читая с экрана, — поэтому плашка не зависит от того,
// включена ли озвучка на этом устройстве.
//
// Текст берётся из контекста, а место в разметке выбирает КАЖДЫЙ экран сам:
// футеры у них от нуля (у зрителей список идёт до края) до ~224 px (раздача
// ролей с тремя кнопками), и накладкой с общим отступом это не закрыть — она
// неизбежно ложилась на кнопки то на одном экране, то на другом. Стоя в потоке
// перед футером, плашка отнимает высоту у контента выше, а кнопки не двигает.
//
// Гаснет, когда ведущий договорил: длительность речи считает та же функция, по
// которой сервер удлиняет фазу. Иначе строка висела бы до конца фазы — всё
// обсуждение, две минуты после того, как её произнесли.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { speechMs, type MafiaNarration } from "@igroteka/shared/mafia-narration";

const NarrationContext = createContext<MafiaNarration | null>(null);

export function NarrationCaptionProvider({
  value,
  children,
}: {
  value: MafiaNarration | null;
  children: ReactNode;
}) {
  return <NarrationContext.Provider value={value}>{children}</NarrationContext.Provider>;
}

/** Сколько плашка висит после того, как реплика отзвучала. */
const CAPTION_LINGER_MS = 2500;
/** Длительность затухания. Продублирована в .mf-caption — менять в обоих местах. */
const CAPTION_FADE_MS = 600;

export default function NarrationCaption() {
  const narration = useContext(NarrationContext);
  const key = narration?.key ?? null;

  // Храним не «что показать», а «что уже отыграло»: показываемое выводится из
  // контекста прямо в рендере, и эффекту не нужно ничего выставлять сразу —
  // только по таймеру, когда реплика отзвучала.
  const [fadedKey, setFadedKey] = useState<string | null>(null);
  const [goneKey, setGoneKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key || !narration) return;
    const spoken = speechMs(narration.text) + CAPTION_LINGER_MS;
    const fade = window.setTimeout(() => setFadedKey(key), spoken);
    // Из разметки убираем только после затухания. Контент выше везде на
    // flex: 1 и заберёт освободившуюся высоту себе — футер не дрогнет.
    const gone = window.setTimeout(() => setGoneKey(key), spoken + CAPTION_FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, [key, narration]);

  if (!narration || goneKey === key) return null;
  return (
    <div className="mf-caption" role="status" data-faded={fadedKey === key ? "" : undefined}>
      {narration.text}
    </div>
  );
}
