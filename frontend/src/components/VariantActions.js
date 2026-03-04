import React from 'react';
import { useI18n } from '../i18n/I18nContext';

/**
 * VariantActions Component
 *
 * Displays action buttons for variant management: Create, Import, Export, and Generate Outputs.
 * Shown in the variants header when the create variant form is not displayed.
 *
 * @param {Object} props - Component props
 * @param {string} props.releaseId - Release ID
 * @param {boolean} props.loadingInputs - Whether release inputs are loading
 * @param {boolean} props.loadingRules - Whether release rules are loading
 * @param {Function} props.onCreateClick - Callback when create variant clicked
 * @param {Function} props.onImportClick - Callback when import clicked
 * @param {Function} props.onExportClick - Callback when export clicked
 * @param {Function} props.onGenerateClick - Callback when generate outputs clicked
 * @param {Object} props.importProgress - Import progress state {releaseId, current, total}
 * @param {boolean} props.isGenerating - Whether currently generating outputs
 * @returns {JSX.Element} Variant action buttons
 */
const VariantActions = ({
  releaseId,
  loadingInputs,
  loadingRules,
  onCreateClick,
  onImportClick,
  onExportClick,
  onGenerateClick,
  importProgress,
  isGenerating,
}) => {
  const { t } = useI18n();

  return (
    <div className="variants-header-buttons">
      {/* Create Variant Button */}
      <button
        className="btn-create-variant"
        onClick={(e) => {
          e.stopPropagation();
          onCreateClick();
        }}
        title={t('createVariant')}
        disabled={loadingInputs || loadingRules}
      >
        {loadingInputs || loadingRules ? (
          <div
            style={{
              width: '16px',
              height: '16px',
              minWidth: '16px',
              minHeight: '16px',
              border: '2px solid #ffffff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
              boxSizing: 'border-box',
              display: 'block',
              flexShrink: 0,
            }}
          ></div>
        ) : (
          '+'
        )}
      </button>

      {/* Import Variants Button */}
      <button
        className="btn-import-variant"
        onClick={(e) => {
          e.stopPropagation();
          onImportClick();
        }}
        title={t('importVariants')}
        disabled={importProgress?.releaseId === releaseId}
      >
        {importProgress?.releaseId === releaseId ? (
          <span>
            {importProgress.current}/{importProgress.total}
          </span>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </button>

      {/* Export Variants Button */}
      <button
        className="btn-export-variant"
        onClick={(e) => {
          e.stopPropagation();
          onExportClick();
        }}
        title={t('exportVariants')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>

      {/* Generate Outputs Button */}
      <button
        className="btn-generate-outputs"
        onClick={onGenerateClick}
        title={t('generateOutputsForAllVariants')}
        disabled={isGenerating}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
};

export default VariantActions;
