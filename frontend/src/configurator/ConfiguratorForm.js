import React, { useEffect, useState } from 'react';
import { extractConstraints, snapToIncrement } from '../utils/helpers';

/**
 * Left-hand configuration panel — the same idea as "Create New Variant" in the
 * full demo app, reduced to a single self-contained form. Renders one field per
 * release input (number / boolean / text / allowed-value dropdown), enforces the
 * release's validation rules, and shows the constraints behind each field.
 *
 * There is deliberately no "Configure" heading: the Configure button already says
 * it, and the product name above the form is the panel's title.
 */

/**
 * Pull an allowed-value list out of an input, whatever key the API used.
 *
 * The release's rules come first: `parameters['Infill_Type'].values = [...]` is
 * the authoritative list, and it is the only place these products declare one —
 * without it the field renders as a free-text box.
 */
function getOptions(input, constraints) {
  const raw =
    (constraints && constraints.values) ||
    input.allowedValues || input.values || input.options || input.choices ||
    input.enum || input.oneOf || (constraints && constraints.enum);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((opt) => {
    if (opt && typeof opt === 'object') {
      const value = opt.value !== undefined ? opt.value : opt.id !== undefined ? opt.id : opt.name;
      return { value, label: opt.label || opt.name || String(value) };
    }
    return { value: opt, label: String(opt) };
  });
}

// The API reports types in upper case ("NUMERIC", "BOOLEAN"), so normalize before
// comparing — matching only the lower-case spellings silently sent every numeric
// field down the text-input path, where min/max are ignored.
const typeOf = (input) => String(input.type || '').toLowerCase();
const isNumeric = (t) => ['number', 'integer', 'float', 'numeric', 'double', 'decimal'].includes(t);
const isInteger = (t) => t === 'integer' || t === 'int';
const isBoolean = (t) => t === 'boolean' || t === 'bool';

/**
 * Constraints for one input.
 *
 * `input.rules` is the per-parameter block already parsed out of the release's
 * rule script upstream (min/max/increment/readOnly for THIS parameter). It is
 * preferred because the previous path handed the whole script to
 * `extractConstraints`, which returns the first min/max it finds anywhere — so
 * every field, text ones included, inherited Width's limits.
 *
 * The `extractConstraints` fallback remains only for the other rules shape,
 * where the payload is already a { [inputName]: code } map and so is per-input.
 */
function constraintsFor(input, validationCode, evaluatedSettings) {
  // The rules engine's own output wins: it has resolved the conditionals, so its
  // min/max/values/readOnly reflect the CURRENT state of the other fields. The
  // statically parsed `input.rules` underneath it covers the window before the
  // first evaluation returns, and the case where evaluation is unavailable.
  const base = input.rules || null;
  if (evaluatedSettings) return { ...base, ...evaluatedSettings };
  if (base) return base;
  if (!validationCode || typeof validationCode === 'string') return null;
  const code = validationCode[input.name || input.key];
  return code ? extractConstraints(code) : null;
}

