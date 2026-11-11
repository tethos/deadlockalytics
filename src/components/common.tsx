import { useState, type ReactNode } from "react";
import { meta, fmtDate, type Source } from "../lib/data";

/** "Data: … · Patch: … · Content as of: …" freshness line shown at the top of every tab. */
export function DataStamp({ contentAsOf, live }: { contentAsOf?: string; live?: ReactNode }) {
  return (
    <div className="stamp" title="Run `npm run refresh-data` after a patch to update game data">
      <span>
        <b>Game data</b> {fmtDate(meta.fetchedAt)}
      </span>
      <span>
        <b>Patch</b> {meta.patchLabel} ({meta.patchDate})
      </span>
      {contentAsOf && (
        <span>
          <b>Guide text as of</b> {contentAsOf}
        </span>
      )}
      {live}
    </div>
  );
}

export function TabHeader({
  title,
  eyebrow,
  subtitle,
  contentAsOf,
  live,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  contentAsOf?: string;
  live?: ReactNode;
}) {
  return (
    <header className="tab-header">
      <div className="tab-header-top">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        <DataStamp contentAsOf={contentAsOf} live={live} />
      </div>
      <div className="deco-rule" aria-hidden>
        <span />
      </div>
    </header>
  );
}

export function Card({ title, children, className = "", accent }: { title?: ReactNode; children: ReactNode; className?: string; accent?: string }) {
  return (
    <section className={`card ${className}`} style={accent ? ({ "--accent-c": accent } as React.CSSProperties) : undefined}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </section>
  );
}

/** ⚠ marker for anything not verified against a primary source. */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <span className="flag" title="Not fully verified — check in-game">
      ⚠ {children}
    </span>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <p className="sources">
      Sources:{" "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && " · "}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        </span>
      ))}
    </p>
  );
}

/** Hot-loaded image with a neutral placeholder if the remote asset is missing. */
export function Img({ src, alt, className = "", size }: { src: string | null; alt: string; className?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken)
    return (
      <span className={`img-fallback ${className}`} style={size ? { width: size, height: size } : undefined} aria-label={alt}>
        {alt.slice(0, 2)}
      </span>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      width={size}
      height={size}
      onError={() => setBroken(true)}
      referrerPolicy="no-referrer"
    />
  );
}

/** Render pre-sanitized API description HTML (only span/br/b/i with class attributes survive refresh-data). */
export function Rich({ html, className = "" }: { html: string; className?: string }) {
  return <span className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Placeholder({ milestone, what }: { milestone: number; what: string }) {
  return (
    <Card className="placeholder">
      <p>
        <b>Coming in milestone {milestone}:</b> {what}
      </p>
      <div className="shimmer-lines" aria-hidden>
        <i />
        <i />
        <i />
      </div>
    </Card>
  );
}
