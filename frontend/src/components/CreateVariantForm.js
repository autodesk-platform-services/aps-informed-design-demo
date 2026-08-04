import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  extractConstraints,
  extractParameterRules,
  generateVariantName,
  isQuotedParameterValue,
  unquoteParameterValue,
  quoteParameterValue,
  snapToIncrement,
} from '../utils/helpers';

/**
 * CreateVariantForm Component
 *
 * Form for creating new variants with dynamic input fields based on release configuration.
 * Handles:
 * - Dynamic form fields (number, boolean toggle, text, allowed-value dropdown)
 * - Per-parameter constraints read from the release's rules
 * - Async field validation using rules API
 * - Field-level error display with dismissal
 * - Auto-generated variant names
 * - Pending corrections for validation errors
 *
 * @param {Object} props - Component properties
 */

// The API reports types in upper case ("NUMERIC", "TEXT", "BOOLEAN"). Comparing
// against the lower-case spellings alone sent every field down the text path —
// numerics lost their min/max and spinner, and booleans rendered as a text box.
const typeOf = (input) => String(input.type || '').toLowerCase();
const isNumeric = (t) => ['number', 'integer', 'float', 'numeric', 'double', 'decimal'].includes(t);
const isInteger = (t) => t === 'integer' || t === 'int';
const isBoolean = (t) => t === 'boolean' || t === 'bool';

