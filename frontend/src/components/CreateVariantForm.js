import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { extractConstraints, generateVariantName } from '../utils/helpers';

/**
 * CreateVariantForm Component
 *
 * Form for creating new variants with dynamic input fields based on release configuration.
 * Handles:
 * - Dynamic form fields (number, boolean, text)
 * - Async field validation using rules API
 * - Field-level error display with dismissal
 * - Auto-generated variant names
 * - Constraint display (min/max values)
 * - Pending corrections for validation errors
 *
 * @param {Object} props - Component properties
 */
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

  // Get or generate variant name
  let variantName = formData._variantName;
  if (!variantName && product) {
    variantName = generateVariantName(product, formData, releaseInputs || []);
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
          {releaseInputs && releaseInputs.length > 0 ? (
            <div className="variant-form-inputs">
              {releaseInputs.map((input, inputIndex) => {
                const key = input.key || input.name || `input-${inputIndex}`;
                const value = formData[key] !== undefined ? formData[key] : (input.defaultValue !== undefined ? input.defaultValue : '');

                const fieldKey = `${releaseId}-${key}`;

                // Get constraints from validation code
                let constraints = null;
                if (releaseValidationCode) {
                  const code = typeof releaseValidationCode === 'string' ? releaseValidationCode : releaseValidationCode[key];
                  if (code) {
                    constraints = extractConstraints(code);
                  }
                }

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

                if (!validation.constraints && constraints) {
                  validation.constraints = constraints;
                }

                const hasError = !validation.valid && validation.error && !isErrorDismissed;

                // Handle field blur (validation)
                const handleBlur = (e) => {
                  e.stopPropagation();
                  const currentValue = formData[key] !== undefined ? formData[key] : (input.defaultValue !== undefined ? input.defaultValue : '');

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

                // Handle field change (update form data and variant name)
                const handleChange = (newValue) => {
                  const newFormData = { ...(formData || {}) };
                  newFormData[key] = newValue;

                  // Update variant name if it hasn't been manually edited
                  if (!newFormData._variantNameEdited) {
                    const currentProduct = product || products.find(p => {
                      const productId = p.id || p.productId;
                      const releases = productReleases[productId] || p.releases || [];
                      return releases.some(r => (r.id || r.releaseId) === releaseId);
                    });
                    if (currentProduct) {
                      newFormData._variantName = generateVariantName(currentProduct, newFormData, releaseInputs || []);
                    }
                  }

                  setFormData(newFormData);
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

                return (
                  <div key={inputIndex} className="variant-form-input-group">
                    <label className="variant-form-label">
                      {input.name || input.key || `Input ${inputIndex + 1}`}
                      {input.description && (
                        <span className="variant-form-description"> - {input.description}</span>
                      )}
                    </label>

                    {/* Number input */}
                    {(input.type === 'number' || input.type === 'integer' || input.type === 'float') && (
                      <input
                        type="number"
                        className={`variant-form-input ${hasError ? 'variant-form-input-error' : ''}`}
                        value={value}
                        {...commonProps}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newValue = e.target.value !== '' ? (input.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value)) : '';
                          handleChange(newValue);
                        }}
                        placeholder={input.defaultValue !== undefined ? String(input.defaultValue) : ''}
                        step={input.type === 'integer' ? 1 : undefined}
                        min={validation.constraints?.min}
                        max={validation.constraints?.max}
                      />
                    )}

                    {/* Boolean input */}
                    {input.type === 'boolean' && (
                      <select
                        className={`variant-form-input ${hasError ? 'variant-form-input-error' : ''}`}
                        value={value !== undefined && value !== null && value !== '' ? String(value) : ''}
                        {...commonProps}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newValue = e.target.value === 'true';
                          handleChange(newValue);
                        }}
                      >
                        <option value="">Select...</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    )}

                    {/* Text input */}
                    {!['number', 'integer', 'float', 'boolean'].includes(input.type) && (
                      <input
                        type="text"
                        className={`variant-form-input ${hasError ? 'variant-form-input-error' : ''}`}
                        value={value !== undefined && value !== null ? String(value) : ''}
                        {...commonProps}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleChange(e.target.value);
                        }}
                        placeholder={input.defaultValue !== undefined ? String(input.defaultValue) : ''}
                      />
                    )}

                    {/* Type and constraints display */}
                    {input.type && (
                      <span className="variant-form-type">
                        {t('type')}: {input.type}
                        {validation.constraints && (
                          <>
                            {validation.constraints.min !== undefined && (
                              <span className="constraint-inline"> • {t('min')}: {validation.constraints.min}</span>
                            )}
                            {validation.constraints.max !== undefined && (
                              <span className="constraint-inline"> • {t('max')}: {validation.constraints.max}</span>
                            )}
                          </>
                        )}
                      </span>
                    )}

                    {/* Error message with dismissal */}
                    {hasError && (
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

export default CreateVariantForm;
