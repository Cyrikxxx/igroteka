"use client";

// Выбор того, во что играть. Один компонент на три экрана: локальная игра,
// создание онлайн-комнаты и настройки лобби.
//
// Два уровня, и это намеренно разные вещи:
//   • Сложность — три больших набора. Их выбирают, но не раскрывают.
//   • Подборки — раскрываются, внутри темы. Тема входит ровно в одну
//     подборку, поэтому она нигде не дублируется и состояние карточки
//     («не выбрана / часть / вся») однозначно.
//
// Выбрать можно что угодно и в любом сочетании: одну сложность, все три,
// подборку целиком, пару тем из разных подборок или всё сразу. Наружу
// уходит один плоский список categoryIds — формат настроек партии не
// меняется.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import type { CatalogFromAPI, CategoryFromAPI, CollectionFromAPI } from "@/types";
import { isInSeason, seasonRank } from "@alias/shared/season";
import { pluralize, WORDS } from "@/lib/plural";

interface CategoryPickerProps {
  catalog: CatalogFromAPI | null;
  selected: number[];
  onChange: (ids: number[]) => void;
  /**
   * Честное число разных слов в наборе — экрану оно нужно для своей сводки.
   * Отдаём отсюда, чтобы не считать дважды: сложить счётчики категорий
   * нельзя, а лишний запрос ради той же цифры не нужен.
   */
  onWordCount?: (count: number | null) => void;
}

/** Карточка темы или уровня. */
function Card({
  category,
  on,
  onToggle,
  seasonNow,
}: {
  category: CategoryFromAPI;
  on: boolean;
  onToggle: () => void;
  seasonNow?: boolean;
}) {
  return (
    <button type="button" className={"cat-card" + (on ? " on" : "")} onClick={onToggle}>
      <span className="cat-check">
        <Check size={14} />
      </span>
      <span className="cat-emoji">{category.emoji}</span>
      <span className="cat-name">{category.name}</span>
      <span className="cat-count">
        {category._count?.words ?? 0} слов
        {seasonNow ? " · сейчас" : ""}
      </span>
    </button>
  );
}