const CreateVariantForm = ({
  // Identification
  releaseId,
  product,

  // Release configuration
  releaseInputs,
  releaseValidationCode,
  loadingRules,

  // Form data & state
  formData,
  setFormData,
  creatingVariant,
  createVariantError,

  // Validation state
  fieldValidationErrors,
  setFieldValidationErrors,
  dismissedErrors,
  setDismissedErrors,
  pendingCorrections,
  setPendingCorrections,
  validatingInputs,
  setValidatingInputs,

  // Additional data needed for variant name generation
  products,
  productReleases,

  // Handlers
  onCancel,
  onCreate,
  validateInputValue,
  handleValidationResult,
}) => {
  const { t } = useI18n();

  // The rules carry per-parameter settings (min/max/increment/readOnly/values/
  // label) keyed by name. Resolving them per parameter matters: the old code
  // handed the WHOLE rule script to extractConstraints, which returns the first
  // min/max it finds anywhere — so every field, text ones included, reported
  // Width's "Min: 300 • Max: 3000".
  const paramRules = useMemo(
    () => extractParameterRules(typeof releaseValidationCode === 'string' ? releaseValidationCode : ''),
    [releaseValidationCode]
  );

  // Attach the resolved rules so read-only parameters are recognised — most
  // importantly by generateVariantName, which leaves them out of the name.
  const inputs = useMemo(
    () =>
      (releaseInputs || []).map((param) => {
        const rules = paramRules[param.name || param.key];
        return rules ? { ...param, rules, readOnly: Boolean(rules.readOnly) } : param;
      }),
    [releaseInputs, paramRules]
  );

  // Get or generate variant name
  let variantName = formData._variantName;
  if (!variantName && product) {
    variantName = generateVariantName(product, formData, inputs);
  }

  return (
    <div
      className="create-variant-form"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {loadingRules ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '3px solid #f3f3f3', borderTop: '3px solid #0696d7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '10px', color: '#666' }}>{t('loadingValidationRules')}</p>
        </div>
      ) : (
        <>
          <h5 className="create-variant-title">{t('createNewVariant')}</h5>

          {/* Variant name input */}
          <div className="variant-form-input-group">
            <label className="variant-form-label">{t('name')}</label>
            <input
              type="text"
              className="variant-form-input"
              value={variantName || ''}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const newFormData = { ...(formData || {}) };
                newFormData._variantName = e.target.value;
                newFormData._variantNameEdited = true; // Mark as manually edited
                setFormData(newFormData);
              }}
              placeholder="Variant Name"
            />
          </div>

          {/* Dynamic input fields */}
          {inputs && inputs.length > 0 ? (
            <div className="variant-form-inputs">
              {inputs.map((input, inputIndex) => {
                const key = input.key || input.name || `input-${inputIndex}`;
                const type = typeOf(input);
                const rawValue = formData[key] !== undefined ? formData[key] : (input.defaultValue !== undefined ? input.defaultValue : '');

                const fieldKey = `${releaseId}-${key}`;

                // Per-parameter constraints. The { [inputName]: code } rules
                // shape is already per-input, so extractConstraints is still
                // correct there — it is only the single-script shape that has
                // to go through extractParameterRules.
                let constraints = paramRules[key] || null;
                if (!constraints && releaseValidationCode && typeof releaseValidationCode !== 'string') {
                  const code = releaseValidationCode[key];
                  if (code) constraints = extractConstraints(code);
                }

                // Informed Design computes read-only parameters from the others
                // (Family_Type_Name is derived from Width and Height). Shown so
                // the value is visible, but not editable and not ours to send.
                const readOnly = Boolean(input.readOnly || (constraints && constraints.readOnly));

                // Inventor text parameters arrive quoted — the API issues
                // `"Vision"`, quotes included. The form shows the bare string
                // and restores the quoting on write, so formData keeps the
                // exact shape the API expects.
                const quoted = isQuotedParameterValue(input.defaultValue) || isQuotedParameterValue(rawValue);
                const value = quoted ? unquoteParameterValue(rawValue) : rawValue;

                // Allowed values come from the rules (`parameters['X'].values`),
                // the only place these products declare one. Without it a text
                // parameter renders as a free-text box.
                const options = Array.isArray(constraints?.values) && constraints.values.length
                  ? constraints.values.map(unquoteParameterValue)
                  : null;

                const label = input.label || constraints?.label || input.displayName || key;

                // `unit` is documented on numeric parameters. Suppressed when
                // the authored label already ends in it, so "Width (mm)" does
                // not render as "Width (mm) (mm)".
                const rawUnit = isNumeric(type) && input.unit ? String(input.unit).trim() : null;
                const unit = rawUnit && !String(label).includes(rawUnit) ? rawUnit : null;

                // Check for stored validation error
                const storedError = fieldValidationErrors[fieldKey];
                const isErrorDismissed = dismissedErrors[fieldKey];

                // Build validation object
                let validation;
                if (storedError && !isErrorDismissed) {
                  validation = { valid: false, error: storedError, constraints };
                } else {
                  validation = { valid: true, error: null, constraints };
                }

                const hasError = !validation.valid && validation.error && !isErrorDismissed;

                // Handle field change (update form data and variant name).
                // Takes the DISPLAY value and restores the API's quoting.
                const handleChange = (newValue) => {
                  const newFormData = { ...(formData || {}) };
                  newFormData[key] = quoted && typeof newValue === 'string'
                    ? quoteParameterValue(newValue)
                    : newValue;

                  // Update variant name if it hasn't been manually edited
                  if (!newFormData._variantNameEdited) {
                    const currentProduct = product || products.find(p => {
                      const productId = p.id || p.productId;
                      const releases = productReleases[productId] || p.releases || [];
                      return releases.some(r => (r.id || r.releaseId) === releaseId);
                    });
                    if (currentProduct) {
                      newFormData._variantName = generateVariantName(currentProduct, newFormData, inputs);
                    }
                  }

                  setFormData(newFormData);
                };

                // Handle field blur (validation). Read-only parameters are
                // computed upstream, so there is nothing to validate.
                const runValidation = (overrideValue) => {
                  if (readOnly) return;
                  const currentValue = overrideValue !== undefined
                    ? overrideValue
                    : (formData[key] !== undefined ? formData[key] : (input.defaultValue !== undefined ? input.defaultValue : ''));

                  if (currentValue !== '' && currentValue !== null && currentValue !== undefined) {
                    setValidatingInputs(prev => ({ ...prev, [fieldKey]: true }));

                    validateInputValue(releaseId, key, currentValue, formData).then(validation => {
                      handleValidationResult(validation, fieldKey, releaseId, key);
                    }).catch(err => {
                      setValidatingInputs(prev => {
                        const updated = { ...prev };
                        delete updated[fieldKey];
                        return updated;
                      });
                    });
                  }
                };

                const handleBlur = (e) => {
                  e.stopPropagation();
                  runValidation();
                };

                // Common event handlers for all input types
                const commonProps = {
                  onClick: (e) => e.stopPropagation(),
                  onMouseDown: (e) => e.stopPropagation(),
                  onMouseUp: (e) => e.stopPropagation(),
                  onFocus: (e) => e.stopPropagation(),
                  onKeyDown: (e) => e.stopPropagation(),
                  onKeyUp: (e) => e.stopPropagation(),
                  onBlur: handleBlur,
                };

                const inputClass = `variant-form-input${hasError ? ' variant-form-input-error' : ''}${readOnly ? ' variant-form-input-readonly' : ''}`;

                // A boolean is a switch: two states, one always set. The label
                // sits beside the control, so it replaces the whole field row
                // rather than slotting into the usual label-above layout.
                if (isBoolean(type) && !readOnly) {
                  const checked = value === true || value === 'true';
                  return (
                    <div key={inputIndex} className="variant-form-input-group variant-form-toggle-group">
                      <label className="variant-form-toggle">
                        <input
                          type="checkbox"
                          className="variant-form-toggle-input"
                          checked={checked}
                          {...commonProps}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleChange(e.target.checked);
                            // Flipping a switch is a commit, not a keystroke.
                            runValidation(e.target.checked);
                          }}
                        />
                        <span className="variant-form-toggle-track" aria-hidden="true">
                          <span className="variant-form-toggle-thumb" />
                        </span>
                        <span className="variant-form-toggle-label">{label}</span>
                      </label>
                      {input.description && (
                        <span className="variant-form-description">{input.description}</span>
                      )}
                      {hasError && (
                        <FieldError
                          validation={validation}
                          fieldKey={fieldKey}
                          formData={formData}
                          setFormData={setFormData}
                          pendingCorrections={pendingCorrections}
                          setPendingCorrections={setPendingCorrections}
                          setDismissedErrors={setDismissedErrors}
                          validateInputValue={validateInputValue}
                          handleValidationResult={handleValidationResult}
                          t={t}
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <div key={inputIndex} className="variant-form-input-group">
                    <label className="variant-form-label">
                      {label}
                      {unit && <span className="variant-form-unit"> ({unit})</span>}
                      {input.description && (
                        <span className="variant-form-description"> - {input.description}</span>
                      )}
                    </label>

                    {/* Read-only: shown, never edited, never sent */}
                    {readOnly && (
                      <input
                        type="text"
                        className={inputClass}
                        value={value !== undefined && value !== null ? String(value) : ''}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    )}

                    {/* Allowed-value dropdown, from the release's rules */}
                    {!readOnly && options && (
                      <select
                        className={inputClass}
                        value={value !== undefined && value !== null ? String(value) : ''}
                        {...commonProps}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleChange(e.target.value);
                          // A selection is a commit; another parameter may
                          // depend on it, so re-evaluate now.
                          runValidation(quoted ? quoteParameterValue(e.target.value) : e.target.value);
                        }}
                      >
                        {!options.some((o) => String(o) === String(value ?? '')) && (
                          <option value="">Select...</option>
                        )}
                        {options.map((opt, i) => (
                          <option key={i} value={String(opt)}>{String(opt)}</option>
                        ))}
                      </select>
                    )}

                    {/* Number input */}
                    {!readOnly && !options && isNumeric(type) && (
                      <input
                        type="number"
                        className={inputClass}
                        value={value}
                        {...commonProps}
                        // Snap onto the release's increment as the field is
                        // left, then validate the snapped value — otherwise a
                        // typed 1201 goes up only to come back "updated to 1200".
                        onBlur={(e) => {
                          e.stopPropagation();
                          const snapped = snapToIncrement(value, constraints);
                          if (snapped !== value) handleChange(snapped);
                          runValidation(snapped);
                        }}
                        onChange={(e) => {
                          e.stopPropagation();
                          const raw = e.target.value;
                          handleChange(raw === '' ? '' : isInteger(type) ? parseInt(raw, 10) : parseFloat(raw));
                        }}
                        placeholder={input.defaultValue !== undefined ? String(input.defaultValue) : ''}
                        step={constraints?.increment ?? (isInteger(type) ? 1 : 'any')}
                        min={constraints?.min}
                        max={constraints?.max}
                      />
                    )}

                    {/* Boolean that is read-only falls through to text above;
                        everything else is free text */}
                    {!readOnly && !options && !isNumeric(type) && !isBoolean(type) && (
                      <input
                        type="text"
                        className={inputClass}
                        value={value !== undefined && value !== null ? String(value) : ''}
                        {...commonProps}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleChange(e.target.value);
                        }}
                        placeholder={input.defaultValue !== undefined ? String(unquoteParameterValue(input.defaultValue)) : ''}
                      />
                    )}

                    {/* Type and constraints. Min/max only where they apply —
                        they are numeric limits, and printing them under a text
                        field was the most visible symptom of the shared-
                        constraints bug. */}
                    {input.type && (
                      <span className="variant-form-type">
                        {t('type')}: {input.type}
                        {isNumeric(type) && constraints && (
                          <>
                            {constraints.min !== undefined && (
                              <span className="constraint-inline"> • {t('min')}: {constraints.min}</span>
                            )}
                            {constraints.max !== undefined && (
                              <span className="constraint-inline"> • {t('max')}: {constraints.max}</span>
                            )}
                            {constraints.increment !== undefined && (
                              <span className="constraint-inline"> • increments of {constraints.increment}</span>
                            )}
                          </>
                        )}
                        {readOnly && <span className="constraint-inline"> • computed</span>}
                      </span>
                    )}

                    {/* Error message with dismissal */}
                    {hasError && (
                      <FieldError
                        validation={validation}
                        fieldKey={fieldKey}
                        formData={formData}
                        setFormData={setFormData}
                        pendingCorrections={pendingCorrections}
                        setPendingCorrections={setPendingCorrections}
                        setDismissedErrors={setDismissedErrors}
                        validateInputValue={validateInputValue}
                        handleValidationResult={handleValidationResult}
                        t={t}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="no-parameters">This release has no inputs</p>
          )}

          {/* Form actions */}
          <div className="variant-form-actions">
            <button
              className="btn-cancel-variant"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(releaseId);
              }}
              disabled={creatingVariant}
            >
              {t('cancel')}
            </button>
            <button
              className="btn-submit-variant"
              onClick={async (e) => {
                e.stopPropagation();
                await onCreate(releaseId, product);
              }}
              disabled={creatingVariant}
            >
              {creatingVariant ? (
                <>
                  <span className="create-variant-button-spinner" aria-hidden="true" />
                  {t('creating')}
                </>
              ) : (
                t('create')
              )}
            </button>
          </div>

          {/* Error message */}
          {createVariantError && (
            <p className="create-variant-error" role="alert">
              {createVariantError}
            </p>
          )}
        </>
      )}
    </div>
  );
};

