import React from 'react';
import { pid, pname, relId, relLabel } from './labels';

/**
 * Simple, clean card gallery — the configurator's landing screen. One card per
 * product: thumbnail, name, a release selector, and a Configure button that
 * launches the single-page configurator for that product + release.
 */
export default function ProductGallery({ products, thumbs, cardRelease, onReleaseChange, onConfigure }) {
  return (
    <div className="cfg-gallery">
      {products.map((p) => {
        const id = pid(p);
        const releases = p.releases || [];
        const rid = cardRelease[id] || '';
        const thumb = thumbs[id];
        return (
          <div className="cfg-card" key={id}>
            <div className="cfg-card-thumb">
              {thumb ? (
                <img src={thumb} alt={pname(p)} />
              ) : (
                <span className="cfg-card-thumb-empty">No preview</span>
              )}
            </div>
            <div className="cfg-card-body">
              <h3 className="cfg-card-title" title={pname(p)}>{pname(p)}</h3>

              <label className="cfg-card-label">Release</label>
              <select
                className="cfg-input"
                value={rid}
                disabled={releases.length === 0}
                onChange={(e) => onReleaseChange(id, e.target.value)}
              >
                {releases.length === 0 && (
                  <option value="">{p.releasesError ? 'Could not load releases' : 'No releases'}</option>
                )}
                {releases.map((r, i) => (
                  <option key={relId(r) || i} value={relId(r)}>{relLabel(r, p, i)}</option>
                ))}
              </select>
              {p.releasesError && <p className="cfg-card-error">{p.releasesError}</p>}

              <button
                className="cfg-submit cfg-card-btn"
                disabled={!rid}
                onClick={() => onConfigure(id, rid)}
              >
                Configure
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
