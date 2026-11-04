"use client";

import type { CSSProperties } from "react";

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
  onVerPerfil?: () => void;
};

function formatIngreso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
  return texto.replace(".", "");
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
  logo,
  onVerPerfil,
}: EmployeeCardProps) {
  return (
    <article className="employee-card">
      <style>{`
        .employee-card,
        .employee-card * {
          box-sizing: border-box;
        }

        .employee-card {
          width: min(340px, 100%);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.85);
          border-radius: 22px;
          background: #fff;
          color: #102338;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          box-shadow:
            0 22px 55px -18px rgba(8,31,54,.35),
            0 4px 12px rgba(8,31,54,.06);
        }

        .employee-card__hero {
          position: relative;
          height: 215px;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 95% 90%, #098995 0%, transparent 55%),
            linear-gradient(135deg, #112947, #071727 75%);
        }

        .employee-card__top {
          position: absolute;
          z-index: 3;
          inset: 16px 16px auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .employee-card__brand {
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 3.5px;
        }

        .employee-card__logo {
          display: block;
          width: 90px;
          height: 24px;
          object-fit: contain;
          object-position: left center;
        }

        .employee-card__status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 999px;
          background: var(--status-bg);
          color: var(--status-color);
          font-size: 10px;
          font-weight: 700;
        }

        .employee-card__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .employee-card__waves {
          position: absolute;
          inset: auto 0 0;
          width: 100%;
          height: 145px;
          opacity: .4;
          z-index: 1;
        }

        .employee-card__avatar-photo {
          position: absolute;
          z-index: 2;
          inset: 0;
        }

        .employee-card__avatar-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 22%;
          mask-image: radial-gradient(ellipse 75% 95% at 50% 55%, black 55%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 75% 95% at 50% 55%, black 55%, transparent 100%);
        }

        .employee-card__avatar-fallback-wrap {
          position: absolute;
          z-index: 2;
          bottom: 0;
          left: 50%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 160px;
          height: 160px;
          transform: translateX(-50%);
        }

        .employee-card__avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 120px;
          height: 120px;
          margin-bottom: 8px;
          border-radius: 50%;
          border: 4px solid rgba(255,255,255,.85);
          font-size: 38px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 8px 18px rgba(0,0,0,.25);
        }

        .employee-card__body {
          position: relative;
          z-index: 4;
          margin-top: -16px;
          padding: 18px 20px 20px;
          border-radius: 20px 20px 0 0;
          background: linear-gradient(145deg, #fff, #f5f8fa);
        }

        .employee-card__name {
          margin: 0;
          overflow-wrap: anywhere;
          color: #0c2035;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -.6px;
        }

        .employee-card__role {
          margin: 6px 0 0;
          color: #07828a;
          font-size: 10.5px;
          font-weight: 800;
          line-height: 1.4;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .employee-card__details {
          display: grid;
          gap: 10px;
          margin: 15px 0 0;
          padding-top: 14px;
          border-top: 1px solid #dfe7ed;
        }

        .employee-card__row {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1.2fr);
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
        }

        .employee-card__icon {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border-radius: 10px;
          background: #e5f0f2;
          color: #16616e;
        }

        .employee-card__label {
          margin: 0;
          color: #778493;
        }

        .employee-card__value {
          margin: 0;
          overflow-wrap: anywhere;
          color: #173047;
          font-weight: 700;
        }

        .employee-card__footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 16px;
        }

        .employee-card__socials {
          display: flex;
          gap: 6px;
        }

        .employee-card__social {
          display: grid;
          width: 29px;
          height: 29px;
          place-items: center;
          border-radius: 50%;
          background: #e5eff2;
          color: #173c52;
          text-decoration: none;
        }

        .employee-card__button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 32px;
          padding: 6px 13px;
          border: 1px solid #087a83;
          border-radius: 999px;
          background: transparent;
          color: #114354;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .employee-card__button:hover {
          background: #087a83;
          color: #fff;
        }

        .employee-card a:focus-visible,
        .employee-card button:focus-visible {
          outline: 3px solid #21b9c5;
          outline-offset: 3px;
        }
      `}</style>

      <div className="employee-card__hero">
        <div className="employee-card__top">
          {logo ? (
            <img className="employee-card__logo" src={logo} alt={equipo} />
          ) : (
            <span className="employee-card__brand">{equipo}</span>
          )}

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

        <svg
          className="employee-card__waves"
          viewBox="0 0 360 145"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0, 16, 32, 48, 64, 80].map((offset) => (
            <path
              key={offset}
              d={`M-40 ${50 + offset}
                  C70 ${-20 + offset},
                   155 ${195 + offset},
                   400 ${-35 + offset}`}
              stroke="#37d7df"
              strokeWidth=".8"
            />
          ))}
        </svg>

        {imagen ? (
          <div className="employee-card__avatar-photo">
            <img src={imagen} alt={`Retrato de ${nombre}`} />
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
          <nav className="employee-card__socials" aria-label={`Redes de ${nombre}`}>
            <a className="employee-card__social" href="#" onClick={(e) => e.preventDefault()} aria-label="Instagram">
              <InstagramIcon />
            </a>
            <a className="employee-card__social" href="#" onClick={(e) => e.preventDefault()} aria-label="Facebook">
              <FacebookIcon />
            </a>
            <a className="employee-card__social" href="#" onClick={(e) => e.preventDefault()} aria-label="TikTok">
              <TikTokIcon />
            </a>
          </nav>

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