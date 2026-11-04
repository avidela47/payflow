"use client";

import { useState, type CSSProperties } from "react";

type EmployeeCardProps = {
  nombre: string;
  cargo: string;
  imagen?: string;
  fallbackInitials: string;
  fallbackColorClass: string;
  ingresoIso?: string;
  equipo?: string;
  activo?: boolean;
  logo?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  onVerPerfil?: () => void;
};

function formatIngreso(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso);
  if (!match) return "—";
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date).replace(/\./g, "");
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="15"
      height="15"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H7.9V12h2.6V9.8c0-2.6 1.5-4 3.9-4 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
      <path d="M16.5 2c.3 2.4 1.8 4 4.4 4.2v3.1c-1.5.1-2.9-.4-4.4-1.3v6.6c0 3.6-2.6 6.4-6.3 6.4-1.6 0-3-.5-4.1-1.5A6.3 6.3 0 0 1 4 14.6c0-3.5 2.8-6.3 6.3-6.3.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.7 0-3 1.3-3 3s1.3 3.1 3 3.1 3.1-1.3 3.1-3.1V2h3.1z" />
    </svg>
  );
}

export default function EmployeeCard({
  nombre,
  cargo,
  imagen,
  fallbackInitials,
  fallbackColorClass,
  ingresoIso,
  equipo = "ITELSA",
  activo = true,
  logo = "/logo2.png",
  instagram,
  facebook,
  tiktok,
  onVerPerfil,
}: EmployeeCardProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const redes = [
    { label: "Instagram", url: instagram, icon: <InstagramIcon /> },
    { label: "Facebook", url: facebook, icon: <FacebookIcon /> },
    { label: "TikTok", url: tiktok, icon: <TikTokIcon /> },
  ];

  return (
    <article className="employee-card">
      <style>{`
.employee-card,.employee-card *{box-sizing:border-box}
.employee-card{width:100%;margin:0;overflow:hidden;border-radius:28px;background:#f8fafc;color:#0b1c30;font-family:Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 24px 65px -18px #061b3866}
.employee-card__hero{position:relative;height:270px;overflow:hidden;background:radial-gradient(ellipse at 100% 92%,#0797a3 0,transparent 56%),linear-gradient(130deg,#102747,#061726 80%)}
.employee-card__top{position:absolute;inset:20px 20px auto;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;pointer-events:none}
.employee-card__logo-wrap{width:116px;height:36px;display:flex;align-items:center}
.employee-card__logo{display:block;width:100%;height:100%;object-fit:contain;object-position:left center}
.employee-card__status{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;background:var(--status-bg);color:var(--status-color);font-size:10px;font-weight:750;white-space:nowrap}
.employee-card__dot{width:5px;height:5px;background:currentColor;border-radius:50%}
.employee-card__waves{position:absolute;bottom:0;left:0;width:100%;height:210px;opacity:.55;z-index:1}
.employee-card__avatar-frame{position:absolute;z-index:2;top:12px;left:50%;width:78%;height:360px;transform:translateX(-50%);background:transparent;filter:drop-shadow(0 8px 15px #0003)}
.employee-card__avatar-frame img{display:block;width:100%;height:100%;object-fit:contain;object-position:center top}
.employee-card__avatar-fallback-wrap{position:absolute;inset:65px 0 0;display:grid;place-items:center;z-index:2}
.employee-card__avatar-fallback{display:grid;place-items:center;width:125px;height:125px;border:4px solid #ffffffb3;border-radius:50%;font-size:40px;font-weight:800;color:#fff;background-color:#13767c}
.employee-card__body{position:relative;z-index:4;padding:12px 24px 22px;background:linear-gradient(#fff,#f4f7fa)}
.employee-card__divider{position:absolute;top:-28px;left:0;width:100%;height:29px;display:block}
.employee-card__name{margin:0;color:#081b30;font-size:28px;font-weight:800;line-height:1.12;letter-spacing:-.8px;overflow-wrap:anywhere;text-transform:none}
.employee-card__role{margin:7px 0 0;color:#057f88;font-size:11px;font-weight:750;line-height:1.4;letter-spacing:1.8px;text-transform:uppercase}
.employee-card__details{display:grid;gap:12px;margin:18px 0 0;padding-top:16px;border-top:1px solid #d7e1e9}
.employee-card__row{display:grid;grid-template-columns:30px 1fr 1.25fr;align-items:center;gap:9px;font-size:12px}
.employee-card__icon{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#e2eef1;color:#124b61}
.employee-card__label{margin:0;color:#7b8390}
.employee-card__value{margin:0;color:#10243b;font-weight:700;overflow-wrap:anywhere}
.employee-card__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}
.employee-card__socials{display:flex;gap:7px}
.employee-card__social{display:grid;place-items:center;width:31px;height:31px;padding:0;border:0;border-radius:50%;background:#e1edf1;color:#123b51;text-decoration:none;cursor:pointer}
.employee-card__button{display:inline-flex;align-items:center;justify-content:center;gap:14px;margin-left:auto;min-height:36px;padding:7px 16px;border:1px solid #167984;border-radius:999px;background:transparent;color:#11364d;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.employee-card__button:hover{background:#087d86;color:white}
.employee-card__social:hover{background:#cbe4e8}
.employee-card :is(button,a):focus-visible{outline:3px solid #1bbac8;outline-offset:3px}
.employee-profile-dialog{width:min(360px,calc(100vw - 32px))!important;max-width:none!important;max-height:none!important;overflow:visible!important;border:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}
.employee-profile-dialog__content{max-height:none!important;overflow:visible!important;padding:0!important}
@media(max-height:620px){.employee-card__hero{height:215px}.employee-card__avatar-frame{height:300px}.employee-card__body{padding:9px 20px 16px}.employee-card__name{font-size:24px}.employee-card__details{margin-top:12px;padding-top:12px;gap:8px}.employee-card__footer{margin-top:14px}}
`}</style>

      <div className="employee-card__hero">
        <div className="employee-card__top">
          <div className="employee-card__logo-wrap">
            <img className="employee-card__logo" src={logo} alt={equipo} />
          </div>

          <span
            className="employee-card__status"
            style={
              {
                "--status-bg": activo ? "#b2f0d5" : "#e4e9ef",
                "--status-color": activo ? "#14583e" : "#526173",
              } as CSSProperties
            }
          >
            <span className="employee-card__dot" aria-hidden="true" />
            {activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <svg className="employee-card__waves" viewBox="0 0 360 210" fill="none" preserveAspectRatio="none" aria-hidden="true">
          {[0, 14, 28, 42, 56, 70].map((offset) => (
            <path key={offset}
              d={`M-30 ${100+offset} C75 ${50+offset}, 130 ${230+offset}, 390 ${10+offset}`}
              stroke="#39d8e0" strokeWidth=".8" />
          ))}
        </svg>
        {imagen && failedImage !== imagen ? (
          <div className="employee-card__avatar-frame">
            <img src={imagen} alt={`Retrato de ${nombre}`} onError={() => setFailedImage(imagen)} />
          </div>
        ) : (
          <div className="employee-card__avatar-fallback-wrap">
            <div className={`employee-card__avatar-fallback ${fallbackColorClass}`}>
              {fallbackInitials}
            </div>
          </div>
        )}
      </div>

            <div className="employee-card__body">
        <svg
          className="employee-card__divider"
          viewBox="0 0 400 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,36 C12,0 42,6 86,9 C195,16 265,44 350,27 C380,21 393,12 400,0 L400,36 Z"
            fill="#ffffff"
          />
        </svg>
        <h2 className="employee-card__name">{nombre}</h2>
        <p className="employee-card__role">{cargo}</p>

        <dl className="employee-card__details">
          <div className="employee-card__row">
            <span className="employee-card__icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 3v4m8-4v4M4 11h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <dt className="employee-card__label">Ingreso</dt>
            <dd className="employee-card__value">{ingresoIso ? formatIngreso(ingresoIso) : "—"}</dd>
          </div>

          <div className="employee-card__row">
            <span className="employee-card__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <dt className="employee-card__label">Equipo</dt>
            <dd className="employee-card__value">{equipo}</dd>
          </div>
        </dl>

        <div className="employee-card__footer">
          {redes.length > 0 && (
            <nav className="employee-card__socials" aria-label={`Redes de ${nombre}`}>
              {redes.map((red) => {
                const hasLink = Boolean(red.url && /^https?:\/\//i.test(red.url));
                return hasLink ? (
                  <a key={red.label} className="employee-card__social"
                    href={red.url} target="_blank" rel="noopener noreferrer"
                    aria-label={red.label}>
                    {red.icon}
                  </a>
                ) : (
                  <button key={red.label} type="button"
                    className="employee-card__social" aria-label={red.label}>
                    {red.icon}
                  </button>
                );
              })}
            </nav>
          )}

          {onVerPerfil && (
            <button type="button" className="employee-card__button" onClick={onVerPerfil}>
              Ver perfil
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}