/**
 * A field's validation error, with the dismiss button that also applies the
 * correction the rules engine suggested. Extracted so the toggle layout and the
 * standard layout share one copy.
 */
const FieldError = ({
  validation,
  fieldKey,
  formData,
  setFormData,
  pendingCorrections,
  setPendingCorrections,
  setDismissedErrors,
  validateInputValue,
  handleValidationResult,
  t,
}) => (
  <div className="variant-form-error-dismissible">
    <span className="variant-form-error-text">
      {validation.error}
      {pendingCorrections[fieldKey] && (
        <span className="variant-form-error-correction">
          {' '}(Will be corrected to: {String(pendingCorrections[fieldKey].updatedValue)})
        </span>
      )}
    </span>
    <button
      className="variant-form-error-close"
      onClick={(e) => {
        e.stopPropagation();
        setDismissedErrors(prev => ({ ...prev, [fieldKey]: true }));

        // Apply pending correction if it exists
        const pendingCorrection = pendingCorrections[fieldKey];
        if (pendingCorrection) {
          const updatedFormData = { ...(formData || {}) };
          updatedFormData[pendingCorrection.inputKey] = pendingCorrection.updatedValue;
          setFormData(updatedFormData);

          // Re-validate with the corrected value
          validateInputValue(pendingCorrection.releaseId, pendingCorrection.inputKey, pendingCorrection.updatedValue, updatedFormData).then(revalidation => {
            handleValidationResult(revalidation, fieldKey, pendingCorrection.releaseId, pendingCorrection.inputKey);
          });

          // Clear pending correction
          setPendingCorrections(prev => {
            const updated = { ...prev };
            delete updated[fieldKey];
            return updated;
          });
        }
      }}
      title={t('dismissError')}
    >
      ×
    </button>
  </div>
);

export default CreateVariantForm;
