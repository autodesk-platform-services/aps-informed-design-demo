import React from 'react';
import DxFileTree from './DxFileTree';
import { useI18n } from '../i18n/I18nContext';

/**
 * DxFilesPanel Component
 *
 * Displays the Data Exchange files tab with a file tree browser and file details panel.
 * Handles data exchange files with thumbnail display and viewer integration.
 *
 * Responsibilities:
 * - Display DX file tree structure
 * - Show file thumbnails and metadata
 * - Open files in the 3D viewer
 *
 * @param {Object} props - Component properties
 * @returns {JSX.Element} DX files panel UI
 */
const DxFilesPanel = ({
  // Project context
  selectedProject,
  selectedAccount,

  // File tree state
  dxFileTree,
  loadingDxFiles,
  selectedDxFile,
  expandedDxFiles,
  setExpandedDxFiles,
  setSelectedDxFile,

  // File details state
  dxFileDetails,
  loadingDxFileDetails,
  dxFileThumbnail,
  loadingDxFileThumbnail,
  setDxFileThumbnail,
  setLoadingDxFileThumbnail,

  // Viewer state
  loadingDxSvfUrl,
  setLoadingDxSvfUrl,
  setDxViewerUrl,
  setDxViewerIsUrn,
  setDxViewerToken,
  setShowDxViewer,

  // Functions
  formatDate,
  translateStatus,
}) => {
  const { t } = useI18n();

  /**
   * Handle file tree expansion toggle
   */
  const handleToggleExpand = (fileId) => {
    const newExpanded = new Set(expandedDxFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedDxFiles(newExpanded);
  };

  /**
   * Handle opening file in 3D viewer
   */
  const handleOpenViewer = async () => {
    if (!selectedDxFile || !selectedProject || !selectedAccount) return;

    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) return;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    const encodedFileId = encodeURIComponent(selectedDxFile.id);

    try {
      setLoadingDxSvfUrl(true);
      const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}`;

      const response = await fetch(svfUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const svfData = await response.json();
        const svfUrlValue = svfData.url || svfData.svfUrl || svfData.urn || svfData.data?.url || svfData.data?.svfUrl || svfData.data?.urn;
        const isUrnValue = svfData.isUrn !== undefined ? svfData.isUrn : (svfData.data?.isUrn !== undefined ? svfData.data.isUrn : false);

        if (svfUrlValue) {
          setDxViewerUrl(svfUrlValue);
          setDxViewerIsUrn(isUrnValue);
          setDxViewerToken(accessToken);
          setShowDxViewer(true);
        }
      }
    } catch (error) {
      console.error('Error opening DX viewer:', error);
    } finally {
      setLoadingDxSvfUrl(false);
    }
  };

  return (
    <>
      {/* Left Panel: DX File Tree */}
      <div className="folder-panel">
        <h2>Data Exchange Files</h2>
        {loadingDxFiles ? (
          <p>Loading files...</p>
        ) : !selectedProject ? (
          <p>Please select a project.</p>
        ) : dxFileTree ? (
          <div className="folder-tree">
            <DxFileTree
              item={dxFileTree}
              expandedFiles={expandedDxFiles}
              selectedFile={selectedDxFile}
              onToggleExpand={handleToggleExpand}
              onSelectFile={setSelectedDxFile}
              level={0}
              isRoot={true}
              parentName=""
            />
          </div>
        ) : (
          <p>No data exchange files found.</p>
        )}
      </div>

      {/* Right Panel: File Details */}
      <div className="products-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>
            {selectedDxFile ? (selectedDxFile.name || selectedDxFile.id) : t('dataExchangePanelTitle')}
          </h2>
          {dxFileDetails && dxFileDetails.version && (
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              background: '#ffffff',
              color: '#1DA1F2',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '400',
              lineHeight: '1.4',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              border: '1px solid #E0E0E0',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              {dxFileDetails.version}
            </span>
          )}
        </div>

        {loadingDxFileDetails ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>Loading file details...</p>
          </div>
        ) : selectedDxFile ? (
          <div className="rvt-preview-panel">
            {/* Left Column: Thumbnail and Button */}
            <div className="preview-left">
              {/* Thumbnail */}
              <div style={{ textAlign: 'center' }}>
                {loadingDxFileThumbnail ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <div className="thumbnail-loading-spinner" />
                  </div>
                ) : dxFileThumbnail ? (
                  <img
                    src={dxFileThumbnail}
                    alt={selectedDxFile.name || 'Data exchange thumbnail'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '500px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '40px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    color: '#666',
                    textAlign: 'center',
                    minHeight: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {t('thumbnailNotAvailable')}
                  </div>
                )}
              </div>

              {/* Open in Viewer Button */}
              <button
                onClick={handleOpenViewer}
                disabled={loadingDxSvfUrl}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  marginTop: '16px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: '#ffffff',
                  backgroundColor: '#1DA1F2',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loadingDxSvfUrl ? 'not-allowed' : 'pointer',
                  opacity: loadingDxSvfUrl ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {loadingDxSvfUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div className="thumbnail-loading-spinner" style={{ width: '16px', height: '16px' }} />
                    <span>{t('loading')}</span>
                  </div>
                ) : (
                  t('openAutodeskViewer')
                )}
              </button>
            </div>

            {/* Right Column: File Properties */}
            <div className="preview-right">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.1rem', fontWeight: '600' }}>
                {selectedDxFile ? t('properties') : t('details')}
              </h3>

              {dxFileDetails ? (
                <div className="file-details-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {dxFileDetails.displayName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666', width: '40%' }}>
                            {t('name')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {dxFileDetails.displayName}
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.fileType && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('type')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {dxFileDetails.fileType}
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.storageSize !== undefined && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('size')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {(dxFileDetails.storageSize / 1024 / 1024).toFixed(2)} MB
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.lastModifiedTime && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('modified')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {formatDate(dxFileDetails.lastModifiedTime)}
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.createTime && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('created')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {formatDate(dxFileDetails.createTime)}
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.createUserName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('createdBy')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {dxFileDetails.createUserName}
                          </td>
                        </tr>
                      )}

                      {dxFileDetails.lastModifiedUserName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('modifiedBy')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {dxFileDetails.lastModifiedUserName}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>
                  {t('selectDataExchangeFromList')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.95rem'
          }}>
            <p>{t('selectDataExchangeFromList')}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default DxFilesPanel;
