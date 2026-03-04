import React from 'react';
import FileTree from './FileTree';
import { useI18n } from '../i18n/I18nContext';

/**
 * FilesPanel Component
 *
 * Displays the project files tab with a file tree browser and file details panel.
 * Handles Revit (RVT) files with 3D view selection and viewer integration.
 *
 * Responsibilities:
 * - Display file tree structure
 * - Show file thumbnails and metadata
 * - Allow 3D view selection for RVT files
 * - Open files in the 3D viewer
 *
 * @param {Object} props - Component properties
 * @returns {JSX.Element} Files panel UI
 */
const FilesPanel = ({
  // Project context
  selectedProject,
  selectedAccount,

  // File tree state
  fileTree,
  loadingFiles,
  selectedFile,
  expandedFiles,
  setExpandedFiles,
  setSelectedFile,

  // File details state
  fileDetails,
  loadingFileDetails,
  fileThumbnail,
  loadingFileThumbnail,
  setFileThumbnail,
  setLoadingFileThumbnail,

  // 3D view state (for RVT files)
  availableViews,
  selectedViewGuid,
  setSelectedViewGuid,
  loadingViews,
  loadingSvfUrl,
  setLoadingSvfUrl,

  // Viewer state
  setRvtViewerUrl,
  setRvtViewerIsUrn,
  setRvtViewerToken,
  setShowRvtViewer,

  // Functions
  formatDate,
  translateStatus,
}) => {
  const { t } = useI18n();

  /**
   * Handle file tree expansion toggle
   */
  const handleToggleExpand = (fileId) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  /**
   * Handle 3D view selection change
   * Refetches thumbnail and SVF URL for the selected view
   */
  const handleViewChange = async (e) => {
    const newViewGuid = e.target.value;
    setSelectedViewGuid(newViewGuid);

    // Refetch thumbnail and SVF with new view GUID
    if (selectedFile && selectedFile.id && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const encodedFileId = encodeURIComponent(selectedFile.id);

        // Update thumbnail
        setLoadingFileThumbnail(true);
        const thumbnailUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/thumbnail?hubId=${encodeURIComponent(selectedAccount)}${newViewGuid ? `&viewGuid=${encodeURIComponent(newViewGuid)}` : ''}`;

        try {
          const response = await fetch(thumbnailUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const blob = await response.blob();
            // Revoke old blob URL if it exists
            if (fileThumbnail && fileThumbnail.startsWith('blob:')) {
              URL.revokeObjectURL(fileThumbnail);
            }
            const blobUrl = URL.createObjectURL(blob);
            setFileThumbnail(blobUrl);
          } else {
            setFileThumbnail(null);
          }
        } catch (error) {
          setFileThumbnail(null);
        } finally {
          setLoadingFileThumbnail(false);
        }

        // Refetch SVF URL with new view GUID
        setLoadingSvfUrl(true);
        const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}${newViewGuid ? `&viewGuid=${encodeURIComponent(newViewGuid)}` : ''}`;

        try {
          const response = await fetch(svfUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            const svfUrlValue = data.url || data.svfUrl || data.urn || data.data?.url || data.data?.svfUrl || data.data?.urn;
            const isUrnValue = data.isUrn !== undefined ? data.isUrn : (data.data?.isUrn !== undefined ? data.data.isUrn : false);

            if (svfUrlValue) {
              setRvtViewerUrl(svfUrlValue);
              setRvtViewerIsUrn(isUrnValue);
              setRvtViewerToken(accessToken);
            }
          }
        } catch (error) {
          // Error fetching SVF URL - silently fail
        } finally {
          setLoadingSvfUrl(false);
        }
      }
    }
  };

  /**
   * Handle opening file in 3D viewer
   */
  const handleOpenViewer = async () => {
    if (!selectedFile || !selectedProject || !selectedAccount) return;

    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) return;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    const encodedFileId = encodeURIComponent(selectedFile.id);

    try {
      setLoadingSvfUrl(true);
      const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}${selectedViewGuid ? `&viewGuid=${encodeURIComponent(selectedViewGuid)}` : ''}`;

      const response = await fetch(svfUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const svfData = await response.json();
        const svfUrlValue = svfData.url || svfData.svfUrl || svfData.urn || svfData.data?.url || svfData.data?.svfUrl || svfData.data?.urn;
        const isUrnValue = svfData.isUrn !== undefined ? svfData.isUrn : (svfData.data?.isUrn !== undefined ? svfData.data.isUrn : false);

        if (svfUrlValue) {
          setRvtViewerUrl(svfUrlValue);
          setRvtViewerIsUrn(isUrnValue);
          setRvtViewerToken(accessToken);
          setShowRvtViewer(true);
        }
      }
    } catch (error) {
      console.error('Error opening viewer:', error);
    } finally {
      setLoadingSvfUrl(false);
    }
  };

  return (
    <>
      {/* Left Panel: File Tree */}
      <div className="folder-panel">
        <h2>Project Files</h2>
        {loadingFiles ? (
          <p>Loading files...</p>
        ) : !selectedProject ? (
          <p>Please select a project.</p>
        ) : fileTree ? (
          <div className="folder-tree">
            <FileTree
              item={fileTree}
              expandedFiles={expandedFiles}
              selectedFile={selectedFile}
              onToggleExpand={handleToggleExpand}
              onSelectFile={setSelectedFile}
              level={0}
              isRoot={true}
            />
          </div>
        ) : (
          <p>No files found.</p>
        )}
      </div>

      {/* Right Panel: File Details */}
      <div className="products-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>
            {selectedFile ? (selectedFile.name || selectedFile.id) : t('projectPanelTitle')}
          </h2>
          {fileDetails && fileDetails.version && (
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
              {fileDetails.version}
            </span>
          )}
        </div>

        {selectedFile ? (
          <div className="rvt-preview-panel">
            {/* Left Column: Thumbnail, View Selector, and Button */}
            <div className="preview-left">
              {/* Thumbnail */}
              <div style={{ textAlign: 'center' }}>
                {loadingFileThumbnail ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <div className="thumbnail-loading-spinner" />
                  </div>
                ) : fileThumbnail ? (
                  <img
                    src={fileThumbnail}
                    alt={selectedFile.name || 'File thumbnail'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
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

              {/* 3D View Selector (for RVT files) */}
              {availableViews.length > 0 && (
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: '#333'
                  }}>
                    {t('select3DView')}:
                  </label>
                  <select
                    value={selectedViewGuid || ''}
                    onChange={handleViewChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.9rem',
                      border: '1px solid #E0E0E0',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#333',
                      cursor: 'pointer'
                    }}
                    disabled={loadingViews || loadingSvfUrl}
                  >
                    {availableViews.map((view) => (
                      <option key={view.guid} value={view.guid}>
                        {view.name || view.guid}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Open in Viewer Button */}
              <button
                onClick={handleOpenViewer}
                disabled={loadingSvfUrl}
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
                  cursor: loadingSvfUrl ? 'not-allowed' : 'pointer',
                  opacity: loadingSvfUrl ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {loadingSvfUrl ? (
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
                {selectedFile ? t('properties') : t('projectPanelTitle')}
              </h3>

              {loadingFileDetails ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="thumbnail-loading-spinner" />
                </div>
              ) : fileDetails ? (
                <div className="file-details-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {fileDetails.displayName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666', width: '40%' }}>
                            {t('name')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {fileDetails.displayName}
                          </td>
                        </tr>
                      )}

                      {fileDetails.fileType && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('type')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {fileDetails.fileType}
                          </td>
                        </tr>
                      )}

                      {fileDetails.storageSize !== undefined && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('size')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {(fileDetails.storageSize / 1024 / 1024).toFixed(2)} MB
                          </td>
                        </tr>
                      )}

                      {fileDetails.lastModifiedTime && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('modified')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {formatDate(fileDetails.lastModifiedTime)}
                          </td>
                        </tr>
                      )}

                      {fileDetails.createTime && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('created')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {formatDate(fileDetails.createTime)}
                          </td>
                        </tr>
                      )}

                      {fileDetails.createUserName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('createdBy')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {fileDetails.createUserName}
                          </td>
                        </tr>
                      )}

                      {fileDetails.lastModifiedUserName && (
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '500', color: '#666' }}>
                            {t('modifiedBy')}:
                          </td>
                          <td style={{ padding: '12px 8px', color: '#333' }}>
                            {fileDetails.lastModifiedUserName}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>
                  {t('selectFileToViewDetails')}
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
            <p>{t('selectFileToViewDetails')}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default FilesPanel;
