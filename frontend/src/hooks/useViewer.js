import { useState, useCallback } from 'react';

/**
 * Custom hook for managing multiple viewer instances (GLB, RVT, DX).
 * Handles viewer URLs, tokens, models, views, and element selection for cross-highlighting.
 *
 * @returns {Object} Viewer state and methods
 */
export const useViewer = () => {
  // GLB Viewer (Product Viewer)
  const [showViewer, setShowViewer] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [viewerVariantData, setViewerVariantData] = useState(null);
  const [loadingSvfUrl, setLoadingSvfUrl] = useState(false);

  // RVT Viewer (Revit Files)
  const [showRvtViewer, setShowRvtViewer] = useState(false);
  const [rvtViewerUrl, setRvtViewerUrl] = useState(null);
  const [rvtViewerIsUrn, setRvtViewerIsUrn] = useState(false);
  const [rvtViewerToken, setRvtViewerToken] = useState(null);
  const [rvtViewerInstance, setRvtViewerInstance] = useState(null);
  const [rvtModel, setRvtModel] = useState(null);

  // DX Viewer (Data Exchange Files)
  const [showDxViewer, setShowDxViewer] = useState(false);
  const [dxViewerUrl, setDxViewerUrl] = useState(null);
  const [dxViewerIsUrn, setDxViewerIsUrn] = useState(false);
  const [dxViewerToken, setDxViewerToken] = useState(null);
  const [dxViewerInstance, setDxViewerInstance] = useState(null);
  const [dxModel, setDxModel] = useState(null);
  const [loadingDxSvfUrl, setLoadingDxSvfUrl] = useState(false);

  // Views (for RVT files)
  const [availableViews, setAvailableViews] = useState([]);
  const [selectedViewGuid, setSelectedViewGuid] = useState(null);
  const [loadingViews, setLoadingViews] = useState(false);

  // MID Elements (for cross-highlighting)
  const [midElements, setMidElements] = useState([]);
  const [loadingMidElements, setLoadingMidElements] = useState(false);
  const [selectedElements, setSelectedElements] = useState(new Set());
  const [highlightingElements, setHighlightingElements] = useState(false);

  /**
   * Open GLB viewer with a product variant.
   */
  const openGlbViewer = useCallback((url, token, variantData = null) => {
    setViewerUrl(url);
    setViewerToken(token);
    setViewerVariantData(variantData);
    setShowViewer(true);
  }, []);

  /**
   * Close GLB viewer.
   */
  const closeGlbViewer = useCallback(() => {
    setShowViewer(false);
    // Keep URL/token so button remains enabled
  }, []);

  /**
   * Open RVT viewer with a Revit file.
   */
  const openRvtViewer = useCallback((url, token, isUrn = false) => {
    setRvtViewerUrl(url);
    setRvtViewerToken(token);
    setRvtViewerIsUrn(isUrn);
    setShowRvtViewer(true);
  }, []);

  /**
   * Close RVT viewer.
   */
  const closeRvtViewer = useCallback(() => {
    setShowRvtViewer(false);
    setRvtViewerInstance(null);
    setRvtModel(null);
    setAvailableViews([]);
    setSelectedViewGuid(null);
    // Keep URL/token so button remains enabled
  }, []);

  /**
   * Open DX viewer with a data exchange file.
   */
  const openDxViewer = useCallback((url, token, isUrn = false) => {
    setDxViewerUrl(url);
    setDxViewerToken(token);
    setDxViewerIsUrn(isUrn);
    setShowDxViewer(true);
  }, []);

  /**
   * Close DX viewer.
   */
  const closeDxViewer = useCallback(() => {
    setShowDxViewer(false);
    setDxViewerInstance(null);
    setDxModel(null);
    // Keep URL/token so button remains enabled
  }, []);

  /**
   * Toggle element selection.
   */
  const toggleElementSelection = useCallback((dbId) => {
    setSelectedElements(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(dbId)) {
        newSelected.delete(dbId);
      } else {
        newSelected.add(dbId);
      }
      return newSelected;
    });
  }, []);

  /**
   * Select multiple elements.
   */
  const selectElements = useCallback((dbIds) => {
    setSelectedElements(new Set(dbIds));
  }, []);

  /**
   * Clear element selection.
   */
  const clearElementSelection = useCallback(() => {
    setSelectedElements(new Set());
  }, []);

  /**
   * Add elements to selection.
   */
  const addElementsToSelection = useCallback((dbIds) => {
    setSelectedElements(prev => {
      const newSelected = new Set(prev);
      dbIds.forEach(id => newSelected.add(id));
      return newSelected;
    });
  }, []);

  /**
   * Remove elements from selection.
   */
  const removeElementsFromSelection = useCallback((dbIds) => {
    setSelectedElements(prev => {
      const newSelected = new Set(prev);
      dbIds.forEach(id => newSelected.delete(id));
      return newSelected;
    });
  }, []);

  /**
   * Get the current active viewer instance.
   */
  const getActiveViewer = useCallback(() => {
    if (showRvtViewer) {
      return { instance: rvtViewerInstance, model: rvtModel, type: 'rvt' };
    }
    if (showDxViewer) {
      return { instance: dxViewerInstance, model: dxModel, type: 'dx' };
    }
    return { instance: null, model: null, type: null };
  }, [showRvtViewer, rvtViewerInstance, rvtModel, showDxViewer, dxViewerInstance, dxModel]);

  /**
   * Clear all viewer state.
   */
  const clearAllViewers = useCallback(() => {
    // GLB
    setShowViewer(false);
    setViewerUrl(null);
    setViewerToken(null);
    setViewerVariantData(null);

    // RVT
    setShowRvtViewer(false);
    setRvtViewerUrl(null);
    setRvtViewerToken(null);
    setRvtViewerInstance(null);
    setRvtModel(null);
    setAvailableViews([]);
    setSelectedViewGuid(null);

    // DX
    setShowDxViewer(false);
    setDxViewerUrl(null);
    setDxViewerToken(null);
    setDxViewerInstance(null);
    setDxModel(null);

    // Elements
    setMidElements([]);
    setSelectedElements(new Set());
  }, []);

  return {
    // GLB Viewer
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

    // RVT Viewer
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

    // DX Viewer
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

    // Views
    availableViews,
    setAvailableViews,
    selectedViewGuid,
    setSelectedViewGuid,
    loadingViews,
    setLoadingViews,

    // MID Elements
    midElements,
    setMidElements,
    loadingMidElements,
    setLoadingMidElements,
    selectedElements,
    setSelectedElements,
    highlightingElements,
    setHighlightingElements,

    // Methods
    openGlbViewer,
    closeGlbViewer,
    openRvtViewer,
    closeRvtViewer,
    openDxViewer,
    closeDxViewer,
    toggleElementSelection,
    selectElements,
    clearElementSelection,
    addElementsToSelection,
    removeElementsFromSelection,
    getActiveViewer,
    clearAllViewers,
  };
};