function Field({ input, value, onChange, onBlurValidate, validationCode, evaluatedSettings, fieldError }) {
  const key = input.name || input.key;
  const type = typeOf(input);
  const constraints = constraintsFor(input, validationCode, evaluatedSettings);
  const options = getOptions(input, constraints);
  const hasError = Boolean(fieldError && fieldError.error);

  // The rules can mark a parameter read-only (`parameters['X'].readOnly = true`)
  // because they compute its value from the others. Such a field is shown, so
  // the user can see what it resolved to, but not edited — and it is left out of
  // the variant payload entirely (see runConfiguration).
  const readOnly = Boolean(input.readOnly || (constraints && constraints.readOnly));

  // Display name, most authoritative first: the evaluated rules, then the
  // parameter's own `label` (what the authored Form publishes), then the raw
  // parameter name.
  const authoredLabel = (constraints && constraints.label) || input.label || input.displayName || null;
  const label = authoredLabel || key;

  const cls = `cfg-input${hasError ? ' cfg-input-error' : ''}${readOnly ? ' cfg-input-readonly' : ''}`;

  // Rules are cross-field, so validate the whole form when a field loses focus.
  const commonProps = { onBlur: () => onBlurValidate && onBlurValidate() };

  const errorNote = hasError ? (
    <span className="cfg-field-error" role="alert">
      {fieldError.error}
      {fieldError.updatedValue !== undefined && fieldError.updatedValue !== null && (
        <> (suggested: {String(fieldError.updatedValue)})</>
      )}
    </span>
  ) : null;

  // A boolean is a switch, not a Yes/No list: it has exactly two states and one
  // of them is always set, so a dropdown costs a click to say what a toggle says
  // at a glance. It also lays out differently from every other field — the label
  // sits beside the control rather than above it — hence the early return rather
  // than another `control` branch.
  //
  // Checked before the `options` branch: a boolean that happens to arrive with a
  // values list is still a boolean.
  if (isBoolean(type)) {
    const checked = value === true || value === 'true';
    return (
      <div className="cfg-field cfg-field-toggle">
        <label className={`cfg-toggle${readOnly ? ' cfg-toggle-readonly' : ''}`}>
          <input
            type="checkbox"
            className="cfg-toggle-input"
            checked={checked}
            disabled={readOnly}
            onChange={(e) => {
              onChange(key, e.target.checked);
              // Flipping a switch is a commit, and other fields' visibility
              // hangs off these (HasRiser hides the riser material).
              onBlurValidate && onBlurValidate();
            }}
          />
          <span className="cfg-toggle-track" aria-hidden="true">
            <span className="cfg-toggle-thumb" />
          </span>
          <span className="cfg-toggle-label">{label}</span>
        </label>
        {errorNote}
      </div>
    );
  }

  let control;
  if (readOnly) {
    // Shows the release's default until a configuration is built, then
    // Informed Design's computed value, refreshed on each new configuration.
    control = (
      <input
        className={cls}
        type="text"
        value={value ?? ''}
        title={value ? String(value) : undefined}
        readOnly
        tabIndex={-1}
        aria-readonly="true"
      />
    );
  } else if (options) {
    // The placeholder only earns its place when nothing valid is selected yet.
    // These parameters always arrive with a value, so offering "Select…" just
    // adds a row that means "unset it" — which the release does not allow.
    const hasSelection = options.some((o) => String(o.value) === String(value ?? ''));
    control = (
      <select
        className={cls}
        value={value ?? ''}
        title={value ? String(value) : undefined}
        {...commonProps}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          onChange(key, picked ? picked.value : e.target.value);
          // A selection is a commit, and another field's visibility may depend
          // on it — re-evaluate now rather than waiting for a blur.
          onBlurValidate && onBlurValidate();
        }}
      >
        {!hasSelection && <option value="">Select…</option>}
        {options.map((o, i) => (
          <option key={i} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
    );
  } else if (isNumeric(type)) {
    // Step size comes from the release (`increment`); an integer parameter with
    // no increment steps by 1. A continuous float with neither gets no stepper —
    // there would be no defensible amount to step by.
    const stepAmount = constraints?.increment ?? (isInteger(type) ? 1 : null);

    const asNumber = typeof value === 'number' ? value : parseFloat(value);
    const current = Number.isNaN(asNumber) ? null : asNumber;
    const atMin = current !== null && constraints?.min !== undefined && current <= constraints.min;
    const atMax = current !== null && constraints?.max !== undefined && current >= constraints.max;

    const nudge = (direction) => {
      const from = current !== null ? current : constraints?.min ?? 0;
      let next = from + direction * stepAmount;
      if (constraints?.min !== undefined) next = Math.max(next, constraints.min);
      if (constraints?.max !== undefined) next = Math.min(next, constraints.max);
      onChange(key, snapToIncrement(next, constraints));
      onBlurValidate && onBlurValidate();
    };

    const numberEntry = (<input
        className={cls}
        type="number"
        value={value ?? ''}
        title={value !== undefined && value !== '' ? String(value) : undefined}
        step={constraints?.increment ?? (isInteger(type) ? 1 : 'any')}
        min={constraints?.min}
        max={constraints?.max}
        placeholder={input.defaultValue !== undefined ? String(input.defaultValue) : ''}
        // Snap onto the release's increment as the field is left, then validate
        // the snapped value — otherwise a typed 1201 goes to the evaluator only
        // to come back "updated to 1200".
        // NB: no {...commonProps} here — it carries the plain onBlur, and
        // spreading it after this would replace the snapping one.
        onBlur={() => {
          const snapped = snapToIncrement(value, constraints);
          if (snapped !== value) onChange(key, snapped);
          onBlurValidate && onBlurValidate();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(key, raw === '' ? '' : isInteger(type) ? parseInt(raw, 10) : parseFloat(raw));
        }}
      />);

    // Autodesk's NumericInput spinner: paired carets tucked inside the right
    // edge of the field, rather than buttons flanking it. type="button" matters
    // — a bare <button> inside a form defaults to submit.
    control = stepAmount ? (
      <div className="cfg-stepper">
        {numberEntry}
        <span className="cfg-step-arrows">
          <button
            type="button"
            className="cfg-step-arrow"
            onClick={() => nudge(1)}
            disabled={atMax}
            tabIndex={-1}
            aria-label={`Increase ${label} by ${stepAmount}`}
          >
            <svg width="9" height="5" viewBox="0 0 9 5" aria-hidden="true" focusable="false">
              <path d="M4.5 0 9 5H0z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="cfg-step-arrow"
            onClick={() => nudge(-1)}
            disabled={atMin}
            tabIndex={-1}
            aria-label={`Decrease ${label} by ${stepAmount}`}
          >
            <svg width="9" height="5" viewBox="0 0 9 5" aria-hidden="true" focusable="false">
              <path d="M4.5 5 0 0h9z" fill="currentColor" />
            </svg>
          </button>
        </span>
      </div>
    ) : numberEntry;
  } else {
    control = (
      <input
        className={cls}
        type="text"
        value={value ?? ''}
        title={value ? String(value) : undefined}
        pattern={constraints?.pattern}
        placeholder={input.defaultValue !== undefined ? String(input.defaultValue) : ''}
        {...commonProps}
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  }

  // Constraint line, worded as Inventor's own Form renders it:
  // "300 to 3000 - increments of 5". One phrase rather than three labelled
  // fragments, and no unit — the label above already carries it.
  const hasMin = constraints && constraints.min !== undefined;
  const hasMax = constraints && constraints.max !== undefined;
  const hasStep = constraints && constraints.increment !== undefined;
  const range =
    hasMin && hasMax ? `${constraints.min} to ${constraints.max}`
    : hasMin ? `from ${constraints.min}`
    : hasMax ? `up to ${constraints.max}`
    : null;
  const constraintText = [range, hasStep && `increments of ${constraints.increment}`]
    .filter(Boolean)
    .join(' - ');

  // `unit` is a documented field on the release's numeric parameters
  // (GET Release -> parameters[] -> Numeric input). Only numerics define it.
  //
  // Suppressed when an authored label already ends in the unit: the Form writes
  // "Width (mm)" itself, and appending would render "Width (mm) (mm)". An
  // authored label is the author's wording — it is not ours to decorate.
  const rawUnit = isNumeric(type) && input.unit ? String(input.unit).trim() : null;
  const unit = rawUnit && !(authoredLabel && authoredLabel.includes(rawUnit)) ? rawUnit : null;

  return (
    <div className="cfg-field">
      {/* No read-only badge: the recessed, uneditable field says it already. */}
      <label className="cfg-label">
        {label}
        {unit && <span className="cfg-unit"> ({unit})</span>}
      </label>
      {input.description && <span className="cfg-desc">{input.description}</span>}
      {control}

      {/* Just the limits — the control itself already implies the type. */}
      {constraintText && <span className="cfg-meta">{constraintText}</span>}

      {errorNote}
    </div>
  );
}

export default function ConfiguratorForm({
  inputs,
  values,
  onChange,
  onBlurValidate,
  validationCode,
  evaluated = {},
  fieldErrors = {},
  validating,
  variantName,
  onVariantNameChange,
  onSubmit,
  generating,
  error,
  downloadEnabled,
  downloadPanel,
}) {
  // Opening the download drawer takes over part of the action pane and disables
  // Configure. Two enabled primary actions side by side read as a choice between
  // equals, when in fact one produces what the other consumes.
  const [downloadOpen, setDownloadOpen] = useState(false);

  // An edit invalidates the configuration; close rather than leave the drawer
  // open over a model the form no longer describes.
  useEffect(() => {
    if (!downloadEnabled) setDownloadOpen(false);
  }, [downloadEnabled]);

  useEffect(() => {
    if (!downloadOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDownloadOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [downloadOpen]);
  // Shown as busy while either runs, but ONLY a generate disables the button.
  //
  // Clicking Configure blurs whichever field has focus, and that blur kicks off
  // rules validation. Disabling on `validating` therefore disabled the button
  // between mousedown and mouseup — the click landed on a disabled element and
  // the form never submitted, so the button appeared to do nothing except flash
  // "Checking…". The click has to reach the handler; the handler then runs
  // validation itself and refuses to build anything the rules reject.
  const busy = generating || validating;

  return (
    <form
      className="cfg-form"
      // The release's rules are the gate, so the browser's own constraint
      // validation must not pre-empt them. Left on, a number outside min/max
      // makes the browser refuse to submit at all: the click fires, no submit
      // event follows, and the only feedback is a native tooltip in place of the
      // inline per-field error the rules produce. Same dead-button symptom,
      // different cause. The min/max attributes stay for the spinner steps.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* Only the fields scroll. Configure is pinned below them, so a release
          with many parameters can never push the primary action out of view. */}
      <div className="cfg-form-fields">
      <div className="cfg-field">
        <label className="cfg-label">Name</label>
        <input
          className="cfg-input"
          type="text"
          value={variantName}
          /* Generated names routinely exceed the panel width; the browser gives
             no tooltip for overflowing input text, so set one explicitly. */
          title={variantName || undefined}
          onChange={(e) => onVariantNameChange(e.target.value)}
          placeholder="Variant name"
        />
      </div>

      {inputs.length === 0 ? (
        <p className="cfg-empty">This release has no configurable inputs.</p>
      ) : (
        inputs
          // The rules can switch a parameter off for the current combination —
          // this release hides Infill_Color whenever Infill_Type is "Vision".
          // Only the engine knows that, so an absent entry means "still visible".
          .filter((input) => evaluated[input.name || input.key]?.visible !== false)
          .map((input, i) => (
            <Field
              key={input.name || input.key || i}
              input={input}
              value={values[input.name || input.key]}
              onChange={onChange}
              onBlurValidate={onBlurValidate}
              validationCode={validationCode}
              evaluatedSettings={evaluated[input.name || input.key]}
              fieldError={fieldErrors[input.name || input.key]}
            />
          ))
      )}
      </div>

      <div className="cfg-form-actions">
      {/* Above the row, inside the pinned pane: the buttons stay exactly where
          they were and the fields above give up the space instead. A layer
          floating over the fields moved the controls, which was jarring. */}
      {downloadOpen && downloadEnabled && (
        <div className="cfg-export-drawer" role="group" aria-label="Download this configuration">
          {downloadPanel}
        </div>
      )}

      <div className="cfg-form-actions-row">
      <button
        className="cfg-submit"
        type="submit"
        disabled={generating || downloadOpen}
        aria-label="Configure"
        aria-busy={busy || undefined}
      >
        {/* Spinner only. The status text duplicated the overlay already on the
            viewer, and long phases ("Generating 3D model… (PENDING)") clipped
            inside a fixed-width button. */}
        {busy ? <span className="cfg-spinner cfg-spinner-on-btn" aria-hidden="true" /> : 'Configure'}
      </button>
      {/* Sits beside the action that unlocks it: `downloadEnabled` is only true
          after a Configure that passed the rules gate, so pressing Configure
          visibly lights up its neighbour. */}
      <button
        type="button"
        className={`cfg-export-btn${downloadOpen ? ' is-open' : ''}`}
        disabled={!downloadEnabled}
        aria-expanded={downloadOpen}
        aria-label="Download this configuration"
        title={downloadEnabled ? 'Download this configuration' : 'Press Configure to enable downloads'}
        onClick={() => setDownloadOpen((o) => !o)}
      >
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true" focusable="false">
          <path
            d="M8.5 2.5v7.5m0 0L5.5 7m3 3 3-3M3 12v1.5A1.5 1.5 0 0 0 4.5 15h8a1.5 1.5 0 0 0 1.5-1.5V12"
            fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
      </div>

      {error && <p className="cfg-error" role="alert">{error}</p>}
      </div>
    </form>
  );
}
