import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import AppShell from "@/components/common/AppShell";
import { supportMailto } from "@/constants/site";

export const metadata: Metadata = {
  title: "О нас · Alias",
  description: "Alias Online — бесплатная веб-версия игры в слова. Онлайн и локально, без регистрации.",
};

export default function AboutPage() {
  return (
    <AppShell nav className="screen-anim">
      <Link href="/" className="back-link">
        <ArrowLeft /> На главную
      </Link>

      <div className="info-page">
        <span className="eyebrow">о проекте</span>
        <h1 className="h-display" style={{ margin: "10px 0 18px" }}>
          Alias Online
        </h1>

        <div className="prose">
          <p>
            <strong>Alias</strong> — это весёлая игра в слова: один игрок объясняет слово, не
            называя его и однокоренные, а команда угадывает. Чем больше слов за раунд — тем больше
            очков. Эта веб-версия позволяет играть прямо в браузере, без приложений и установки.
          </p>

          <h2>Два режима</h2>
          <p>
            <strong>Онлайн</strong> — каждый играет со своего телефона в одной комнате, счёт и ход
            обновляются в реальном времени через вебсокеты. <strong>Локально</strong> — одна
            компания и одно устройство, которое передаётся по кругу.
          </p>

          <h2>Что внутри</h2>
          <ul>
            <li>10 категорий и 629 слов</li>
            <li>Командный счёт, настраиваемые правила (время раунда, цель, штраф за пропуск)</li>
            <li>Тёмная и светлая темы</li>
            <li>История сыгранных партий с возможностью вернуться к незавершённой игре</li>
            <li>Работает на любом телефоне, планшете и компьютере</li>
          </ul>

          <h2>Бесплатно и без регистрации</h2>
          <p>
            Аккаунт не нужен — заходи и играй. Никакой рекламы и сбора лишних данных: имя и команды
            хранятся только для текущей игры.
          </p>
        </div>

        <div
          className="card"
          style={{
            marginTop: 28,
            maxWidth: 760,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>Нашли ошибку или есть идея?</strong>
            <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
              Напишите — отвечаю лично.
            </div>
          </div>
          <a href={supportMailto()} className="btn btn-primary">
            <Mail size={18} /> Написать
          </a>
        </div>
      </div>
    </AppShell>
  );
}
