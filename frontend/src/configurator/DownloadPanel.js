import React from 'react';
import { typeNeedsRepresentation } from './configuratorService';

/**
 * Downloads for the configuration currently on screen.
 *
 * Same interaction as the variant Downloads section in the full demo app
 * (ProductsTab.js): pick an output type, then a representation if that type uses
 * one, then Download. PDF/DWG/IDW take no representation, so that second dropdown
 * is skipped and the button enables immediately.
 *
 * Only rendered while the configuration is "active" — i.e. the model in the viewer
 * was built from the values currently in the form. Downloads come from that
 * already-created variant, so an edited form would produce a mismatched file.
 */
export default function DownloadPanel({
  types,
  representations,
  selectedType,
  selectedRepresentation,
  onTypeChange,
  onRepresentationChange,
  onDownload,
  busy,
  statusText,
  error,
}) {
  const needsRep = selectedType && typeNeedsRepresentation(selectedType);
  const canDownload = Boolean(selectedType) && (!needsRep || Boolean(selectedRepresentation)) && !busy;

  return (
    <section className="cfg-downloads">
      {types.length === 0 ? (
        <p className="cfg-empty">This release has no downloadable outputs.</p>
      ) : (
        <>
          <div className="cfg-field">
            <label className="cfg-label">Output type</label>
            <select
              className="cfg-input"
              value={selectedType || ''}
              disabled={busy}
              onChange={(e) => onTypeChange(e.target.value)}
            >
              <option value="">Select output type…</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Always present, disabled when the chosen type takes no
              representation (PDF, DWG, IDW). Showing and hiding it made the
              drawer change height every time the type changed. */}
          <div className="cfg-field">
            <label className="cfg-label">Representation</label>
            <select
              className="cfg-input"
              value={needsRep ? selectedRepresentation || '' : ''}
              disabled={busy || !needsRep}
              onChange={(e) => onRepresentationChange(e.target.value)}
            >
              <option value="">
                {!selectedType
                  ? 'Select a type first'
                  : needsRep
                  ? 'Select representation…'
                  : 'Not applicable'}
              </option>
              {needsRep && representations.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <button type="button" className="cfg-submit" disabled={!canDownload} onClick={onDownload}>
            {busy ? (
              <>
                <span className="cfg-spinner cfg-spinner-on-btn" aria-hidden="true" />
                {statusText || 'Working…'}
              </>
            ) : (
              'Download'
            )}
          </button>

          {error && <p className="cfg-error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