export default function CategoryPicker({ catalog, selected, onChange, onWordCount }: CategoryPickerProps) {
  // Раскрытых подборок может быть сколько угодно: человек сравнивает темы
  // из разных, и захлопывать предыдущую при открытии следующей — мешать ему.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggleOpen = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const [wordCount, setWordCount] = useState<number | null>(null);

  // Через ref, а не напрямую в зависимостях эффекта: если экран передаст
  // сюда инлайновую стрелку, ссылка будет новой на каждый рендер и запрос
  // уйдёт в цикл.
  const reportRef = useRef(onWordCount);
  useEffect(() => {
    reportRef.current = onWordCount;
  });

  const chosen = useMemo(() => new Set(selected), [selected]);
  const month = new Date().getMonth() + 1;

  /**
   * Сколько РАЗНЫХ слов в наборе. Сложить счётчики категорий нельзя:
   * уровни намеренно пересекаются с темами, и сумма завышает итог на сотни
   * слов. Считает сервер одним запросом; дёргаем с задержкой, чтобы серия
   * быстрых нажатий не превратилась в серию запросов.
   */
  useEffect(() => {
    if (selected.length === 0) {
      // Ноль знаем и без сервера — сообщаем экрану и не ходим в сеть.
      reportRef.current?.(0);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/categories/word-count?ids=${selected.join(",")}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count: number } | null) => {
          setWordCount(d ? d.count : null);
          reportRef.current?.(d ? d.count : null);
        })
        .catch(() => {
          setWordCount(null);
          reportRef.current?.(null);
        });
    }, 250);
    return () => clearTimeout(id);
  }, [selected]);

  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const setMany = (ids: number[], on: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  };

  if (!catalog) {
    return <p className="muted">Загружаем темы…</p>;
  }

  // Сезонная подборка в свой месяц идёт первой: искать «Новый год» в
  // декабре человек не должен.
  const collections = [...catalog.collections].sort((a, b) => {
    const rank = (c: CollectionFromAPI) =>
      Math.min(...c.categories.map((x) => seasonRank(x.season, month)), 1);
    return rank(a) - rank(b);
  });

  const themeIds = catalog.collections.flatMap((c) => c.categories.map((x) => x.id));
  const chosenThemes = themeIds.filter((id) => chosen.has(id)).length;

  return (
    <div className="picker">
      <div className="picker-head">
        <h3 className="picker-title">Сложность</h3>
        <span className="picker-note">большие наборы на любой вкус</span>
      </div>
      <div className="cats-grid picker-levels">
        {catalog.levels.map((lvl) => (
          <Card
            key={lvl.id}
            category={lvl}
            on={chosen.has(lvl.id)}
            onToggle={() => toggle(lvl.id)}
          />
        ))}
      </div>

      <div className="picker-head">
        <h3 className="picker-title">Подборки</h3>
        <span className="picker-note">
          {chosenThemes > 0 ? `выбрано тем: ${chosenThemes}` : "нажми, чтобы взять целиком"}
        </span>
      </div>

      <div className="picker-collections">
        {collections.map((col) => {
          const ids = col.categories.map((c) => c.id);
          const inside = ids.filter((id) => chosen.has(id)).length;
          const all = inside === ids.length;
          const expanded = open.has(col.slug);
          const seasonNow = col.categories.some((c) => isInSeason(c.season, month));

          // Темы внутри: сезонная — первой.
          const cats = [...col.categories].sort(
            (a, b) => seasonRank(a.season, month) - seasonRank(b.season, month),
          );

          return (
            <div
              key={col.slug}
              className={
                "pick-col" +
                (all ? " all" : inside > 0 ? " some" : "") +
                (expanded ? " open" : "")
              }
            >
              <div className="pick-col-head">
                <button
                  type="button"
                  className="pick-col-main"
                  onClick={() => setMany(ids, !all)}
                  aria-pressed={all}
                >
                  <span className="pick-col-ic">
                    <span aria-hidden="true">{col.emoji}</span>
                    <span className="pick-col-check">
                      <Check size={13} />
                    </span>
                  </span>
                  <span className="pick-col-text">
                    <span className="pick-col-name">
                      {col.name}
                      {seasonNow && (
                        <span className="pick-col-season">
                          <Sparkles size={12} /> сезон
                        </span>
                      )}
                    </span>
                    <span className="pick-col-desc">{col.description}</span>
                  </span>
                  <span className="pick-col-count mono">
                    {inside > 0 ? `${inside}/${ids.length}` : `${ids.length} тем`}
                  </span>
                </button>
                <button
                  type="button"
                  className="pick-col-toggle"
                  onClick={() => toggleOpen(col.slug)}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Свернуть «${col.name}»` : `Раскрыть «${col.name}»`}
                >
                  <span className="pick-col-toggle-label">
                    {expanded ? "Свернуть" : "Темы"}
                  </span>
                  <ChevronDown size={17} />
                </button>
              </div>

              {expanded && (
                <div className="pick-col-body">
                  <div className="cats-grid">
                    {cats.map((cat) => (
                      <Card
                        key={cat.id}
                        category={cat}
                        on={chosen.has(cat.id)}
                        onToggle={() => toggle(cat.id)}
                        seasonNow={isInSeason(cat.season, month)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="picker-foot">
        {selected.length === 0 ? (
          <span className="muted">Выбери сложность или хотя бы одну тему</span>
        ) : (
          <span className="muted">
            Выбрано: {selected.length} · в игре{" "}
            <b className="mono accent-text">
              {wordCount === null ? "…" : pluralize(wordCount, WORDS)}
            </b>
          </span>
        )}
        {selected.length > 0 && (
          <button type="button" className="link-btn" onClick={() => onChange([])}>
            Очистить
          </button>
        )}
      </div>
    </div>
  );
}
