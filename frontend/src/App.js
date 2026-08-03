import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import './App.css';
import Viewer from './Viewer';

// Services
import * as authService from './services/authService';
import * as productService from './services/productService';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useAccountsProjects } from './hooks/useAccountsProjects';
import { useFileManagement } from './hooks/useFileManagement';
import { useProducts } from './hooks/useProducts'; // Using new grouped API
import { useFolders } from './hooks/useFolders';
import { useViewer } from './hooks/useViewer';

// Utilities
import {
  formatDate as formatDateUtil,
  translateStatus as translateStatusUtil,
  normalizeDbId,
  generateVariantName,
  sanitizeVariantName,
  extractParameterRules,
} from './utils/helpers';
import { apiRequestJson } from './utils/apiClient';

// Components
import NavigationBar from './components/NavigationBar';
import ConfiguratorApp from './configurator/ConfiguratorApp';
import { useConfiguratorMode, isStandalone } from './configurator/mode';
import TokenDialog from './components/TokenDialog';
import IdsDialog from './components/IdsDialog';
import ApsAppsDialog from './components/ApsAppsDialog';
import ElementsTree from './components/ElementsTree';
import FilesPanel from './components/FilesPanel';
import DxFilesPanel from './components/DxFilesPanel';
import ProductsTab from './components/ProductsTab';
import { useI18n } from './i18n/I18nContext';

