import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing products, variants, releases, and related data.
 *
 * This hook provides a clean, grouped API for product management instead of
 * exposing 70+ individual state variables.
 *
 * @param {string} selectedFolder - Currently selected folder ID
 * @returns {Object} Grouped products state and methods
 *
 * @example
 * const { productState, variantState, releaseState, methods } = useProducts(folderId);
 *
 * // Access product data
 * const { list, selected, expanded, loading } = productState;
 *
 * // Update product state
 * methods.updateProductState({ loading: true });
 *
 * // Call methods
 * methods.selectProduct(product);
 */
export const useProducts = (selectedFolder) => {
  // ============================================================================
  // GROUPED STATE - Products
  // ============================================================================
  const [productState, setProductState] = useState({
    list: [],
    selected: null,
    expanded: null,
    loading: false,
    showNoMessage: false,
    retryCount: 0,
    loadAttempted: false,
    isRetrying: false,
  });

  // Refs for products (kept separate as they don't trigger re-renders)
  const noProductsTimeoutRef = useRef(null);
  const fetchProductsInProgressRef = useRef(false);
  const isRetryingProductsRef = useRef(false);

  // ============================================================================
  // GROUPED STATE - Variants
  // ============================================================================
  const [variantState, setVariantState] = useState({
    byRelease: {},           // { [releaseId]: [variants] }
    selected: null,
    expanded: null,
    details: {},             // { [variantId]: details }
    loadingByRelease: {},    // { [releaseId]: boolean }
    loadingDetails: {},      // { [variantId]: boolean }
  });

  // ============================================================================
  // GROUPED STATE - Variant Creation Form
  // ============================================================================
  const [formState, setFormState] = useState({
    showByRelease: {},       // { [releaseId]: boolean }
    dataByRelease: {},       // { [releaseId]: formData }
    creatingByRelease: {},   // { [releaseId]: boolean }
    errorsByRelease: {},     // { [releaseId]: errorMessage }
  });

  // ============================================================================
  // GROUPED STATE - Releases
  // ============================================================================
  const [releaseState, setReleaseState] = useState({
    byProduct: {},           // { [productId]: [releases] }
    selectedByProduct: {},   // { [productId]: releaseId }
    inputs: {},              // { [releaseId]: [inputs] }
    validationCode: {},      // { [releaseId]: code }
    rulesKey: {},            // { [releaseId]: key }
    dataCache: {},           // { [releaseId]: data }
    categories: new Map(),   // Map of release categories
    loadingRules: {},        // { [releaseId]: boolean }
    loadingInputs: {},       // { [releaseId]: boolean }
    loadingCategories: false,
  });

  // ============================================================================
  // GROUPED STATE - Validation
  // ============================================================================
  const [validationState, setValidationState] = useState({
    fieldErrors: {},         // { [fieldKey]: errorMessage }
    dismissedErrors: {},     // { [fieldKey]: boolean }
    pendingCorrections: {},  // { [fieldKey]: correction }
    validatingInputs: {},    // { [fieldKey]: boolean }
  });

  // ============================================================================
  // GROUPED STATE - Outputs
  // ============================================================================
  const [outputState, setOutputState] = useState({
    byVariant: {},                // { [variantId]: outputs }
    downloads: {},                // { [key]: downloadUrl }
    statuses: {},                 // { [key]: status }
    errors: {},                   // { [key]: errorMessage }
    loadingByVariant: {},         // { [variantId]: boolean }
    loadingDownloads: {},         // { [key]: boolean }
    downloadingByKey: {},         // { [key]: boolean }
    downloadStatuses: {},         // { [key]: status }
    selectedDownloadTypes: {},    // { [variantId]: type }
    selectedRepresentations: {}, // { [variantId]: representation }
    showGenerationPanel: {},      // { [variantId]: boolean }
    selectedOutputTypes: {},      // { [variantId]: [types] }
    generationProgress: {
      releaseId: null,
      current: 0,
      total: 0,
      successCount: 0,
      failureCount: 0,
    },
  });

  // ============================================================================
  // GROUPED STATE - Thumbnails
  // ============================================================================
  const [thumbnailState, setThumbnailState] = useState({
    products: {},            // { [productId]: thumbnailUrl }
    variants: {},            // { [variantId]: thumbnailUrl }
    glbPreviews: {},         // { [productId]: previewUrl }
    loadingVariants: {},     // { [variantId]: boolean }
    loadingGlbPreviews: {}, // { [productId]: boolean }
  });

  // ============================================================================
  // GROUPED STATE - Import/Export
  // ============================================================================
  const [importExportState, setImportExportState] = useState({
    importProgress: {
      releaseId: null,
      current: 0,
      total: 0,
    },
    showImportDialog: {
      releaseId: null,
      show: false,
    },
    dragOverReleaseId: null,
  });

  // ============================================================================
  // GROUPED STATE - Element Selection (for cross-highlighting)
  // ============================================================================
  const [selectionState, setSelectionState] = useState({
    categories: new Set(),
    products: new Set(),
    expandedCategories: new Set(),
    expandedProducts: new Set(),
    expandedElements: new Set(),
  });

  // ============================================================================
  // HELPER FUNCTIONS - State Updaters
  // ============================================================================

  /**
   * Update product state (partial update).
   * Supports both object updates and functional updates.
   * @example updateProductState({ loading: true, list: [...] })
   * @example updateProductState(prev => ({ ...prev, loading: true }))
   */
  const updateProductState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setProductState(updates);
    } else {
      setProductState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update variant state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateVariantState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setVariantState(updates);
    } else {
      setVariantState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update form state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateFormState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setFormState(updates);
    } else {
      setFormState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update release state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateReleaseState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setReleaseState(updates);
    } else {
      setReleaseState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update validation state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateValidationState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setValidationState(updates);
    } else {
      setValidationState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update output state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateOutputState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setOutputState(updates);
    } else {
      setOutputState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update thumbnail state (partial update).
   * Supports both object updates and functional updates.
   */
  const updateThumbnailState = useCallback((updates) => {
    if (typeof updates === 'function') {
      setThumbnailState(updates);
    } else {
      setThumbnailState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Update import/export state (partial update).
   */
  const updateImportExportState = useCallback((updates) => {
    setImportExportState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Update selection state (partial update).
   */
  const updateSelectionState = useCallback((updates) => {
    setSelectionState(prev => ({ ...prev, ...updates }));
  }, []);

  // ============================================================================
  // BUSINESS LOGIC METHODS
  // ============================================================================

  /**
   * Clear all product-related state.
   */
  const clearProducts = useCallback(() => {
    setProductState({
      list: [],
      selected: null,
      expanded: null,
      loading: false,
      showNoMessage: false,
      retryCount: 0,
      loadAttempted: false,
      isRetrying: false,
    });
    setVariantState({
      byRelease: {},
      selected: null,
      expanded: null,
      details: {},
      loadingByRelease: {},
      loadingDetails: {},
    });
    setOutputState(prev => ({
      ...prev,
      byVariant: {},
    }));
    if (noProductsTimeoutRef.current) {
      clearTimeout(noProductsTimeoutRef.current);
    }
  }, []);

  /**
   * Select a product.
   */
  const selectProduct = useCallback((product) => {
    updateProductState({ selected: product });
  }, [updateProductState]);

  /**
   * Toggle product expansion.
   */
  const toggleProductExpansion = useCallback((productId) => {
    setProductState(prev => ({
      ...prev,
      expanded: prev.expanded === productId ? null : productId
    }));
  }, []);

  /**
   * Toggle variant expansion.
   */
  const toggleVariantExpansion = useCallback((variantId) => {
    setVariantState(prev => ({
      ...prev,
      expanded: prev.expanded === variantId ? null : variantId
    }));
  }, []);

  /**
   * Show/hide variant creation form for a release.
   */
  const toggleCreateVariantForm = useCallback((releaseId, show) => {
    setFormState(prev => {
      const updated = { ...prev };
      updated.showByRelease = { ...prev.showByRelease, [releaseId]: show };

      if (!show) {
        // Clear form data when hiding
        const newData = { ...prev.dataByRelease };
        delete newData[releaseId];
        updated.dataByRelease = newData;
      }

      return updated;
    });
  }, []);

  /**
   * Update variant form data for a specific release.
   */
  const updateVariantFormData = useCallback((releaseId, data) => {
    setFormState(prev => ({
      ...prev,
      dataByRelease: {
        ...prev.dataByRelease,
        [releaseId]: {
          ...(prev.dataByRelease[releaseId] || {}),
          ...data
        }
      }
    }));
  }, []);

  /**
   * Toggle output generation panel for a variant.
   */
  const toggleOutputGenerationPanel = useCallback((variantId, show) => {
    setOutputState(prev => ({
      ...prev,
      showGenerationPanel: {
        ...prev.showGenerationPanel,
        [variantId]: show
      }
    }));
  }, []);

  // ============================================================================
  // RETURN GROUPED API
  // ============================================================================

  return {
    // Grouped state objects (8 main groups instead of 70+ individual items)
    productState,
    variantState,
    formState,
    releaseState,
    validationState,
    outputState,
    thumbnailState,
    importExportState,
    selectionState,

    // Refs (kept separate as they don't trigger re-renders)
    refs: {
      noProductsTimeout: noProductsTimeoutRef,
      fetchProductsInProgress: fetchProductsInProgressRef,
      isRetryingProducts: isRetryingProductsRef,
    },

    // State updaters (9 functions for partial updates)
    updaters: {
      updateProductState,
      updateVariantState,
      updateFormState,
      updateReleaseState,
      updateValidationState,
      updateOutputState,
      updateThumbnailState,
      updateImportExportState,
      updateSelectionState,
    },

    // Business logic methods (7 functions)
    methods: {
      clearProducts,
      selectProduct,
      toggleProductExpansion,
      toggleVariantExpansion,
      toggleCreateVariantForm,
      updateVariantFormData,
      toggleOutputGenerationPanel,
    },
  };
};

/**
 * MIGRATION GUIDE for existing code:
 *
 * OLD WAY:
 * const { products, setProducts, loadingProducts, setLoadingProducts, ... } = useProducts(folder);
 * setProducts(newProducts);
 * setLoadingProducts(true);
 *
 * NEW WAY:
 * const { productState, updaters } = useProducts(folder);
 * const { list, loading } = productState;
 * updaters.updateProductState({ list: newProducts, loading: true });
 *
 * This reduces 70+ destructured items to ~10 logical groups, making the API much clearer!
 */
