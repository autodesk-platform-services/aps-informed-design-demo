import React from 'react';
import FolderTree from './FolderTree';
import CreateVariantForm from './CreateVariantForm';
import VariantActions from './VariantActions';
import { useI18n } from '../i18n/I18nContext';

/**
 * ProductsTab Component
 *
 * Displays the products tab with folder panel (filtered to folders containing products)
 * and products list with variant management, output generation, and import/export.
 *
 * This is the most complex tab in the application, handling:
 * - Product browsing and selection
 * - Release management
 * - Variant creation and management
 * - Input validation
 * - Output generation for multiple variants
 * - Import/Export functionality
 * - Product and variant thumbnails
 *
 * Responsibilities:
 * - Display folder tree filtered to only folders with Informed Design products
 * - Show products list with expandable cards
 * - Handle product/release selection
 * - Manage variant CRUD operations
 * - Generate outputs for variants
 * - Import/export variants from/to Excel
 *
 * @param {Object} props - Component properties
 * @returns {JSX.Element} Products tab UI
 */
const ProductsTab = ({
  // Folder-related props
  folderTree,
  selectedFolder,
  expandedFolders,
  loadingFolders,
  selectedProject,
  foldersWithProductsIds,
  loadingFoldersWithProducts,
  toggleFolder,
  handleFolderSelect,

  // Products-related props
  products,
  setProducts,
  loadingProducts,
  isRetryingProducts,
  productsRetryCount,
  selectedProduct,
  setSelectedProduct,
  expandedProductId,
  setExpandedProductId,

  // Variants
  variants,
  setVariants,
  loadingVariants,
  setLoadingVariants,
  expandedVariantId,
  setExpandedVariantId,
  variantDetails,
  setVariantDetails,
  loadingVariantDetails,
  setLoadingVariantDetails,

  // Releases
  productReleases,
  selectedReleases,
  setSelectedReleases,
  releaseInputs,
  setReleaseInputs,
  releaseValidationCode,
  setReleaseValidationCode,
  releaseRulesKey,
  setReleaseRulesKey,
  loadingRules,
  setLoadingRules,
  loadingInputs,
  setLoadingInputs,
  releaseDataCache,
  setReleaseDataCache,
  releaseCategories,
  setReleaseCategories,
  loadingReleaseCategories,
  setLoadingReleaseCategories,

  // Validation
  fieldValidationErrors,
  setFieldValidationErrors,
  dismissedErrors,
  setDismissedErrors,
  pendingCorrections,
  setPendingCorrections,
  validatingInputs,
  setValidatingInputs,

  // Variant creation
  showCreateVariantForm,
  setShowCreateVariantForm,
  createVariantFormData,
  setCreateVariantFormData,
  creatingVariant,
  setCreatingVariant,
  createVariantError,
  setCreateVariantError,

  // Outputs
  variantOutputs,
  setVariantOutputs,
  loadingVariantOutputs,
  setLoadingVariantOutputs,
  outputDownloads,
  setOutputDownloads,
  loadingOutputDownloads,
  setLoadingOutputDownloads,
  outputStatuses,
  setOutputStatuses,
  outputErrors,
  setOutputErrors,
  selectedDownloadTypes,
  setSelectedDownloadTypes,
  selectedRepresentations,
  setSelectedRepresentations,
  downloadingOutputs,
  setDownloadingOutputs,
  downloadStatuses,
  setDownloadStatuses,
  showOutputGenerationPanel,
  setShowOutputGenerationPanel,
  selectedOutputTypes,
  setSelectedOutputTypes,
  outputGenerationProgress,
  setOutputGenerationProgress,
  outputGenerationAbortRef,

  // Thumbnails
  productThumbnails,
  setProductThumbnails,
  variantThumbnails,
  setVariantThumbnails,
  setLoadingVariantThumbnails,
  thumbnailAbortControllerRef,

  // Import/Export
  importProgress,
  setImportProgress,
  showImportDialog,
  setShowImportDialog,
  dragOverReleaseId,
  setDragOverReleaseId,

  // Element selection (cross-highlighting)
  expandedCategories,
  setExpandedCategories,
  expandedProducts,
  setExpandedProducts,
  expandedElements,
  setExpandedElements,
  selectedElements,

  // Viewer props (for product selection from viewer)
  showRvtViewer,
  showDxViewer,

  // Utility functions
  formatDate,
  translateStatus,
  
  // Handler functions (defined in App.js)
  filterFolderTreeToProductsOnly,
  fetchVariants,
  generateProductThumbnails,
  handleCreateVariantClick,
  handleImportVariants,
  handleExportVariants,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  createVariantOutput,
  handleFileSelect,
  validateInputValue,
  handleValidationResult,
  handleCancelCreateVariant,
  handleCreateVariant,
  fetchVariantDetails,
  fetchVariantOutputs,
  deleteVariant,
  handleDownloadOutput,
  showNoProductsMessage,
  // When provided, the configurator replaces the product cards. The folder panel
  // above stays, so account/project (menu bar) + folder still drive selection --
  // no need to hard-code ids in .env.
  configuratorNode,
}) => {
  const { t } = useI18n();

  return (
                <>
                  <div className="folder-panel">
                  <h2>{t('selectFolder')}</h2>
                  {loadingFolders ? (
                    <p>{t('loadingFolders')}</p>
                  ) : !selectedProject ? (
                    <p>{t('selectProjectToViewFolders')}</p>
                  ) : !folderTree ? (
                    <p>No folders found in Project Files.</p>
                  ) : loadingFoldersWithProducts || foldersWithProductsIds === null ? (
                    <div className="folder-checking-products" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
                      <div className="thumbnail-loading-spinner" style={{ width: '24px', height: '24px', flexShrink: 0 }} />
                      <span>Searching for products</span>
                    </div>
                  ) : (() => {
                    const filteredTree = filterFolderTreeToProductsOnly(folderTree, foldersWithProductsIds);
                    const hasFilteredChildren = filteredTree && filteredTree.children && filteredTree.children.length > 0;
                    if (!hasFilteredChildren) {
                      return <p className="no-folders-with-products">No folders with Informed Design products found.</p>;
                    }
                    return (
                      <div className="folder-tree">
                        <FolderTree
                          folder={filteredTree}
                          expandedFolders={expandedFolders}
                          selectedFolder={selectedFolder}
                          onToggleFolder={toggleFolder}
                          onSelectFolder={handleFolderSelect}
                          level={0}
                          isRoot={true}
                        />
                      </div>
                    );
                  })()}
                </div>
                {configuratorNode ? (
                  <div className="products-panel">{configuratorNode}</div>
                ) : (
                <div className={`products-panel${expandedProductId != null ? ' products-panel--expanded' : ''}`}>
              <div className="products-header">
                <h2 className="products-title">{t('products')}</h2>
              </div>
              {(loadingProducts || isRetryingProducts) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '16px' }}>
                  <div className="thumbnail-loading-spinner" style={{ width: '40px', height: '40px' }}></div>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>
                    {productsRetryCount > 0 
                      ? `${t('loadingProducts')}... (attempt ${productsRetryCount})`
                      : t('loadingProducts')
                    }
                  </p>
                </div>
              ) : (selectedFolder || (showRvtViewer || showDxViewer)) ? (
                products.length > 0 ? (
                  <div className="products-card-list">
                    {products.map((product, index) => {
                      // Use actual product ID, not index as fallback
                      const productId = product.id || product.productId;
                      if (!productId) {
                        // Skip products without IDs
                        return null;
                      }
                      // Use string comparison for expansion check to ensure consistency
                      const isExpanded = expandedProductId !== null && String(expandedProductId) === String(productId);
                      // Get the selected release or default to defaultRelease
                      const selectedReleaseId = selectedReleases[productId];
                      const releases = productReleases[productId] || product.releases || [];
                      const currentRelease = releases.find(r => (r.id || r.releaseId) === selectedReleaseId) || product.defaultRelease;
                      const releaseId = currentRelease?.id || currentRelease?.releaseId;
                      
                      // Ensure default release is set in selectedReleases if not already set
                      if (!selectedReleaseId && releaseId) {
                        // Use setTimeout to avoid state updates during render
                        setTimeout(() => {
                          setSelectedReleases(prev => {
                            if (!prev[productId]) {
                              return { ...prev, [productId]: releaseId };
                            }
                            return prev;
                          });
                        }, 0);
                      }
                      
                      // Check if this product is selected - use consistent ID comparison
                      const selectedProductId = selectedProduct?.id || selectedProduct?.productId;
                      const isSelected = String(selectedProductId) === String(productId);
                      
                      return (
                        <div 
                          key={productId} 
                          className={`product-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                          onClick={async () => {
                            // Always set this product as selected (only one can be selected)
                            setSelectedProduct(product);
                            
                            // Toggle expansion state - if clicking the same product, collapse it; otherwise expand this one
                            const newExpandedState = isExpanded ? null : String(productId);
                            setExpandedProductId(newExpandedState);
                            
                            // Get the release ID to use for fetching variants
                            const currentSelectedReleaseId = selectedReleases[productId];
                            const currentReleases = productReleases[productId] || product.releases || [];
                            const releaseToUse = currentReleases.find(r => (r.id || r.releaseId) === currentSelectedReleaseId) || product.defaultRelease;
                            const releaseIdToFetch = releaseToUse?.id || releaseToUse?.releaseId;
                            
                            // Fetch variants when expanding - use the current release or default
                            if (newExpandedState && releaseIdToFetch && !variants[releaseIdToFetch]) {
                              await fetchVariants(releaseIdToFetch, product);
                            }
                          }}
                        >
                          <h3 className="product-card-name">
                            {product.name || product.productName || `Product ${index + 1}`}
                          </h3>
                          {(() => {
                            let productId = product.id || product.productId;
                            // Normalize product ID (remove "b." prefix if present) for consistent matching
                            productId = productId ? (String(productId).startsWith('b.') ? String(productId).substring(2) : String(productId)) : null;
                            const thumbnailUrl = productId ? productThumbnails[productId] : null;
                            // GLB preview variables reserved for future use
                            // const glbUrl = productId ? productGlbPreviews[productId] : null;
                            // const isLoadingGlb = productId ? loadingProductGlbPreviews[productId] : false;
                            
                            return (
                              <>
                                  <div className="product-card-thumbnail">
                                  {thumbnailUrl ? (
                                    <img src={thumbnailUrl} alt={product.name || product.productName || 'Product'} />
                                  ) : (
                                    <div className="product-card-thumbnail-loading">
                                      <div className="thumbnail-loading-spinner"></div>
                                      <span>{t('loadingThumbnail')}</span>
                                  </div>
                                )}
                                </div>
                              </>
                            );
                          })()}
                          <div className="product-card-details">
                            <div className="product-detail-item">
                              <span className="product-detail-label">{t('release')}:</span>
                              <select
                                className="release-select"
                                value={(() => {
                                  const productId = product.id || product.productId;
                                  const selectedReleaseId = selectedReleases[productId];
                                  if (selectedReleaseId) return selectedReleaseId;
                                  // Fall back to the found default release ID (from the matched release object)
                                  const defaultReleaseId = product.foundDefaultReleaseId || 
                                    product.defaultRelease?.id || 
                                    product.defaultRelease?.releaseId || 
                                    (typeof product.defaultRelease === 'object' ? null : product.defaultRelease) ||
                                    product.defaultReleaseId || 
                                    product.default_release_id || 
                                    product.default_release;
                                  return defaultReleaseId || '';
                                })()}
                                onChange={async (e) => {
                                  const productId = product.id || product.productId;
                                  const selectedReleaseId = e.target.value;
                                  setSelectedReleases(prev => ({ ...prev, [productId]: selectedReleaseId }));
                                  
                                  // Update the product's defaultRelease to the selected one
                                  const releases = productReleases[productId] || product.releases || [];
                                  const selectedRelease = releases.find(r => (r.id || r.releaseId) === selectedReleaseId);
                                  if (selectedRelease) {
                                    setProducts(prev => prev.map(p => {
                                      const pid = p.id || p.productId;
                                      if (pid === productId) {
                                        return { ...p, defaultRelease: selectedRelease };
                                      }
                                      return p;
                                    }));
                                    
                                    // Refetch variants for the new release
                                    const newReleaseId = selectedRelease.id || selectedRelease.releaseId;
                                    if (newReleaseId) {
                                      fetchVariants(newReleaseId, { ...product, defaultRelease: selectedRelease });
                                      
                                      // Regenerate thumbnail for the new release
                                      const normalizedProductId = String(productId).startsWith('b.') ? String(productId).substring(2) : String(productId);
                                      
                                      // Clear old thumbnail
                                      const oldThumbnailUrl = productThumbnails[normalizedProductId];
                                      if (oldThumbnailUrl) {
                                        URL.revokeObjectURL(oldThumbnailUrl);
                                        setProductThumbnails(prev => {
                                          const updated = { ...prev };
                                          delete updated[normalizedProductId];
                                          return updated;
                                        });
                                      }
                                      
                                      // Regenerate thumbnail for the new release
                                      const accessToken = localStorage.getItem('aps_access_token');
                                      const selectedProject = localStorage.getItem('saved_project_id');
                                      const selectedFolder = localStorage.getItem('saved_folder_id');
                                      
                                      if (accessToken && selectedProject && selectedFolder) {
                                        const cleanProjectId = selectedProject.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
                                        
                                        // Generate thumbnail for the new release
                                        generateProductThumbnails([{ ...product, defaultRelease: selectedRelease }], cleanProjectId, selectedFolder).catch(() => {
                                          // Silently fail - thumbnails are optional
                                        });
                                      }
                                    }
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(() => {
                                  const productId = product.id || product.productId;
                                  const releases = productReleases[productId] || product.releases || [];
                                  // Get the default release ID from the product
                                  // CRITICAL: Always use the original default release ID, never the selected release
                                  // Use foundDefaultReleaseId first (set during product fetch, never changes)
                                  const defaultReleaseId = product.foundDefaultReleaseId || 
                                    (product.defaultRelease && typeof product.defaultRelease === 'object' ? (product.defaultRelease.id || product.defaultRelease.releaseId) : null) ||
                                    (typeof product.defaultRelease === 'string' ? product.defaultRelease : null) ||
                                    product.defaultReleaseId || 
                                    product.default_release_id || 
                                    product.default_release;
                                  
                                  if (releases.length === 0) {
                                    return <option value="">{t('noReleasesAvailable')}</option>;
                                  }
                                  
                                  // Normalize ID helper function
                                  const normalizeId = (id) => {
                                    if (!id) return '';
                                    const idStr = String(id);
                                    return idStr.startsWith('b.') ? idStr.substring(2) : idStr;
                                  };
                                  const normalizedDefaultId = normalizeId(defaultReleaseId);
                                  
                                  return releases.map((release, idx) => {
                                    const releaseId = release.id || release.releaseId;
                                    const releaseNumber = release.number || release.releaseNumber || release.release_number || (idx + 1);
                                    
                                    // Check if this release matches the DEFAULT release (not the selected one)
                                    // Always compare against the original defaultReleaseId from the product
                                    const normalizedReleaseId = normalizeId(releaseId);
                                    const isDefaultById = normalizedReleaseId === normalizedDefaultId || 
                                                          String(releaseId) === String(defaultReleaseId);
                                    
                                    // Also check if this release has isDefault flag set
                                    const isDefaultByFlag = release.isDefault === true || release.default === true;
                                    
                                    // Only show star if this is the actual default release
                                    const isDefault = isDefaultById || isDefaultByFlag;
                                    
                                    return (
                                      <option key={releaseId || idx} value={releaseId}>
                                        {isDefault ? `${releaseNumber} ★` : String(releaseNumber)}
                                      </option>
                                    );
                                  });
                                })()}
                              </select>
                            </div>
                            <div className="product-detail-item">
                              <span className="product-detail-label">{t('state')}:</span>
                              <span className="product-detail-value">
                                {product.state || t('notAvailable')}
                              </span>
                            </div>
                            {(() => {
                              const productId = product.id || product.productId;
                              const selectedReleaseId = selectedReleases[productId];
                              const releases = productReleases[productId] || product.releases || [];
                              const currentRelease = releases.find(r => (r.id || r.releaseId) === selectedReleaseId) || product.defaultRelease;
                              
                              return currentRelease && (
                                <div className="product-detail-item">
                                  <span className="product-detail-label">{t('releaseDate')}:</span>
                                  <span className="product-detail-value">
                                    {currentRelease.releaseDate 
                                      ? formatDate(currentRelease.releaseDate)
                                      : currentRelease.release_date
                                        ? formatDate(currentRelease.release_date)
                                        : currentRelease.date
                                          ? formatDate(currentRelease.date)
                                          : currentRelease.createdAt
                                            ? formatDate(currentRelease.createdAt)
                                            : currentRelease.created_at
                                              ? formatDate(currentRelease.created_at)
                                              : t('notAvailable')}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          {isExpanded && (() => {
                            const productId = product.id || product.productId;
                            const selectedReleaseId = selectedReleases[productId];
                            const releases = productReleases[productId] || product.releases || [];
                            const currentRelease = releases.find(r => (r.id || r.releaseId) === selectedReleaseId) || product.defaultRelease;
                            const releaseId = currentRelease?.id || currentRelease?.releaseId;
                            
                            // Fetch variants if not already loaded or if we have an empty array (might have been set prematurely)
                            // Use useRef to track if we've already initiated fetch to prevent multiple calls
                            const existingVariants = variants[releaseId];
                            const shouldFetch = releaseId && 
                              !loadingVariants[releaseId] && 
                              (!existingVariants || (Array.isArray(existingVariants) && existingVariants.length === 0));
                            
                            if (shouldFetch) {
                              const accessToken = localStorage.getItem('aps_access_token');
                              if (accessToken) {
                                // Set loading immediately to prevent flickering
                                setLoadingVariants(prev => ({ ...prev, [releaseId]: true }));
                                // Use requestAnimationFrame to batch state updates and prevent flickering
                                requestAnimationFrame(() => {
                                  fetchVariants(releaseId, product).catch(() => {
                                    // Silently fail
                                  });
                                });
                              }
                            }
                            
                            return (
                            <div className="product-card-expanded">
                              
                              <div 
                                className={`variants-header ${dragOverReleaseId === releaseId ? 'drag-over' : ''}`}
                                onDrop={(e) => handleDrop(e, releaseId)}
                                onDragOver={(e) => handleDragOver(e, releaseId)}
                                onDragLeave={handleDragLeave}
                              >
                                <h4 className="expanded-section-title">{t('variants')}</h4>
                                {!showCreateVariantForm[releaseId] && (
                                  <VariantActions
                                    releaseId={releaseId}
                                    loadingInputs={loadingInputs[releaseId]}
                                    loadingRules={loadingRules[releaseId]}
                                    onCreateClick={() => handleCreateVariantClick(releaseId)}
                                    onImportClick={() => handleImportVariants(releaseId)}
                                    onExportClick={() => handleExportVariants(releaseId)}
                                    onGenerateClick={async (e) => {
                                      e.stopPropagation();
                                      const isCurrentlyOpen = showOutputGenerationPanel[releaseId];
                                      if (!isCurrentlyOpen) {
                                        // Fetch release data to get output types
                                        const accessToken = localStorage.getItem('aps_access_token');
                                        if (accessToken) {
                                          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                                          const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
                                          const accessId = `${cleanProjectId}|${selectedFolder}`;
                                          try {
                                            const releaseResponse = await fetch(
                                              `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
                                              {
                                                headers: {
                                                  'Authorization': `Bearer ${accessToken}`,
                                                  'Content-Type': 'application/json',
                                                },
                                              }
                                            );
                                            if (releaseResponse.ok) {
                                              const releaseData = await releaseResponse.json();
                                              setReleaseDataCache(prev => ({ ...prev, [releaseId]: releaseData }));
                                            }
                                          } catch (error) {
                                            // Silently fail
                                          }
                                        }
                                      }
                                      setShowOutputGenerationPanel(prev => ({
                                        ...prev,
                                        [releaseId]: !isCurrentlyOpen
                                      }));
                                    }}
                                    importProgress={importProgress}
                                    isGenerating={outputGenerationProgress.releaseId === releaseId}
                                  />
                                )}
                                {showOutputGenerationPanel[releaseId] && (
                                  <div className="output-generation-panel" onClick={(e) => e.stopPropagation()}>
                                    {outputGenerationProgress.releaseId === releaseId && outputGenerationProgress.total > 0 && (
                                      <div className="output-generation-progress-overlay">
                                        <div className="output-generation-progress-text">
                                          <div className="output-generation-progress-count">
                                            {outputGenerationProgress.current} / {outputGenerationProgress.total}
                                          </div>
                                          <div className="output-generation-progress-stats">
                                            Success: {outputGenerationProgress.successCount} · Failed: {outputGenerationProgress.failureCount}
                                          </div>
                                          <button
                                            type="button"
                                            className="output-generation-progress-cancel"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              outputGenerationAbortRef.current = true;
                                            }}
                                          >
                                            {t('cancel')}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="output-generation-content">
                                      <h5>{t('generateOutputsForAllVariants')}</h5>
                                      <p>{t('selectOutputTypesToGenerate')}</p>
                                      <div className="output-types-checkboxes">
                                        {(() => {
                                          const releaseData = releaseDataCache[releaseId];
                                          if (!releaseData || !releaseData.outputSettings) {
                                            return <p className="loading-output-types">{t('loadingOutputTypes')}</p>;
                                          }
                                          
                                          // Extract output types and their representations from outputSettings
                                          let outputTypesWithReps = [];
                                          if (typeof releaseData.outputSettings === 'object' && !Array.isArray(releaseData.outputSettings)) {
                                            outputTypesWithReps = Object.keys(releaseData.outputSettings).map(outputType => {
                                              const settings = releaseData.outputSettings[outputType];
                                              let representations = [];
                                              
                                              // Check if representations are in the settings
                                              if (settings && settings.representations && Array.isArray(settings.representations)) {
                                                representations = settings.representations;
                                              } else if (settings && settings.representation) {
                                                representations = [settings.representation];
                                              }
                                              
                                              // For output types that don't use representations (PDF, DWG, IDW), show empty
                                              const outputTypeUpper = outputType.toUpperCase();
                                              if (outputTypeUpper === 'PDF' || outputTypeUpper === 'DWG' || outputTypeUpper === 'IDW') {
                                                representations = [];
                                              }
                                              
                                              return { type: outputType, representations };
                                            });
                                          } else if (Array.isArray(releaseData.outputSettings)) {
                                            outputTypesWithReps = releaseData.outputSettings.map(setting => {
                                              const outputType = setting.type || setting.outputType || setting.format || '';
                                              let representations = [];
                                              
                                              if (setting.representations && Array.isArray(setting.representations)) {
                                                representations = setting.representations;
                                              } else if (setting.representation) {
                                                representations = [setting.representation];
                                              } else if (setting.settings && setting.settings.representations && Array.isArray(setting.settings.representations)) {
                                                representations = setting.settings.representations;
                                              } else if (setting.settings && setting.settings.representation) {
                                                representations = [setting.settings.representation];
                                              }
                                              
                                              // For output types that don't use representations (PDF, DWG, IDW), show empty
                                              const outputTypeUpper = outputType.toUpperCase();
                                              if (outputTypeUpper === 'PDF' || outputTypeUpper === 'DWG' || outputTypeUpper === 'IDW') {
                                                representations = [];
                                              }
                                              
                                              return { type: outputType, representations };
                                            }).filter(item => item.type);
                                          }
                                          
                                          // Filter out BCD from output options everywhere
                                          outputTypesWithReps = outputTypesWithReps.filter(({ type }) => (type || '').toUpperCase() !== 'BCD');
                                          
                                          // Group by output type (case-insensitive) so e.g. all RFA entries are under one RFA node
                                          const groupedByType = new Map();
                                          const groupKey = (type) => {
                                            const u = (type || '').toUpperCase();
                                            if (u === 'RFA' || u.startsWith('RFA')) return 'RFA';
                                            return u;
                                          };
                                          for (const { type: outputType, representations } of outputTypesWithReps) {
                                            const typeUpper = (outputType || '').toUpperCase();
                                            if (!typeUpper) continue;
                                            const key = groupKey(outputType);
                                            const existing = groupedByType.get(key);
                                            const repList = Array.isArray(representations) ? representations : [];
                                            if (existing) {
                                              const mergedReps = [...existing.representations];
                                              repList.forEach(rep => {
                                                const r = rep && typeof rep === 'object' ? (rep.name || rep.id || String(rep)) : String(rep);
                                                if (r && !mergedReps.includes(r)) mergedReps.push(r);
                                              });
                                              existing.representations = mergedReps;
                                            } else {
                                              const reps = repList.map(rep => rep && typeof rep === 'object' ? (rep.name || rep.id || String(rep)) : String(rep)).filter(Boolean);
                                              groupedByType.set(key, { type: key, representations: [...new Set(reps)] });
                                            }
                                          }
                                          outputTypesWithReps = Array.from(groupedByType.values());
                                          
                                          if (outputTypesWithReps.length === 0) {
                                            return <p className="no-output-types">No output types available for this release.</p>;
                                          }
                                          
                                          return outputTypesWithReps.map(({ type: outputType, representations }) => {
                                            const outputTypeUpper = outputType.toUpperCase();
                                            const hasRepresentations = outputTypeUpper !== 'PDF' && outputTypeUpper !== 'DWG' && outputTypeUpper !== 'IDW';
                                            
                                            // For types with representations, show hierarchical structure
                                            if (hasRepresentations && representations && representations.length > 0) {
                                              // Check if all representations are selected
                                              const allRepsSelected = representations.every(rep => {
                                                const repKey = `${releaseId}-${outputType}-${rep}`;
                                                return selectedOutputTypes[repKey] || false;
                                              });
                                              
                                              // Check if any representation is selected (for indeterminate state)
                                              const someRepsSelected = representations.some(rep => {
                                                const repKey = `${releaseId}-${outputType}-${rep}`;
                                                return selectedOutputTypes[repKey] || false;
                                              });
                                              
                                              return (
                                                <div key={outputType} className="output-type-group">
                                                  <label className="output-type-checkbox-label output-type-parent-label">
                                                    <input
                                                      type="checkbox"
                                                      checked={allRepsSelected}
                                                      ref={(input) => {
                                                        if (input) {
                                                          input.indeterminate = someRepsSelected && !allRepsSelected;
                                                        }
                                                      }}
                                                      onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        const updates = {};
                                                        representations.forEach(rep => {
                                                          const repKey = `${releaseId}-${outputType}-${rep}`;
                                                          updates[repKey] = isChecked;
                                                        });
                                                        setSelectedOutputTypes(prev => ({
                                                          ...prev,
                                                          ...updates
                                                        }));
                                                      }}
                                                      className="output-type-checkbox output-type-parent-checkbox"
                                                    />
                                                    <span className="output-type-name">{outputType}</span>
                                                  </label>
                                                  <div className="output-type-representations-list">
                                                    {representations.map((representation) => {
                                                      const repKey = `${releaseId}-${outputType}-${representation}`;
                                                      const isChecked = selectedOutputTypes[repKey] || false;
                                                      
                                                      return (
                                                        <label key={representation} className="output-type-checkbox-label output-type-representation-label">
                                                          <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                              setSelectedOutputTypes(prev => ({
                                                                ...prev,
                                                                [repKey]: e.target.checked
                                                              }));
                                                            }}
                                                            className="output-type-checkbox"
                                                          />
                                                          <span className="output-type-name">{representation}</span>
                                                        </label>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            } else {
                                              // No representations (PDF, DWG, IDW) - show single checkbox
                                              const typeKey = `${releaseId}-${outputType}`;
                                              const isChecked = selectedOutputTypes[typeKey] || false;
                                              
                                              return (
                                                <label key={outputType} className="output-type-checkbox-label">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                      setSelectedOutputTypes(prev => ({
                                                        ...prev,
                                                        [typeKey]: e.target.checked
                                                      }));
                                                    }}
                                                    className="output-type-checkbox"
                                                  />
                                                  <span className="output-type-name">{outputType}</span>
                                                </label>
                                              );
                                            }
                                          });
                                        })()}
                                      </div>
                                      <div className="output-generation-actions">
                                        <button
                                          className="btn-cancel-output-generation"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowOutputGenerationPanel(prev => ({
                                              ...prev,
                                              [releaseId]: false
                                            }));
                                          }}
                                        >
                                          {t('cancel')}
                                        </button>
                                        <button
                                          className="btn-generate-outputs-submit"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            
                                            const accessToken = localStorage.getItem('aps_access_token');
                                            if (!accessToken) {
                                              alert('Not authenticated. Please log in again.');
                                              return;
                                            }
                                            
                                            // Get release data
                                            const releaseData = releaseDataCache[releaseId];
                                            if (!releaseData) {
                                              alert('Release data has not been loaded. Please try again.');
                                              return;
                                            }
                                            
                                            // Get all variants for this release
                                            const releaseVariants = variants[releaseId] || [];
                                            if (releaseVariants.length === 0) {
                                              alert('No variants found for this release.');
                                              return;
                                            }
                                            
                                            // Get selected output types and representations
                                            // Build a list of { type, representation } pairs that are selected
                                            const selectedOutputs = [];
                                            
                                            if (typeof releaseData.outputSettings === 'object' && !Array.isArray(releaseData.outputSettings)) {
                                              Object.keys(releaseData.outputSettings).forEach(outputType => {
                                                if ((outputType || '').toUpperCase() === 'BCD') return;
                                                const settings = releaseData.outputSettings[outputType];
                                                let representations = [];
                                                
                                                if (settings && settings.representations && Array.isArray(settings.representations)) {
                                                  representations = settings.representations;
                                                } else if (settings && settings.representation) {
                                                  representations = [settings.representation];
                                                }
                                                
                                                const outputTypeUpper = outputType.toUpperCase();
                                                if (outputTypeUpper !== 'PDF' && outputTypeUpper !== 'DWG' && outputTypeUpper !== 'IDW') {
                                                  if (representations.length === 0) {
                                                    representations = ['[Primary]'];
                                                  }
                                                  
                                                  // Check each representation individually
                                                  for (const representation of representations) {
                                                    const repKey = `${releaseId}-${outputType}-${representation}`;
                                                    if (selectedOutputTypes[repKey]) {
                                                      selectedOutputs.push({ type: outputType, representation });
                                                    }
                                                  }
                                                } else {
                                                  // No representations (PDF, DWG, IDW) - check type key
                                                  const typeKey = `${releaseId}-${outputType}`;
                                                  if (selectedOutputTypes[typeKey]) {
                                                    selectedOutputs.push({ type: outputType, representation: null });
                                                  }
                                                }
                                              });
                                            } else if (Array.isArray(releaseData.outputSettings)) {
                                              releaseData.outputSettings.forEach(setting => {
                                                const outputType = setting.type || setting.outputType || setting.format || '';
                                                if ((outputType || '').toUpperCase() === 'BCD') return;
                                                if (outputType) {
                                                  let representations = [];
                                                  
                                                  if (setting.representations && Array.isArray(setting.representations)) {
                                                    representations = setting.representations;
                                                  } else if (setting.representation) {
                                                    representations = [setting.representation];
                                                  } else if (setting.settings && setting.settings.representations && Array.isArray(setting.settings.representations)) {
                                                    representations = setting.settings.representations;
                                                  } else if (setting.settings && setting.settings.representation) {
                                                    representations = [setting.settings.representation];
                                                  }
                                                  
                                                  const outputTypeUpper = outputType.toUpperCase();
                                                  if (outputTypeUpper !== 'PDF' && outputTypeUpper !== 'DWG' && outputTypeUpper !== 'IDW') {
                                                    if (representations.length === 0) {
                                                      representations = ['[Primary]'];
                                                    }
                                                    
                                                    // Check each representation individually
                                                    for (const representation of representations) {
                                                      const repKey = `${releaseId}-${outputType}-${representation}`;
                                                      if (selectedOutputTypes[repKey]) {
                                                        selectedOutputs.push({ type: outputType, representation });
                                                      }
                                                    }
                                                  } else {
                                                    // No representations (PDF, DWG, IDW) - check type key
                                                    const typeKey = `${releaseId}-${outputType}`;
                                                    if (selectedOutputTypes[typeKey]) {
                                                      selectedOutputs.push({ type: outputType, representation: null });
                                                    }
                                                  }
                                                }
                                              });
                                            }
                                            
                                            if (selectedOutputs.length === 0) {
                                              alert('No output type selected.');
                                              return;
                                            }
                                            
                                            // Count total requests (variants × selected outputs)
                                            const validVariants = releaseVariants.filter(v => v.id || v.variantId);
                                            const totalRequests = validVariants.length * selectedOutputs.length;
                                            
                                            outputGenerationAbortRef.current = false;
                                            setOutputGenerationProgress({
                                              releaseId,
                                              current: 0,
                                              total: totalRequests,
                                              successCount: 0,
                                              failureCount: 0,
                                            });
                                            
                                            let successCount = 0;
                                            let failureCount = 0;
                                            let current = 0;
                                            
                                            for (const variant of releaseVariants) {
                                              if (outputGenerationAbortRef.current) break;
                                              const variantId = variant.id || variant.variantId;
                                              if (!variantId) continue;
                                              
                                              for (const { type: outputType, representation } of selectedOutputs) {
                                                if (outputGenerationAbortRef.current) break;
                                                const result = await createVariantOutput(variantId, outputType, releaseData, representation);
                                                if (result) {
                                                  successCount++;
                                                } else {
                                                  failureCount++;
                                                }
                                                current++;
                                                setOutputGenerationProgress({
                                                  releaseId,
                                                  current,
                                                  total: totalRequests,
                                                  successCount,
                                                  failureCount,
                                                });
                                              }
                                            }
                                            
                                            // Clear progress so button shows "Generate" again (no popup, panel stays open)
                                            setOutputGenerationProgress({
                                              releaseId: null,
                                              current: 0,
                                              total: 0,
                                              successCount: 0,
                                              failureCount: 0,
                                            });
                                          }}
                                          disabled={outputGenerationProgress.releaseId === releaseId && outputGenerationProgress.total > 0}
                                        >
                                          {t('generate')}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {showImportDialog.show && showImportDialog.releaseId === releaseId && (
                                  <div className="import-file-dialog" onClick={(e) => e.stopPropagation()}>
                                    <div className="import-file-content">
                                      <h5>{t('importVariants')}</h5>
                                      <p>{t('selectFileToImportVariants')}</p>
                                      <p className="import-file-hint">{t('orDragAndDropFile')}</p>
                                      <label className="import-file-label">
                                        <input
                                          type="file"
                                          accept=".csv,.xlsx,.xls"
                                          onChange={(e) => handleFileSelect(e, releaseId)}
                                          className="import-file-input"
                                        />
                                        <span className="import-file-button">{t('selectFile')}</span>
                                      </label>
                                      <div className="import-file-actions">
                                        <button
                                          className="btn-cancel-import"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowImportDialog({ releaseId: null, show: false });
                                          }}
                                        >
                                          {t('cancel')}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {showCreateVariantForm[releaseId] && releaseInputs[releaseId] && releaseInputs[releaseId].length > 0 && loadingRules[releaseId] === false ? (
                                <CreateVariantForm
                                  releaseId={releaseId}
                                  product={product}
                                  releaseInputs={releaseInputs[releaseId]}
                                  releaseValidationCode={releaseValidationCode[releaseId]}
                                  loadingRules={loadingRules[releaseId]}
                                  formData={createVariantFormData[releaseId] || {}}
                                  setFormData={(newData) => setCreateVariantFormData(prev => ({ ...prev, [releaseId]: newData }))}
                                  creatingVariant={creatingVariant[releaseId]}
                                  createVariantError={createVariantError[releaseId]}
                                  fieldValidationErrors={fieldValidationErrors}
                                  setFieldValidationErrors={setFieldValidationErrors}
                                  dismissedErrors={dismissedErrors}
                                  setDismissedErrors={setDismissedErrors}
                                  pendingCorrections={pendingCorrections}
                                  setPendingCorrections={setPendingCorrections}
                                  validatingInputs={validatingInputs}
                                  setValidatingInputs={setValidatingInputs}
                                  products={products}
                                  productReleases={productReleases}
                                  onCancel={handleCancelCreateVariant}
                                  onCreate={handleCreateVariant}
                                  validateInputValue={validateInputValue}
                                  handleValidationResult={handleValidationResult}
                                />
                              ) : loadingVariants[releaseId] ? (
                                <p className="loading-variants">{t('loadingVariants')}</p>
                              ) : (variants[releaseId] && Array.isArray(variants[releaseId]) && variants[releaseId].length > 0) ? (
                                <div className="variants-list">
                                  {(() => {
                                    // Process variants to add numbers to duplicate names
                                    const variantsList = variants[releaseId];
                                    const nameCounts = {};
                                    const processedVariants = variantsList.map((variant) => {
                                      const baseName = variant.name || variant.variantName || '';
                                      if (baseName) {
                                        nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
                                      }
                                      return variant;
                                    });
                                    
                                    // Second pass: append numbers to duplicates
                                    const nameOccurrences = {};
                                    const variantsWithDisplayNames = processedVariants.map((variant) => {
                                      const baseName = variant.name || variant.variantName || '';
                                      let displayName = baseName || `Variant ${variantsList.indexOf(variant) + 1}`;
                                      
                                      if (baseName) {
                                        nameOccurrences[baseName] = (nameOccurrences[baseName] || 0) + 1;
                                        if (nameCounts[baseName] > 1) {
                                          displayName = `${baseName} ${nameOccurrences[baseName]}`;
                                        }
                                      }
                                      
                                      return { ...variant, displayName };
                                    });
                                    
                                    return variantsWithDisplayNames.map((variant, variantIndex) => {
                                    const variantId = variant.id || variant.variantId || variantIndex;
                                    const isVariantExpanded = expandedVariantId === variantId;
                                    
                                    return (
                                      <div key={variantId} className="variant-item-wrapper">
                                        <div 
                                          className={`variant-item ${isVariantExpanded ? 'expanded' : ''}`}
                                          onClick={async (e) => {
                                            e.stopPropagation(); // Prevent card from collapsing
                                            const newExpandedState = isVariantExpanded ? null : variantId;
                                            setExpandedVariantId(newExpandedState);
                                            
                                            // Fetch variant details and outputs when expanding
                                            if (newExpandedState) {
                                              if (!variantDetails[variantId]) {
                                                await fetchVariantDetails(variantId, releaseId);
                                              }
                                              // Fetch outputs after variant details are loaded (outputs might be in variant details)
                                              // Use setTimeout to ensure variant details state is updated first
                                              setTimeout(async () => {
                                                // Use default "[Primary]" representation for Preview
                                                // Check if outputs don't exist OR if they're an empty array (from failed previous attempt)
                                                if (!variantOutputs[variantId] || (Array.isArray(variantOutputs[variantId]) && variantOutputs[variantId].length === 0)) {
                                                  // Pass releaseId and default representation to fetchVariantOutputs
                                                  await fetchVariantOutputs(variantId, releaseId, "[Primary]");
                                                }
                                              }, 100);
                                            }
                                          }}
                                        >
                                          <div className="variant-header">
                                            <div className="variant-info">
                                              {(() => {
                                                const normalizedVariantId = String(variantId).startsWith('b.') ? String(variantId).substring(2) : String(variantId);
                                                const thumbnailUrl = variantThumbnails[normalizedVariantId];
                                                
                                                return (
                                                  <div className="variant-content">
                                                    <div className="variant-thumbnail-container">
                                                      {thumbnailUrl ? (
                                                        <div className="variant-thumbnail">
                                                            <img src={thumbnailUrl} alt={variant.displayName || variant.name || variant.variantName || 'Variant'} />
                                                        </div>
                                                      ) : (
                                                        <div className="variant-thumbnail-loading">
                                                          <div className="variant-thumbnail-spinner"></div>
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="variant-text">
                                                      <div className="variant-name">
                                                          {variant.displayName || variant.name || variant.variantName || `Variant ${variantIndex + 1}`}
                                                      </div>
                                                      {variant.description && (
                                                        <div className="variant-description">{variant.description}</div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                            <div className="variant-actions">
                                              <button
                                                className="variant-delete-button"
                                                onClick={async (e) => {
                                                  e.stopPropagation(); // Prevent variant from expanding/collapsing
                                                  await deleteVariant(variantId, releaseId, product);
                                                }}
                                                title={t('deleteVariant')}
                                              >
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                  <path d="M5.5 2V1C5.5 0.447715 5.94772 0 6.5 0H9.5C10.0523 0 10.5 0.447715 10.5 1V2H13.5C13.7761 2 14 2.22386 14 2.5C14 2.77614 13.7761 3 13.5 3H13V13.5C13 14.3284 12.3284 15 11.5 15H4.5C3.67157 15 3 14.3284 3 13.5V3H2.5C2.22386 3 2 2.77614 2 2.5C2 2.22386 2.22386 2 2.5 2H5.5ZM6.5 1V2H9.5V1H6.5ZM4 3V13.5C4 13.7761 4.22386 14 4.5 14H11.5C11.7761 14 12 13.7761 12 13.5V3H4ZM6 5.5C6 5.22386 6.22386 5 6.5 5C6.77614 5 7 5.22386 7 5.5V11.5C7 11.7761 6.77614 12 6.5 12C6.22386 12 6 11.7761 6 11.5V5.5ZM9 5.5C9 5.22386 9.22386 5 9.5 5C9.77614 5 10 5.22386 10 5.5V11.5C10 11.7761 9.77614 12 9.5 12C9.22386 12 9 11.7761 9 11.5V5.5Z" fill="currentColor"/>
                                                </svg>
                                              </button>
                                              <div className="variant-expand-icon">
                                                {isVariantExpanded ? '▼' : '▶'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        {isVariantExpanded && (
                                          <div className="variant-parameters">
                                            <h5 className="variant-parameters-title">{t('parameters')}</h5>
                                            {loadingVariantDetails[variantId] ? (
                                              <p className="loading-parameters">{t('loadingParameters')}</p>
                                            ) : variantDetails[variantId] ? (
                                              (() => {
                                                const details = variantDetails[variantId];
                                                const inputs = details.inputs;
                                                
                                                return inputs && Array.isArray(inputs) && inputs.length > 0 ? (
                                                  <div className="parameters-list">
                                                    {inputs.map((input, inputIndex) => (
                                                      <div key={inputIndex} className="parameter-item">
                                                        <div className="parameter-name">
                                                          {input.name || input.key || `Input ${inputIndex + 1}`}
                                                        </div>
                                                        <div className="parameter-value">
                                                          {input.value !== undefined ? String(input.value) : input.defaultValue !== undefined ? String(input.defaultValue) : t('notAvailable')}
                                                        </div>
                                                        {input.type && (
                                                          <div className="parameter-type">{t('type')}: {input.type}</div>
                                                        )}
                                                        {input.description && (
                                                          <div className="parameter-description">{input.description}</div>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="no-parameters">{t('noParameters')}</p>
                                                );
                                              })()
                                            ) : (
                                              <p className="no-parameters">No inputs available</p>
                                            )}

                                            {/* Preview Section */}
                                            {loadingVariantOutputs[variantId] ? (
                                              <div className="variant-outputs">
                                                <h5 className="variant-parameters-title">{t('preview')}</h5>
                                                <p className="loading-parameters">{t('loadingPreview')}</p>
                                              </div>
                                            ) : variantOutputs[variantId] && variantOutputs[variantId].length > 0 ? (
                                              (() => {
                                                const outputs = variantOutputs[variantId];
                                                const glbOutput = outputs.find(output => output.type === 'GLB');
                                                const thumbnailOutput = !glbOutput ? outputs.find(output => output.type === 'THUMBNAIL') : null;
                                                
                                                const displayOutput = glbOutput || thumbnailOutput;
                                                const outputId = displayOutput?.id;
                                                const outputFailed = displayOutput?.failed;
                                                const statusKey = outputId;
                                                const status = outputStatuses[statusKey];
                                                const error = outputErrors[statusKey];
                                                const downloadKey = outputId ? `${variantId}-${outputId}` : null;
                                                const downloadUrl = downloadKey ? outputDownloads[downloadKey] : null;
                                                
                                                // Show error if output failed
                                                if (outputFailed || error) {
                                                  return (
                                                    <div className="variant-outputs">
                                                      <h5 className="variant-parameters-title">{t('preview')}</h5>
                                                      <div className="output-error">
                                                        <p className="error-message">
                                                          {error || t('failedToGenerateOutput')}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                }
                                                
                                                return (
                                                  <div className="variant-outputs">
                                                    <h5 className="variant-parameters-title">{t('preview')}</h5>
                                                    {status && status !== 'SUCCESS' && status !== 'success' && status !== 'Success' ? (
                                                      <p className="loading-parameters">{glbOutput ? t('model') : t('thumbnail')} {t('generating')}... ({t('status')}: {translateStatus(status)})</p>
                                                    ) : loadingOutputDownloads[downloadKey] ? (
                                                      <p className="loading-parameters">{t('loading')} {glbOutput ? t('model') : t('thumbnail')}...</p>
                                                    ) : downloadUrl ? (
                                                      glbOutput ? (
                                                        <div 
                                                          className="output-preview"
                                                          onClick={(e) => e.stopPropagation()}
                                                          onMouseDown={(e) => e.stopPropagation()}
                                                          onMouseUp={(e) => e.stopPropagation()}
                                                        >
                                                          <model-viewer
                                                            src={downloadUrl}
                                                            alt="3D Model"
                                                            camera-controls
                                                            auto-rotate
                                                            style={{
                                                              width: '100%',
                                                              height: '150px',
                                                              backgroundColor: '#f0f0f0'
                                                            }}
                                                          />
                                                        </div>
                                                      ) : (
                                                        <div className="output-thumbnail">
                                                          <img 
                                                            src={downloadUrl} 
                                                            alt="Variant thumbnail"
                                                            onError={(e) => {
                                                              e.target.style.display = 'none';
                                                            }}
                                                          />
                                                        </div>
                                                      )
                                                    ) : (
                                                      <p className="no-parameters">{glbOutput ? t('noModelAvailable') : t('noThumbnailAvailable')}</p>
                                                    )}
                                                  </div>
                                                );
                                              })()
                                            ) : null}
                                            
                                            {/* Downloads Section */}
                                            {currentRelease && currentRelease.outputSettings && (
                                              <div className="variant-downloads">
                                                <h5 className="variant-parameters-title">{t('downloads')}</h5>
                                                <div className="downloads-controls">
                                                  <div className="download-control-row">
                                                    <select
                                                      className="download-type-select"
                                                      value={selectedDownloadTypes[variantId] || ''}
                                                      onChange={(e) => {
                                                        const newType = e.target.value;
                                                        setSelectedDownloadTypes(prev => ({
                                                          ...prev,
                                                          [variantId]: newType
                                                        }));
                                                        // Clear representation when output type changes
                                                        setSelectedRepresentations(prev => ({
                                                          ...prev,
                                                          [variantId]: ''
                                                        }));
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <option value="">{t('selectOutputType')}</option>
                                                      {(() => {
                                                        const outputSettings = currentRelease.outputSettings;
                                                        let outputTypes = [];
                                                        
                                                        if (Array.isArray(outputSettings)) {
                                                          // Get unique output types
                                                          const typeSet = new Set();
                                                          outputSettings.forEach(setting => {
                                                            const type = setting.type || setting.outputType || setting.format;
                                                            if (type && type !== 'Unknown' && type.toUpperCase() !== 'BCD') {
                                                              typeSet.add(type);
                                                            }
                                                          });
                                                          outputTypes = Array.from(typeSet);
                                                        } else if (typeof outputSettings === 'object') {
                                                          // Get unique output types from object keys (exclude BCD)
                                                          outputTypes = Object.keys(outputSettings).filter(t => (t || '').toUpperCase() !== 'BCD');
                                                        }
                                                        
                                                        return outputTypes.map((type, idx) => (
                                                          <option key={idx} value={type}>
                                                            {type}
                                                          </option>
                                                        ));
                                                      })()}
                                                    </select>
                                                  </div>
                                                  {selectedDownloadTypes[variantId] && (() => {
                                                    const selectedType = selectedDownloadTypes[variantId];
                                                    const selectedTypeUpper = selectedType ? selectedType.toUpperCase() : '';
                                                    const needsRepresentation = selectedTypeUpper !== 'PDF' && selectedTypeUpper !== 'DWG' && selectedTypeUpper !== 'IDW';
                                                    const isSVF = selectedTypeUpper === 'SVF';
                                                    
                                                    return (
                                                      <>
                                                        {needsRepresentation && (
                                                          <div className="download-control-row">
                                                            <select
                                                              className="representation-select"
                                                              value={selectedRepresentations[variantId] || ''}
                                                              onChange={(e) => {
                                                                setSelectedRepresentations(prev => ({
                                                                  ...prev,
                                                                  [variantId]: e.target.value
                                                                }));
                                                              }}
                                                              onClick={(e) => e.stopPropagation()}
                                                            >
                                                              <option value="">{t('selectRepresentation')}</option>
                                                              {(() => {
                                                                const outputSettings = currentRelease.outputSettings;
                                                                let representations = new Set();
                                                                
                                                                // Get representations for the selected output type
                                                                if (Array.isArray(outputSettings)) {
                                                                  outputSettings.forEach(setting => {
                                                                    const settingType = setting.type || setting.outputType || setting.format;
                                                                    if (settingType === selectedType || settingType === selectedType.toUpperCase()) {
                                                                      // Check for representation in the setting
                                                                      if (setting.representation) {
                                                                        representations.add(setting.representation);
                                                                      } else if (setting.settings && setting.settings.representation) {
                                                                        representations.add(setting.settings.representation);
                                                                      } else if (setting.representations && Array.isArray(setting.representations)) {
                                                                        setting.representations.forEach(repr => {
                                                                          if (typeof repr === 'string') {
                                                                            representations.add(repr);
                                                                          } else if (repr && typeof repr === 'object' && repr.name) {
                                                                            representations.add(repr.name);
                                                                          } else if (repr && typeof repr === 'object' && repr.id) {
                                                                            representations.add(repr.id);
                                                                          }
                                                                        });
                                                                      }
                                                                    }
                                                                  });
                                                                } else if (typeof outputSettings === 'object') {
                                                                  // Get settings for the selected type
                                                                  const typeKey = selectedType.toUpperCase();
                                                                  const typeSettings = outputSettings[typeKey] || outputSettings[selectedType] || outputSettings[selectedType.toLowerCase()];
                                                                  
                                                                  if (typeSettings) {
                                                                    if (typeSettings.representation) {
                                                                      representations.add(typeSettings.representation);
                                                                    } else if (typeSettings.settings && typeSettings.settings.representation) {
                                                                      representations.add(typeSettings.settings.representation);
                                                                    } else if (typeSettings.representations && Array.isArray(typeSettings.representations)) {
                                                                      typeSettings.representations.forEach(repr => {
                                                                        if (typeof repr === 'string') {
                                                                          representations.add(repr);
                                                                        } else if (repr && typeof repr === 'object' && repr.name) {
                                                                          representations.add(repr.name);
                                                                        } else if (repr && typeof repr === 'object' && repr.id) {
                                                                          representations.add(repr.id);
                                                                        }
                                                                      });
                                                                    }
                                                                  }
                                                                }
                                                                
                                                                // If no representations found, add default
                                                                if (representations.size === 0) {
                                                                  representations.add('[Primary]');
                                                                }
                                                                
                                                                return Array.from(representations).map((repr, idx) => (
                                                                  <option key={idx} value={repr}>
                                                                    {repr}
                                                                  </option>
                                                                ));
                                                              })()}
                                                            </select>
                                                          </div>
                                                        )}
                                                        <div className="download-control-row">
                                                          <button
                                                            className="download-button"
                                                            onClick={async (e) => {
                                                              e.stopPropagation();
                                                              
                                                              const selectedRepr = needsRepresentation ? selectedRepresentations[variantId] : null;
                                                              
                                                              if (selectedType && currentRelease && (!needsRepresentation || selectedRepr)) {
                                                                await handleDownloadOutput(variantId, selectedType, currentRelease, selectedRepr);
                                                              }
                                                            }}
                                                            disabled={(() => {
                                                              const hasRequiredRepr = !needsRepresentation || selectedRepresentations[variantId];
                                                              const downloadKey = `${variantId}-${selectedDownloadTypes[variantId]}`;
                                                              const isDownloading = downloadingOutputs[downloadKey];
                                                              const status = downloadStatuses[downloadKey];
                                                              const isInProgress = status === 'DOWNLOADING' || status === 'PENDING' || status === 'IN_PROGRESS' || status === 'INPROGRESS' || status === 'PROCESSING';
                                                              const isComplete = status === 'DOWNLOADED' || status === 'SUCCESS' || status === 'success' || status === 'Success';
                                                              
                                                              // Disable if: missing requirements, currently downloading, in progress, or already downloaded (waiting for status clear)
                                                              return !hasRequiredRepr || isDownloading || isInProgress || isComplete;
                                                            })()}
                                                          >
                                                            {(() => {
                                                              const downloadKey = `${variantId}-${selectedDownloadTypes[variantId]}`;
                                                              const isDownloading = downloadingOutputs[downloadKey];
                                                              const status = downloadStatuses[downloadKey];
                                                              
                                                              if (status === 'DOWNLOADING') {
                                                                return t('downloading');
                                                              }
                                                              if (isDownloading || status === 'PENDING' || status === 'IN_PROGRESS' || status === 'INPROGRESS' || status === 'PROCESSING') {
                                                                if (status && status !== 'SUCCESS' && status !== 'success' && status !== 'Success' && status !== 'FAILURE' && status !== 'failure' && status !== 'FAILED' && status !== 'failed' && status !== 'DOWNLOADED' && status !== 'DOWNLOADING') {
                                                                  return t('generatingWithStatus', { status: translateStatus(status) });
                                                                }
                                                                return t('generating');
                                                              }
                                                              if (status === 'DOWNLOADED') {
                                                                return t('downloaded');
                                                              }
                                                              if (status === 'SUCCESS' || status === 'success' || status === 'Success') {
                                                                return isSVF ? t('view') : t('download');
                                                              }
                                                              if (status === 'FAILURE' || status === 'failure' || status === 'FAILED' || status === 'failed') {
                                                                return t('failedRetry');
                                                              }
                                                              return isSVF ? t('view') : t('download');
                                                            })()}
                                                          </button>
                                                        </div>
                                                      </>
                                                    );
                                                  })()}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                  })()}
                                </div>
                              ) : (
                                <p className="no-variants">{t('noVariantsAvailable')}</p>
                              )}
                            </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : showNoProductsMessage ? (
                  <p>{t('noProductsFound')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '16px' }}>
                    <div className="thumbnail-loading-spinner" style={{ width: '40px', height: '40px' }}></div>
                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>{t('loadingProducts')}</p>
                  </div>
                )
              ) : null}
            </div>
                )}
                </>
  );
};

export default ProductsTab;
