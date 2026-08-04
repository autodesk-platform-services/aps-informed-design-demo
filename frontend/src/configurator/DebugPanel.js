import React, { useState } from 'react';

/**
 * Development-only inspector for the raw API payloads behind the configure view.
 *
 * The form is driven by data that is invisible once parsed — the rules script,
 * the evaluator's per-parameter verdict, the release definition. When a field
 * renders with the wrong label, limits or visibility, the question is always
 * "what did the API actually say?", and answering it from the parsed state is
 * guesswork. This shows the payloads verbatim, for the product currently open.
 *
 * Rendered only under NODE_ENV=development, so it never reaches the template
 * a customer builds on.
 */

const SECTIONS = [
  { key: 'rules', label: 'rules (Input)' },
  { key: 'layout', label: 'layout (Form)' },
  { key: 'evaluate', label: 'POST /rules:evaluate' },
  { key: 'release', label: 'GET /releases/{id}' },
];

function pretty(value) {
  if (value === undefined) return '(not fetched yet)';
  if (value === null) return 'null';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function DebugPanel({
  rulesKey, rawRules, rulesError,
  layoutKey, rawLayout, layoutError,
  evaluateRaw, evaluateSent, release,
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('rules');
  const [copied, setCopied] = useState(false);

  const payloads = {
    rules: rulesError ? { error: rulesError } : rawRules,
    layout: layoutError
      ? { error: layoutError, layoutKey }
      : (layoutKey ? rawLayout : { note: 'release.layout is null — no form published on this release' }),
    evaluate: evaluateRaw === undefined
      ? undefined
      : { request: { rules: rulesKey, inputs: evaluateSent }, response: evaluateRaw },
    release,
  };

  const body = pretty(payloads[section]);

  const copy = () => {
    navigator.clipboard?.writeText(body).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => {}
    );
  };

  if (!open) {
    return (
      <button className="cfg-debug-fab" onClick={() => setOpen(true)} title="Inspect the raw API payloads">
        {'{ } API'}
      </button>
    );
  }

  return (
    <div className="cfg-debug">
      <div className="cfg-debug-head">
        <div className="cfg-debug-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`cfg-debug-tab${section === s.key ? ' is-active' : ''}`}
              onClick={() => setSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="cfg-debug-actions">
          <button className="cfg-debug-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          <button className="cfg-debug-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>

      {/* The rules script is a JS string; showing it escaped inside JSON makes it
          unreadable, so it gets its own pane with the newlines intact. */}
      {section === 'rules' && rawRules && typeof rawRules.code === 'string' && (
        <>
          <div className="cfg-debug-sub">code ({rawRules.lang})</div>
          <pre className="cfg-debug-pre cfg-debug-code">{rawRules.code}</pre>
          <div className="cfg-debug-sub">full response</div>
        </>
      )}

      {section === 'rules' && (
        <div className="cfg-debug-sub cfg-debug-key">rulesKey: {rulesKey || '(none)'}</div>
      )}

      {section === 'layout' && rawLayout && typeof rawLayout.code === 'string' && (
        <>
          <div className="cfg-debug-sub">code ({rawLayout.lang})</div>
          <pre className="cfg-debug-pre cfg-debug-code">{rawLayout.code}</pre>
          <div className="cfg-debug-sub">full response</div>
        </>
      )}

      {section === 'layout' && (
        <div className="cfg-debug-sub cfg-debug-key">release.layout: {layoutKey || 'null'}</div>
      )}

      <pre className="cfg-debug-pre">{body}</pre>
    </div>
  );
}
