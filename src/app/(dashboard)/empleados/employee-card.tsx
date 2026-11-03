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
}: EmployeeCardProps) {
  const redes = [
    { nombre: "Instagram", texto: "IG" },
    { nombre: "Facebook", texto: "f" },
    { nombre: "TikTok", texto: "♪" },
  ];

  return (
    <article className="employee-card">
      <style>{`
        .employee-card,
        .employee-card * {
          box-sizing: border-box;
        }

        .employee-card {
          width: min(360px, 100%);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.85);
          border-radius: 26px;
          background: #fff;
          color: #102338;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          box-shadow:
            0 22px 55px -18px rgba(8,31,54,.35),
            0 4px 12px rgba(8,31,54,.06);
        }

        .employee-card__hero {
          position: relative;
          height: 255px;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 95% 90%, #098995 0%, transparent 55%),
            linear-gradient(135deg, #112947, #071727 75%);
        }

        .employee-card__top {
          position: absolute;
          z-index: 3;
          inset: 20px 20px auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .employee-card__brand {
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 4px;
        }

        .employee-card__logo {
          display: block;
          width: 105px;
          height: 28px;
          object-fit: contain;
          object-position: left center;
        }

        .employee-card__status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 999px;
          background: var(--status-bg);
          color: var(--status-color);
          font-size: 11px;
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
          height: 170px;
          opacity: .45;
        }

        .employee-card__avatar {
          position: absolute;
          z-index: 2;
          bottom: -5px;
          left: 50%;
          width: 225px;
          height: 225px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          transform: translateX(-50%);
        }

        .employee-card__avatar img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center bottom;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,.18));
        }

        .employee-card__avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 150px;
          height: 150px;
          margin-bottom: 10px;
          border-radius: 50%;
          border: 4px solid rgba(255,255,255,.85);
          font-size: 48px;
          font-weight: 800;
          color: #fff;
          box-shadow: 0 8px 18px rgba(0,0,0,.25);
        }

        .employee-card__body {
          position: relative;
          z-index: 4;
          margin-top: -18px;
          padding: 24px;
          border-radius: 24px 24px 0 0;
          background: linear-gradient(145deg, #fff, #f5f8fa);
        }

        .employee-card__name {
          margin: 0;
          overflow-wrap: anywhere;
          color: #0c2035;
          font-size: 25px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -.8px;
        }

        .employee-card__role {
          margin: 8px 0 0;
          color: #07828a;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.5;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .employee-card__details {
          display: grid;
          gap: 14px;
          margin: 21px 0 0;
          padding-top: 18px;
          border-top: 1px solid #dfe7ed;
        }

        .employee-card__row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) minmax(0, 1.2fr);
          align-items: center;
          gap: 9px;
          font-size: 12px;
        }

        .employee-card__icon {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 11px;
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
          gap: 14px;
          margin-top: 23px;
        }

        .employee-card__socials {
          display: flex;
          gap: 7px;
        }

        .employee-card__social {
          display: grid;
          width: 33px;
          height: 33px;
          place-items: center;
          border-radius: 50%;
          background: #e5eff2;
          color: #173c52;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }

        .employee-card a:focus-visible {
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
          viewBox="0 0 360 170"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0, 16, 32, 48, 64, 80].map((offset) => (
            <path
              key={offset}
              d={`M-40 ${65 + offset}
                  C70 ${-20 + offset},
                   155 ${210 + offset},
                   400 ${-35 + offset}`}
              stroke="#37d7df"
              strokeWidth=".8"
            />
          ))}
        </svg>

        <div className="employee-card__avatar">
          {imagen ? (
            <img src={imagen} alt={`Retrato de ${nombre}`} />
          ) : (
            <div className={`employee-card__avatar-fallback ${fallbackColorClass}`}>
              {fallbackInitials}
            </div>
          )}
        </div>
      </div>

      <div className="employee-card__body">
        <h2 className="employee-card__name">{nombre}</h2>
        <p className="employee-card__role">{cargo}</p>

        <dl className="employee-card__details">
          {ingresoIso && (
            <div className="employee-card__row">
              <span className="employee-card__icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="5" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M8 3v4m8-4v4M4 11h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <dt className="employee-card__label">Ingreso</dt>
              <dd className="employee-card__value">{formatIngreso(ingresoIso)}</dd>
            </div>
          )}

          <div className="employee-card__row">
            <span className="employee-card__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            {redes.map((red) => (
              <a
                key={red.nombre}
                className="employee-card__social"
                href="#"
                onClick={(e) => e.preventDefault()}
                aria-label={red.nombre}
              >
                {red.texto}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </article>
  );
}