function App() {
  // Reactive so toggling swaps the products panel in place. A reload here would
  // remount useAuth and bounce the user to the login screen.
  const configuratorMode = useConfiguratorMode();
  const embedConfigurator = configuratorMode && !isStandalone();
  const { t, language } = useI18n();

  // Wrapper functions for utilities that need language or translation context
  const formatDate = (dateString) => formatDateUtil(dateString, language);
  const translateStatus = (status) => translateStatusUtil(status, t);

  // Initialize authentication hook
  const auth = useAuth();

  // Initialize accounts/projects hook (callback will be set up later)
  const accountsProjects = useAccountsProjects(auth.isAuthenticated);

  // Extract commonly used values from hooks for convenience
  const {
    isAuthenticated,
    userProfile,
    profileError,
    loading,
    error,
    handleLogin,
    handleLogout,
    setCustomApsCredentials,
    apsAppName,
    apsClientId,
  } = auth;

  const {
    accAccounts,
    selectedAccount,
    loadingAccounts,
    accProjects,
    selectedProject,
    loadingProjects,
    projectsError,
    handleAccountChange,
    handleProjectChange: handleProjectChangeBase,
  } = accountsProjects;

  // Initialize file management hook
  const files = useFileManagement(selectedAccount);

  // Initialize folders hook
  const folders = useFolders(selectedAccount, selectedProject);

  // Initialize productState.list hook with new grouped API
  const {
    productState,
    variantState,
    formState,
    releaseState,
    validationState,
    outputState,
    thumbnailState,
    importExportState,
    selectionState,
    refs: productRefs,
    updaters: productUpdaters,
    methods: productMethods,
  } = useProducts(folders.selectedFolder);

  // Create legacy flat API for ProductsTab from the single useProducts instance
  // IMPORTANT: Don't call useProductsLegacy as it creates a separate state instance!
  const productsLegacyProps = {
    // Products (flat)
    products: productState.list,
    setProducts: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.list) : valueOrFn;
      productUpdaters.updateProductState({ list: newValue });
    },
    loadingProducts: productState.loading,
    setLoadingProducts: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.loading) : valueOrFn;
      productUpdaters.updateProductState({ loading: newValue });
    },
    showNoProductsMessage: productState.showNoMessage,
    setShowNoProductsMessage: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.showNoMessage) : valueOrFn;
      productUpdaters.updateProductState({ showNoMessage: newValue });
    },
    productsRetryCount: productState.retryCount,
    setProductsRetryCount: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.retryCount) : valueOrFn;
      productUpdaters.updateProductState({ retryCount: newValue });
    },
    productsLoadAttempted: productState.loadAttempted,
    setProductsLoadAttempted: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.loadAttempted) : valueOrFn;
      productUpdaters.updateProductState({ loadAttempted: newValue });
    },
    isRetryingProducts: productState.isRetrying,
    setIsRetryingProducts: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.isRetrying) : valueOrFn;
      productUpdaters.updateProductState({ isRetrying: newValue });
    },
    selectedProduct: productState.selected,
    setSelectedProduct: productMethods.selectProduct,
    expandedProductId: productState.expanded,
    setExpandedProductId: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(productState.expanded) : valueOrFn;
      productUpdaters.updateProductState({ expanded: newValue });
    },

    // Variants (flat)
    variants: variantState.byRelease,
    setVariants: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(variantState.byRelease) : valueOrFn;
      productUpdaters.updateVariantState({ byRelease: newValue });
    },
    loadingVariants: variantState.loadingByRelease,
    setLoadingVariants: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(variantState.loadingByRelease) : valueOrFn;
      productUpdaters.updateVariantState({ loadingByRelease: newValue });
    },
    expandedVariantId: variantState.expanded,
    setExpandedVariantId: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(variantState.expanded) : valueOrFn;
      productUpdaters.updateVariantState({ expanded: newValue });
    },
    variantDetails: variantState.details,
    setVariantDetails: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(variantState.details) : valueOrFn;
      productUpdaters.updateVariantState({ details: newValue });
    },
    loadingVariantDetails: variantState.loadingDetails,
    setLoadingVariantDetails: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(variantState.loadingDetails) : valueOrFn;
      productUpdaters.updateVariantState({ loadingDetails: newValue });
    },

    // Form (flat)
    showCreateVariantForm: formState.showByRelease,
    setShowCreateVariantForm: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(formState.showByRelease) : valueOrFn;
      productUpdaters.updateFormState({ showByRelease: newValue });
    },
    createVariantFormData: formState.dataByRelease,
    setCreateVariantFormData: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(formState.dataByRelease) : valueOrFn;
      productUpdaters.updateFormState({ dataByRelease: newValue });
    },
    creatingVariant: formState.creatingByRelease,
    setCreatingVariant: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(formState.creatingByRelease) : valueOrFn;
      productUpdaters.updateFormState({ creatingByRelease: newValue });
    },
    createVariantError: formState.errorsByRelease,
    setCreateVariantError: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(formState.errorsByRelease) : valueOrFn;
      productUpdaters.updateFormState({ errorsByRelease: newValue });
    },

    // Releases (flat)
    productReleases: releaseState.byProduct,
    setProductReleases: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.byProduct) : valueOrFn;
      productUpdaters.updateReleaseState({ byProduct: newValue });
    },
    selectedReleases: releaseState.selectedByProduct,
    setSelectedReleases: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.selectedByProduct) : valueOrFn;
      productUpdaters.updateReleaseState({ selectedByProduct: newValue });
    },
    releaseInputs: releaseState.inputs,
    setReleaseInputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.inputs) : valueOrFn;
      productUpdaters.updateReleaseState({ inputs: newValue });
    },
    releaseValidationCode: releaseState.validationCode,
    setReleaseValidationCode: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.validationCode) : valueOrFn;
      productUpdaters.updateReleaseState({ validationCode: newValue });
    },
    releaseRulesKey: releaseState.rulesKey,
    setReleaseRulesKey: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.rulesKey) : valueOrFn;
      productUpdaters.updateReleaseState({ rulesKey: newValue });
    },
    loadingRules: releaseState.loadingRules,
    setLoadingRules: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.loadingRules) : valueOrFn;
      productUpdaters.updateReleaseState({ loadingRules: newValue });
    },
    loadingInputs: releaseState.loadingInputs,
    setLoadingInputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.loadingInputs) : valueOrFn;
      productUpdaters.updateReleaseState({ loadingInputs: newValue });
    },
    releaseDataCache: releaseState.dataCache,
    setReleaseDataCache: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.dataCache) : valueOrFn;
      productUpdaters.updateReleaseState({ dataCache: newValue });
    },
    releaseCategories: releaseState.categories,
    setReleaseCategories: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.categories) : valueOrFn;
      productUpdaters.updateReleaseState({ categories: newValue });
    },
    loadingReleaseCategories: releaseState.loadingCategories,
    setLoadingReleaseCategories: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(releaseState.loadingCategories) : valueOrFn;
      productUpdaters.updateReleaseState({ loadingCategories: newValue });
    },

    // Validation (flat)
    fieldValidationErrors: validationState.fieldErrors,
    setFieldValidationErrors: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(validationState.fieldErrors) : valueOrFn;
      productUpdaters.updateValidationState({ fieldErrors: newValue });
    },
    dismissedErrors: validationState.dismissedErrors,
    setDismissedErrors: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(validationState.dismissedErrors) : valueOrFn;
      productUpdaters.updateValidationState({ dismissedErrors: newValue });
    },
    pendingCorrections: validationState.pendingCorrections,
    setPendingCorrections: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(validationState.pendingCorrections) : valueOrFn;
      productUpdaters.updateValidationState({ pendingCorrections: newValue });
    },
    validatingInputs: validationState.validatingInputs,
    setValidatingInputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(validationState.validatingInputs) : valueOrFn;
      productUpdaters.updateValidationState({ validatingInputs: newValue });
    },

    // Outputs (flat)
    variantOutputs: outputState.byVariant,
    setVariantOutputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.byVariant) : valueOrFn;
      productUpdaters.updateOutputState({ byVariant: newValue });
    },
    loadingVariantOutputs: outputState.loadingByVariant,
    setLoadingVariantOutputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.loadingByVariant) : valueOrFn;
      productUpdaters.updateOutputState({ loadingByVariant: newValue });
    },
    outputDownloads: outputState.downloads,
    setOutputDownloads: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.downloads) : valueOrFn;
      productUpdaters.updateOutputState({ downloads: newValue });
    },
    loadingOutputDownloads: outputState.loadingDownloads,
    setLoadingOutputDownloads: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.loadingDownloads) : valueOrFn;
      productUpdaters.updateOutputState({ loadingDownloads: newValue });
    },
    outputStatuses: outputState.statuses,
    setOutputStatuses: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.statuses) : valueOrFn;
      productUpdaters.updateOutputState({ statuses: newValue });
    },
    outputErrors: outputState.errors,
    setOutputErrors: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.errors) : valueOrFn;
      productUpdaters.updateOutputState({ errors: newValue });
    },
    selectedDownloadTypes: outputState.selectedDownloadTypes,
    setSelectedDownloadTypes: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.selectedDownloadTypes) : valueOrFn;
      productUpdaters.updateOutputState({ selectedDownloadTypes: newValue });
    },
    selectedRepresentations: outputState.selectedRepresentations,
    setSelectedRepresentations: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.selectedRepresentations) : valueOrFn;
      productUpdaters.updateOutputState({ selectedRepresentations: newValue });
    },
    downloadingOutputs: outputState.downloadingByKey,
    setDownloadingOutputs: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.downloadingByKey) : valueOrFn;
      productUpdaters.updateOutputState({ downloadingByKey: newValue });
    },
    downloadStatuses: outputState.downloadStatuses,
    setDownloadStatuses: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.downloadStatuses) : valueOrFn;
      productUpdaters.updateOutputState({ downloadStatuses: newValue });
    },
    showOutputGenerationPanel: outputState.showGenerationPanel,
    setShowOutputGenerationPanel: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.showGenerationPanel) : valueOrFn;
      productUpdaters.updateOutputState({ showGenerationPanel: newValue });
    },
    selectedOutputTypes: outputState.selectedOutputTypes,
    setSelectedOutputTypes: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.selectedOutputTypes) : valueOrFn;
      productUpdaters.updateOutputState({ selectedOutputTypes: newValue });
    },
    outputGenerationProgress: outputState.generationProgress,
    setOutputGenerationProgress: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(outputState.generationProgress) : valueOrFn;
      productUpdaters.updateOutputState({ generationProgress: newValue });
    },

    // Thumbnails (flat)
    productThumbnails: thumbnailState.products,
    setProductThumbnails: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(thumbnailState.products) : valueOrFn;
      productUpdaters.updateThumbnailState({ products: newValue });
    },
    variantThumbnails: thumbnailState.variants,
    setVariantThumbnails: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(thumbnailState.variants) : valueOrFn;
      productUpdaters.updateThumbnailState({ variants: newValue });
    },
    loadingVariantThumbnails: thumbnailState.loadingVariants,
    setLoadingVariantThumbnails: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(thumbnailState.loadingVariants) : valueOrFn;
      productUpdaters.updateThumbnailState({ loadingVariants: newValue });
    },
    productGlbPreviews: thumbnailState.glbPreviews,
    setProductGlbPreviews: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(thumbnailState.glbPreviews) : valueOrFn;
      productUpdaters.updateThumbnailState({ glbPreviews: newValue });
    },
    loadingProductGlbPreviews: thumbnailState.loadingGlbPreviews,
    setLoadingProductGlbPreviews: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(thumbnailState.loadingGlbPreviews) : valueOrFn;
      productUpdaters.updateThumbnailState({ loadingGlbPreviews: newValue });
    },

    // Import/Export (flat)
    importProgress: importExportState.importProgress,
    setImportProgress: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(importExportState.importProgress) : valueOrFn;
      productUpdaters.updateImportExportState({ importProgress: newValue });
    },
    showImportDialog: importExportState.showImportDialog,
    setShowImportDialog: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(importExportState.showImportDialog) : valueOrFn;
      productUpdaters.updateImportExportState({ showImportDialog: newValue });
    },
    dragOverReleaseId: importExportState.dragOverReleaseId,
    setDragOverReleaseId: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(importExportState.dragOverReleaseId) : valueOrFn;
      productUpdaters.updateImportExportState({ dragOverReleaseId: newValue });
    },

    // Selection (flat)
    selectedCategories: selectionState.categories,
    setSelectedCategories: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(selectionState.categories) : valueOrFn;
      productUpdaters.updateSelectionState({ categories: newValue });
    },
    selectedProducts: selectionState.products,
    setSelectedProducts: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(selectionState.products) : valueOrFn;
      productUpdaters.updateSelectionState({ products: newValue });
    },
    expandedCategories: selectionState.expandedCategories,
    setExpandedCategories: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(selectionState.expandedCategories) : valueOrFn;
      productUpdaters.updateSelectionState({ expandedCategories: newValue });
    },
    expandedProducts: selectionState.expandedProducts,
    setExpandedProducts: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(selectionState.expandedProducts) : valueOrFn;
      productUpdaters.updateSelectionState({ expandedProducts: newValue });
    },
    expandedElements: selectionState.expandedElements,
    setExpandedElements: (valueOrFn) => {
      const newValue = typeof valueOrFn === 'function' ? valueOrFn(selectionState.expandedElements) : valueOrFn;
      productUpdaters.updateSelectionState({ expandedElements: newValue });
    },

    // Refs (flat)
    noProductsTimeoutRef: productRefs.noProductsTimeout,
    fetchProductsInProgressRef: productRefs.fetchProductsInProgress,
    isRetryingProductsRef: productRefs.isRetryingProducts,

    // Methods (flat)
    clearProducts: productMethods.clearProducts,
    handleProductSelect: productMethods.selectProduct,
    handleProductExpand: productMethods.toggleProductExpansion,
    handleVariantExpand: productMethods.toggleVariantExpansion,
    toggleCreateVariantForm: productMethods.toggleCreateVariantForm,
    updateVariantFormData: productMethods.updateVariantFormData,
    toggleOutputGenerationPanel: productMethods.toggleOutputGenerationPanel,
  };

  // Initialize viewer hook
  const viewer = useViewer();

  // Destructure from file management hook
  const {
    fileTree,
    selectedFile,
    expandedFiles,
    loadingFiles,
    fileDetails,
    loadingFileDetails,
    fileThumbnail,
    loadingFileThumbnail,
    setFileTree,
    setSelectedFile,
    setExpandedFiles,
    setFileDetails,
    setLoadingFileDetails,
    setFileThumbnail,
    setLoadingFileThumbnail,
    dxFileTree,
    selectedDxFile,
    expandedDxFiles,
    loadingDxFiles,
    dxFileDetails,
    loadingDxFileDetails,
    dxFileThumbnail,
    loadingDxFileThumbnail,
    setDxFileTree,
    setSelectedDxFile,
    setExpandedDxFiles,
    setDxFileDetails,
    setLoadingDxFileDetails,
    setDxFileThumbnail,
    setLoadingDxFileThumbnail,
    fetchFiles,
    fetchDxFiles,
  } = files;

  // Destructure from folders hook
  const {
    folderTree,
    selectedFolder,
    expandedFolders,
    loadingFolders,
    setFolderTree,
    setSelectedFolder,
    setExpandedFolders,
    handleFolderSelect,
    toggleFolder,
  } = folders;

  // Folders that have Informed Design productState.list (for filtering the folder list)
  const [foldersWithProductsIds, setFoldersWithProductsIds] = useState(null);
  const [loadingFoldersWithProducts, setLoadingFoldersWithProducts] = useState(false);

  // Products hook now uses grouped state - access via productState, variantState, etc.
  // Example: productState.list, productState.loading, variantState.byRelease
  // Updates via: productUpdaters.updateProductState({ loading: true })

  // Abort ref for "Generate outputs" so Cancel can stop the loop
  const outputGenerationAbortRef = useRef(false);
  // Abort thumbnail generation when switching productState.list so we don't fire 400s for previous product's variantState.byRelease
  const thumbnailAbortControllerRef = useRef(null);
  // Ignore selection-change callbacks that would overwrite panel state after we programmatically select (avoids unchecking)
  const isProgrammaticSelectionRef = useRef(false);
  const lastProgrammaticDbIdsRef = useRef(null);
  const programmaticSelectionTimeoutRef = useRef(null);

  // Destructure from viewer hook
  const {
    showViewer,
    setShowViewer,
    viewerUrl,
    setViewerUrl,
    viewerToken,
    setViewerToken,
    viewerVariantData,
    setViewerVariantData,
    loadingSvfUrl,
    setLoadingSvfUrl,
    showRvtViewer,
    setShowRvtViewer,
    rvtViewerUrl,
    setRvtViewerUrl,
    rvtViewerIsUrn,
    setRvtViewerIsUrn,
    rvtViewerToken,
    setRvtViewerToken,
    rvtViewerInstance,
    setRvtViewerInstance,
    rvtModel,
    setRvtModel,
    showDxViewer,
    setShowDxViewer,
    dxViewerUrl,
    setDxViewerUrl,
    dxViewerIsUrn,
    setDxViewerIsUrn,
    dxViewerToken,
    setDxViewerToken,
    dxViewerInstance,
    setDxViewerInstance,
    dxModel,
    setDxModel,
    loadingDxSvfUrl,
    setLoadingDxSvfUrl,
    availableViews,
    setAvailableViews,
    selectedViewGuid,
    setSelectedViewGuid,
    loadingViews,
    setLoadingViews,
    midElements,
    setMidElements,
    loadingMidElements,
    setLoadingMidElements,
    selectedElements,
    setSelectedElements,
    highlightingElements,
    setHighlightingElements,
  } = viewer;

  // Other state (not in hooks yet)
  const [activeTab, setActiveTab] = useState('products');
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [, setTokenCopied] = useState(false);
  const [showIdsDialog, setShowIdsDialog] = useState(false);
  const [showApsAppsDialog, setShowApsAppsDialog] = useState(false);

  // Wrapper for handleProjectChange that clears additional state
  const handleProjectChange = useCallback(async (projectId) => {
    setFolderTree(null);
    setSelectedFolder(null);
    setExpandedFolders(new Set());
    productUpdaters.updateProductState({ list: [] });
    productMethods.selectProduct(null);
    productUpdaters.updateProductState({ expanded: null });
    setFileTree(null);
    setSelectedFile(null);
    setExpandedFiles(new Set());
    setSelectedElements(new Set()); // Clear element selection when changing projects

    await handleProjectChangeBase(projectId);
  }, [handleProjectChangeBase, setFolderTree, setSelectedFolder, setExpandedFolders, productUpdaters.updateProductState, productMethods.selectProduct, setFileTree, setSelectedFile, setExpandedFiles, setSelectedElements]);

  // Wrapper for handleFolderSelect that clears element selection
  const handleFolderSelectWrapper = useCallback((folderId) => {
    setSelectedElements(new Set()); // Clear element selection when changing folders
    handleFolderSelect(folderId);
  }, [handleFolderSelect, setSelectedElements]);

  // Reset folders-with-productState.list when folder tree or project changes (will recompute in next effect)
  useEffect(() => {
    setFoldersWithProductsIds(null);
  }, [folderTree, selectedProject]);

  // Compute which folders have Informed Design productState.list (for filtering the folder list)
  useEffect(() => {
    if (!folderTree || !selectedProject || !selectedAccount) {
      setLoadingFoldersWithProducts(false);
      return;
    }
    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) {
      setLoadingFoldersWithProducts(false);
      return;
    }
    const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;

    const collectFolderIds = (folder) => {
      if (!folder) return [];
      const ids = [folder.id].filter(Boolean);
      if (folder.children && folder.children.length > 0) {
        folder.children.forEach(child => {
          ids.push(...collectFolderIds(child));
        });
      }
      return ids;
    };

    let cancelled = false;
    setLoadingFoldersWithProducts(true);
    const folderIds = collectFolderIds(folderTree);
    if (folderIds.length === 0) {
      setFoldersWithProductsIds(new Set());
      setLoadingFoldersWithProducts(false);
      return;
    }
    // Process folders in batches to avoid ERR_INSUFFICIENT_RESOURCES (too many concurrent requests)
    const FOLDER_BATCH_SIZE = 5;
    const runFolderBatches = async () => {
      const idsWithProducts = new Set();
      for (let i = 0; i < folderIds.length; i += FOLDER_BATCH_SIZE) {
        if (cancelled) return;
        const batch = folderIds.slice(i, i + FOLDER_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(folderId =>
            productService.folderHasProducts(accessToken, cleanProjectId, folderId).then(hasProducts => ({ folderId, hasProducts }))
          )
        );
        results
          .filter(r => r.status === 'fulfilled' && r.value?.hasProducts)
          .forEach(r => { if (r.value?.folderId) idsWithProducts.add(r.value.folderId); });
      }
      if (!cancelled) {
        setFoldersWithProductsIds(idsWithProducts);
        setLoadingFoldersWithProducts(false);
      }
    };
    runFolderBatches().catch(() => {
      if (!cancelled) {
        setFoldersWithProductsIds(new Set());
        setLoadingFoldersWithProducts(false);
      }
    });
    return () => { cancelled = true; };
  }, [folderTree, selectedProject, selectedAccount]);

  // Fetch productState.list when folder is selected (user clicks folder in tree)
  useEffect(() => {
    if (selectedFolder && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        productUpdaters.updateProductState(prev => ({
          ...prev,
          loading: true,
          isRetrying: false,
          showNoMessage: false,
          loadAttempted: false,
          retryCount: 0
        }));
        fetchProducts(accessToken, selectedProject, selectedFolder).catch((err) => {
          console.error('[App] Error fetching productState.list:', err);
          productUpdaters.updateProductState(prev => ({
            ...prev,
            list: [],
            loadAttempted: true,
            loading: false,
            isRetrying: false,
            retryCount: 0
          }));
          productRefs.fetchProductsInProgress.current = false;
        });
      }
    } else if (!selectedFolder) {
      productUpdaters.updateProductState(prev => ({
        ...prev,
        list: [],
        loading: false,
        showNoMessage: false
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, selectedProject, selectedAccount]);

  const fetchProducts = async (accessToken, projectId, folderId, retryCount = 0) => {
    // Validate that folderId is not null, undefined, or the string "null"
    if (!projectId || !folderId || folderId === 'null' || folderId === null || folderId === undefined) {
      productUpdaters.updateProductState(prev => ({
        ...prev,
        list: [],
        loading: false
      }));
      productRefs.fetchProductsInProgress.current = false;
      return;
    }

    // Prevent concurrent calls (except retries)
    if (retryCount === 0 && productRefs.fetchProductsInProgress.current) {
      return;
    }

    // Always set selectedFolder when fetching productState.list to ensure it's in sync
    setSelectedFolder(folderId);

    try {
      // Set loading state - ensure it stays true during retries
      // Always set productState.loading to true at the start of each attempt (including retries)
      if (retryCount === 0) {
        productRefs.fetchProductsInProgress.current = true;
        productRefs.isRetryingProducts.current = false;
        // Clear any existing timeout
        if (productRefs.noProductsTimeout.current) {
          clearTimeout(productRefs.noProductsTimeout.current);
          productRefs.noProductsTimeout.current = null;
        }
        productUpdaters.updateProductState(prev => ({
          ...prev,
          loading: true,
          loadAttempted: false,
          showNoMessage: false,
          retryCount: 0,
          isRetrying: false
        }));
      } else {
        // On retries, update retry count for progress indication
        productRefs.isRetryingProducts.current = true;
        productUpdaters.updateProductState(prev => ({
          ...prev,
          loading: true,
          retryCount: retryCount,
          isRetrying: true
        }));
      }
      
      const FETCH_PRODUCTS_TIMEOUT_MS = 45000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PRODUCTS_REQUEST_TIMEOUT')), FETCH_PRODUCTS_TIMEOUT_MS);
      });
      const productsData = await Promise.race([
        productService.fetchProducts(accessToken, projectId, folderId),
        timeoutPromise
      ]);

      // Extract products from the response
      let productsList = [];
      if (Array.isArray(productsData)) {
        productsList = productsData;
      } else if (productsData.results && Array.isArray(productsData.results)) {
        productsList = productsData.results;
      } else if (productsData.data && Array.isArray(productsData.data)) {
        productsList = productsData.data;
      } else if (productsData.products && Array.isArray(productsData.products)) {
        productsList = productsData.products;
      } else if (productsData.items && Array.isArray(productsData.items)) {
        productsList = productsData.items;
      } else if (typeof productsData === 'object' && productsData !== null) {
        // If it's an object, try to find any array property
        for (const key in productsData) {
          if (Array.isArray(productsData[key])) {
            productsList = productsData[key];
            break;
          }
        }
      }

            // Fetch all releases for each product and set default release
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const PROCESSING_TIMEOUT_MS = 60000;
      const processingTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PRODUCTS_REQUEST_TIMEOUT')), PROCESSING_TIMEOUT_MS);
      });
      const productsWithReleases = await Promise.race([
        Promise.all(
              productsList.map(async (product) => {
                try {
                  const productId = product.id || product.productId;
                  if (!productId) return { ...product, defaultRelease: null, releases: [] };
                  
                  // Create accessId same way as backend (needed for fetching individual product and releases)
                  const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
                  const accessId = `${cleanProjectId}|${folderId}`;
                  
                  // Fetch the full product details to get defaultRelease
                  // The list endpoint may not include defaultRelease, so we need to fetch individual product
                  let fullProduct = product;
                  let defaultReleaseId = null;
                  
                  try {
                    const productDetailResponse = await fetch(
                      `${backendUrl}/api/informed-design/products/${encodeURIComponent(productId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
                      {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                        },
                      }
                    );
                    
                    if (productDetailResponse.ok) {
                      const productDetailData = await productDetailResponse.json();
                      fullProduct = productDetailData;
                    }
                  } catch (err) {
                    // If fetching individual product fails, continue with the product from the list
                  }
                  
                  // Extract defaultRelease from the full product object
                  if (fullProduct.defaultRelease) {
                    if (typeof fullProduct.defaultRelease === 'object') {
                      // It's an object - extract the ID or number
                      defaultReleaseId = fullProduct.defaultRelease.id || 
                                         fullProduct.defaultRelease.releaseId || 
                                         fullProduct.defaultRelease.number ||
                                         fullProduct.defaultRelease.releaseNumber;
                    } else {
                      // It's a primitive value (string or number)
                      defaultReleaseId = fullProduct.defaultRelease;
                    }
                  }
                  
                  // Fallback to other fields
                  if (!defaultReleaseId) {
                    defaultReleaseId = fullProduct.defaultReleaseId || 
                                       fullProduct.default_release_id || 
                                       fullProduct.default_release;
                  }
                  
                  // Fetch all releases for this product
                  let allReleases = [];
                  let defaultRelease = null;
                  
                  // Fetch all releases for the product
                  const releasesResponse = await fetch(
                    `${backendUrl}/api/informed-design/releases?productId=${encodeURIComponent(productId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                      },
                    }
                  );
                  
                  if (releasesResponse.ok) {
                    const releasesData = await releasesResponse.json();
                    // Extract releases array from response - releases are in the "results" array
                    if (releasesData.results && Array.isArray(releasesData.results)) {
                      allReleases = releasesData.results;
                    } else if (Array.isArray(releasesData)) {
                      allReleases = releasesData;
                    } else if (releasesData.data && Array.isArray(releasesData.data)) {
                      allReleases = releasesData.data;
                    } else if (releasesData.releases && Array.isArray(releasesData.releases)) {
                      allReleases = releasesData.releases;
                    } else if (releasesData.items && Array.isArray(releasesData.items)) {
                      allReleases = releasesData.items;
                    }
                    
                    // Sort releases by number if available
                    allReleases.sort((a, b) => {
                      const numA = a.number || a.releaseNumber || a.release_number || 0;
                      const numB = b.number || b.releaseNumber || b.release_number || 0;
                      return numA - numB;
                    });
                    
                    // Find the default release from the list
                    // Since the product object doesn't have defaultRelease info, we need to identify it from the releases
                    
                    // Strategy 1: Look for a release with isDefault: true or default: true
                    defaultRelease = allReleases.find(r => r.isDefault === true || r.default === true) || null;
                    
                    // Strategy 2: If we have a defaultReleaseId from product, try to match it
                    if (!defaultRelease && defaultReleaseId && allReleases.length > 0) {
                      // Direct ID match
                      defaultRelease = allReleases.find(r => {
                        const rId = r.id || r.releaseId;
                        return String(rId) === String(defaultReleaseId);
                      }) || null;
                      
                      // Match with "b." prefix variations
                      if (!defaultRelease) {
                        defaultRelease = allReleases.find(r => {
                          const rId = r.id || r.releaseId;
                          const normalizedRId = String(rId).startsWith('b.') ? String(rId).substring(2) : String(rId);
                          const normalizedDefaultId = String(defaultReleaseId).startsWith('b.') ? String(defaultReleaseId).substring(2) : String(defaultReleaseId);
                          return normalizedRId === normalizedDefaultId;
                      }) || null;
                      }
                      
                      // Match by release number if defaultReleaseId is a number
                      if (!defaultRelease) {
                        const defaultReleaseNumber = !isNaN(defaultReleaseId) ? parseInt(defaultReleaseId, 10) : null;
                        if (defaultReleaseNumber !== null) {
                          defaultRelease = allReleases.find(r => {
                            const rNumber = r.number || r.releaseNumber || r.release_number;
                            return rNumber === defaultReleaseNumber;
                          }) || null;
                        }
                      }
                    }
                    
                    
                    // Strategy 4: Match by comparing with product.defaultRelease object directly (if it exists)
                    if (!defaultRelease && product.defaultRelease && typeof product.defaultRelease === 'object') {
                      defaultRelease = allReleases.find(r => {
                        const rId = r.id || r.releaseId;
                        const rNumber = r.number || r.releaseNumber || r.release_number;
                        return (
                          (product.defaultRelease.id && String(product.defaultRelease.id) === String(rId)) ||
                          (product.defaultRelease.releaseId && String(product.defaultRelease.releaseId) === String(rId)) ||
                          (product.defaultRelease.number && product.defaultRelease.number === rNumber) ||
                          (product.defaultRelease.releaseNumber && product.defaultRelease.releaseNumber === rNumber)
                        );
                      }) || null;
                    }
                    
                    
                    // If still no default release found and we have releases, use the first one
                    if (!defaultRelease && allReleases.length > 0) {
                      defaultRelease = allReleases[0];
                    }
                  }
                  
                  // If we still don't have releases, try to fetch just the default release as fallback
                  if (allReleases.length === 0 && defaultReleaseId) {
                    const releaseResponse = await fetch(
                      `${backendUrl}/api/informed-design/releases/${encodeURIComponent(defaultReleaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
                      {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                        },
                      }
                    );
                    
                    if (releaseResponse.ok) {
                      const releaseData = await releaseResponse.json();
                      
                      // Extract the release from the response
                      if (Array.isArray(releaseData)) {
                        defaultRelease = releaseData[0] || null;
                      } else if (releaseData.data) {
                        defaultRelease = Array.isArray(releaseData.data) ? releaseData.data[0] : releaseData.data;
                      } else if (releaseData.id) {
                        defaultRelease = releaseData;
                      }
                      
                      if (defaultRelease) {
                        allReleases = [defaultRelease];
                      }
                    }
                  }
                  
                  // Store releases for this product
                  const productKey = productId;
                  productUpdaters.updateReleaseState(prev => ({
                    ...prev,
                    byProduct: { ...prev.byProduct, [productKey]: allReleases }
                  }));

                  // Set default release as selected if available
                  // CRITICAL: Use the found defaultRelease's ID, not the original product.defaultRelease
                  if (defaultRelease) {
                    const releaseId = defaultRelease.id || defaultRelease.releaseId;
                    if (releaseId) {
                    productUpdaters.updateReleaseState(prev => ({
                      ...prev,
                      selectedByProduct: { ...prev.selectedByProduct, [productKey]: releaseId }
                    }));
                    }
                  } else if (product.defaultRelease && typeof product.defaultRelease === 'object') {
                    // If we didn't find a match but product.defaultRelease is an object, try to use it directly
                    const releaseId = product.defaultRelease.id || product.defaultRelease.releaseId;
                    if (releaseId) {
                      // Try to find this release in the fetched releases
                      const matchedRelease = allReleases.find(r => {
                        const rId = r.id || r.releaseId;
                        return String(rId) === String(releaseId);
                      });
                      if (matchedRelease) {
                        defaultRelease = matchedRelease;
                        productUpdaters.updateReleaseState(prev => ({
                      ...prev,
                      selectedByProduct: { ...prev.selectedByProduct, [productKey]: releaseId }
                    }));
                      }
                    }
                  }
                  
                  // Store the found default release ID for use in dropdown
                  const foundDefaultReleaseId = defaultRelease ? (defaultRelease.id || defaultRelease.releaseId) : null;
                  
                  return { ...product, defaultRelease, releases: allReleases, foundDefaultReleaseId };
                } catch (err) {
                  return { ...product, defaultRelease: null, releases: [] };
                }
              })
            ),
        processingTimeoutPromise
      ]);

      // Set both states together - React will batch these and trigger one re-render
      // IMPORTANT: Set selectedFolder first, then productState.list, so selectedFolder is available when productState.list render
      setSelectedFolder(folderId);


      // If we have productState.list, update productState.list and we're done
      if (productsWithReleases.length > 0) {
        productUpdaters.updateProductState(prev => ({
          ...prev,
          list: productsWithReleases,
          loadAttempted: true,
          loading: false,
          showNoMessage: false,
          retryCount: 0,
          isRetrying: false
        }));
        productRefs.fetchProductsInProgress.current = false;
        productRefs.isRetryingProducts.current = false;
        // Clear timeout if productState.list are found
        if (productRefs.noProductsTimeout.current) {
          clearTimeout(productRefs.noProductsTimeout.current);
          productRefs.noProductsTimeout.current = null;
        }
        // Continue to thumbnail generation below
      } else {
        // No productState.list found - retry with exponential backoff (up to 15 retries, ~60 seconds total)
        // IMPORTANT: Keep productState.loading true and productsLoadAttempted false while retrying
        // DON'T update productState.list array - keep previous state (if any) or empty
        const maxRetries = 15;
        const baseDelay = 2000; // Start with 2 seconds
        const maxDelay = 5000; // Max 5 seconds between retries
        
        if (retryCount < maxRetries) {
          // Calculate delay with exponential backoff, capped at maxDelay
          const delay = Math.min(baseDelay * Math.pow(1.3, retryCount), maxDelay);
          
          // Update retry count for progress indication
          // CRITICAL: Explicitly keep productState.loading true and productsLoadAttempted false while retrying
          productRefs.isRetryingProducts.current = true;
          productUpdaters.updateProductState(prev => ({
            ...prev,
            isRetrying: true,
            retryCount: retryCount + 1,
            loading: true,
            loadAttempted: false
          }));
          
          // Retry after delay - keep loading state active
          setTimeout(() => {
            // Ensure loading state is still true before retrying
            if (productRefs.isRetryingProducts.current) {
              productUpdaters.updateProductState(prev => ({
                ...prev,
                loading: true,
                isRetrying: true
              }));
            }
            fetchProducts(accessToken, projectId, folderId, retryCount + 1);
          }, delay);
          // Return early to prevent executing thumbnail generation code
          return;
        } else {
          // Max retries reached - update productState.list to empty and show "no productState.list found"
          productUpdaters.updateProductState(prev => ({
            ...prev,
            list: [],
            loadAttempted: true,
            loading: false,
            retryCount: 0,
            isRetrying: false
          }));
          productRefs.fetchProductsInProgress.current = false;
          productRefs.isRetryingProducts.current = false;
          productRefs.noProductsTimeout.current = setTimeout(() => {
            productUpdaters.updateProductState({ showNoMessage: true });
            productRefs.noProductsTimeout.current = null;
          }, 2000);
          // Return early to prevent executing thumbnail generation code
          return;
        }
      }
      
      // Generate thumbnails for ALL productState.list when they're displayed (not just selected ones)
      // This gets thumbnails from the release's thumbnails array (OSS bucket key)
      // Use folderId parameter (same as when fetching productState.list)
      // Only generate if we have valid projectId and folderId is set
      if (projectId && folderId && folderId !== 'null' && folderId !== null && folderId !== undefined) {
        // This processes all productState.list in the list and fetches thumbnails for each one
        generateProductThumbnails(productsWithReleases, projectId, folderId).catch((err) => {
          // Silently fail - thumbnails are optional
        });
        
        // Generate variant thumbnails for ALL productState.list and ALL variantState.byRelease in the background
        // This ensures all thumbnails are cached even if productState.list aren't expanded
        // fetchVariants already calls generateVariantThumbnails, so we just need to call it for all productState.list
        productsWithReleases.forEach((product) => {
          if (product.defaultRelease) {
            const releaseId = product.defaultRelease.id || product.defaultRelease.releaseId || product.defaultRelease;
            if (releaseId) {
              // Fetch variantState.byRelease and generate thumbnails in the background
              // fetchVariants will automatically call generateVariantThumbnails after fetching
              fetchVariants(releaseId, product).catch(() => {
                // Silently fail - variant fetching is optional
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('[App] Error fetching productState.list:', err);

      const isTimeout = err?.message === 'PRODUCTS_REQUEST_TIMEOUT';
      if (isTimeout) {
        productUpdaters.updateProductState(prev => ({
          ...prev,
          list: [],
          loadAttempted: true,
          loading: false,
          retryCount: 0,
          isRetrying: false
        }));
        productRefs.fetchProductsInProgress.current = false;
        productRefs.isRetryingProducts.current = false;
        productRefs.noProductsTimeout.current = setTimeout(() => {
          productUpdaters.updateProductState({ showNoMessage: true });
          productRefs.noProductsTimeout.current = null;
        }, 500);
        return;
      }

      // Retry on error (up to 15 retries)
      // IMPORTANT: Keep productState.loading true and productsLoadAttempted false while retrying
      const maxRetries = 15;
      const baseDelay = 2000;
      const maxDelay = 5000;

      if (retryCount < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(1.3, retryCount), maxDelay);
        // Update retry count for progress indication
        // CRITICAL: Explicitly keep productState.loading true and productsLoadAttempted false while retrying
        productRefs.isRetryingProducts.current = true;
        productUpdaters.updateProductState(prev => ({
          ...prev,
          isRetrying: true,
          retryCount: retryCount + 1,
          loading: true,
          loadAttempted: false
        }));
        setTimeout(() => {
          // Ensure loading state is still true before retrying
          if (productRefs.isRetryingProducts.current) {
            productUpdaters.updateProductState(prev => ({
              ...prev,
              loading: true,
              isRetrying: true
            }));
          }
          fetchProducts(accessToken, projectId, folderId, retryCount + 1);
        }, delay);
      } else {
        // Max retries reached - show error
        productUpdaters.updateProductState(prev => ({
          ...prev,
          list: [],
          loadAttempted: true,
          loading: false,
          retryCount: 0,
          isRetrying: false
        }));
        productRefs.fetchProductsInProgress.current = false;
        productRefs.isRetryingProducts.current = false;
        productRefs.noProductsTimeout.current = setTimeout(() => {
          productUpdaters.updateProductState({ showNoMessage: true });
          productRefs.noProductsTimeout.current = null;
        }, 2000);
      }
    }
  };

  const generateProductThumbnails = async (productsList, projectId, folderUrn) => {
    if (!productsList || productsList.length === 0) {
      return;
    }
    
    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) {
      return;
    }
    
    // Use the folderUrn parameter passed to the function (this is the selectedFolder from fetchProducts)
    // Don't rely on state as it may not be updated yet
    const folderUrnToUse = folderUrn;
    
    // Validate folderUrn - it should not be null, undefined, or the string "null"
    if (!projectId || !folderUrnToUse || folderUrnToUse === 'null' || folderUrnToUse === null || folderUrnToUse === undefined) {
      return;
    }
    
    // Create accessId same way as other functions - projectId|folderUrn
    const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
    const accessId = `${cleanProjectId}|${folderUrnToUse}`;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    
    // Process each product in the list - this runs for ALL productState.list, not just selected ones
    // Each product card will get its thumbnail from the release's thumbnails array
    for (const product of productsList) {
      let productId = product.id || product.productId;
      if (!productId) {
        continue;
      }
      
      // Normalize product ID (remove "b." prefix if present) for consistent matching
      productId = String(productId).startsWith('b.') ? String(productId).substring(2) : String(productId);
      
      try {
        // Get the release to use - prefer selected release, fallback to default release
        let releaseToUse = product.defaultRelease;
        
        // Check if there's a selected release for this product
        const normalizedProductIdForState = product.id || product.productId;
        const selectedReleaseId = releaseState.selectedByProduct[normalizedProductIdForState];
        if (selectedReleaseId) {
          const productReleasesList = releaseState.byProduct[normalizedProductIdForState] || product.releases || [];
          const selectedRelease = productReleasesList.find(r => {
            const rId = r.id || r.releaseId;
            return String(rId) === String(selectedReleaseId);
          });
          if (selectedRelease) {
            releaseToUse = selectedRelease;
          }
        }
        
        if (!releaseToUse) {
          continue;
        }
        
        const releaseId = releaseToUse.id || releaseToUse.releaseId;
        if (!releaseId) {
          continue;
        }
        
        // Download thumbnail from product using backend endpoint
        // This uses the product download-url endpoint to get the thumbnail
        const thumbnailUrl = `${backendUrl}/api/informed-design/products/${encodeURIComponent(productId)}/thumbnail?accessId=${encodeURIComponent(accessId)}&accessType=ACC`;
        const thumbnailResponse = await fetch(thumbnailUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (thumbnailResponse.ok) {
          const blob = await thumbnailResponse.blob();
          
          // Verify the blob is valid
          if (blob && blob.size > 0) {
              const blobUrl = URL.createObjectURL(blob);
              
              // Verify the image loads
              await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  productUpdaters.updateThumbnailState(prev => ({
                    ...prev,
                    products: { ...prev.products, [productId]: blobUrl }
                  }));
                  resolve();
                };
                img.onerror = () => {
                  URL.revokeObjectURL(blobUrl);
                  reject(new Error('Image failed to load'));
                };
                img.src = blobUrl;
              }).catch(() => {
                // Silently fail - thumbnail verification failed
              });
            }
        }
      } catch (error) {
        // Silently fail - thumbnails are optional
      }
    }
    
  };

  // eslint-disable-next-line no-unused-vars
  const generateProductGlbPreviews = async (productsList, projectId, folderUrn) => {
    
    if (!productsList || productsList.length === 0) {
      return;
    }
    
    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) {
      return;
    }
    
    // Use selectedFolder from state directly
    const folderUrnToUse = selectedFolder || folderUrn;
    
    // Validate folderUrn
    if (!projectId || !folderUrnToUse || folderUrnToUse === 'null' || folderUrnToUse === null || folderUrnToUse === undefined) {
      return;
    }
    
    // Create accessId same way as other functions - projectId|folderUrn
    const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
    const accessId = `${cleanProjectId}|${folderUrnToUse}`;
    
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
    
    // Process each product synchronously
    for (const product of productsList) {
      let productId = product.id || product.productId;
      if (!productId) continue;
      
      // Normalize product ID (remove "b." prefix if present) for consistent matching
      productId = String(productId).startsWith('b.') ? String(productId).substring(2) : String(productId);
      
      // Set loading state
      productUpdaters.updateThumbnailState(prev => ({
        ...prev,
        loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: true }
      }));
      
      try {
        // Get the release to use - prefer selected release, fallback to default release
        let releaseToUse = product.defaultRelease;
        
        // Check if there's a selected release for this product
        const normalizedProductIdForState = product.id || product.productId;
        const selectedReleaseId = releaseState.selectedByProduct[normalizedProductIdForState];
        if (selectedReleaseId) {
          const productReleasesList = releaseState.byProduct[normalizedProductIdForState] || product.releases || [];
          const selectedRelease = productReleasesList.find(r => {
            const rId = r.id || r.releaseId;
            return String(rId) === String(selectedReleaseId);
          });
          if (selectedRelease) {
            releaseToUse = selectedRelease;
          }
        }
        
        if (!releaseToUse) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        const releaseId = releaseToUse.id || releaseToUse.releaseId;
        if (!releaseId) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        // Fetch variantState.byRelease for the selected release (or default release)
        const variantsResponse = await fetch(
          `${backendUrl}/api/informed-design/variants?releaseId=${encodeURIComponent(releaseId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!variantsResponse.ok) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        const variantsData = await variantsResponse.json();
        let variantsList = [];
        
        if (Array.isArray(variantsData)) {
          variantsList = variantsData;
        } else if (variantsData.results && Array.isArray(variantsData.results)) {
          variantsList = variantsData.results;
        } else if (variantsData.data && Array.isArray(variantsData.data)) {
          variantsList = variantsData.data;
        } else if (variantsData.variantState.byRelease && Array.isArray(variantsData.variantState.byRelease)) {
          variantsList = variantsData.variantState.byRelease;
        }
        
        if (variantsList.length === 0) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        // Get the first variant
        const firstVariant = variantsList[0];
        const variantId = firstVariant.id || firstVariant.variantId;
        if (!variantId) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        // Fetch release details for output settings
        const releaseResponse = await fetch(
          `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!releaseResponse.ok) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        const releaseData = await releaseResponse.json();
        
        // Remove "b." prefix from variant ID if present
        const normalizedVariantId = String(variantId).startsWith('b.') ? String(variantId).substring(2) : String(variantId);
        
        // Create GLB output for the first variant
        const glbOutputResult = await createVariantOutput(normalizedVariantId, 'GLB', releaseData, '[Primary]');
        
        if (!glbOutputResult || !glbOutputResult.outputId) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        const glbOutputId = glbOutputResult.outputId;
        
        // Poll until status is SUCCESS
        const statusData = await pollOutputStatus(
          glbOutputId, 
          accessId, 
          accessToken,
          60, // maxAttempts - allow more time for GLB (2 minutes total)
          1000, // interval - poll every 1 second
          null // No status callback - just poll silently
        );
        
        
        // Check if we got SUCCESS status
        if (!statusData) {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        // Verify the status is actually SUCCESS before proceeding
        const finalStatus = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
        if (finalStatus !== 'SUCCESS' && finalStatus !== 'success' && finalStatus !== 'Success') {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          continue;
        }
        
        // Status is SUCCESS, download the GLB
        const downloadResponse = await fetch(
          `${backendUrl}/api/informed-design/outputs/${encodeURIComponent(glbOutputId)}/download?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          
          // Verify the blob is valid
          if (blob && blob.size > 0) {
            const contentType = blob.type || downloadResponse.headers.get('content-type') || '';
            const isGlb = contentType.includes('model/gltf-binary') || 
                         contentType.includes('model/glb') || 
                         contentType === 'application/octet-stream' ||
                         contentType === '';
            
            if (isGlb) {
              const blobUrl = URL.createObjectURL(blob);
              productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                glbPreviews: { ...prev.glbPreviews, [productId]: blobUrl }
              }));
              // Keep loading state true - it will be set to false when model-viewer loads
              // The loading state will be managed by the model-viewer's load event
            } else {
              productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
            }
          } else {
            productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
          }
        } else {
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
          }));
        }
      } catch (error) {
        productUpdaters.updateThumbnailState(prev => ({
          ...prev,
          loadingGlbPreviews: { ...prev.loadingGlbPreviews, [productId]: false }
        }));
      }
    }
    
  };

  const generateVariantThumbnails = async (variantsList, releaseId, product, projectIdOverride = null, folderIdOverride = null, abortSignal = null) => {
    if (abortSignal?.aborted) return;
    if (!variantsList || variantsList.length === 0) return;

    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) return;

    const projectIdToUse = projectIdOverride || selectedProject;
    const folderUrnToUse = folderIdOverride || selectedFolder;
    if (!projectIdToUse || !folderUrnToUse || folderUrnToUse === 'null' || folderUrnToUse === null || folderUrnToUse === undefined) return;

    const cleanProjectId = projectIdToUse.startsWith('b.') ? projectIdToUse.substring(2) : projectIdToUse;
    const accessId = `${cleanProjectId}|${folderUrnToUse}`;
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

    variantsList.forEach((variant) => {
      if (abortSignal?.aborted) return;
      const variantId = variant.id || variant.variantId;
      if (!variantId) return;
      const normalizedVariantId = String(variantId).startsWith('b.') ? String(variantId).substring(2) : String(variantId);
      if (!thumbnailState.variants[normalizedVariantId]) {
        productUpdaters.updateThumbnailState(prev => ({
          ...prev,
          loadingVariants: (!prev.loadingVariants[normalizedVariantId] ? { ...prev.loadingVariants, [normalizedVariantId]: true } : prev.loadingVariants)
        }));
      }
    });

    const THUMBNAIL_BATCH_SIZE = 3;
    const processOneThumbnail = async (variant) => {
      if (abortSignal?.aborted) return;
      const variantId = variant.id || variant.variantId;
      if (!variantId) return;
      const normalizedVariantId = String(variantId).startsWith('b.') ? String(variantId).substring(2) : String(variantId);
      if (thumbnailState.variants[normalizedVariantId]) {
        productUpdaters.updateThumbnailState(prev => ({
          ...prev,
          loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
        }));
        return;
      }
      try {
        const thumbnailResponse = await fetch(
          `${backendUrl}/api/informed-design/variants/${encodeURIComponent(normalizedVariantId)}/thumbnail?accessId=${encodeURIComponent(accessId)}&accessType=ACC&releaseId=${encodeURIComponent(releaseId)}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: abortSignal || undefined }
        );
        if (abortSignal?.aborted) return;
        if (thumbnailResponse.ok) {
          const blob = await thumbnailResponse.blob();
          if (abortSignal?.aborted) return;
          if (blob && blob.size > 0) {
            const contentType = blob.type || thumbnailResponse.headers.get('content-type') || '';
            const isImage = contentType.startsWith('image/') || contentType === 'application/octet-stream' || contentType === '';
            if (isImage) {
              const blobUrl = URL.createObjectURL(blob);
              productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                variants: { ...prev.variants, [normalizedVariantId]: blobUrl }
              }));
              productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
              }));
              return;
            }
          }
          productUpdaters.updateThumbnailState(prev => ({
            ...prev,
            loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
          }));
          return;
        }
        if (thumbnailResponse.status === 202) {
          let retryCount = 0;
          const maxRetries = 3;
          const retryThumbnail = () => {
            if (retryCount >= maxRetries) {
              productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
              }));
              return;
            }
            retryCount++;
            const delay = Math.min(5000 * retryCount, 15000);
            setTimeout(async () => {
              if (abortSignal?.aborted) { productUpdaters.updateThumbnailState(prev => ({ ...prev, loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false } })); return; }
              try {
                const retryResponse = await fetch(
                  `${backendUrl}/api/informed-design/variants/${encodeURIComponent(normalizedVariantId)}/thumbnail?accessId=${encodeURIComponent(accessId)}&accessType=ACC&releaseId=${encodeURIComponent(releaseId)}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: abortSignal || undefined }
                );
                if (retryResponse.ok) {
                  const blob = await retryResponse.blob();
                  if (blob && blob.size > 0) {
                    const ct = blob.type || retryResponse.headers.get('content-type') || '';
                    if (ct.startsWith('image/') || ct === 'application/octet-stream' || ct === '') {
                      const blobUrl = URL.createObjectURL(blob);
                      productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                variants: { ...prev.variants, [normalizedVariantId]: blobUrl }
              }));
                      productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
              }));
                      return;
                    }
                  }
                } else if (retryResponse.status === 202) {
                  retryThumbnail();
                  return;
                }
                productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
              }));
              } catch {
                productUpdaters.updateThumbnailState(prev => ({
                ...prev,
                loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
              }));
              }
            }, delay);
          };
          retryThumbnail();
          return;
        }
        await thumbnailResponse.text().catch(() => '');
        if (!abortSignal?.aborted) productUpdaters.updateThumbnailState(prev => ({ ...prev, loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false } }));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        productUpdaters.updateThumbnailState(prev => ({
          ...prev,
          loadingVariants: { ...prev.loadingVariants, [normalizedVariantId]: false }
        }));
      }
    };

    for (let i = 0; i < variantsList.length; i += THUMBNAIL_BATCH_SIZE) {
      if (abortSignal?.aborted) break;
      const batch = variantsList.slice(i, i + THUMBNAIL_BATCH_SIZE);
      await Promise.allSettled(batch.map(processOneThumbnail));
    }
    if (abortSignal?.aborted) {
      const next = { ...thumbnailState.loadingVariants };
      variantsList.forEach((variant) => {
        const variantId = variant.id || variant.variantId;
        if (variantId) {
          const normalizedVariantId = String(variantId).startsWith('b.') ? String(variantId).substring(2) : String(variantId);
          next[normalizedVariantId] = false;
        }
      });
      productUpdaters.updateThumbnailState({ loadingVariants: next });
    }
  };

  const fetchVariants = async (releaseId, product) => {
    if (!releaseId) return;

    if (thumbnailAbortControllerRef.current) {
      thumbnailAbortControllerRef.current.abort();
    }
    thumbnailAbortControllerRef.current = new AbortController();
    const thumbnailSignal = thumbnailAbortControllerRef.current.signal;

    try {
      productUpdaters.updateVariantState(prev => ({
        ...prev,
        loadingByRelease: { ...prev.loadingByRelease, [releaseId]: true }
      }));
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          loadingByRelease: { ...prev.loadingByRelease, [releaseId]: false }
        }));
        return;
      }
      
      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      // Validate we have required data
      if (!cleanProjectId || !selectedFolder || selectedFolder === 'null' || selectedFolder === null || selectedFolder === undefined) {
        // Don't set empty array - let it fetch later when data is available
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          loadingByRelease: { ...prev.loadingByRelease, [releaseId]: false }
        }));
        return;
      }
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/variants?releaseId=${encodeURIComponent(releaseId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const variantsData = await response.json();

        // Extract variantState.byRelease from the response
        let variantsList = [];
        if (Array.isArray(variantsData)) {
          variantsList = variantsData;
        } else if (variantsData.data && Array.isArray(variantsData.data)) {
          variantsList = variantsData.data;
        } else if (variantsData.variantState && variantsData.variantState.byRelease && Array.isArray(variantsData.variantState.byRelease)) {
          variantsList = variantsData.variantState.byRelease;
        } else if (variantsData.items && Array.isArray(variantsData.items)) {
          variantsList = variantsData.items;
        } else if (typeof variantsData === 'object' && variantsData !== null) {
          // If it's an object, try to find any array property
          for (const key in variantsData) {
            if (Array.isArray(variantsData[key])) {
              variantsList = variantsData[key];
              break;
            }
          }
        }

        // Set variantState.byRelease and loading state together to prevent "No variantState.byRelease available" flash
        // Batch state updates to prevent flickering - set both in the same render cycle
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          byRelease: { ...prev.byRelease, [releaseId]: variantsList },
          loadingByRelease: { ...prev.loadingByRelease, [releaseId]: false }
        }));
        
        // Generate thumbnails for this release (cancel previous product's thumbnail run when switching)
        if (variantsList.length > 0 && product) {
          const projectIdForThumbnails = selectedProject;
          const folderIdForThumbnails = selectedFolder;
          setTimeout(() => {
            if (thumbnailSignal.aborted) return;
            if (projectIdForThumbnails && folderIdForThumbnails) {
              generateVariantThumbnails(variantsList, releaseId, product, projectIdForThumbnails, folderIdForThumbnails, thumbnailSignal).catch(() => {});
            }
          }, 100);
        }
      } else {
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          byRelease: { ...prev.byRelease, [releaseId]: [] },
          loadingByRelease: { ...prev.loadingByRelease, [releaseId]: false }
        }));
      }
    } catch (err) {
      productUpdaters.updateVariantState(prev => ({
        ...prev,
        byRelease: { ...prev.byRelease, [releaseId]: [] },
        loadingByRelease: { ...prev.loadingByRelease, [releaseId]: false }
      }));
    }
  };

  const fetchVariantDetails = async (variantId, releaseId) => {
    if (!variantId) return;
    
    try {
      productUpdaters.updateVariantState(prev => ({
        ...prev,
        loadingDetails: { ...prev.loadingDetails, [variantId]: true }
      }));
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) return;
      
      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const variantData = await response.json();
        
        // Extract variant details from the response
        let variantDetailsData = variantData;
        if (variantData.data) {
          variantDetailsData = variantData.data;
        }
        
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          details: { ...prev.details, [variantId]: variantDetailsData }
        }));
      } else {
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          details: { ...prev.details, [variantId]: null }
        }));
      }
    } catch (err) {
      productUpdaters.updateVariantState(prev => ({
        ...prev,
        details: { ...prev.details, [variantId]: null }
      }));
    } finally {
      productUpdaters.updateVariantState(prev => ({
        ...prev,
        loadingDetails: { ...prev.loadingDetails, [variantId]: false }
      }));
    }
  };

  const fetchReleaseInputs = async (releaseId) => {
    if (!releaseId) return;
    
    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) return;
      
      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const releaseData = await response.json();
        const parameters = releaseData.parameters || releaseData.data?.parameters || releaseData.inputs || releaseData.data?.inputs || [];
        productUpdaters.updateReleaseState(prev => ({
          ...prev,
          inputs: { ...prev.inputs, [releaseId]: parameters }
        }));
        
        // Initialize form data with default values
        const formData = {};
        parameters.forEach(param => {
          const key = param.key || param.name;
          formData[key] = param.defaultValue !== undefined ? param.defaultValue : '';
        });
        productUpdaters.updateFormState({ dataByRelease: { ...formState.dataByRelease, [releaseId]: formData } });
        
        // Fetch rules if rulesKey exists
        // The rulesKey comes from the rules property in the release response
        const rulesKey = releaseData.rules || releaseData.data?.rules;
        
        // Store the rulesKey for use in validation
        if (rulesKey) {
          productUpdaters.updateReleaseState(prev => ({
            ...prev,
            rulesKey: { ...prev.rulesKey, [releaseId]: rulesKey }
          }));
        }
        
        if (rulesKey) {
          // Mark as loading rules
          productUpdaters.updateReleaseState(prev => ({
            ...prev,
            loadingRules: { ...prev.loadingRules, [releaseId]: true }
          }));
          try {
            const rulesResponse = await fetch(
              `${backendUrl}/api/informed-design/rules/${encodeURIComponent(rulesKey)}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (rulesResponse.ok) {
              const rulesData = await rulesResponse.json();
              
              // Extract and store validation code from rules
              // Rules can have code at the root level or per input
              if (rulesData.code) {
                productUpdaters.updateReleaseState(prev => ({
                  ...prev,
                  validationCode: { ...prev.validationCode, [releaseId]: rulesData.code }
                }));
              } else if (rulesData.inputs && Array.isArray(rulesData.inputs)) {
                // If code is per input, create a map
                const inputCodeMap = {};
                rulesData.inputs.forEach(input => {
                  if (input.code && (input.name || input.key)) {
                    const inputKey = input.name || input.key;
                    inputCodeMap[inputKey] = input.code;
                  }
                });
                if (Object.keys(inputCodeMap).length > 0) {
                  productUpdaters.updateReleaseState(prev => ({
                    ...prev,
                    validationCode: { ...prev.validationCode, [releaseId]: inputCodeMap }
                  }));
                }
              } else {
                // Try to find code in other possible locations
                if (rulesData.data && rulesData.data.code) {
                  productUpdaters.updateReleaseState(prev => ({
                    ...prev,
                    validationCode: { ...prev.validationCode, [releaseId]: rulesData.data.code }
                  }));
                } else if (rulesData.rules && rulesData.rules.code) {
                  productUpdaters.updateReleaseState(prev => ({
                    ...prev,
                    validationCode: { ...prev.validationCode, [releaseId]: rulesData.rules.code }
                  }));
                }
              }
            }
          } catch (rulesErr) {
            // Error fetching rules - non-fatal, continue without rules
          } finally {
            // Mark rules loading as complete
            productUpdaters.updateReleaseState(prev => ({
              ...prev,
              loadingRules: { ...prev.loadingRules, [releaseId]: false }
            }));
          }
        } else {
          // No rules to fetch, mark as complete
          productUpdaters.updateReleaseState(prev => ({
            ...prev,
            loadingRules: { ...prev.loadingRules, [releaseId]: false }
          }));
        }
      } else {
        // Handle error response - still mark rules loading as complete even if release fetch failed
        productUpdaters.updateReleaseState(prev => ({
          ...prev,
          loadingRules: { ...prev.loadingRules, [releaseId]: false }
        }));
      }
    } catch (err) {
      // Error fetching release inputs
      productUpdaters.updateReleaseState(prev => ({
        ...prev,
        loadingRules: { ...prev.loadingRules, [releaseId]: false }
      }));
    }
  };

  // Validate input value using rules:evaluate API endpoint
  const validateInputValue = async (releaseId, inputKey, value, allFormData) => {
    // Get the validation code for this specific input (for extracting constraints)
    const validationCode = releaseState.validationCode[releaseId];
    let constraints = null;
    if (validationCode) {
      const code = typeof validationCode === 'string' ? validationCode : validationCode[inputKey];
      if (code) {
        constraints = extractConstraints(code);
      }
    }
    
    // Get the rulesKey for the API call (not the code)
    const rulesKey = releaseState.rulesKey[releaseId];
    if (!rulesKey) {
      return { valid: true, error: null, constraints };
    }
    
    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) return { valid: true, error: null, constraints };
      
      // Get all parameters from the release inputs to ensure we include all parameters
      // The rules code references parameters['Width'].value, so we need all parameters
      const releaseParams = releaseState.inputs[releaseId] || [];
      
      // Convert form data to inputs array format for the API
      // Based on API documentation, inputs should match the parameter structure
      // Include the full parameter object but update the value
      const inputs = releaseParams.map(param => {
        const key = param.key || param.name;
        // Skip internal fields
        if (key && key.startsWith('_')) return null;
        
        // Use value from form data if available, otherwise use defaultValue
        const formValue = allFormData[key];
        let inputValue = formValue !== undefined && formValue !== null && formValue !== '' 
          ? formValue 
          : (param.defaultValue !== undefined ? param.defaultValue : null);
        
        // Ensure values are the correct type based on parameter type
        const paramType = param.type || 'string';
        
        // Convert value to appropriate type
        if (paramType === 'number' || paramType === 'integer' || paramType === 'float' || paramType === 'NUMERIC') {
          // Ensure numeric values are numbers, not strings
          if (inputValue !== null && inputValue !== undefined && inputValue !== '') {
            inputValue = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
          }
        } else if (paramType === 'boolean' || paramType === 'BOOLEAN') {
          // Ensure boolean values are booleans
          if (inputValue !== null && inputValue !== undefined && inputValue !== '') {
            inputValue = typeof inputValue === 'string' ? inputValue === 'true' : Boolean(inputValue);
          }
        }
        
        // Return the input structure for the API
        // API expects: name, value, and type (no "key" field)
        return {
          name: param.name || param.key,
          value: inputValue,
          type: param.type // Use the exact type from the parameter
        };
      }).filter(input => input !== null && input.name);
      
      const requestBody = {
        rules: rulesKey, // Use rulesKey (identifier), not the JavaScript code
        inputs: inputs
      };
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/rules:evaluate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Validation failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return { valid: false, error: errorMessage, constraints };
      }
      
      const evaluationResult = await response.json();
      
      // Process evaluation result
      // The backend now returns { valid: true/false, error: string, evaluatedInputs: [], errorDetails: {} }
      if (evaluationResult.valid !== undefined) {
        // Check if there's an updatedValue in the error details
        let updatedValue = null;
        if (evaluationResult.errorDetails && evaluationResult.errorDetails.errors) {
          const inputError = evaluationResult.errorDetails.errors.find(e => 
            (e.parameter || e.field) === inputKey
          );
          if (inputError && inputError.updatedValue !== undefined) {
            updatedValue = inputError.updatedValue;
          }
        }
        
        return {
          valid: evaluationResult.valid !== false,
          error: evaluationResult.error || (evaluationResult.valid === false ? 'Validation failed' : null),
          constraints,
          updatedValue: updatedValue
        };
      }
      
      // Fallback: Check for error property in the response (direct from API)
      if (evaluationResult.error && evaluationResult.error.errors && evaluationResult.error.errors.length > 0) {
        // Find error for this specific input
        const inputError = evaluationResult.error.errors.find(e => 
          (e.parameter || e.field) === inputKey
        );
        
        if (inputError) {
          // Build error message from the error details
          let errorMessage = inputError.detail || inputError.title || 'Validation failed';
          if (inputError.value !== undefined && inputError.updatedValue !== undefined) {
            errorMessage = `${errorMessage} Value ${inputError.value} was updated to ${inputError.updatedValue}.`;
          }
          return {
            valid: false,
            error: errorMessage,
            constraints,
            updatedValue: inputError.updatedValue
          };
        }
        
        // If no specific error for this input, check if any error mentions this input
        // Return the first error as a general validation error
        const firstError = evaluationResult.error.errors[0];
        let errorMessage = firstError.detail || firstError.title || 'Validation failed';
        if (firstError.value !== undefined && firstError.updatedValue !== undefined) {
          errorMessage = `${errorMessage} Value ${firstError.value} was updated to ${firstError.updatedValue}.`;
        }
        return {
          valid: false,
          error: errorMessage,
          constraints,
          updatedValue: firstError.updatedValue
        };
      }
      
      // If no specific error found, assume valid
      return { valid: true, error: null, constraints, updatedValue: null };
    } catch (err) {
      // Fallback: extract constraints for display
      const validationCode = releaseState.validationCode[releaseId];
      if (validationCode) {
        const code = typeof validationCode === 'string' ? validationCode : validationCode[inputKey];
        if (code) {
          const constraints = extractConstraints(code);
          return { valid: true, error: null, constraints };
        }
      }
      return { valid: true, error: null, constraints: null };
    }
  };

  // Helper function to handle validation result and show error before auto-correction
  const handleValidationResult = (validation, fieldKey, releaseId, inputKey) => {
    // Always show error first if validation failed
    if (!validation.valid && validation.error) {
      // Clear dismissed error when validating
      const updatedDismissed = { ...validationState.dismissedErrors };
      delete updatedDismissed[fieldKey];
      productUpdaters.updateValidationState({ dismissedErrors: updatedDismissed });

      // Store validation error in state
      productUpdaters.updateValidationState({ fieldErrors: { ...validationState.fieldErrors, [fieldKey]: validation.error } });

      // If there's an updatedValue, store it for later (after user dismisses error)
      if (validation.updatedValue !== null && validation.updatedValue !== undefined) {
        productUpdaters.updateValidationState({ pendingCorrections: {
          ...validationState.pendingCorrections,
          [fieldKey]: {
            updatedValue: validation.updatedValue,
            error: validation.error,
            releaseId,
            inputKey
          }
        } });
      } else {
        // No updatedValue - clear any pending correction
        const updated = { ...validationState.pendingCorrections };
        delete updated[fieldKey];
        productUpdaters.updateValidationState({ pendingCorrections: updated });
      }
    } else {
      // Validation passed - clear errors and pending corrections
      const updatedErrors = { ...validationState.fieldErrors };
      delete updatedErrors[fieldKey];
      productUpdaters.updateValidationState({ fieldErrors: updatedErrors });

      const updatedCorrections = { ...validationState.pendingCorrections };
      delete updatedCorrections[fieldKey];
      productUpdaters.updateValidationState({ pendingCorrections: updatedCorrections });
    }

    // Clear validating state
    const updatedValidating = { ...validationState.validatingInputs };
    delete updatedValidating[fieldKey];
    productUpdaters.updateValidationState({ validatingInputs: updatedValidating });
  };
  
  // Extract constraints (min, max, etc.) from code string for display
  const extractConstraints = (code) => {
    if (!code || typeof code !== 'string') return null;
    
    const constraints = {};
    
    // Try to extract min/max from common patterns
    // Pattern: min = 10, min: 10, value >= 10, 10 <= value
    const minMatches = [
      code.match(/min\s*[=:]\s*(\d+\.?\d*)/i),
      code.match(/value\s*>=\s*(\d+\.?\d*)/i),
      code.match(/(\d+\.?\d*)\s*<=\s*value/i)
    ];
    for (const match of minMatches) {
      if (match) {
        constraints.min = parseFloat(match[1]);
        break;
      }
    }
    
    const maxMatches = [
      code.match(/max\s*[=:]\s*(\d+\.?\d*)/i),
      code.match(/value\s*<=\s*(\d+\.?\d*)/i),
      code.match(/(\d+\.?\d*)\s*>=\s*value/i)
    ];
    for (const match of maxMatches) {
      if (match) {
        constraints.max = parseFloat(match[1]);
        break;
      }
    }
    
    // Extract pattern for strings
    const patternMatch = code.match(/pattern\s*[=:]\s*['"]([^'"]+)['"]|match\(['"]([^'"]+)['"]\)/i);
    if (patternMatch) {
      constraints.pattern = patternMatch[1] || patternMatch[2];
    }
    
    // Extract enum/choices
    const enumMatch = code.match(/enum\s*[=:]\s*\[([^\]]+)\]|choices\s*[=:]\s*\[([^\]]+)\]/i);
    if (enumMatch) {
      try {
        constraints.enum = JSON.parse(`[${enumMatch[1] || enumMatch[2]}]`);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return Object.keys(constraints).length > 0 ? constraints : null;
  };

  // NB: no local generateVariantName. There used to be one here that neither
  // sanitized the name nor skipped read-only parameters, while CreateVariantForm
  // used the shared helper — so the name shown in the form and the name actually
  // submitted could differ. One implementation, in utils/helpers.

  const handleCreateVariantClick = async (releaseId) => {
    // Mark as loading inputs
    productUpdaters.updateReleaseState(prev => ({
      ...prev,
      loadingInputs: { ...prev.loadingInputs, [releaseId]: true }
    }));
    // Don't set formState.showByRelease yet - wait until inputs and rules are loaded
    // This keeps the buttons visible while loading
    await fetchReleaseInputs(releaseId);
    // Clear loading state
    productUpdaters.updateReleaseState(prev => {
      const updatedLoadingInputs = { ...prev.loadingInputs };
      delete updatedLoadingInputs[releaseId];
      return { ...prev, loadingInputs: updatedLoadingInputs };
    });

    productUpdaters.updateFormState(prev => ({
      ...prev,
      errorsByRelease: { ...prev.errorsByRelease, [releaseId]: null }
    }));

    // Clear validation state for this release so Create button isn't stuck disabled
    productUpdaters.updateValidationState(prev => {
      const nextFieldErrors = { ...prev.fieldErrors };
      Object.keys(nextFieldErrors).forEach(key => { if (key.startsWith(`${releaseId}-`)) delete nextFieldErrors[key]; });
      return { ...prev, fieldErrors: nextFieldErrors };
    });

    productUpdaters.updateValidationState(prev => {
      const nextValidatingInputs = { ...prev.validatingInputs };
      Object.keys(nextValidatingInputs).forEach(key => { if (key.startsWith(`${releaseId}-`)) delete nextValidatingInputs[key]; });
      return { ...prev, validatingInputs: nextValidatingInputs };
    });

    productUpdaters.updateFormState(prev => ({
      ...prev,
      showByRelease: { ...prev.showByRelease, [releaseId]: true }
    }));
  };

  const handleCancelCreateVariant = (releaseId) => {
    productUpdaters.updateFormState(prev => ({
      ...prev,
      showByRelease: { ...prev.showByRelease, [releaseId]: false }
    }));
    productUpdaters.updateFormState(prev => ({
      ...prev,
      errorsByRelease: { ...prev.errorsByRelease, [releaseId]: null }
    }));
    productUpdaters.updateFormState(prev => {
      const updatedDataByRelease = { ...prev.dataByRelease };
      delete updatedDataByRelease[releaseId];
      return { ...prev, dataByRelease: updatedDataByRelease };
    });
  };

  const handleCreateVariant = async (releaseId, product) => {
    if (!releaseId) {
      alert('Missing release ID');
      return;
    }

    const minLoadingMs = 500;
    const startTime = Date.now();

    productUpdaters.updateFormState(prev => ({
      ...prev,
      errorsByRelease: { ...prev.errorsByRelease, [releaseId]: null }
    }));
    productUpdaters.updateFormState(prev => ({
      ...prev,
      creatingByRelease: { ...prev.creatingByRelease, [releaseId]: true }
    }));

    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        alert('Not authenticated. Please log in again.');
        return;
      }

      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      if (!cleanProjectId || !selectedFolder || selectedFolder === 'null') {
        productUpdaters.updateFormState(prev => ({
          ...prev,
          errorsByRelease: { ...prev.errorsByRelease, [releaseId]: 'Please select a project and folder.' }
        }));
        return;
      }

      const formData = formState.dataByRelease[releaseId] || {};
      const rawParameters = releaseState.inputs[releaseId] || [];

      // Read-only parameters are computed by the rules (Family_Type_Name is
      // derived from Width and Height), so they are not ours to send — the
      // value we hold is only ever a stale copy of what the rules recompute.
      const rulesCode = releaseState.validationCode[releaseId];
      const paramRules = extractParameterRules(typeof rulesCode === 'string' ? rulesCode : '');
      const parameters = rawParameters.map(param => {
        const rules = paramRules[param.name || param.key];
        return rules ? { ...param, rules, readOnly: Boolean(rules.readOnly) } : param;
      });

      const variantInputs = parameters
        .filter(param => !param.readOnly)
        .map(param => {
          const name = param.name || param.key;
          const value = formData[param.key || param.name];
          return {
            name: name,
            value: value !== undefined && value !== null && value !== '' ? value : param.defaultValue
          };
        });
      // Sanitized at the boundary, not just in the generator: a name typed by
      // hand comes through here too, and the API 400s on characters like `"`,
      // which Inventor text values carry.
      const variantName = sanitizeVariantName(
        formData._variantName || generateVariantName(product, formData, parameters)
      );

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/variants?releaseId=${encodeURIComponent(releaseId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: variantInputs, name: variantName }),
        }
      );

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const rawId = data.id ?? data.variantId ?? data.variant_id;
        const newVariantId = typeof rawId === 'string' && rawId.startsWith('b.') ? rawId.substring(2) : rawId;

        productUpdaters.updateFormState(prev => ({
          ...prev,
          showByRelease: { ...prev.showByRelease, [releaseId]: false }
        }));
        productUpdaters.updateFormState(prev => {
          const updatedFormData = { ...prev.dataByRelease };
          delete updatedFormData[releaseId];
          return { ...prev, dataByRelease: updatedFormData };
        });
        productUpdaters.updateFormState(prev => ({
          ...prev,
          errorsByRelease: { ...prev.errorsByRelease, [releaseId]: null }
        }));
        if (newVariantId !== null && newVariantId !== undefined) {
          productUpdaters.updateVariantState({ expanded: newVariantId });
        }

        // Optimistically add the new variant so it shows immediately; list item needs id/variantId and name/variantName
        const createdVariantForList = {
          ...data,
          id: newVariantId,
          variantId: newVariantId,
          name: data.name ?? variantName,
          variantName: data.variantName ?? data.name ?? variantName,
        };
        productUpdaters.updateVariantState(prev => ({
          ...prev,
          byRelease: {
            ...prev.byRelease,
            [releaseId]: [...(prev.byRelease[releaseId] || []), createdVariantForList],
          }
        }));

        await fetchVariants(releaseId, product);

        // If refetch returned a list that doesn't include the new variant (e.g. cache), merge it in
        productUpdaters.updateVariantState(prev => {
          const list = prev.byRelease[releaseId] || [];
          const hasNew = list.some(v => String(v.id || v.variantId) === String(newVariantId));
          if (!hasNew) {
            return {
              ...prev,
              byRelease: {
                ...prev.byRelease,
                [releaseId]: [...list, createdVariantForList]
              }
            };
          }
          return prev;
        });

        // Load parameters first, then thumbnail/outputs in the background (don't await so a failure can't block create)
        fetchVariantDetails(newVariantId, releaseId).catch(() => {});
        setTimeout(() => {
          fetchVariantOutputs(newVariantId, releaseId, '[Primary]').catch(() => {});
        }, 100);
        generateVariantThumbnails([createdVariantForList], releaseId, product, selectedProject, selectedFolder).catch(() => {});
      } else {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error || errorData.developerMessage || errorData.message || `Request failed (${response.status})`;
        productUpdaters.updateFormState(prev => ({
          ...prev,
          errorsByRelease: { ...prev.errorsByRelease, [releaseId]: msg }
        }));
      }
    } catch (err) {
      productUpdaters.updateFormState(prev => ({
        ...prev,
        errorsByRelease: { ...prev.errorsByRelease, [releaseId]: err.message || 'Network or unexpected error' }
      }));
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadingMs) {
        await new Promise(r => setTimeout(r, minLoadingMs - elapsed));
      }
      productUpdaters.updateFormState(prev => ({
        ...prev,
        creatingByRelease: { ...prev.creatingByRelease, [releaseId]: false }
      }));
    }
  };

  const deleteVariant = async (variantId, releaseId, product) => {
    if (!variantId || !releaseId) {
      alert('Missing variant ID or release ID');
      return;
    }

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this variant?')) {
      return;
    }

    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        alert('Not authenticated. Please log in again.');
        return;
      }

      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(
        `${backendUrl}/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Remove variant from local state
        const releaseVariants = variantState.byRelease[releaseId] || [];
        productUpdaters.updateVariantState({ byRelease: {
          ...variantState.byRelease,
          [releaseId]: releaseVariants.filter(v => (v.id || v.variantId) !== variantId)
        } });

        // Clean up variant-related state
        const updatedDetails = { ...variantState.details };
        delete updatedDetails[variantId];
        productUpdaters.updateVariantState({ details: updatedDetails });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete variant' }));
        alert(`Failed to delete variant: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting variant: ${err.message}`);
    }
  };

  // Helper function to save file with system dialog
  const saveFileWithDialog = async (blob, suggestedFileName) => {
    // Try to use File System Access API (modern browsers)
    // Access via bracket notation to avoid webpack static analysis issues
    const showSaveFilePicker = window.showSaveFilePicker;
    if (showSaveFilePicker && typeof showSaveFilePicker === 'function') {
      try {
        const fileHandle = await showSaveFilePicker({
          suggestedName: suggestedFileName,
          types: [{
            description: 'Excel files',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        // User cancelled or error occurred, fall back to download
        if (err.name !== 'AbortError') {
        }
      }
    }
    
    // Fallback to download approach
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = suggestedFileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const handleExportVariants = async (releaseId) => {
    // Get the product for this release
    const product = productState.list.find(p => {
      const productId = p.id || p.productId;
      const releases = releaseState.byProduct[productId] || p.releases || [];
      return releases.some(r => (r.id || r.releaseId) === releaseId);
    });

    if (!product) {
      alert('Product not found');
      return;
    }

    const productId = product.id || product.productId;
    const allReleases = releaseState.byProduct[productId] || product.releases || [];

    // Collect all variantState.byRelease from all releases for this product
    const allVariants = [];
    for (const release of allReleases) {
      const releaseIdForVariants = release.id || release.releaseId;
      const releaseVariants = variantState.byRelease[releaseIdForVariants] || [];
      for (const variant of releaseVariants) {
        allVariants.push({
          ...variant,
          releaseId: releaseIdForVariants,
        });
      }
    }

    if (allVariants.length === 0) {
      alert('No variantState.byRelease to export');
      return;
    }

    // Fetch variant details for variantState.byRelease that don't have complete data
    const accessToken = localStorage.getItem('aps_access_token');
    if (!accessToken) {
      alert('Not authenticated. Please log in again.');
      return;
    }

    const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
    const accessId = `${cleanProjectId}|${selectedFolder}`;
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

    // Fetch details for variantState.byRelease that need them
    const variantsWithDetails = await Promise.all(
      allVariants.map(async (variant) => {
      const variantId = variant.id || variant.variantId;
        
        // Check if we already have details with inputs
        if (variantState.details[variantId] && variantState.details[variantId].inputs) {
          return {
            ...variant,
            ...variantState.details[variantId],
          };
        }

        // Fetch variant details
        try {
          const response = await fetch(
            `${backendUrl}/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const variantData = await response.json();
            const details = variantData.data || variantData;
            return {
              ...variant,
              ...details,
            };
          }
        } catch (err) {
          // Error fetching variant details
        }

        // Return variant as-is if fetch failed
        return variant;
      })
    );

    // Collect all unique parameter names across all variantState.byRelease
    const allParameterNames = new Set();
    variantsWithDetails.forEach(variant => {
      const inputs = variant.inputs || [];
      inputs.forEach(input => {
        const paramName = input.name || input.key;
        if (paramName) {
          allParameterNames.add(paramName);
        }
      });
    });

    // Sort parameter names for consistent column order
    const sortedParameterNames = Array.from(allParameterNames).sort();

    // Build Excel data with headers: Name, ID, then parameter values
    const headers = ['Name', 'ID', ...sortedParameterNames];

    const rows = variantsWithDetails.map(variant => {
      const variantId = variant.id || variant.variantId;
      const variantName = variant.name || variantId || '';
      const inputs = variant.inputs || [];
      
      // Create a map of input values by name
      const inputMap = {};
      inputs.forEach(input => {
        const name = input.name || input.key;
        if (name) {
          const value = input.value !== undefined && input.value !== null ? String(input.value) : '';
          inputMap[name] = value;
        }
      });
      
      // Build row: Name, ID, then all parameter values
      const row = [
        variantName,
        variantId || '',
        ...sortedParameterNames.map(name => inputMap[name] || '')
      ];
      
      return row;
    });

    // Create Excel workbook
    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths (auto-width for better readability)
    const columnWidths = headers.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...rows.map(row => String(row[colIndex] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    const productName = (product.name || productId || 'product').replace(/[^a-z0-9]/gi, '_');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Variants');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save file with system dialog
    const fileName = `${productName}_variants_${Date.now()}.xlsx`;
    await saveFileWithDialog(blob, fileName);
  };


  const handleExportMidElements = async () => {
    if (!midElements || midElements.length === 0) {
      alert('No elements to export');
      return;
    }

    // Helper function to find property value
    const findPropertyValue = (element, propName) => {
      const propertiesToSearch = element.allProperties || element.properties || [];
      for (const prop of propertiesToSearch) {
        const name = String(prop.name || prop.displayName || prop.attributeName || '').trim();
        if (name === propName) {
          return prop.value || prop.displayValue || prop.attributeValue || null;
        }
      }
      return null;
    };

    // Helper function to extract parameters from an element (same logic as in renderMidElementsTree)
    const extractParameters = (element) => {
      const parameterPairs = [];
      const allProps = element.allProperties || element.properties || [];
      
      // First, check for Base64 encoded inputs field
      const inputsBase64 = findPropertyValue(element, 'MID/inputsBase64Encoded');
      if (inputsBase64) {
        try {
          // Decode Base64 string
          const decodedString = atob(inputsBase64);
          // Try to parse as JSON
          const decodedParams = JSON.parse(decodedString);
          
          // Handle different JSON structures
          if (Array.isArray(decodedParams)) {
            // If it's an array of parameter objects
            decodedParams.forEach(param => {
              if (param.name && param.value !== undefined) {
                parameterPairs.push({ name: param.name, value: param.value });
              } else if (typeof param === 'object') {
                // If it's an object with keys as names and values as values
                Object.entries(param).forEach(([key, value]) => {
                  parameterPairs.push({ name: key, value: value });
                });
              }
            });
          } else if (typeof decodedParams === 'object') {
            // If it's an object with parameter name/value pairs
            Object.entries(decodedParams).forEach(([key, value]) => {
              parameterPairs.push({ name: key, value: value });
            });
          }
        } catch (err) {
          // Fall through to other methods
        }
      }
      
      // If no Base64 parameters found, try other methods
      if (parameterPairs.length === 0) {
        // Try to get MID/parameterName and MID/parameterValue (single pair)
        const parameterName = findPropertyValue(element, 'MID/parameterName');
        const parameterValue = findPropertyValue(element, 'MID/parameterValue');
        if (parameterName && parameterValue) {
          parameterPairs.push({ name: parameterName, value: parameterValue });
        }
        
        // Then, look for numbered parameter pairs (MID/parameter1Name, MID/parameter1Value, etc.)
        const parameterProps = allProps.filter(prop => {
          const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
          return propName.startsWith('MID/parameter') && 
                 propName !== 'MID/parameterName' && 
                 propName !== 'MID/parameterValue' &&
                 propName !== 'MID/inputsBase64Encoded' &&
                 (propName.includes('Name') || propName.includes('Value'));
        });
        
        // Group parameter properties by number/index
        const parameterGroups = {};
        parameterProps.forEach(prop => {
          const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
          const propValue = prop.value || prop.displayValue || prop.attributeValue || '';
          
          // Extract parameter index (e.g., "1" from "MID/parameter1Name")
          const match = propName.match(/MID\/parameter(\d+)(Name|Value)/);
          if (match) {
            const index = match[1];
            const type = match[2]; // "Name" or "Value"
            
            if (!parameterGroups[index]) {
              parameterGroups[index] = {};
            }
            parameterGroups[index][type.toLowerCase()] = propValue;
          } else {
            // Handle other parameter formats
            const genericMatch = propName.match(/MID\/parameter(.+)/);
            if (genericMatch) {
              const suffix = genericMatch[1];
              if (!parameterGroups[suffix]) {
                parameterGroups[suffix] = {};
              }
              parameterGroups[suffix].value = propValue;
              parameterGroups[suffix].name = suffix;
            }
          }
        });
        
        // Convert groups to pairs
        Object.values(parameterGroups).forEach(group => {
          if (group.name && group.value) {
            parameterPairs.push({ name: group.name, value: group.value });
          }
        });
      }
      
      return parameterPairs;
    };

    // Helper function to sanitize sheet names (Excel has restrictions)
    const sanitizeSheetName = (name) => {
      // Excel sheet names can't be longer than 31 characters and can't contain: \ / ? * [ ]
      // In character class, only ] and \ need escaping
      let sanitized = name.replace(/[\]\\/?*[\]]/g, '_');
      if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 31);
      }
      return sanitized || 'Sheet';
    };

    // Group elements by product
    const productsMap = new Map();
    
    midElements.forEach((element, index) => {
      const productName = findPropertyValue(element, 'MID/productName') || 'Unknown Product';
      
      if (!productsMap.has(productName)) {
        productsMap.set(productName, []);
      }
      productsMap.get(productName).push({ element, index });
    });

    // Base headers (without Product Name since it's the sheet name)
    const baseHeaders = [
      'Name',
      'Category',
      'Type Name',
      'Level',
      'Host',
      'Release Number',
      'Representation',
      'Authoring App',
      'Is Configurable',
      'DB ID'
    ];

    const workbook = XLSX.utils.book_new();

    // Create overview worksheet with all elements
    const overviewHeaders = [
      'Name',
      'Category',
      'Product Name',
      'Release Number',
      'Authoring App',
      'Is Configurable',
      'Type',
      'Level',
      'Host'
    ];

    const overviewRows = midElements.map(element => {
      const categoryKey = (() => {
        const releaseId = findPropertyValue(element, 'MID/releaseId');
        let projectId = findPropertyValue(element, 'MID/projectId');
        const accessIdValue = findPropertyValue(element, 'MID/accessId');
        
        let folderUrn = null;
        if (accessIdValue && accessIdValue.includes('|')) {
          const parts = accessIdValue.split('|');
          if (parts.length >= 2) {
            const extractedProjectId = parts[0].trim();
            const extractedFolderUrn = parts.slice(1).join('|').trim();
            if (!projectId && extractedProjectId) {
              projectId = extractedProjectId;
            }
            if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
              folderUrn = extractedFolderUrn;
            }
          }
        }
        
        if (releaseId && projectId && folderUrn) {
          const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
          const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
          return `${releaseId}|||${formattedAccessId}|||ACC`;
        }
        return null;
      })();

      const releaseInfo = categoryKey ? releaseState.categories.get(categoryKey) : null;
      const category = releaseInfo 
        ? (typeof releaseInfo === 'string' ? releaseInfo : releaseInfo.category || 'Unknown Category')
        : 'Unknown Category';

      const productName = findPropertyValue(element, 'MID/productName') || '';
      const typeName = findPropertyValue(element, 'Type Name') || findPropertyValue(element, 'TypeName') || findPropertyValue(element, 'typeName') || '';
      const level = findPropertyValue(element, 'Level') || findPropertyValue(element, 'level') || '';
      const host = findPropertyValue(element, 'Host') || findPropertyValue(element, 'host') || '';
      const releaseNumber = findPropertyValue(element, 'MID/releaseNumber') || '';
      const authoringApp = findPropertyValue(element, 'MID/authoringApp') || '';
      const isConfigurable = findPropertyValue(element, 'MID/isConfigurable') || '';

      return [
        element.name || '',
        category,
        productName,
        releaseNumber,
        authoringApp,
        isConfigurable,
        typeName,
        level,
        host
      ];
    });

    // Create overview worksheet
    const overviewWorksheetData = [overviewHeaders, ...overviewRows];
    const overviewWorksheet = XLSX.utils.aoa_to_sheet(overviewWorksheetData);
    
    // Set column widths for overview
    const overviewColumnWidths = overviewHeaders.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...overviewRows.map(row => String(row[colIndex] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    overviewWorksheet['!cols'] = overviewColumnWidths;

    // Add overview sheet as the first sheet
    XLSX.utils.book_append_sheet(workbook, overviewWorksheet, 'Overview');

    // Create a worksheet for each product
    productsMap.forEach((elementData, productName) => {
      // Extract parameters for elements in this product and collect unique parameter names for this product
      const productParameterNames = new Set();
      const productElementParameters = elementData.map(({ element }) => {
        const params = extractParameters(element);
        params.forEach(param => {
          if (param.name) {
            productParameterNames.add(param.name);
          }
        });
        return params;
      });

      // Sort parameter names for consistent column order
      const sortedParameterNames = Array.from(productParameterNames).sort();
      const headers = [...baseHeaders, ...sortedParameterNames];

      // Build rows for this product
      const rows = elementData.map(({ element }, elementIndex) => {
        const categoryKey = (() => {
          const releaseId = findPropertyValue(element, 'MID/releaseId');
          let projectId = findPropertyValue(element, 'MID/projectId');
          const accessIdValue = findPropertyValue(element, 'MID/accessId');
          
          let folderUrn = null;
          if (accessIdValue && accessIdValue.includes('|')) {
            const parts = accessIdValue.split('|');
            if (parts.length >= 2) {
              const extractedProjectId = parts[0].trim();
              const extractedFolderUrn = parts.slice(1).join('|').trim();
              if (!projectId && extractedProjectId) {
                projectId = extractedProjectId;
              }
              if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                folderUrn = extractedFolderUrn;
              }
            }
          }
          
          if (releaseId && projectId && folderUrn) {
            const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
            const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
            return `${releaseId}|||${formattedAccessId}|||ACC`;
          }
          return null;
        })();

        const releaseInfo = categoryKey ? releaseState.categories.get(categoryKey) : null;
        const category = releaseInfo 
          ? (typeof releaseInfo === 'string' ? releaseInfo : releaseInfo.category || 'Unknown Category')
          : 'Unknown Category';

        const typeName = findPropertyValue(element, 'Type Name') || findPropertyValue(element, 'TypeName') || findPropertyValue(element, 'typeName') || '';
        const level = findPropertyValue(element, 'Level') || findPropertyValue(element, 'level') || '';
        const host = findPropertyValue(element, 'Host') || findPropertyValue(element, 'host') || '';
        const releaseNumber = findPropertyValue(element, 'MID/releaseNumber') || '';
        const representation = findPropertyValue(element, 'MID/representation') || '';
        const authoringApp = findPropertyValue(element, 'MID/authoringApp') || '';
        const isConfigurable = findPropertyValue(element, 'MID/isConfigurable') || '';

        // Get parameters for this element
        const params = productElementParameters[elementIndex];
        const paramMap = {};
        params.forEach(param => {
          if (param.name) {
            paramMap[param.name] = param.value !== undefined && param.value !== null ? String(param.value) : '';
          }
        });

        // Build row: base fields + parameter values
        const baseRow = [
          element.name || '',
          category,
          typeName,
          level,
          host,
          releaseNumber,
          representation,
          authoringApp,
          isConfigurable,
          element.dbId || ''
        ];

        // Add parameter values in the same order as headers
        const paramValues = sortedParameterNames.map(name => paramMap[name] || '');

        return [...baseRow, ...paramValues];
      });

      // Create worksheet for this product
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      const columnWidths = headers.map((header, colIndex) => {
        const maxLength = Math.max(
          header.length,
          ...rows.map(row => String(row[colIndex] || '').length)
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = columnWidths;

      // Add sheet to workbook with sanitized product name
      const sheetName = sanitizeSheetName(productName);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const fileName = `mid_elements_${Date.now()}.xlsx`;

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Save file with system dialog
    await saveFileWithDialog(blob, fileName);
  };

  const processImportFile = async (file, releaseId) => {
      if (!file) return;
      
      try {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const isCSV = fileName.endsWith('.csv');
        
        if (!isExcel && !isCSV) {
          alert('Please select a CSV or Excel file (.csv, .xlsx, or .xls)');
          return;
        }
        
        let headers = [];
        let rows = [];
        
        if (isExcel) {
          // Parse Excel file
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON with header row - use raw: false to get formatted values
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false  // Get formatted values as strings
          });
          
          
          if (jsonData.length < 2) {
            alert('Excel file must have at least a header row and one data row');
            return;
          }
          
          // First row is headers
          headers = jsonData[0].map(h => String(h || '').trim());
          
          // Remaining rows are data - ensure all rows have the same length as headers
          rows = jsonData.slice(1).map(row => {
            // Pad row with empty strings if it's shorter than headers
            const paddedRow = [...row];
            while (paddedRow.length < headers.length) {
              paddedRow.push('');
            }
            return paddedRow;
          });
        } else {
          // Parse CSV file
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          alert('CSV file must have at least a header row and one data row');
          return;
        }
        
        // Parse header
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current);
          return result;
        };
        
          headers = parseCSVLine(lines[0]).map(h => h.trim());
          rows = lines.slice(1).map(line => parseCSVLine(line));
        }
        
        // Validate format: should be Name, ID, then parameters (matching export format)
        if (headers.length === 0 || headers[0].toLowerCase() !== 'name') {
          alert('File must have "Name" as the first column');
          return;
        }
        
        // Check if second column is ID (export format)
        const hasIdColumn = headers.length > 1 && headers[1].toLowerCase() === 'id';
        const parameterStartIndex = hasIdColumn ? 2 : 1;
        
        // Get product and release inputs
        const product = productState.list.find(p => {
          const productId = p.id || p.productId;
          const releases = releaseState.byProduct[productId] || p.releases || [];
          return releases.some(r => (r.id || r.releaseId) === releaseId);
        });
        
        const parameters = releaseState.inputs[releaseId] || [];
        const parameterMap = {};
        parameters.forEach(param => {
          parameterMap[param.name || param.key] = param;
        });
        
        // Parse data rows - skip ID column if present
        const variantsToCreate = [];
        for (let i = 0; i < rows.length; i++) {
          const values = rows[i];
          
          if (values.length < parameterStartIndex) {
            continue;
          }
          
          const variantName = String(values[0] || '').trim();
          if (!variantName) {
            continue;
          }
          
          const inputs = [];
          
          // Start from parameterStartIndex (skip Name and ID columns)
          for (let j = parameterStartIndex; j < headers.length; j++) {
            const paramName = headers[j].trim();
            if (!paramName) {
              continue;
            }
            
            // Get the value from the row array at the correct index
            let rawValue = '';
            if (j < values.length) {
              rawValue = values[j];
            }
            
            // Handle undefined, null, or empty values
            if (rawValue === undefined || rawValue === null) {
              rawValue = '';
            }
            
            const paramValue = String(rawValue).trim();
            
            // Use the parameter name from the spreadsheet header and the value from the cell
            // Don't check against release parameters - just use what's in the spreadsheet
            const finalValue = paramValue || '';
              inputs.push({
                name: paramName,
              value: finalValue
              });
          }
          
          variantsToCreate.push({ name: variantName, inputs });
        }
        
        if (variantsToCreate.length === 0) {
          alert('No valid variantState.byRelease found in file');
          return;
        }
        
        // Confirm import
        if (!window.confirm(`Import ${variantsToCreate.length} variant(s)?`)) {
          return;
        }
        
        // Create variantState.byRelease with progress updates
        const accessToken = localStorage.getItem('aps_access_token');
        if (!accessToken) {
          alert('Not authenticated. Please log in again.');
          return;
        }
        
        const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
        const accessId = `${cleanProjectId}|${selectedFolder}`;
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        
        // Set up progress tracking
        productUpdaters.updateImportExportState({ importProgress: { releaseId, current: 0, total: variantsToCreate.length } });
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < variantsToCreate.length; i++) {
          const variantData = variantsToCreate[i];
          
          // Update progress
          productUpdaters.updateImportExportState({ importProgress: { releaseId, current: i + 1, total: variantsToCreate.length } });
          
          try {
            const response = await fetch(
              `${backendUrl}/api/informed-design/variants?releaseId=${encodeURIComponent(releaseId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(variantData),
              }
            );
            
            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            failCount++;
          }
        }
        
        // Clear progress
        productUpdaters.updateImportExportState({ importProgress: { releaseId: null, current: 0, total: 0 } });
        
        // Refresh variantState.byRelease list for all releases of the product
        if (product) {
          const productId = product.id || product.productId;
          const allReleases = releaseState.byProduct[productId] || product.releases || [];
          
          // Refresh variantState.byRelease for all releases of this product
          const refreshPromises = allReleases.map(release => {
            const releaseIdForRefresh = release.id || release.releaseId;
            return fetchVariants(releaseIdForRefresh, product);
          });
          
          await Promise.all(refreshPromises);
        }
        
        alert(`Import complete: ${successCount} succeeded, ${failCount} failed`);
      } catch (err) {
        alert(`Error importing variantState.byRelease: ${err.message}`);
      }
    };

  const handleImportVariants = (releaseId) => {
    productUpdaters.updateImportExportState({ showImportDialog: { releaseId, show: true } });
  };

  const handleFileSelect = async (e, releaseId) => {
    const file = e.target.files[0];
    if (file) {
      productUpdaters.updateImportExportState({ showImportDialog: { releaseId: null, show: false } });
      await processImportFile(file, releaseId);
    }
  };

  const handleDrop = async (e, releaseId) => {
    e.preventDefault();
    e.stopPropagation();
    productUpdaters.updateImportExportState({ dragOverReleaseId: null });
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv');
      
      if (isExcel || isCSV) {
        productUpdaters.updateImportExportState({ showImportDialog: { releaseId: null, show: false } });
        await processImportFile(file, releaseId);
      } else {
        alert('Please drop a CSV or Excel file (.csv, .xlsx, or .xls)');
      }
    }
  };

  const handleDragOver = (e, releaseId) => {
    e.preventDefault();
    e.stopPropagation();
    productUpdaters.updateImportExportState({ dragOverReleaseId: releaseId });
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    productUpdaters.updateImportExportState({ dragOverReleaseId: null });
  };

  const createVariantOutput = async (variantId, outputType, releaseData, representation) => {
    
    if (!variantId || !outputType) {
      return null;
    }
    
    // Normalize representation to string if it came as an object (e.g. from release outputSettings)
    let representationStr = representation;
    if (representation != null && typeof representation === 'object') {
      representationStr = representation.name ?? representation.id ?? String(representation);
    } else if (representation != null && typeof representation !== 'string') {
      representationStr = String(representation);
    }
    
    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) return null;
      
      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      // Get outputSettings from release data (match resolution used elsewhere)
      // API may return output_settings (snake_case) or nested under data
      const outputSettings = (releaseData && (
        releaseData.outputSettings ||
        releaseData.output_settings ||
        (releaseData.data && (releaseData.data.outputSettings || releaseData.data.output_settings))
      )) || null;
      let settings = {};
      if (outputSettings) {
        // outputSettings might be an object with keys like "GLB", "THUMBNAIL", etc.
        // or it might be an array of output settings
        if (typeof outputSettings === 'object' && !Array.isArray(outputSettings)) {
          const typeKey = outputType.toUpperCase();
          settings = outputSettings[typeKey] || 
                     outputSettings[outputType] || 
                     outputSettings[typeKey.toLowerCase()] || 
                     {};
        } else if (Array.isArray(outputSettings)) {
          const outputSetting = outputSettings.find(setting => {
            const settingType = setting.type || setting.outputType || setting.format;
            return settingType === outputType || settingType === outputType.toUpperCase();
          });
          if (outputSetting) {
            settings = outputSetting.settings || {};
            const { type, outputType: outputTypeField, format, settings: settingsField, ...otherFields } = outputSetting;
            settings = { ...otherFields, ...settings };
            const { type: typeInSettings, outputType: outputTypeInSettings, format: formatInSettings, ...settingsOnly } = settings;
            settings = settingsOnly;
          }
        }
      }
      
      // Handle representations (plural) -> representation (singular) conversion
      // API expects representation (singular), but outputSettings may have representations (plural array)
      const outputTypeUpper = outputType.toUpperCase();
      if (outputTypeUpper !== 'PDF' && outputTypeUpper !== 'DWG' && outputTypeUpper !== 'IDW') {
        // If we have representations (plural array), convert to representation (singular)
        if (settings.representations && Array.isArray(settings.representations) && settings.representations.length > 0) {
          // Prefer the user's explicit choice (e.g. from representation dropdown); only fall back to first when not provided
          if (representationStr != null && representationStr !== '') {
            settings.representation = representationStr;
          } else {
            const first = settings.representations[0];
            settings.representation = typeof first === 'object' ? (first?.name ?? first?.id ?? String(first)) : first;
          }
          // Remove representations (plural) - API only wants representation (singular)
          delete settings.representations;
        } else if (!settings.representation) {
          // No representations array and no representation - use parameter or default
          settings.representation = representationStr != null && representationStr !== '' ? representationStr : '[Primary]';
        }
        // API expects a string; normalize if it came as an object from outputSettings
        if (settings.representation != null && typeof settings.representation === 'object') {
          settings.representation = settings.representation.name ?? settings.representation.id ?? String(settings.representation);
        }
      }
      
      // Remove metadata fields that shouldn't be in settings
      // These are output type definition metadata, not settings for creating outputs
      const metadataFields = ['isPublic', 'category', 'family', 'behavior', 'categoryName', 'category_name', 'familyName', 'family_name'];
      const cleanedSettings = {};
      for (const key in settings) {
        if (!metadataFields.includes(key)) {
          cleanedSettings[key] = settings[key];
        }
      }
      settings = cleanedSettings;
      
      // For types that don't use representation (PDF, DWG, IDW), don't send it - API may reject it
      if (outputTypeUpper === 'PDF' || outputTypeUpper === 'DWG' || outputTypeUpper === 'IDW') {
        delete settings.representation;
      }
      // Strip null/undefined so we don't send invalid values to the API
      const finalSettings = {};
      for (const key in settings) {
        const v = settings[key];
        if (v !== undefined && v !== null) {
          finalSettings[key] = v;
        }
      }
      settings = finalSettings;
      
      // For PDF outputs, convert templatePaths (plural) to templatePath (singular)
      // templatePath should be a single string, not an array
      if (outputTypeUpper === 'PDF') {
        if (settings.templatePaths !== undefined) {
          // If templatePaths is an array, take the first element; if it's a string, use it directly
          settings.templatePath = Array.isArray(settings.templatePaths) 
            ? settings.templatePaths[0] 
            : settings.templatePaths;
          delete settings.templatePaths;
        }
        // Ensure templatePath is a string, not an array
        if (settings.templatePath !== undefined && Array.isArray(settings.templatePath)) {
          settings.templatePath = settings.templatePath[0];
        }
      }
      
      // Build the outputs array with type and settings (API expects type in consistent format)
      // The payload structure should be: { variantId, outputs: [{ type, settings }] }
      const outputsArray = [{
        type: outputTypeUpper,
        settings: settings
      }];
      
      const requestBody = {
        variantId,
        outputs: outputsArray
      };
      
      // Pass accessId and accessType as query parameters; use apiRequestJson so 401 triggers token refresh and retry
      const params = new URLSearchParams();
      params.append('accessId', accessId);
      params.append('accessType', 'ACC');
      const endpoint = `/api/informed-design/outputs?${params.toString()}`;

      const outputData = await apiRequestJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }, accessToken);

      // The response contains an "outputs" array with the actual output objects
      if (outputData.outputs && Array.isArray(outputData.outputs) && outputData.outputs.length > 0) {
        const firstOutput = outputData.outputs[0];
        const outputId = firstOutput.id || firstOutput.outputId;
        const status = firstOutput.status || firstOutput.state || outputData.status;
        if (outputId) {
          return { outputId, status, output: firstOutput };
        }
      }

      // Fallback: try to extract outputsRequestId if outputs array is not available
      const outputsRequestId = outputData.outputsRequestId || outputData.outputs_request_id || outputData.outputRequestId || outputData.output_request_id;
      if (!outputsRequestId) {
        return null;
      }
      return { outputsRequestId };
    } catch (err) {
      const apiMessage = err.details?.developerMessage || err.details?.message || err.details?.error || err.message;
      console.error('createVariantOutput exception:', err.message, err.details ? err.details : '');
      if (err.status === 400 && apiMessage) {
        console.error('API validation error:', apiMessage);
      }
      return null;
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getOutputFromRequestId = async (outputsRequestId, accessId, accessToken) => {
    if (!outputsRequestId) return null;
    
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const url = `${backendUrl}/api/informed-design/outputs?outputsRequestId=${encodeURIComponent(outputsRequestId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const outputData = await response.json();
        
        // Extract outputId and status from response
        // The response structure has an "outputs" array containing the actual outputs
        let output = null;
        if (outputData.outputs && Array.isArray(outputData.outputs) && outputData.outputs.length > 0) {
          // Get the first output from the outputs array
          output = outputData.outputs[0];
        } else if (Array.isArray(outputData)) {
          output = outputData[0] || null;
        } else if (outputData.data && Array.isArray(outputData.data)) {
          output = outputData.data[0] || null;
        } else if (outputData.id) {
          output = outputData;
        } else if (outputData.data && outputData.data.id) {
          output = outputData.data;
        }
        
        if (output) {
          const outputId = output.id || output.outputId;
          const status = output.status || output.state || outputData.status;
          return { outputId, status, output };
        } else {
          return null;
        }
      } else {
        await response.text(); // Read response to avoid memory leak
        return null;
      }
    } catch (err) {
      return null;
    }
  };

  const handleSvfView = async (variantId, outputType, releaseData, representation) => {
    const downloadKey = `${variantId}-${outputType}`;
    productUpdaters.updateOutputState(prev => ({
      ...prev,
      downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: true }
    }));
    
    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        return;
      }
      
      // Create accessId
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      // Create the SVF output
      const outputResult = await createVariantOutput(variantId, outputType, releaseData, representation);
      
      if (!outputResult || !outputResult.outputId) {
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        return;
      }
      
      const outputId = outputResult.outputId;
      const status = outputResult.status;
      
      // Update download status
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: status }
      }));
      
      // Poll for status if not already SUCCESS
      let statusData = outputResult.output;
      let finalStatus = status;
      
      if (status !== 'SUCCESS' && status !== 'success' && status !== 'Success') {
        // Poll and update status as we go
        statusData = await pollOutputStatus(outputId, accessId, accessToken, 60, 1000, (currentStatus) => {
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: currentStatus }
          }));
        });

        if (statusData) {
          finalStatus = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: finalStatus }
          }));
        } else {
          // Polling failed or timed out
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
          }));
          productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
          return;
        }
      } else {
        finalStatus = status;
      }
      
      if (statusData && (finalStatus === 'SUCCESS' || finalStatus === 'success' || finalStatus === 'Success')) {
        // Get the SVF file URL from backend (backend will poll and serve it)
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const svfUrl = `${backendUrl}/api/informed-design/outputs/${encodeURIComponent(outputId)}/svf?accessId=${encodeURIComponent(accessId)}&accessType=ACC`;
        
        // Get variant data to display parameters
        // First try to get from variantState.details (which has inputs), otherwise fetch them
        const releaseId = releaseData?.releaseId || releaseData?.id || releaseData?.release_id;
        let variantData = variantState.details[variantId];
        
        // If variant details not available, fetch them
        if (!variantData && releaseId) {
          // Fetch variant details first
          await fetchVariantDetails(variantId, releaseId);
          // The fetchVariantDetails updates state, so we need to get it from state after a brief delay
          // Or we can fetch it directly here
          const accessToken = localStorage.getItem('aps_access_token');
          if (accessToken) {
            const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
            const accessId = `${cleanProjectId}|${selectedFolder}`;
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
            try {
              const detailsResponse = await fetch(
                `${backendUrl}/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              if (detailsResponse.ok) {
                const variantDetailsData = await detailsResponse.json();
                variantData = variantDetailsData.data || variantDetailsData;
              }
            } catch (err) {
              // If fetch fails, use basic variant data
            }
          }
        }
        
        // If still no variant data with inputs, use basic variant data
        if (!variantData || !variantData.inputs) {
          const basicVariant = variantState.byRelease[releaseId]?.find(v => v.id === variantId || v.variantId === variantId);
          if (basicVariant) {
            variantData = basicVariant;
          }
        }
        
        // Show viewer on same page
        setViewerUrl(svfUrl);
        setViewerToken(accessToken);
        setViewerVariantData(variantData || null);
        setShowViewer(true);
        
        // Mark as complete and clear downloading state
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'DOWNLOADED' }
        }));
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        
        // Clear download status after a delay
        setTimeout(() => {
          const updated = { ...outputState.downloadStatuses };
          delete updated[downloadKey];
          productUpdaters.updateOutputState({ downloadStatuses: updated });
        }, 2000);
      } else {
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
        }));
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
      }
    } catch (error) {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' },
        downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
      }));
    }
  };

  const fetchVariantOutputs = async (variantId, releaseId, representation) => {
    if (!variantId) return;

    try {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        loadingByVariant: { ...prev.loadingByVariant, [variantId]: true }
      }));
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        return;
      }
      
      // Create accessId same way as backend
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      // Get release data to extract output configurations
      let releaseData = null;
      if (releaseId) {
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
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
            releaseData = await releaseResponse.json();
          }
        } catch (err) {
          // Failed to fetch release data
        }
      }
      
      // Use provided representation or default to "[Primary]"
      const representationToUse = representation || "[Primary]";
      
      // First try to create GLB output
      const glbOutputResult = await createVariantOutput(variantId, 'GLB', releaseData, representationToUse);
      
      if (glbOutputResult) {
        // Check if we got outputId directly (from outputs array) or outputsRequestId
        let glbOutputInfo = null;
        
        if (glbOutputResult.outputId) {
          // We got the outputId directly from the create response
          glbOutputInfo = glbOutputResult;
        } else if (glbOutputResult.outputsRequestId) {
          // We got outputsRequestId, need to get the output (but API doesn't support this, so this is a fallback)
          glbOutputInfo = null;
        }
        
        if (glbOutputInfo && glbOutputInfo.outputId) {
          // If status is not SUCCESS yet, poll until it is
          let statusData = glbOutputInfo.output;
          if (glbOutputInfo.status !== 'SUCCESS' && glbOutputInfo.status !== 'success' && glbOutputInfo.status !== 'Success') {
            statusData = await pollOutputStatus(glbOutputInfo.outputId, accessId, accessToken);
          }
        
          if (statusData) {
            // Status is SUCCESS, fetch download URL
            await fetchOutputDownload(variantId, glbOutputInfo.outputId, accessId, accessToken);
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              byVariant: { ...prev.byVariant, [variantId]: [{ type: 'GLB', id: glbOutputInfo.outputId }] }
            }));
          } else {
            // Status is FAILURE or timed out, try thumbnail instead
            const thumbnailOutputResult = await createVariantOutput(variantId, 'THUMBNAIL', releaseData, representationToUse);
            
            if (thumbnailOutputResult) {
              let thumbnailOutputInfo = null;
              
              if (thumbnailOutputResult.outputId) {
                thumbnailOutputInfo = thumbnailOutputResult;
              } else if (thumbnailOutputResult.outputsRequestId) {
                thumbnailOutputInfo = null;
              }
              
              if (thumbnailOutputInfo && thumbnailOutputInfo.outputId) {
                // If status is not SUCCESS yet, poll until it is
                let thumbnailStatusData = thumbnailOutputInfo.output;
                if (thumbnailOutputInfo.status !== 'SUCCESS' && thumbnailOutputInfo.status !== 'success' && thumbnailOutputInfo.status !== 'Success') {
                  thumbnailStatusData = await pollOutputStatus(thumbnailOutputInfo.outputId, accessId, accessToken);
                }
                
                if (thumbnailStatusData) {
                  // Thumbnail is ready, fetch download URL
                  await fetchOutputDownload(variantId, thumbnailOutputInfo.outputId, accessId, accessToken);
                  productUpdaters.updateOutputState(prev => ({
                    ...prev,
                    byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputInfo.outputId }] }
                  }));
                } else {
                  // Thumbnail also failed
                  productUpdaters.updateOutputState(prev => ({
                    ...prev,
                    byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputInfo.outputId, failed: true }] }
                  }));
                }
              } else {
                productUpdaters.updateOutputState(prev => ({
                  ...prev,
                  byVariant: { ...prev.byVariant, [variantId]: [{ type: 'GLB', id: glbOutputInfo?.outputId, failed: true }] }
                }));
              }
            } else {
              // No outputs available
              productUpdaters.updateOutputState(prev => ({
                ...prev,
                byVariant: { ...prev.byVariant, [variantId]: [{ type: 'GLB', id: glbOutputInfo?.outputId, failed: true }] }
              }));
            }
          }
        } else {
          // Try thumbnail as fallback
          const thumbnailOutputResult = await createVariantOutput(variantId, 'THUMBNAIL', releaseData, representationToUse);
          if (thumbnailOutputResult && thumbnailOutputResult.outputId) {
            let thumbnailStatusData = thumbnailOutputResult.output;
            if (thumbnailOutputResult.status !== 'SUCCESS' && thumbnailOutputResult.status !== 'success' && thumbnailOutputResult.status !== 'Success') {
              thumbnailStatusData = await pollOutputStatus(thumbnailOutputResult.outputId, accessId, accessToken);
            }
            if (thumbnailStatusData) {
              await fetchOutputDownload(variantId, thumbnailOutputResult.outputId, accessId, accessToken);
              productUpdaters.updateOutputState(prev => ({
                ...prev,
                byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputResult.outputId }] }
              }));
            } else {
              productUpdaters.updateOutputState(prev => ({
                ...prev,
                byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputResult.outputId, failed: true }] }
              }));
            }
          } else {
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              byVariant: { ...prev.byVariant, [variantId]: [] }
            }));
          }
        }
      } else {
        // If GLB creation failed, try to create thumbnail output
        const thumbnailOutputResult = await createVariantOutput(variantId, 'THUMBNAIL', releaseData, representationToUse);
        
        if (thumbnailOutputResult && thumbnailOutputResult.outputId) {
          // If status is not SUCCESS yet, poll until it is
          let thumbnailStatusData = thumbnailOutputResult.output;
          if (thumbnailOutputResult.status !== 'SUCCESS' && thumbnailOutputResult.status !== 'success' && thumbnailOutputResult.status !== 'Success') {
            thumbnailStatusData = await pollOutputStatus(thumbnailOutputResult.outputId, accessId, accessToken);
          }
          
          if (thumbnailStatusData) {
            // Thumbnail is ready, fetch download URL
            await fetchOutputDownload(variantId, thumbnailOutputResult.outputId, accessId, accessToken);
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputResult.outputId }] }
            }));
          } else {
            // Thumbnail failed
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              byVariant: { ...prev.byVariant, [variantId]: [{ type: 'THUMBNAIL', id: thumbnailOutputResult.outputId, failed: true }] }
            }));
          }
        } else {
          // No outputs available
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            byVariant: { ...prev.byVariant, [variantId]: [] }
          }));
        }
      }
    } catch (err) {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        byVariant: { ...prev.byVariant, [variantId]: [] }
      }));
    } finally {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        loadingByVariant: { ...prev.loadingByVariant, [variantId]: false }
      }));
    }
  };

  const pollOutputStatus = async (outputId, accessId, accessToken, maxAttempts = 30, interval = 2000, onStatusUpdate = null) => {
    if (!outputId) {
      return null;
    }
    
    
    const statusKey = outputId;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const url = `${backendUrl}/api/informed-design/outputs/${encodeURIComponent(outputId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        
        if (response.ok) {
          const statusData = await response.json();
          
          // Extract status from response
          const status = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
          
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            statuses: { ...prev.statuses, [statusKey]: status }
          }));
          
          // Call callback if provided
          if (onStatusUpdate && typeof onStatusUpdate === 'function') {
            onStatusUpdate(status);
          }
          
          
          if (status === 'SUCCESS' || status === 'success' || status === 'Success') {
            return statusData;
          } else if (status === 'FAILURE' || status === 'failure' || status === 'Failure' || status === 'FAILED' || status === 'failed') {
            // Extract error message
            const errorMessage = statusData.error || statusData.message || statusData.errorMessage || statusData.error_message || 'Output generation failed';
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              errors: { ...prev.errors, [statusKey]: errorMessage }
            }));
            return null;
          }
          
          // If status is PENDING or IN_PROGRESS, continue polling
          // Wait before next attempt
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, interval));
          }
        } else {
          await response.text(); // Read response to avoid memory leak
          if (attempt === maxAttempts - 1) {
            productUpdaters.updateOutputState(prev => ({
              ...prev,
              errors: { ...prev.errors, [statusKey]: 'Failed to get output status' }
            }));
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            errors: { ...prev.errors, [statusKey]: 'Error checking output status' }
          }));
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    // Timeout
    productUpdaters.updateOutputState(prev => ({
      ...prev,
      errors: { ...prev.errors, [statusKey]: 'Output generation timed out' }
    }));
    return null;
  };

  const fetchOutputDownload = async (variantId, outputId, accessId, accessToken) => {
    if (!variantId || !outputId) return;
    
    try {
      const downloadKey = `${variantId}-${outputId}`;
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        loadingDownloads: { ...prev.loadingDownloads, [downloadKey]: true }
      }));
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const url = `${backendUrl}/api/informed-design/outputs/${encodeURIComponent(outputId)}/download?accessId=${encodeURIComponent(accessId)}&accessType=ACC`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        // Get the file as a blob
        const blob = await response.blob();
        
        // Create a blob URL for the file
        const blobUrl = URL.createObjectURL(blob);
        
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloads: { ...prev.downloads, [downloadKey]: blobUrl }
        }));
      } else {
        await response.text(); // Read response to avoid memory leak
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloads: { ...prev.downloads, [downloadKey]: null }
        }));
      }
    } catch (err) {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        downloads: { ...prev.downloads, [`${variantId}-${outputId}`]: null }
      }));
    } finally {
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        loadingDownloads: { ...prev.loadingDownloads, [`${variantId}-${outputId}`]: false }
      }));
    }
  };

  const handleDownloadOutput = async (variantId, outputType, releaseData, representation) => {
    // For PDF/DWG/IDW, representation can be null, so we don't check it here
    if (!variantId || !outputType || !releaseData) {
      return;
    }
    
    // Check if representation is needed for this output type
    const outputTypeUpper = outputType.toUpperCase();
    const needsRepresentation = outputTypeUpper !== 'PDF' && outputTypeUpper !== 'DWG' && outputTypeUpper !== 'IDW';
    
    if (needsRepresentation && !representation) {
      return;
    }
    
    // Handle SVF differently - open in viewer instead of downloading
    if (outputTypeUpper === 'SVF') {
      await handleSvfView(variantId, outputType, releaseData, representation);
      return;
    }
    
    const downloadKey = `${variantId}-${outputType}`;
    productUpdaters.updateOutputState(prev => ({
      ...prev,
      downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: true }
    }));
    
    try {
      const accessToken = localStorage.getItem('aps_access_token');
      if (!accessToken) {
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        return;
      }
      
      // Create accessId
      const cleanProjectId = selectedProject?.startsWith('b.') ? selectedProject.substring(2) : selectedProject;
      const accessId = `${cleanProjectId}|${selectedFolder}`;
      
      // Create the output
      const outputResult = await createVariantOutput(variantId, outputType, releaseData, representation);
      
      if (!outputResult || !outputResult.outputId) {
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        return;
      }
      
      const outputId = outputResult.outputId;
      const status = outputResult.status;
      
      // Update download status
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: status }
      }));
      
      // Poll for status if not already SUCCESS
      let statusData = outputResult.output;
      let finalStatus = status;
      
      if (status !== 'SUCCESS' && status !== 'success' && status !== 'Success') {
        // Poll and update status as we go
        statusData = await pollOutputStatus(outputId, accessId, accessToken, 30, 2000, (currentStatus) => {
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: currentStatus }
          }));
        });
        
        if (statusData) {
          finalStatus = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: finalStatus }
          }));
        } else {
          // Polling failed or timed out
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
          }));
          productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
          return;
        }
      } else {
        finalStatus = status;
      }
      
      if (statusData && (finalStatus === 'SUCCESS' || finalStatus === 'success' || finalStatus === 'Success')) {
        // Update status to indicate we're downloading
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'DOWNLOADING' }
        }));
        
        // Get the download URL
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const url = `${backendUrl}/api/informed-design/outputs/${encodeURIComponent(outputId)}/download?accessId=${encodeURIComponent(accessId)}&accessType=ACC&outputType=${encodeURIComponent(outputType)}`;
        
        try {
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (response.ok) {
            // Get the file as a blob
            const blob = await response.blob();
            
            // Verify blob is not empty
            if (blob.size === 0) {
              productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
          }));
              productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
              return;
            }
            
            // Get variant name first (we'll use it regardless of header filename)
            let variantName = null;
            if (variantState.details[variantId]) {
              variantName = variantState.details[variantId].name || variantState.details[variantId].variantName;
            } else {
              // Search through variantState.byRelease arrays to find the variant
              for (const releaseId in variantState.byRelease) {
                const variantList = variantState.byRelease[releaseId];
                if (Array.isArray(variantList)) {
                  const variant = variantList.find(v => v.id === variantId);
                  if (variant) {
                    variantName = variant.name || variant.variantName;
                    break;
                  }
                }
              }
            }
            
            // Sanitize variant name for filesystem (remove invalid characters)
            if (variantName) {
              // Remove invalid filesystem characters: / \ : * ? " < > |
              variantName = variantName.replace(/[/\\:*?"<>|]/g, '_').trim();
              // Remove leading/trailing dots and spaces
              variantName = variantName.replace(/^\.+|\.+$/g, '').trim();
              // Replace multiple underscores with single underscore
              variantName = variantName.replace(/_+/g, '_');
              // Limit length to avoid filesystem issues
              if (variantName.length > 200) {
                variantName = variantName.substring(0, 200);
              }
            }
            
            // Extract extension from Content-Disposition header if present
            let extensionFromHeader = null;
            const contentDisposition = response.headers.get('Content-Disposition');
            
            if (contentDisposition) {
              // Parse Content-Disposition header: "attachment; filename="file.glb"" or "attachment; filename=file.glb" or "attachment; filename*=UTF-8''file.glb"
              const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (filenameMatch && filenameMatch[1]) {
                // Remove quotes if present and decode if needed
                let headerFilename = filenameMatch[1].replace(/['"]/g, '');
                // Handle URL encoding (filename*=UTF-8''encoded)
                if (headerFilename.startsWith("UTF-8''")) {
                  headerFilename = decodeURIComponent(headerFilename.substring(7));
                } else {
                  // Try to decode in case it's encoded
                  try {
                    headerFilename = decodeURIComponent(headerFilename);
                  } catch (e) {
                    // If decoding fails, use as-is
                  }
                }
                // Extract extension from header filename
                const parts = headerFilename.split('.');
                if (parts.length > 1) {
                  extensionFromHeader = parts[parts.length - 1].toLowerCase();
                }
              }
            }
            
            // Helper function to get extension from output type
            const getExtensionFromOutputType = (outputType) => {
              const typeUpper = outputType.toUpperCase();
              if (typeUpper === 'GLB') return 'glb';
              if (typeUpper === 'THUMBNAIL') return 'png';
              if (typeUpper === 'PDF') return 'pdf';
              if (typeUpper === 'BOM') return 'csv';
              if (typeUpper === 'BCD') return 'bcd';
              if (typeUpper === 'STL') return 'stl';
              if (typeUpper === 'STEP') return 'step';
              if (typeUpper === 'INV') return 'inv';
              if (typeUpper === 'SAT') return 'sat';
              if (typeUpper === 'DWG3D') return 'dwg';
              if (typeUpper === 'DWG') return 'dwg';
              if (typeUpper === 'IDW') return 'idw';
              if (typeUpper === 'RFA') return 'rfa';
              // Default to lowercase output type
              return outputType.toLowerCase();
            };
            
            // Determine file extension
            // First try to get from Content-Disposition header, then Content-Type, then outputType
            let extension = extensionFromHeader || '';
            if (!extension) {
              const contentType = response.headers.get('Content-Type');
              if (contentType) {
                if (contentType.includes('application/pdf')) {
                  extension = 'pdf';
                } else if (contentType.includes('model/gltf-binary') || contentType.includes('model/glb')) {
                  extension = 'glb';
                } else if (contentType.includes('image/png')) {
                  extension = 'png';
                } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
                  extension = 'jpg';
                } else if (contentType.includes('image/')) {
                  extension = contentType.split('/')[1].split(';')[0];
                } else if (contentType.includes('text/csv')) {
                  extension = 'csv';
                } else {
                  // Try to determine from outputType
                  extension = getExtensionFromOutputType(outputType);
                }
              } else {
                // Fallback based on output type
                extension = getExtensionFromOutputType(outputType);
              }
            }
            
            // Ensure extension is set - use outputType as final fallback
            if (!extension) {
              extension = getExtensionFromOutputType(outputType);
            }
            
            // Generate filename using variant name
            let filename;
            if (variantName) {
              filename = `${variantName}.${extension}`;
            } else {
              // Fallback to variantId if no variant name available
              filename = `${variantId}-${outputType}.${extension}`;
            }
            
            // Try to use File System Access API to show save dialog (modern browsers)
            // This allows users to choose where to save the file
            // Access via bracket notation to avoid webpack static analysis issues
            const showSaveFilePicker = window.showSaveFilePicker;
            if (showSaveFilePicker && typeof showSaveFilePicker === 'function') {
              try {
                // Determine MIME type based on extension (prioritize extension over blob.type for consistency)
                let mimeType = 'application/octet-stream';
                if (extension === 'pdf') {
                  mimeType = 'application/pdf';
                } else if (extension === 'glb') {
                  mimeType = 'model/gltf-binary';
                } else if (extension === 'png') {
                  mimeType = 'image/png';
                } else if (extension === 'jpg' || extension === 'jpeg') {
                  mimeType = 'image/jpeg';
                } else if (extension === 'csv') {
                  mimeType = 'text/csv';
                } else if (extension === 'rfa') {
                  mimeType = 'application/octet-stream';
                } else if (extension === 'dwg') {
                  mimeType = 'application/acad';
                } else if (extension === 'idw') {
                  mimeType = 'application/x-inventor';
                } else if (extension === 'bcd') {
                  mimeType = 'application/octet-stream';
                } else if (extension === 'stl') {
                  // STL files - use application/octet-stream (extension is what matters for File System Access API)
                  mimeType = 'application/octet-stream';
                } else if (extension === 'step') {
                  // STEP files - use application/octet-stream (extension is what matters)
                  mimeType = 'application/octet-stream';
                } else if (extension === 'inv') {
                  mimeType = 'application/x-inventor';
                } else if (extension === 'sat') {
                  // SAT files - use application/octet-stream (extension is what matters)
                  mimeType = 'application/octet-stream';
                } else if (blob.type && blob.type !== 'application/octet-stream') {
                  // Use blob type if it's more specific than octet-stream
                  mimeType = blob.type;
                }
                
                const fileHandle = await showSaveFilePicker({
                  suggestedName: filename,
                  types: [{
                    description: `${outputType} File`,
                    accept: {
                      [mimeType]: [`.${extension}`]
                    }
                  }]
                });
                
                // Write the blob to the selected file
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                // Mark download as complete
                productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'DOWNLOADED' }
        }));
                productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
                
                // Clear download status after a delay to allow user to see success and re-enable button
                setTimeout(() => {
                  const updated = { ...outputState.downloadStatuses };
                  delete updated[downloadKey];
                  productUpdaters.updateOutputState({ downloadStatuses: updated });
                }, 2000);
                return;
              } catch (error) {
                // User cancelled the save dialog or error occurred
                // Fall through to default download method
                if (error.name === 'AbortError') {
                  // User cancelled - don't treat as error, clear status immediately
                  const updated = { ...outputState.downloadStatuses };
                  delete updated[downloadKey];
                  productUpdaters.updateOutputState({ downloadStatuses: updated });
                  productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
                  return;
                }
                // For other errors, fall back to default download
              }
            }
            
            // Fallback: Create a download link and trigger download (browser default location)
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            
            // Trigger download
            link.click();
            
            // Wait a bit to ensure download starts
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Clean up
            document.body.removeChild(link);
            
            // Clean up blob URL after a delay
            setTimeout(() => {
              URL.revokeObjectURL(blobUrl);
            }, 1000);
            
            // Mark download as complete
            productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'DOWNLOADED' }
        }));
            
            // Clear download status after a delay to allow user to see success
            setTimeout(() => {
              const updated = { ...outputState.downloadStatuses };
              delete updated[downloadKey];
              productUpdaters.updateOutputState({ downloadStatuses: updated });
            }, 2000);
          } else {
            // Download failed
            await response.text(); // Read response to avoid memory leak
            productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
          }));
          }
        } catch (downloadErr) {
          // Download error
          productUpdaters.updateOutputState(prev => ({
            ...prev,
            downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' }
          }));
        } finally {
          // Only re-enable button after download attempt completes
          productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
        }
      } else {
        // Status was not SUCCESS
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: finalStatus || 'FAILURE' }
        }));
        productUpdaters.updateOutputState(prev => ({
          ...prev,
          downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
        }));
      }
    } catch (err) {
      // Error handling
      productUpdaters.updateOutputState(prev => ({
        ...prev,
        downloadStatuses: { ...prev.downloadStatuses, [downloadKey]: 'FAILURE' },
        downloadingByKey: { ...prev.downloadingByKey, [downloadKey]: false }
      }));
    }
  };


  // Filter folder tree to only include folders that have Informed Design productState.list (or contain such a folder)
  const filterFolderTreeToProductsOnly = (folder, idsWithProducts) => {
    if (!folder || !idsWithProducts) return null;
    const hasProducts = idsWithProducts.has(folder.id);
    let filteredChildren = [];
    if (folder.children && folder.children.length > 0) {
      filteredChildren = folder.children
        .map(child => filterFolderTreeToProductsOnly(child, idsWithProducts))
        .filter(Boolean);
    }
    const keep = hasProducts || filteredChildren.length > 0;
    if (!keep) return null;
    return { ...folder, children: filteredChildren };
  };


  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Render file tree for DX tab (data exchanges)


  // Auto-select saved account when accounts are loaded

  // Fetch file details and thumbnail when a data exchange file is selected
  useEffect(() => {
    if (selectedDxFile && selectedDxFile.id && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const encodedFileId = encodeURIComponent(selectedDxFile.id);
        
        // Fetch file properties/details
        setLoadingDxFileDetails(true);
        const propertiesUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/properties?hubId=${encodeURIComponent(selectedAccount)}`;
        fetch(propertiesUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            return null;
          })
          .then(data => {
            if (data && data.data) {
              // Map backend response to frontend format (panel expects displayName, storageSize, createTime, etc.)
              const properties = data.data;
              setDxFileDetails({
                fileId: properties.id,
                displayName: properties.name,
                name: properties.name,
                fileType: properties.fileType || properties.extension?.type || (properties.name?.endsWith('.json') ? 'JSON' : properties.name?.endsWith('.dx') ? 'DX' : null) || properties.type,
                type: properties.type,
                extension: properties.extension?.type || properties.extension || (properties.name?.endsWith('.json') ? '.json' : (properties.name?.endsWith('.dx') ? '.dx' : null)),
                storageSize: properties.storageSize,
                fileSize: properties.storageSize != null ? `${(properties.storageSize / 1024 / 1024).toFixed(2)} MB` : null,
                createTime: properties.createTime,
                created: properties.createTime,
                createUserName: properties.createUserName,
                createdBy: properties.createUserName,
                lastModifiedTime: properties.lastModifiedTime,
                lastModified: properties.lastModifiedTime,
                lastModifiedUserName: properties.lastModifiedUserName,
                lastModifiedBy: properties.lastModifiedUserName,
                version: properties.versionNumber,
                versionNumber: properties.versionNumber,
                description: properties.description
              });
            } else {
              setDxFileDetails(null);
            }
          })
          .catch(() => {
            setDxFileDetails(null);
          })
          .finally(() => {
            setLoadingDxFileDetails(false);
          });

        // Fetch thumbnail
        setLoadingDxFileThumbnail(true);
        // Revoke old blob URL if it exists
        if (dxFileThumbnail && dxFileThumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(dxFileThumbnail);
        }
        setDxFileThumbnail(null);
        
        const thumbnailUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/thumbnail?hubId=${encodeURIComponent(selectedAccount)}`;
        fetch(thumbnailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
          .then(response => {
            if (response.ok) {
              return response.blob();
            }
            return null;
          })
          .then(blob => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              setDxFileThumbnail(blobUrl);
            } else {
              setDxFileThumbnail(null);
            }
          })
          .catch(() => {
            setDxFileThumbnail(null);
          })
          .finally(() => {
            setLoadingDxFileThumbnail(false);
          });

        // Fetch SVF URL for viewer (only if file type supports it)
        // Data exchange files (FDX) may not have SVF derivatives, so handle gracefully
        setLoadingDxSvfUrl(true);
        // Clear any existing viewer URL first
        setDxViewerUrl(null);
        setDxViewerIsUrn(false);
        setDxViewerToken(null);
        
        const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}`;
        fetch(svfUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
          .then(async response => {
            if (response.ok) {
              const data = await response.json();
              // Check if backend explicitly says this is a data exchange file
              if (data.isDataExchange || data.error) {
                return { success: false, error: data.message || data.error || 'SVF not available' };
              }
              return { success: true, data };
            } else {
              // Get error message from response
              let errorMessage = 'SVF not available';
              let isDataExchange = false;
              try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
                isDataExchange = errorData.isDataExchange || false;
              } catch (e) {
                // Response might not be JSON
              }
              return { success: false, error: errorMessage, isDataExchange };
            }
          })
          .then(result => {
            if (result.success && result.data && !result.data.error && !result.data.isDataExchange) {
              const svfData = result.data;
              const svfUrlValue = svfData.url || svfData.svfUrl || svfData.urn || svfData.data?.url || svfData.data?.svfUrl || svfData.data?.urn;
              const isUrnValue = svfData.isUrn !== undefined ? svfData.isUrn : (svfData.data?.isUrn !== undefined ? svfData.data.isUrn : false);
              
              // Don't set viewer URL if it's an ACC storage URN (starts with wipprod when decoded)
              // These don't work with Model Derivative API
              if (svfUrlValue) {
                // Check if it's a base64 encoded ACC storage URN
                let isWipprodUrn = false;
                try {
                  const decoded = atob(svfUrlValue.replace(/-/g, '+').replace(/_/g, '/'));
                  if (decoded.includes('wipprod')) {
                    isWipprodUrn = true;
                  }
                } catch (e) {
                  // Not base64, might be a URL - check if it contains wipprod
                  if (svfUrlValue.includes('wipprod')) {
                    isWipprodUrn = true;
                  }
                }
                
                if (isWipprodUrn) {
                  // This is an ACC storage URN, don't use it
                  setDxViewerUrl(null);
                  setDxViewerIsUrn(false);
                  setDxViewerToken(null);
                } else {
                  setDxViewerUrl(svfUrlValue);
                  setDxViewerIsUrn(isUrnValue);
                  setDxViewerToken(accessToken);
                }
              } else {
                setDxViewerUrl(null);
                setDxViewerIsUrn(false);
                setDxViewerToken(null);
              }
            } else {
              // SVF not available for this file type (expected for data exchange files)
              setDxViewerUrl(null);
              setDxViewerIsUrn(false);
              setDxViewerToken(null);
            }
          })
          .catch((err) => {
            // SVF not available - this is expected for data exchange files
            setDxViewerUrl(null);
            setDxViewerIsUrn(false);
            setDxViewerToken(null);
          })
          .finally(() => {
            setLoadingDxSvfUrl(false);
          });

        // Fetch MID elements for data exchange files (same as RVT files)
        if (selectedDxFile && selectedDxFile.id && selectedProject && selectedAccount) {
          const fetchMidElements = async () => {
            setLoadingMidElements(true);
            try {
              const midElementsUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/mid-elements?hubId=${encodeURIComponent(selectedAccount)}`;
              const response = await fetch(midElementsUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              });
              if (response.ok) {
                const data = await response.json();
                const elements = (data.data || []).map(el => ({
                  ...el,
                  dbId: normalizeDbId(el.dbId) // Normalize dbId when receiving from backend
                })).filter(el => el.dbId !== null);
                setMidElements(elements);
                
                // Extract folderUrn and projectId from MID/accessId property
                // Format: projectId|folderUrn
                const findExactPropertyForDx = (element, exactName) => {
                  const propertiesToSearch = element.allProperties || element.properties || [];
                  for (const prop of propertiesToSearch) {
                    const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
                    if (propName === exactName) {
                      return prop.value || prop.displayValue || prop.attributeValue || null;
                    }
                  }
                  return null;
                };
                
                // Extract from MID/accessId: format is "projectId|folderUrn"
                let folderUrnForProductsDx = null;
                let projectIdForProductsDx = null;
                
                for (const element of elements) {
                  const accessIdValue = findExactPropertyForDx(element, 'MID/accessId');
                  if (accessIdValue && typeof accessIdValue === 'string' && accessIdValue.includes('|')) {
                    // Split on first | to handle cases where folderUrn might contain |
                    const firstPipeIndex = accessIdValue.indexOf('|');
                    if (firstPipeIndex > 0 && firstPipeIndex < accessIdValue.length - 1) {
                      const extractedProjectId = accessIdValue.substring(0, firstPipeIndex).trim();
                      const extractedFolderUrn = accessIdValue.substring(firstPipeIndex + 1).trim();
                      
                      // Validate folderUrn format
                      if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                        folderUrnForProductsDx = extractedFolderUrn;
                        projectIdForProductsDx = extractedProjectId;
                        break; // Use the first valid one found
                      }
                    }
                  }
                }
                
                // Fetch productState.list if we found a folderUrn and projectId
                if (folderUrnForProductsDx && projectIdForProductsDx) {
                  const cleanProjectIdDx = projectIdForProductsDx.startsWith('b.') ? projectIdForProductsDx.substring(2) : projectIdForProductsDx;
                  
                  // Set selectedFolder and loading state so productState.list panel shows spinner until productState.list load
                  setSelectedFolder(folderUrnForProductsDx);
                  productUpdaters.updateProductState({ loading: true });
                  productUpdaters.updateProductState({ showNoMessage: false });
                  productUpdaters.updateProductState({ loadAttempted: false });
                  
                  fetchProducts(accessToken, cleanProjectIdDx, folderUrnForProductsDx).catch(err => {
                    console.error('[App] Error fetching productState.list from MID elements (DX):', err);
                    productUpdaters.updateProductState(prev => ({
                      ...prev,
                      list: [],
                      loadAttempted: true,
                      loading: false,
                      isRetrying: false,
                      retryCount: 0
                    }));
                    productRefs.fetchProductsInProgress.current = false;
                  });
                }
                
                // Fetch release categories for all unique releases (same as RVT files)
                if (elements.length > 0) {
                  productUpdaters.updateReleaseState({ loadingCategories: true });
                  const uniqueReleaseKeys = new Set();
                  
                  const findExactProperty = (element, exactName) => {
                    const propertiesToSearch = element.allProperties || element.properties || [];
                    for (const prop of propertiesToSearch) {
                      const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
                      if (propName === exactName) {
                        return prop.value || prop.displayValue || prop.attributeValue || null;
                      }
                    }
                    return null;
                  };
                  
                  elements.forEach((element) => {
                    const releaseId = findExactProperty(element, 'MID/releaseId');
                    let projectId = findExactProperty(element, 'MID/projectId');
                    const accessIdValue = findExactProperty(element, 'MID/accessId');
                    
                    let folderUrn = null;
                    if (accessIdValue && accessIdValue.includes('|')) {
                      const parts = accessIdValue.split('|');
                      if (parts.length >= 2) {
                        const extractedProjectId = parts[0].trim();
                        const extractedFolderUrn = parts.slice(1).join('|').trim();
                        if (!projectId && extractedProjectId) {
                          projectId = extractedProjectId;
                        }
                        if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                          folderUrn = extractedFolderUrn;
                        }
                      }
                    }
                    
                    if (releaseId && projectId && folderUrn) {
                      const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
                      const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
                      const categoryKey = `${releaseId}|||${formattedAccessId}|||ACC`;
                      uniqueReleaseKeys.add(categoryKey);
                    }
                  });
                  
                  // Fetch release categories for all unique releases
                  const categoryPromises = Array.from(uniqueReleaseKeys).map(async (categoryKey) => {
                    const [releaseId, accessId, accessType] = categoryKey.split('|||');
                    if (!releaseId || !accessId || !accessType) {
                      return { categoryKey, category: 'Unknown Category' };
                    }
                    try {
                      const releaseUrl = `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
                      const releaseResponse = await fetch(releaseUrl, {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                        },
                      });
                      if (releaseResponse.ok) {
                        const releaseData = await releaseResponse.json();
                        const category = releaseData.data?.category || releaseData.category || 'Unknown Category';
                        return { categoryKey, category };
                      }
                    } catch (err) {
                      // Error fetching release category
                    }
                    return { categoryKey, category: 'Unknown Category' };
                  });
                  
                  const categoryResults = await Promise.all(categoryPromises);
                  const newReleaseCategories = new Map(releaseState.categories);
                  categoryResults.forEach(({ categoryKey, category }) => {
                    newReleaseCategories.set(categoryKey, category);
                  });
                  productUpdaters.updateReleaseState({ categories: newReleaseCategories });
                }
              } else {
                setMidElements([]);
              }
            } catch (err) {
              setMidElements([]);
            } finally {
              setLoadingMidElements(false);
              productUpdaters.updateReleaseState(prev => ({
                ...prev,
                loadingCategories: false
              }));
            }
          };
          
          fetchMidElements();
        }
      }
    } else {
      setDxFileDetails(null);
      // Clean up thumbnail blob URL
      if (dxFileThumbnail && dxFileThumbnail.startsWith('blob:')) {
        URL.revokeObjectURL(dxFileThumbnail);
      }
      setDxFileThumbnail(null);
      setDxViewerUrl(null);
      setDxViewerIsUrn(false);
      setDxViewerToken(null);
      setMidElements([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDxFile, selectedProject, selectedAccount]);

  // Fetch files when Projects tab is active
  useEffect(() => {
    if (activeTab === 'projects' && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        files.fetchFiles(accessToken, selectedProject);
      }
    } else if (activeTab === 'dx' && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        files.fetchDxFiles(accessToken, selectedProject);
      }
    } else {
      // Clear file tree when switching away from projects/dx tabs
      if (activeTab !== 'projects' && activeTab !== 'dx') {
        setFileTree(null);
        setDxFileTree(null);
        setSelectedFile(null);
        setSelectedDxFile(null);
      }
    }
  }, [activeTab, selectedProject, selectedAccount, fetchFiles, fetchDxFiles, setDxFileTree, setFileTree, setSelectedDxFile, setSelectedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch MID elements when RVT viewer is shown
  useEffect(() => {
    if (showRvtViewer && selectedFile && selectedFile.id && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        const fetchMidElements = async () => {
          setLoadingMidElements(true);
          try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
            const encodedFileId = encodeURIComponent(selectedFile.id);
            const midElementsUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/mid-elements?hubId=${encodeURIComponent(selectedAccount)}`;
            
            const response = await fetch(midElementsUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              const elements = (data.data || []).map(el => ({
                ...el,
                dbId: normalizeDbId(el.dbId)
              })).filter(el => el.dbId !== null);
              
              if (elements.length > 0) {
                setMidElements(elements);
                
                // Extract folderUrn and projectId from MID/accessId
                const findExactProperty = (element, exactName) => {
                  const propertiesToSearch = element.allProperties || element.properties || [];
                  for (const prop of propertiesToSearch) {
                    const propName = String(prop.name || prop.displayName || prop.attributeName || prop.key || '').trim();
                    if (propName === exactName) {
                      return prop.value || prop.displayValue || prop.attributeValue || null;
                    }
                  }
                  return null;
                };
                
                let folderUrnForProducts = null;
                let projectIdForProducts = null;
                
                for (const element of elements) {
                  const accessIdValue = findExactProperty(element, 'MID/accessId');
                  if (accessIdValue && typeof accessIdValue === 'string' && accessIdValue.includes('|')) {
                    const firstPipeIndex = accessIdValue.indexOf('|');
                    if (firstPipeIndex > 0 && firstPipeIndex < accessIdValue.length - 1) {
                      const extractedProjectId = accessIdValue.substring(0, firstPipeIndex).trim();
                      const extractedFolderUrn = accessIdValue.substring(firstPipeIndex + 1).trim();
                      
                      if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                        folderUrnForProducts = extractedFolderUrn;
                        projectIdForProducts = extractedProjectId;
                        break;
                      }
                    }
                  }
                }
                
                // Fallback: Use selectedProject if available
                if (folderUrnForProducts && !projectIdForProducts && selectedProject) {
                  projectIdForProducts = selectedProject;
                }
                
                // Fetch productState.list if we found folderUrn and projectId
                if (folderUrnForProducts && projectIdForProducts) {
                  const cleanProjectId = projectIdForProducts.startsWith('b.') ? projectIdForProducts.substring(2) : projectIdForProducts;
                  setSelectedFolder(folderUrnForProducts);
                  productUpdaters.updateProductState({ loading: true });
                  productUpdaters.updateProductState({ showNoMessage: false });
                  productUpdaters.updateProductState({ loadAttempted: false });
                  fetchProducts(accessToken, cleanProjectId, folderUrnForProducts).catch(err => {
                    console.error('[App] Error fetching productState.list from MID elements (RVT):', err);
                    productUpdaters.updateProductState(prev => ({
                      ...prev,
                      list: [],
                      loadAttempted: true,
                      loading: false,
                      isRetrying: false,
                      retryCount: 0
                    }));
                    productRefs.fetchProductsInProgress.current = false;
                  });
                }
                
                // Fetch release categories
                if (elements.length > 0) {
                  productUpdaters.updateReleaseState({ loadingCategories: true });
                  const uniqueReleaseKeys = new Set();
                  
                  elements.forEach((element) => {
                    const releaseId = findExactProperty(element, 'MID/releaseId');
                    let projectId = findExactProperty(element, 'MID/projectId');
                    const accessIdValue = findExactProperty(element, 'MID/accessId');
                    
                    let folderUrn = null;
                    if (accessIdValue && accessIdValue.includes('|')) {
                      const parts = accessIdValue.split('|');
                      if (parts.length >= 2) {
                        const extractedProjectId = parts[0].trim();
                        const extractedFolderUrn = parts.slice(1).join('|').trim();
                        if (!projectId && extractedProjectId) {
                          projectId = extractedProjectId;
                        }
                        if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                          folderUrn = extractedFolderUrn;
                        }
                      }
                    }
                    
                    if (releaseId && projectId && folderUrn) {
                      const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
                      const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
                      const categoryKey = `${releaseId}|||${formattedAccessId}|||ACC`;
                      uniqueReleaseKeys.add(categoryKey);
                    }
                  });
                  
                  // Fetch release categories
                  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                  const categoryPromises = Array.from(uniqueReleaseKeys).map(async (categoryKey) => {
                    const [releaseId, accessId, accessType] = categoryKey.split('|||');
                    if (!releaseId || !accessId || !accessType) {
                      return { categoryKey, category: 'Unknown Category', family: null };
                    }
                    try {
                      const releaseUrl = `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
                      const releaseResponse = await fetch(releaseUrl, {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                        },
                      });
                      if (releaseResponse.ok) {
                        const releaseData = await releaseResponse.json();
                        const outputSettings = releaseData.outputSettings || releaseData.output_settings || (releaseData.data && releaseData.data.outputSettings) || (releaseData.data && releaseData.data.output_settings) || null;
                        
                        let category = null;
                        if (outputSettings && Array.isArray(outputSettings)) {
                          const rfaOutput = outputSettings.find(output => {
                            const type = output.type || output.outputType || '';
                            return String(type).toUpperCase() === 'RFA';
                          });
                          if (rfaOutput) {
                            category = rfaOutput.category || rfaOutput.categoryName || rfaOutput.category_name || null;
                          }
                          
                          if (!category) {
                            for (const output of outputSettings) {
                              const outputCategory = output.category || output.categoryName || output.category_name || null;
                              if (outputCategory) {
                                category = outputCategory;
                                break;
                              }
                            }
                          }
                        }
                        
                        const family = releaseData.family || releaseData.familyName || releaseData.family_name || (releaseData.data && releaseData.data.family) || null;
                        
                        if (!category && family) {
                          const familyLower = String(family).toLowerCase();
                          if (familyLower.includes('window')) {
                            category = 'Windows';
                          } else if (familyLower.includes('door')) {
                            category = 'Doors';
                          } else if (familyLower.includes('wall')) {
                            category = 'Walls';
                          }
                        }
                        
                        return { categoryKey, category: category || family || 'Unknown Category', family };
                      }
                    } catch (err) {
                      // Error fetching release category
                    }
                    return { categoryKey, category: 'Unknown Category', family: null };
                  });
                  
                  const categoryResults = await Promise.all(categoryPromises);
                  const newReleaseCategories = new Map();
                  categoryResults.forEach(({ categoryKey, category, family }) => {
                    if (categoryKey) {
                      newReleaseCategories.set(categoryKey, { category, family });
                    }
                  });
                  productUpdaters.updateReleaseState(prev => ({
                    ...prev,
                    categories: newReleaseCategories,
                    loadingCategories: false
                  }));
                }
              } else {
                // Don't overwrite if viewer already provided elements via onModelLoaded
                setMidElements(prev => (prev.length > 0 ? prev : []));
              }
            } else {
              console.error('[App] Failed to fetch MID elements for RVT viewer:', response.status, response.statusText);
              setMidElements(prev => (prev.length > 0 ? prev : []));
            }
          } catch (err) {
            console.error('[App] Error fetching MID elements for RVT viewer:', err);
            setMidElements(prev => (prev.length > 0 ? prev : []));
          } finally {
            setLoadingMidElements(false);
          }
        };
        
        fetchMidElements();
      }
    } else if (!showRvtViewer) {
      // Clear MID elements when viewer is closed
      setMidElements([]);
      setLoadingMidElements(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRvtViewer, selectedFile, selectedProject, selectedAccount]);

  // Legacy useEffect for Projects tab (keeping for backward compatibility)
  useEffect(() => {
    if (activeTab === 'projects' && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken && !fileTree && !loadingFiles) {
        files.fetchFiles(accessToken, selectedProject);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProject, selectedAccount, files]);

  // Fetch file thumbnail, details, and SVF URL when a file is selected
  useEffect(() => {
    if (selectedFile && selectedFile.id && selectedProject && selectedAccount) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
        const encodedFileId = encodeURIComponent(selectedFile.id);
        
        // Fetch file properties/details
        setLoadingFileDetails(true);
        const propertiesUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/properties?hubId=${encodeURIComponent(selectedAccount)}`;
        fetch(propertiesUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            return null;
          })
          .then(data => {
            if (data && data.data) {
              // Map backend response to frontend format (panel expects displayName, storageSize, createTime, etc.)
              const properties = data.data;
              setFileDetails({
                fileId: properties.id,
                displayName: properties.name,
                name: properties.name,
                fileType: properties.fileType || properties.extension?.type || (properties.name?.endsWith('.rvt') ? 'RVT' : null) || properties.type,
                type: properties.type,
                extension: properties.extension?.type || properties.extension || (properties.name?.endsWith('.rvt') ? '.rvt' : null),
                storageSize: properties.storageSize,
                fileSize: properties.storageSize != null ? `${(properties.storageSize / 1024 / 1024).toFixed(2)} MB` : null,
                createTime: properties.createTime,
                created: properties.createTime,
                createUserName: properties.createUserName,
                createdBy: properties.createUserName,
                lastModifiedTime: properties.lastModifiedTime,
                lastModified: properties.lastModifiedTime,
                lastModifiedUserName: properties.lastModifiedUserName,
                lastModifiedBy: properties.lastModifiedUserName,
                version: properties.versionNumber,
                versionNumber: properties.versionNumber,
                description: properties.description
              });
            } else {
              setFileDetails(null);
            }
          })
          .catch(() => {
            setFileDetails(null);
          })
          .finally(() => {
            setLoadingFileDetails(false);
          });

        // Fetch available 3D views
        setLoadingViews(true);
        const viewsUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/views?hubId=${encodeURIComponent(selectedAccount)}`;
        fetch(viewsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
          .then(async response => {
            if (response.ok) {
              const data = await response.json();
              return data.data || [];
            } else {
              return [];
            }
          })
          .then(views => {
            setAvailableViews(views);
            // Auto-select first view if available
            const viewGuidToUse = views.length > 0 ? views[0].guid : null;
            setSelectedViewGuid(viewGuidToUse);
            
            // Fetch thumbnail with the selected view
            setLoadingFileThumbnail(true);
            const thumbnailUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/thumbnail?hubId=${encodeURIComponent(selectedAccount)}${viewGuidToUse ? `&viewGuid=${encodeURIComponent(viewGuidToUse)}` : ''}`;
            fetch(thumbnailUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            })
              .then(response => {
                if (response.ok) {
                  return response.blob();
                }
                return null;
              })
              .then(blob => {
                if (blob) {
                  // Revoke old blob URL if it exists
                  if (fileThumbnail && fileThumbnail.startsWith('blob:')) {
                    URL.revokeObjectURL(fileThumbnail);
                  }
                  const blobUrl = URL.createObjectURL(blob);
                  setFileThumbnail(blobUrl);
                } else {
                  setFileThumbnail(null);
                }
              })
              .catch(() => {
                setFileThumbnail(null);
              })
              .finally(() => {
                setLoadingFileThumbnail(false);
              });
            
            // Fetch SVF URL with the selected view
            setLoadingSvfUrl(true);
            const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}${viewGuidToUse ? `&viewGuid=${encodeURIComponent(viewGuidToUse)}` : ''}`;
            fetch(svfUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            })
              .then(async response => {
                if (response.ok) {
                  const data = await response.json();
                  return data;
                } else {
                  return null;
                }
              })
              .then(svfData => {
                if (svfData) {
                  // Handle different response formats - backend returns { url: ..., isUrn: ... }
                  const svfUrlValue = svfData.url || svfData.svfUrl || svfData.urn || svfData.data?.url || svfData.data?.svfUrl || svfData.data?.urn;
                  const isUrnValue = svfData.isUrn !== undefined ? svfData.isUrn : (svfData.data?.isUrn !== undefined ? svfData.data.isUrn : false);
                  
                  if (svfUrlValue) {
                    setRvtViewerUrl(svfUrlValue);
                    setRvtViewerIsUrn(isUrnValue);
                    setRvtViewerToken(accessToken);
                  } else {
                    setRvtViewerUrl(null);
                    setRvtViewerIsUrn(false);
                    setRvtViewerToken(null);
                  }
                } else {
                  setRvtViewerUrl(null);
                  setRvtViewerIsUrn(false);
                  setRvtViewerToken(null);
                }
              })
              .catch(() => {
                setRvtViewerUrl(null);
                setRvtViewerIsUrn(false);
                setRvtViewerToken(null);
              })
              .finally(() => {
                setLoadingSvfUrl(false);
              });
          })
          .catch(() => {
            setAvailableViews([]);
            setSelectedViewGuid(null);
            // Still try to fetch SVF URL without view GUID
            setLoadingSvfUrl(true);
            const svfUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/svf?hubId=${encodeURIComponent(selectedAccount)}`;
            fetch(svfUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            })
              .then(async response => {
                if (response.ok) {
                  const data = await response.json();
                  return data;
                } else {
                  return null;
                }
              })
              .then(svfData => {
                if (svfData) {
                  // Handle different response formats - backend returns { url: ..., isUrn: ... }
                  const svfUrlValue = svfData.url || svfData.svfUrl || svfData.urn || svfData.data?.url || svfData.data?.svfUrl || svfData.data?.urn;
                  const isUrnValue = svfData.isUrn !== undefined ? svfData.isUrn : (svfData.data?.isUrn !== undefined ? svfData.data.isUrn : false);
                  
                  if (svfUrlValue) {
                    setRvtViewerUrl(svfUrlValue);
                    setRvtViewerIsUrn(isUrnValue);
                    setRvtViewerToken(accessToken);
                  } else {
                    setRvtViewerUrl(null);
                    setRvtViewerIsUrn(false);
                    setRvtViewerToken(null);
                  }
                } else {
                  setRvtViewerUrl(null);
                  setRvtViewerIsUrn(false);
                  setRvtViewerToken(null);
                }
              })
              .catch(() => {
                setRvtViewerUrl(null);
                setRvtViewerIsUrn(false);
                setRvtViewerToken(null);
              })
              .finally(() => {
                setLoadingSvfUrl(false);
              });
          })
          .finally(() => {
            setLoadingViews(false);
          });
      }
    }
    if (!selectedFile || !selectedFile.id || !selectedProject || !selectedAccount) {
      setFileThumbnail(null);
      setFileDetails(null);
      setRvtViewerUrl(null);
      setRvtViewerIsUrn(false);
      setRvtViewerToken(null);
      setLoadingSvfUrl(false);
      setAvailableViews([]);
      setSelectedViewGuid(null);
      setLoadingViews(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, selectedProject, selectedAccount]);
  
  // Cross-highlighting: Update viewer when selectedElements changes
  useEffect(() => {
    const viewerInstance = showRvtViewer ? rvtViewerInstance : (showDxViewer ? dxViewerInstance : null);
    const model = showRvtViewer ? rvtModel : (showDxViewer ? dxModel : null);
    
    if ((showRvtViewer || showDxViewer) && viewerInstance) {
      setHighlightingElements(true);
      
      const updateViewer = async () => {
        try {
          // Wait a bit to ensure model is ready
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Get model from viewer instance (more reliable than stored model)
          const currentModel = viewerInstance.model || model;
          
          if (!currentModel) {
            // Model not ready yet, try again after a delay
            setTimeout(() => {
              setHighlightingElements(false);
            }, 200);
            return;
          }

          // Skip programmatic select/isolate when viewer selection already matches (avoids loop when user selects in viewer)
          if (typeof viewerInstance.getSelection === 'function') {
            const currentSelection = viewerInstance.getSelection() || [];
            const currentSet = new Set((currentSelection).map(id => normalizeDbId(id)).filter(id => id != null));
            if (currentSet.size === selectedElements.size && [...currentSet].every(id => selectedElements.has(id))) {
              setHighlightingElements(false);
              return;
            }
          }

          if (selectedElements.size > 0) {
            // Convert Set to Array for viewer API and ensure dbIds are numbers
            let dbIds = Array.from(selectedElements).map(dbId => {
              // Convert to number if it's a string
              const num = Number(dbId);
              return isNaN(num) ? dbId : num;
            });
            
            // Validate dbIds against the model to ensure they exist
            // This helps catch cases where dbIds from backend don't match viewer dbIds
            try {
              const modelDbIds = currentModel.getObjectIds ? currentModel.getObjectIds() : [];
              if (modelDbIds && modelDbIds.length > 0) {
                // Create a Set for faster lookup
                const modelDbIdSet = new Set(modelDbIds.map(id => Number(id)));
                
                // Filter to only include dbIds that exist in the model
                const validDbIds = dbIds.filter(dbId => {
                  const numId = Number(dbId);
                  return modelDbIdSet.has(numId);
                });
                
                if (validDbIds.length !== dbIds.length) {
                  dbIds = validDbIds;
                }
              }
            } catch (validationError) {
              // If validation fails, proceed with original dbIds
            }
            
            // Don't call clearSelection() here - it fires SELECTION_CHANGED with [] and wipes selectedElements before select() runs
            isProgrammaticSelectionRef.current = true;
            if (dbIds.length > 0) {
              lastProgrammaticDbIdsRef.current = new Set(dbIds);
              if (programmaticSelectionTimeoutRef.current) {
                clearTimeout(programmaticSelectionTimeoutRef.current);
              }
              programmaticSelectionTimeoutRef.current = setTimeout(() => {
                lastProgrammaticDbIdsRef.current = null;
                isProgrammaticSelectionRef.current = false;
                programmaticSelectionTimeoutRef.current = null;
              }, 2000);
              viewerInstance.select(dbIds);
              viewerInstance.isolate(dbIds);
              
              // Fit to view - this can take time, especially the first time
              await new Promise((resolve) => {
                viewerInstance.fitToView(dbIds);
                setTimeout(resolve, 100);
              });
            } else {
              lastProgrammaticDbIdsRef.current = null;
              isProgrammaticSelectionRef.current = false;
              if (programmaticSelectionTimeoutRef.current) {
                clearTimeout(programmaticSelectionTimeoutRef.current);
                programmaticSelectionTimeoutRef.current = null;
              }
              viewerInstance.clearSelection();
              viewerInstance.showAll();
            }
          } else {
            lastProgrammaticDbIdsRef.current = null;
            isProgrammaticSelectionRef.current = false;
            viewerInstance.clearSelection();
            viewerInstance.showAll();
          }
        } catch (err) {
          isProgrammaticSelectionRef.current = false;
          lastProgrammaticDbIdsRef.current = null;
          if (programmaticSelectionTimeoutRef.current) {
            clearTimeout(programmaticSelectionTimeoutRef.current);
            programmaticSelectionTimeoutRef.current = null;
          }
          try {
            if (viewerInstance) {
              viewerInstance.clearSelection();
              viewerInstance.showAll();
            }
          } catch (recoverErr) {
            // Ignore recovery errors
          }
        } finally {
          setTimeout(() => {
            setHighlightingElements(false);
          }, 200);
        }
      };
      
      updateViewer();
    }
  }, [selectedElements, showRvtViewer, rvtViewerInstance, rvtModel, showDxViewer, dxViewerInstance, dxModel, setHighlightingElements]);
  
  // Auto-select saved product when productState.list are loaded
  useEffect(() => {
    if (isAuthenticated && productState.list.length > 0 && selectedFolder) {
      const savedProductId = localStorage.getItem('saved_product_id');
      if (savedProductId) {
        // Find the product in the productState.list array
        const product = productState.list.find(p => {
          const productId = p.id || p.productId;
          // Compare both as strings to handle type mismatches
          return String(productId) === String(savedProductId);
        });
        
        if (product) {
          const productId = product.id || product.productId;
          const currentProductId = productState.selected?.id || productState.selected?.productId;
          
          // Only restore if the current selection doesn't match the saved one
          if (!currentProductId || String(productId) !== String(currentProductId)) {
            // Get the selected release or default to defaultRelease
            const productId = product.id || product.productId;
            const selectedReleaseId = releaseState.selectedByProduct[productId];
            const releases = releaseState.byProduct[productId] || product.releases || [];
            const currentRelease = releases.find(r => (r.id || r.releaseId) === selectedReleaseId) || product.defaultRelease;
            const releaseId = currentRelease?.id || currentRelease?.releaseId;
            
            // Restore product selection (only one product selected)
            productMethods.selectProduct(product);
            // Also expand it to show variantState.byRelease - use string to ensure consistency
            productUpdaters.updateProductState({ expanded: String(productId) });
            
            // Fetch variantState.byRelease if needed (or if we have an empty array from premature fetch)
            const existingVariants = variantState.byRelease[releaseId];
            const shouldFetch = !existingVariants || (Array.isArray(existingVariants) && existingVariants.length === 0);
            if (releaseId && shouldFetch) {
              const accessToken = localStorage.getItem('aps_access_token');
              if (accessToken) {
                setTimeout(async () => {
                  await fetchVariants(releaseId, product);
                }, 100);
              }
            }
          }
        } else {
          // Saved product doesn't exist in the list, clear it
          localStorage.removeItem('saved_product_id');
          // Clear selection if it was the saved product
          const currentProductId = productState.selected?.id || productState.selected?.productId;
          if (currentProductId && String(currentProductId) === String(savedProductId)) {
            productMethods.selectProduct(null);
            productUpdaters.updateProductState({ expanded: null });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, productState.list.length, selectedFolder]);


    return (
    <>
      {isAuthenticated ? (
      <div className="App">
        <NavigationBar
          loadingAccounts={loadingAccounts}
          accAccounts={accAccounts}
          selectedAccount={selectedAccount}
          handleAccountChange={handleAccountChange}
          loadingProjects={loadingProjects}
          projectsError={projectsError}
          accProjects={accProjects}
          selectedProject={selectedProject}
          handleProjectChange={handleProjectChange}
          userProfile={userProfile}
          profileError={profileError}
          handleLogout={handleLogout}
          setShowTokenDialog={setShowTokenDialog}
          setShowIdsDialog={setShowIdsDialog}
        />
        {((showViewer && viewerUrl && viewerToken) || (showRvtViewer && rvtViewerUrl && rvtViewerToken) || (showDxViewer && dxViewerUrl && dxViewerToken)) ? (
          <div className="viewer-wrapper">
            <div className="viewer-side-panel">
              <button 
                className="btn btn-back" 
                onClick={() => {
                  if (showDxViewer) {
                    setShowDxViewer(false);
                    // Don't clear dxViewerUrl/dxViewerToken - keep them so the button remains enabled
                    // They will be cleared when a different file is selected or when the component unmounts
                  } else if (showRvtViewer) {
                    setShowRvtViewer(false);
                    // Don't clear rvtViewerUrl/rvtViewerToken - keep them so the button remains enabled
                    // They will be cleared when a different file is selected or when the component unmounts
                    setMidElements([]);
                    productUpdaters.updateReleaseState({ categories: new Map() });
                  } else {
                    setShowViewer(false);
                    setViewerUrl(null);
                    setViewerToken(null);
                    setViewerVariantData(null);
                  }
                }}
              >
                ← {showDxViewer ? t('backToDataExchanges') : (showRvtViewer ? t('backToProjects') : t('backToProducts'))}
              </button>
              {showRvtViewer && selectedFile && (
                <div style={{ 
                  marginTop: '8px', 
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  color: '#333',
                  fontWeight: '500',
                  wordBreak: 'break-word'
                }}>
                  {selectedFile.name || selectedFile.id || t('file')}
                </div>
              )}
              {showRvtViewer && selectedFile && (
                <div style={{
                  height: '1px',
                  background: '#E0E0E0',
                  margin: '12px 0',
                  width: '100%'
                }}></div>
              )}
              {!showRvtViewer && viewerVariantData && (
                <div className="variant-parameters">
                  <div className="variant-name">
                    {viewerVariantData.name || viewerVariantData.variantName || t('variant')}
                  </div>
                  <h5 className="variant-parameters-title">{t('parameters')}</h5>
                  {viewerVariantData.inputs && viewerVariantData.inputs.length > 0 ? (
                    <div className="parameters-list">
                      {viewerVariantData.inputs.map((input, index) => (
                        <div key={index} className="parameter-item">
                          <div className="parameter-name">
                            {input.name || input.key || t('inputNumber', { number: index + 1 })}
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
                  )}
                </div>
              )}
              {(showRvtViewer || showDxViewer) && (
                <div className="mid-browser">
                  <div className="mid-browser-header">
                    <h5 className="mid-browser-title">Products</h5>
                    {midElements && midElements.length > 0 && (
                      <div className="mid-browser-header-buttons">
                        <button
                          className="btn-export-mid-elements"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportMidElements();
                          }}
                          title={t('exportProducts')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {highlightingElements && (
                    <div className="highlighting-indicator">
                      <div className="highlighting-spinner"></div>
                      <span>Highlighting in viewer...</span>
                    </div>
                  )}
                  {loadingMidElements || releaseState.loadingCategories || (productState.loading || productState.isRetrying) || ((showRvtViewer || showDxViewer) && (!midElements || midElements.length === 0)) ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div className="thumbnail-loading-spinner" style={{ width: '40px', height: '40px' }}></div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>
                          {(productState.loading || productState.isRetrying)
                            ? (productState.retryCount > 0 ? `Loading products... (attempt ${productState.retryCount})` : 'Loading products...')
                            : (loadingMidElements || (!midElements || midElements.length === 0)
                                ? 'Looking for products in project...'
                                : 'Loading products...')}
                        </p>
                        {midElements && midElements.length > 0 && !(productState.loading || productState.isRetrying) && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#0696d7', fontWeight: '600' }}>
                            {midElements.length} {midElements.length === 1 ? 'product' : 'products'} found
                          </p>
                        )}
                        {releaseState.loadingCategories && midElements && midElements.length > 0 && (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>
                            Processing categories...
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <ElementsTree
                      midElements={midElements}
                      releaseCategories={releaseState.categories}
                      selectedElements={selectedElements}
                      onSelectElements={setSelectedElements}
                      expandedCategories={selectionState.expandedCategories}
                      onToggleCategory={(category) => {
                        const newExpanded = new Set(selectionState.expandedCategories);
                        if (newExpanded.has(category)) {
                          newExpanded.delete(category);
                        } else {
                          newExpanded.add(category);
                        }
                        productUpdaters.updateSelectionState({ expandedCategories: newExpanded });
                      }}
                      expandedProducts={selectionState.expandedProducts}
                      onToggleProduct={(productKey) => {
                        const newExpanded = new Set(selectionState.expandedProducts);
                        if (newExpanded.has(productKey)) {
                          newExpanded.delete(productKey);
                        } else {
                          newExpanded.add(productKey);
                        }
                        productUpdaters.updateSelectionState({ expandedProducts: newExpanded });
                      }}
                      expandedElements={selectionState.expandedElements}
                      onToggleElement={(elementKey) => {
                        const newExpanded = new Set(selectionState.expandedElements);
                        if (newExpanded.has(elementKey)) {
                          newExpanded.delete(elementKey);
                        } else {
                          newExpanded.add(elementKey);
                        }
                        productUpdaters.updateSelectionState({ expandedElements: newExpanded });
                      }}
                      isDataExchange={activeTab === 'dx' || showDxViewer || selectedDxFile}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="viewer-main">
              {(showDxViewer && dxViewerUrl && dxViewerToken) || (showRvtViewer && rvtViewerUrl && rvtViewerToken) || (showViewer && viewerUrl && viewerToken) ? (
                <Viewer 
                  svfUrl={showDxViewer && dxViewerUrl ? dxViewerUrl : (showRvtViewer && rvtViewerUrl ? rvtViewerUrl : (showViewer ? viewerUrl : null))} 
                  token={showDxViewer && dxViewerToken ? dxViewerToken : (showRvtViewer && rvtViewerToken ? rvtViewerToken : (showViewer ? viewerToken : null))}
                  isUrn={showDxViewer ? dxViewerIsUrn : (showRvtViewer ? rvtViewerIsUrn : false)}
                  viewGuid={showRvtViewer ? selectedViewGuid : null}
                  onSelectionChange={(showRvtViewer || showDxViewer) ? (selectedDbIds) => {
                    const normalized = (selectedDbIds || []).map(dbId => normalizeDbId(dbId)).filter(id => id !== null && id !== undefined);
                    const incomingSet = new Set(normalized);
                    // If we just did a programmatic select, ignore any callback that doesn't match what we set (e.g. viewer firing with [] and clearing checkboxes)
                    if (lastProgrammaticDbIdsRef.current !== null) {
                      const expected = lastProgrammaticDbIdsRef.current;
                      const same = expected.size === incomingSet.size && [...incomingSet].every(id => expected.has(id));
                      if (same) {
                        lastProgrammaticDbIdsRef.current = null;
                        isProgrammaticSelectionRef.current = false;
                        if (programmaticSelectionTimeoutRef.current) {
                          clearTimeout(programmaticSelectionTimeoutRef.current);
                          programmaticSelectionTimeoutRef.current = null;
                        }
                      }
                      return;
                    }
                    if (isProgrammaticSelectionRef.current) return;
                    setSelectedElements(incomingSet);
                    if (midElements && midElements.length > 0 && productState.list && productState.list.length > 0 && normalized.length > 0) {
                      const selectedSet = new Set(normalized);
                      const findProp = (el, name) => {
                        const props = el.allProperties || el.properties || [];
                        const p = props.find(pr => String(pr?.name || pr?.displayName || pr?.key || '').trim() === name);
                        return p ? (p.value ?? p.displayValue ?? p.attributeValue) : null;
                      };
                      const matched = midElements.find(el => selectedSet.has(normalizeDbId(el.dbId)));
                      const releaseId = matched ? findProp(matched, 'MID/releaseId') : null;
                      if (releaseId) {
                        const product = productState.list.find(p => {
                          if (p.defaultRelease && (p.defaultRelease.id === releaseId || p.defaultRelease.releaseId === releaseId)) return true;
                          return (p.releases || []).some(r => (r.id || r.releaseId) === releaseId);
                        });
                        if (product) {
                          productMethods.selectProduct(product);
                          productUpdaters.updateProductState({ expanded: String(product.id || product.productId) });
                        }
                      }
                    }
                  } : undefined}
                  onModelLoaded={(showRvtViewer || showDxViewer) ? async (viewer, model, elements) => {
                    if (showRvtViewer) {
                      setRvtViewerInstance(viewer);
                      setRvtModel(model);
                    }
                    if (showDxViewer) {
                      setDxViewerInstance(viewer);
                      setDxModel(model);
                    }
                    
                    // Process MID elements extracted from the SVF by the Viewer component
                    if (elements && Array.isArray(elements) && elements.length > 0) {
                      setLoadingMidElements(true);
                      try {
                        const accessToken = localStorage.getItem('aps_access_token');
                        if (!accessToken) {
                          setLoadingMidElements(false);
                          return;
                        }
                        
                        // Helper function to find property value
                        const findExactProperty = (element, exactName) => {
                          const propertiesToSearch = element.allProperties || element.properties || [];
                          for (const prop of propertiesToSearch) {
                            const propName = String(prop.name || prop.displayName || prop.attributeName || prop.key || '').trim();
                            if (propName === exactName) {
                              return prop.value || prop.displayValue || prop.attributeValue || null;
                            }
                          }
                          if (element[exactName]) {
                            return element[exactName];
                          }
                          return null;
                        };
                        
                        // Extract folderUrn and projectId from MID/accessId property
                        // Format: projectId|folderUrn
                        let folderUrnForProducts = null;
                        let projectIdForProducts = null;
                        
                        for (const element of elements) {
                          const accessIdValue = findExactProperty(element, 'MID/accessId');
                          if (accessIdValue && typeof accessIdValue === 'string' && accessIdValue.includes('|')) {
                            const firstPipeIndex = accessIdValue.indexOf('|');
                            if (firstPipeIndex > 0 && firstPipeIndex < accessIdValue.length - 1) {
                              const extractedProjectId = accessIdValue.substring(0, firstPipeIndex).trim();
                              const extractedFolderUrn = accessIdValue.substring(firstPipeIndex + 1).trim();
                              
                              if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                                folderUrnForProducts = extractedFolderUrn;
                                projectIdForProducts = extractedProjectId;
                                break;
                              }
                            }
                          }
                        }
                        
                        // Fallback: Use selectedProject if available
                        if (folderUrnForProducts && !projectIdForProducts && selectedProject) {
                          projectIdForProducts = selectedProject;
                        }
                        
                        // Fetch productState.list from MID elements if we found folderUrn and projectId
                        if (folderUrnForProducts && projectIdForProducts) {
                          const cleanProjectId = projectIdForProducts.startsWith('b.') ? projectIdForProducts.substring(2) : projectIdForProducts;
                          
                          // Set selectedFolder and loading state so productState.list panel shows spinner until productState.list load
                          // IMPORTANT: Set these states BEFORE calling fetchProducts to ensure spinner shows immediately
                          setSelectedFolder(folderUrnForProducts);
                          productUpdaters.updateProductState({ loading: true });
                          productUpdaters.updateProductState({ isRetrying: false });
                          productUpdaters.updateProductState({ showNoMessage: false });
                          productUpdaters.updateProductState({ loadAttempted: false });
                          productUpdaters.updateProductState({ retryCount: 0 });
                          
                          // Store MID elements BEFORE calling fetchProducts to avoid race conditions
                          setMidElements(elements);
                          
                          // Now call fetchProducts - it will maintain loading state during retries
                          fetchProducts(accessToken, cleanProjectId, folderUrnForProducts).catch(err => {
                            console.error('[App] Error fetching productState.list from MID elements:', err);
                            productUpdaters.updateProductState(prev => ({
                              ...prev,
                              list: [],
                              loadAttempted: true,
                              loading: false,
                              isRetrying: false,
                              retryCount: 0
                            }));
                            productRefs.fetchProductsInProgress.current = false;
                          });
                        } else {
                          // Store MID elements even if we don't fetch productState.list
                          setMidElements(elements);
                        }
                        
                        // Fetch release categories for categorization
                        const fetchReleaseCategories = async (allElements) => {
                          if (!allElements || allElements.length === 0) {
                            productUpdaters.updateReleaseState(prev => ({
                              ...prev,
                              loadingCategories: false
                            }));
                            return;
                          }
                          
                          productUpdaters.updateReleaseState({ loadingCategories: true });
                          try {
                            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                            const uniqueReleaseKeys = new Set();
                            
                            allElements.forEach((element) => {
                              const releaseId = findExactProperty(element, 'MID/releaseId');
                              let projectId = findExactProperty(element, 'MID/projectId');
                              const accessIdValue = findExactProperty(element, 'MID/accessId');
                              
                              let folderUrn = null;
                              if (accessIdValue && accessIdValue.includes('|')) {
                                const parts = accessIdValue.split('|');
                                if (parts.length >= 2) {
                                  const extractedProjectId = parts[0].trim();
                                  const extractedFolderUrn = parts.slice(1).join('|').trim();
                                  if (!projectId && extractedProjectId) {
                                    projectId = extractedProjectId;
                                  }
                                  if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                                    folderUrn = extractedFolderUrn;
                                  }
                                }
                              }
                              
                              if (releaseId && projectId && folderUrn) {
                                const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
                                const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
                                const key = `${releaseId}|||${formattedAccessId}|||ACC`;
                                uniqueReleaseKeys.add(key);
                              }
                            });
                            
                            // Fetch release details for each unique release
                            const releasePromises = Array.from(uniqueReleaseKeys).map(async (releaseKey) => {
                              const [releaseId, accessId, accessType] = releaseKey.split('|||');
                              try {
                                const releaseUrl = `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
                                const releaseResponse = await fetch(releaseUrl, {
                                  headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                  },
                                });
                                
                                if (releaseResponse.ok) {
                                  const releaseData = await releaseResponse.json();
                                  const outputSettings = releaseData.outputSettings || releaseData.output_settings || (releaseData.data && releaseData.data.outputSettings) || (releaseData.data && releaseData.data.output_settings) || null;
                                  
                                  let category = null;
                                  if (outputSettings && Array.isArray(outputSettings)) {
                                    const rfaOutput = outputSettings.find(output => {
                                      const type = output.type || output.outputType || '';
                                      return String(type).toUpperCase() === 'RFA';
                                    });
                                    if (rfaOutput) {
                                      category = rfaOutput.category || rfaOutput.categoryName || rfaOutput.category_name || null;
                                    }
                                    
                                    if (!category) {
                                      for (const output of outputSettings) {
                                        const outputCategory = output.category || output.categoryName || output.category_name || null;
                                        if (outputCategory) {
                                          category = outputCategory;
                                          break;
                                        }
                                      }
                                    }
                                  }
                                  
                                  const family = releaseData.family || releaseData.familyName || releaseData.family_name || (releaseData.data && releaseData.data.family) || null;
                                  
                                  if (!category && family) {
                                    const familyLower = String(family).toLowerCase();
                                    if (familyLower.includes('window')) {
                                      category = 'Windows';
                                    } else if (familyLower.includes('door')) {
                                      category = 'Doors';
                                    } else if (familyLower.includes('wall')) {
                                      category = 'Walls';
                                    }
                                  }
                                  
                                  return { key: releaseKey, category: category || family || 'Unknown Category', family };
                                }
                              } catch (err) {
                                // Failed to fetch release
                              }
                              return { key: releaseKey, category: 'Unknown Category', family: null };
                            });
                            
                            const releaseResults = await Promise.all(releasePromises);
                            const newReleaseCategories = new Map();
                            releaseResults.forEach(result => {
                              if (result) {
                                newReleaseCategories.set(result.key, { category: result.category, family: result.family });
                              }
                            });
                            productUpdaters.updateReleaseState(prev => ({
                              ...prev,
                              categories: newReleaseCategories,
                              loadingCategories: false
                            }));
                          } catch (err) {
                            productUpdaters.updateReleaseState(prev => ({
                              ...prev,
                              loadingCategories: false
                            }));
                          }
                        };
                        
                        // Fetch release categories
                        fetchReleaseCategories(elements);
                      } catch (err) {
                        console.error('[App] Error processing MID elements from viewer:', err);
                      } finally {
                        setLoadingMidElements(false);
                      }
                    } else {
                      // No MID elements found in viewer, try fetching from backend API as fallback
                      // Try to fetch MID elements from backend API if we have the necessary info
                      if ((showRvtViewer && selectedFile && selectedFile.id && selectedProject && selectedAccount) ||
                          (showDxViewer && selectedDxFile && selectedDxFile.id && selectedProject && selectedAccount)) {
                        const fileToUse = showRvtViewer ? selectedFile : selectedDxFile;
                        setLoadingMidElements(true);
                        
                        try {
                          const accessToken = localStorage.getItem('aps_access_token');
                          if (accessToken) {
                            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                            const encodedFileId = encodeURIComponent(fileToUse.id);
                            const midElementsUrl = `${backendUrl}/api/acc/projects/${encodeURIComponent(selectedProject)}/files/${encodedFileId}/mid-elements?hubId=${encodeURIComponent(selectedAccount)}`;
                            
                            const response = await fetch(midElementsUrl, {
                              headers: {
                                'Authorization': `Bearer ${accessToken}`,
                              },
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              const allElements = (data.data || []).map(el => ({
                                ...el,
                                dbId: normalizeDbId(el.dbId)
                              })).filter(el => el.dbId !== null);
                              
                              if (allElements.length > 0) {
                                // Use the same processing logic as the button click handler
                                const findExactProperty = (element, exactName) => {
                                  const propertiesToSearch = element.allProperties || element.properties || [];
                                  for (const prop of propertiesToSearch) {
                                    const propName = String(prop.name || prop.displayName || prop.attributeName || prop.key || '').trim();
                                    if (propName === exactName) {
                                      return prop.value || prop.displayValue || prop.attributeValue || null;
                                    }
                                  }
                                  if (element[exactName]) {
                                    return element[exactName];
                                  }
                                  return null;
                                };
                                
                                // Extract folderUrn and projectId from MID/accessId
                                let folderUrnForProducts = null;
                                let projectIdForProducts = null;
                                
                                for (const element of allElements) {
                                  const accessIdValue = findExactProperty(element, 'MID/accessId');
                                  if (accessIdValue && typeof accessIdValue === 'string' && accessIdValue.includes('|')) {
                                    const firstPipeIndex = accessIdValue.indexOf('|');
                                    if (firstPipeIndex > 0 && firstPipeIndex < accessIdValue.length - 1) {
                                      const extractedProjectId = accessIdValue.substring(0, firstPipeIndex).trim();
                                      const extractedFolderUrn = accessIdValue.substring(firstPipeIndex + 1).trim();
                                      
                                      if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                                        folderUrnForProducts = extractedFolderUrn;
                                        projectIdForProducts = extractedProjectId;
                                        break;
                                      }
                                    }
                                  }
                                }
                                
                                // Fallback: Use selectedProject if available
                                if (folderUrnForProducts && !projectIdForProducts && selectedProject) {
                                  projectIdForProducts = selectedProject;
                                }
                                
                                // Fetch productState.list if we found folderUrn and projectId
                                if (folderUrnForProducts && projectIdForProducts) {
                                  const cleanProjectId = projectIdForProducts.startsWith('b.') ? projectIdForProducts.substring(2) : projectIdForProducts;
                                  setSelectedFolder(folderUrnForProducts);
                                  productUpdaters.updateProductState({ loading: true });
                                  productUpdaters.updateProductState({ showNoMessage: false });
                                  productUpdaters.updateProductState({ loadAttempted: false });
                                  fetchProducts(accessToken, cleanProjectId, folderUrnForProducts).catch(err => {
                                    console.error('[App] Error fetching productState.list from MID elements:', err);
                                    productUpdaters.updateProductState(prev => ({
                                      ...prev,
                                      list: [],
                                      loadAttempted: true,
                                      loading: false,
                                      isRetrying: false,
                                      retryCount: 0
                                    }));
                                    productRefs.fetchProductsInProgress.current = false;
                                  });
                                }
                                
                                // Store MID elements
                                setMidElements(allElements);
                                
                                // Fetch release categories (reuse the same function from above)
                                const fetchReleaseCategories = async (elements) => {
                                  if (!elements || elements.length === 0) {
                                    productUpdaters.updateReleaseState(prev => ({
                                      ...prev,
                                      loadingCategories: false
                                    }));
                                    return;
                                  }
                                  
                                  productUpdaters.updateReleaseState({ loadingCategories: true });
                                  try {
                                    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                                    const uniqueReleaseKeys = new Set();
                                    
                                    elements.forEach((element) => {
                                      const releaseId = findExactProperty(element, 'MID/releaseId');
                                      let projectId = findExactProperty(element, 'MID/projectId');
                                      const accessIdValue = findExactProperty(element, 'MID/accessId');
                                      
                                      let folderUrn = null;
                                      if (accessIdValue && accessIdValue.includes('|')) {
                                        const parts = accessIdValue.split('|');
                                        if (parts.length >= 2) {
                                          const extractedProjectId = parts[0].trim();
                                          const extractedFolderUrn = parts.slice(1).join('|').trim();
                                          if (!projectId && extractedProjectId) {
                                            projectId = extractedProjectId;
                                          }
                                          if (extractedFolderUrn && extractedFolderUrn.startsWith('urn:adsk.wipprod:fs.folder:')) {
                                            folderUrn = extractedFolderUrn;
                                          }
                                        }
                                      }
                                      
                                      if (releaseId && projectId && folderUrn) {
                                        const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
                                        const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
                                        const key = `${releaseId}|||${formattedAccessId}|||ACC`;
                                        uniqueReleaseKeys.add(key);
                                      }
                                    });
                                    
                                    // Fetch release details
                                    const releasePromises = Array.from(uniqueReleaseKeys).map(async (releaseKey) => {
                                      const [releaseId, accessId, accessType] = releaseKey.split('|||');
                                      try {
                                        const releaseUrl = `${backendUrl}/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
                                        const releaseResponse = await fetch(releaseUrl, {
                                          headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                          },
                                        });
                                        
                                        if (releaseResponse.ok) {
                                          const releaseData = await releaseResponse.json();
                                          const outputSettings = releaseData.outputSettings || releaseData.output_settings || (releaseData.data && releaseData.data.outputSettings) || (releaseData.data && releaseData.data.output_settings) || null;
                                          
                                          let category = null;
                                          if (outputSettings && Array.isArray(outputSettings)) {
                                            const rfaOutput = outputSettings.find(output => {
                                              const type = output.type || output.outputType || '';
                                              return String(type).toUpperCase() === 'RFA';
                                            });
                                            if (rfaOutput) {
                                              category = rfaOutput.category || rfaOutput.categoryName || rfaOutput.category_name || null;
                                            }
                                            
                                            if (!category) {
                                              for (const output of outputSettings) {
                                                const outputCategory = output.category || output.categoryName || output.category_name || null;
                                                if (outputCategory) {
                                                  category = outputCategory;
                                                  break;
                                                }
                                              }
                                            }
                                          }
                                          
                                          const family = releaseData.family || releaseData.familyName || releaseData.family_name || (releaseData.data && releaseData.data.family) || null;
                                          
                                          if (!category && family) {
                                            const familyLower = String(family).toLowerCase();
                                            if (familyLower.includes('window')) {
                                              category = 'Windows';
                                            } else if (familyLower.includes('door')) {
                                              category = 'Doors';
                                            } else if (familyLower.includes('wall')) {
                                              category = 'Walls';
                                            }
                                          }
                                          
                                          return { key: releaseKey, category: category || family || 'Unknown Category', family };
                                        }
                                      } catch (err) {
                                        // Failed to fetch release
                                      }
                                      return { key: releaseKey, category: 'Unknown Category', family: null };
                                    });
                                    
                                    const releaseResults = await Promise.all(releasePromises);
                                    const newReleaseCategories = new Map();
                                    releaseResults.forEach(result => {
                                      if (result) {
                                        newReleaseCategories.set(result.key, { category: result.category, family: result.family });
                                      }
                                    });
                                    productUpdaters.updateReleaseState(prev => ({
                                      ...prev,
                                      categories: newReleaseCategories,
                                      loadingCategories: false
                                    }));
                                  } catch (err) {
                                    productUpdaters.updateReleaseState(prev => ({
                                      ...prev,
                                      loadingCategories: false
                                    }));
                                  }
                                };
                                
                                fetchReleaseCategories(allElements);
                              } else {
                                setMidElements([]);
                              }
                            } else {
                              console.error('[App] Failed to fetch MID elements from backend:', response.status, response.statusText);
                              setMidElements([]);
                            }
                          }
                        } catch (err) {
                          console.error('[App] Error fetching MID elements from backend:', err);
                          setMidElements([]);
                        } finally {
                          setLoadingMidElements(false);
                        }
                      } else {
                        // Don't have necessary info to fetch from backend
                        setMidElements([]);
                        setLoadingMidElements(false);
                      }
                    }
                  } : undefined}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                  <p>Viewer not available</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="main-content">
            <div className={`content-layout-with-tabs${embedConfigurator ? ' content-layout-configurator' : ''}`}>
              {/* Products / Projects / Data Exchanges are demo-app concerns; the
                  configurator only deals with products, so hide them. */}
              {!embedConfigurator && (
              <div className="vertical-tabs">
                <button
                  className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
                  onClick={() => setActiveTab('products')}
                >
                  {t('products')}
                </button>
                <button
                  className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => setActiveTab('projects')}
                >
                  {t('projects')}
                </button>
                <button
                  className={`tab-button ${activeTab === 'dx' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dx')}
                >
                  {t('dataExchange')}
                </button>
              </div>
              )}
              {activeTab === 'products' ? (
                <ProductsTab
                  configuratorNode={
                    embedConfigurator ? (
                      <ConfiguratorApp
                        embedded
                        projectId={selectedProject}
                        folderUrn={selectedFolder}
                      />
                    ) : null
                  }
                    // Folder-related props
                    folderTree={folderTree}
                  selectedFolder={selectedFolder}
                  expandedFolders={expandedFolders}
                  loadingFolders={loadingFolders}
                  selectedProject={selectedProject}
                  foldersWithProductsIds={foldersWithProductsIds}
                  loadingFoldersWithProducts={loadingFoldersWithProducts}
                  toggleFolder={toggleFolder}
                  handleFolderSelect={handleFolderSelectWrapper}

                  // All products-related props (using legacy adapter)
                  {...productsLegacyProps}

                  // Additional props
                  outputGenerationAbortRef={outputGenerationAbortRef}
                  thumbnailAbortControllerRef={thumbnailAbortControllerRef}
                  selectedElements={selectedElements}
                  showRvtViewer={showRvtViewer}
                  showDxViewer={showDxViewer}

                  // Utility functions
                  formatDate={formatDate}
                  translateStatus={translateStatus}

                  // Handler functions
                  filterFolderTreeToProductsOnly={filterFolderTreeToProductsOnly}
                  fetchVariants={fetchVariants}
                  generateProductThumbnails={generateProductThumbnails}
                  handleCreateVariantClick={handleCreateVariantClick}
                  handleImportVariants={handleImportVariants}
                  handleExportVariants={handleExportVariants}
                  handleDrop={handleDrop}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  createVariantOutput={createVariantOutput}
                  handleFileSelect={handleFileSelect}
                  validateInputValue={validateInputValue}
                  handleValidationResult={handleValidationResult}
                  handleCancelCreateVariant={handleCancelCreateVariant}
                  handleCreateVariant={handleCreateVariant}
                  fetchVariantDetails={fetchVariantDetails}
                  fetchVariantOutputs={fetchVariantOutputs}
                  deleteVariant={deleteVariant}
                  handleDownloadOutput={handleDownloadOutput}
                />
              ) : activeTab === 'projects' ? (
                <FilesPanel
                  // Project context
                  selectedProject={selectedProject}
                  selectedAccount={selectedAccount}
                  
                  // File tree state
                  fileTree={fileTree}
                  loadingFiles={loadingFiles}
                  selectedFile={selectedFile}
                  expandedFiles={expandedFiles}
                  setExpandedFiles={setExpandedFiles}
                  setSelectedFile={setSelectedFile}
                  
                  // File details state
                  fileDetails={fileDetails}
                  loadingFileDetails={loadingFileDetails}
                  fileThumbnail={fileThumbnail}
                  loadingFileThumbnail={loadingFileThumbnail}
                  setFileThumbnail={setFileThumbnail}
                  setLoadingFileThumbnail={setLoadingFileThumbnail}
                  
                  // 3D view state (for RVT files)
                  availableViews={availableViews}
                  selectedViewGuid={selectedViewGuid}
                  setSelectedViewGuid={setSelectedViewGuid}
                  loadingViews={loadingViews}
                  loadingSvfUrl={loadingSvfUrl}
                  setLoadingSvfUrl={setLoadingSvfUrl}
                  
                  // Viewer state
                  setRvtViewerUrl={setRvtViewerUrl}
                  setRvtViewerIsUrn={setRvtViewerIsUrn}
                  setRvtViewerToken={setRvtViewerToken}
                  setShowRvtViewer={setShowRvtViewer}
                  
                  // Functions
                  formatDate={formatDate}
                  translateStatus={translateStatus}
                />
              ) : activeTab === 'dx' ? (
                <DxFilesPanel
                  // Project context
                  selectedProject={selectedProject}
                  selectedAccount={selectedAccount}
                  
                  // File tree state
                  dxFileTree={dxFileTree}
                  loadingDxFiles={loadingDxFiles}
                  selectedDxFile={selectedDxFile}
                  expandedDxFiles={expandedDxFiles}
                  setExpandedDxFiles={setExpandedDxFiles}
                  setSelectedDxFile={setSelectedDxFile}
                  
                  // File details state
                  dxFileDetails={dxFileDetails}
                  loadingDxFileDetails={loadingDxFileDetails}
                  dxFileThumbnail={dxFileThumbnail}
                  loadingDxFileThumbnail={loadingDxFileThumbnail}
                  setDxFileThumbnail={setDxFileThumbnail}
                  setLoadingDxFileThumbnail={setLoadingDxFileThumbnail}
                  
                  // Viewer state
                  loadingDxSvfUrl={loadingDxSvfUrl}
                  setLoadingDxSvfUrl={setLoadingDxSvfUrl}
                  setDxViewerUrl={setDxViewerUrl}
                  setDxViewerIsUrn={setDxViewerIsUrn}
                  setDxViewerToken={setDxViewerToken}
                  setShowDxViewer={setShowDxViewer}
                  
                  // Functions
                  formatDate={formatDate}
                  translateStatus={translateStatus}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
      ) : (
        <div className="App login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="logo">
            <svg width="120" height="120" viewBox="0 0 965.0002 1024" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path d="m156,.15l730,159.85h79.0002v864H137.0002c-28.7188,0-52-23.2812-52-52v-217.7079L154.4662,2.4109l1.5338-2.2609Z" fill="#3a3a3a"/>
                <path d="m156,0h686.0002c28.6996,0,52,23.3004,52,52v668H156V0h0Z" fill="#777676"/>
                <polygon points="0 814 156 720 156 0 0 94 0 814" fill="#d8d8d8"/>
              </g>
              <g>
                <path d="m358.4331,790.9248h37.8008v151.2021h-37.8008v-151.2021Z" fill="#fff"/>
                <path d="m549.2461,790.9248v151.2021h-40.8242l-49.2495-104.3301v104.3301h-32.1846v-151.2021h44.2812l45.7925,93.7451v-93.7451h32.1846Z" fill="#fff"/>
                <path d="m698.4814,851.1895v27.8643c0,38.8809-23.7607,63.0732-68.6895,63.0732h-49.4648v-151.2021h54.6494c42.3359,0,63.5049,24.1924,63.5049,60.2646Zm-37.8008-1.2959c0-21.1689-8.6406-31.7529-26.7842-31.7529h-15.7686v96.7695h12.5283c20.0879,0,30.0244-10.7998,30.0244-34.7764v-30.2402Z" fill="#fff"/>
              </g>
              <g>
                <path d="m574.8789,232.377v255.9302h51.2998v71.8198h-201.7803v-71.8198h50.7305v-255.9302h-50.7305v-71.25h201.7803v71.25h-51.2998Z" fill="#fff"/>
              </g>
            </svg>
          </div>
          <h1>Informed Design Demo</h1>
          <p className="subtitle">Sign in with your Autodesk account</p>
          
          {error && (
            <div className="error">
              <strong>Error:</strong> {error}
              <br />
              <small>Check the browser console (F12) for details</small>
            </div>
          )}
          
          <button 
            onClick={handleLogin} 
            className="btn btn-login" 
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Login with Autodesk'}
          </button>
          
          <div style={{ marginTop: '20px', fontSize: '0.85rem', color: '#666' }}>
            <details>
              <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>Debug Information</summary>
              <button 
                onClick={async () => {
                  try {
                    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                    const response = await fetch(`${backendUrl}/api/aps/diagnose`);
                    const data = await response.json();
                    alert(`Client ID: ${data.clientId.exists ? 'Configured' : 'Not configured'}\nRedirect URI: ${data.redirectUri.value}`);
                  } catch (err) {
                    alert('Failed to retrieve diagnostic information.');
                  }
                }}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '0.85rem',
                  background: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Check Configuration
              </button>
            </details>
          </div>
        </div>
      </div>
    </div>
      )}
      
      {/* Dialogs - rendered outside conditional so they're always available */}
      <TokenDialog 
        isOpen={showTokenDialog}
        onClose={() => {
          setShowTokenDialog(false);
          setTokenCopied(false);
        }}
      />
      <IdsDialog
        isOpen={showIdsDialog}
        onClose={() => setShowIdsDialog(false)}
        selectedAccount={selectedAccount}
        selectedProject={selectedProject}
        selectedFolder={selectedFolder}
        selectedProduct={productState.selected}
        selectedReleaseId={(() => {
          if (!productState.selected) return null;
          const productId = productState.selected.id || productState.selected.productId;
          
          // Check if a release has been explicitly selected
          const explicitReleaseId = releaseState.selectedByProduct[productId];
          if (explicitReleaseId) {
            return explicitReleaseId;
          }
          
          // If no release selected, use the defaultRelease ID from the product response
          // The product.defaultRelease can be a string ID or an object
          if (productState.selected.defaultRelease) {
            if (typeof productState.selected.defaultRelease === 'object' && productState.selected.defaultRelease !== null) {
              // It's an object - extract the ID
              return productState.selected.defaultRelease.id || productState.selected.defaultRelease.releaseId || null;
            }
            // It's a string/ID directly - use it
            return productState.selected.defaultRelease;
          }
          
          // Fallback: use foundDefaultReleaseId if available (set during product fetch)
          if (productState.selected.foundDefaultReleaseId) {
            return productState.selected.foundDefaultReleaseId;
          }
          
          // Final fallback to other default release ID fields
          return productState.selected.defaultReleaseId ||
                 productState.selected.default_release_id ||
                 productState.selected.default_release ||
                 null;
        })()}
        expandedVariantId={variantState.expanded}
      />
      <ApsAppsDialog
        isOpen={showApsAppsDialog}
        onClose={() => setShowApsAppsDialog(false)}
        appName={apsAppName}
        clientId={apsClientId}
        onSwitchApp={async (credentials) => {
          try {
            // Save custom credentials
            await authService.setCustomApsCredentials(credentials);
            localStorage.setItem('custom_aps_credentials', JSON.stringify(credentials));
            setCustomApsCredentials(credentials);
            // Note: apsAppName and apsClientId will update automatically via hook

            // Clear existing tokens and force re-authentication (trigger logout)
            handleLogout();
          } catch (err) {
            throw new Error(err.message || 'Failed to switch app');
          }
        }}
      />
    </>
  );
}

export default App;

