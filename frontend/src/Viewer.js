/* global Autodesk */
import React, { useEffect, useRef, useState } from 'react';
import './Viewer.css';
import { useI18n } from './i18n/I18nContext';

function Viewer({ svfUrl: propSvfUrl, token: propToken, isUrn: propIsUrn, viewGuid: propViewGuid, onModelLoaded, onSelectionChange }) {
  const { t } = useI18n();
  const viewerContainer = useRef(null);
  const viewerInstance = useRef(null);
  const resizeHandlerRef = useRef(null);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    let isMounted = true;
    
    // Get SVF URL and token from props or URL parameters (for backward compatibility)
    const urlParams = new URLSearchParams(window.location.search);
    const svfUrl = propSvfUrl || urlParams.get('svfUrl');
    const token = propToken || urlParams.get('token');
    const isUrn = propIsUrn || false;
    const viewGuid = propViewGuid || null;

    if (!svfUrl || !token) {
      setError(null); // Don't show error if no URL/token - component just won't render viewer
      setLoading(false);
      return;
    }

    // Reset error and loading state when props change
    setError(null);
    setLoading(true);

    // Initialize Autodesk Viewer
    const initViewer = async () => {
      try {
        // Wait for Autodesk viewer script to load
        let waitAttempts = 0;
        const maxWaitAttempts = 50;
        
        while (typeof Autodesk === 'undefined' || typeof Autodesk.Viewing === 'undefined') {
          if (waitAttempts >= maxWaitAttempts) {
            setError('Autodesk Viewer library failed to load. Please refresh the page.');
            setLoading(false);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          waitAttempts++;
        }

        // Create viewer options
        // For SVF2 files, we need to use AutodeskProduction2 and streamingV2
        // For SVF files, we use AutodeskProduction
        // Check if the URL is a manifest URL (contains /manifest) to determine if it's SVF2
        const isSvf2 = svfUrl.includes('/manifest') || isUrn;
        const options = isSvf2 ? {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken: (onTokenReady) => {
            onTokenReady(token, 3600);
          },
        } : {
          env: 'AutodeskProduction',
          getAccessToken: (onTokenReady) => {
            onTokenReady(token, 3600);
          },
        };

        // Initialize the viewer
        try {
          Autodesk.Viewing.Initializer(options, () => {
            try {
              // Create viewer instance
              if (!viewerContainer.current) {
                console.error('[Viewer] viewerContainer.current is null');
                setError('Viewer container not available');
                setLoading(false);
                return;
              }
              
              let viewer;
              try {
                viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainer.current);
              } catch (err) {
                console.error('[Viewer] Error creating viewer:', err);
                setError(`Failed to create viewer: ${err.message || 'Unknown error'}`);
                setLoading(false);
                return;
              }
              
              if (!viewer) {
                console.error('[Viewer] viewer is null after creation');
                setError('Failed to create viewer');
                setLoading(false);
                return;
              }
              
              viewerInstance.current = viewer;
              
              try {
                viewer.start();
              } catch (err) {
                console.error('[Viewer] Error starting viewer:', err);
                setError(`Failed to start viewer: ${err.message || 'Unknown error'}`);
                setLoading(false);
                return;
              }
            
            // Helper function to wait for model and then search for MID/ elements
            const waitForModelAndSearch = (viewerInstance) => {
              try {
                if (!viewerInstance) {
                  console.error('[Viewer] waitForModelAndSearch: viewerInstance is null');
                  return;
                }
                
                // Safe callback wrapper
                const safeCallback = (midElements) => {
                  try {
                    if (onModelLoadedRef.current && typeof onModelLoadedRef.current === 'function') {
                      onModelLoadedRef.current(viewerInstance, viewerInstance.model, midElements || []);
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in onModelLoaded callback:', err);
                  }
                };
                
                // Check if model is already available
                if (viewerInstance.model) {
                  searchForMidElements(viewerInstance, safeCallback);
                  return;
                }
                
                // Wait for geometry loaded event
                const onGeometryLoaded = () => {
                  try {
                    if (viewerInstance && viewerInstance.model) {
                      searchForMidElements(viewerInstance, safeCallback);
                      if (viewerInstance.removeEventListener) {
                        viewerInstance.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
                      }
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in onGeometryLoaded:', err);
                  }
                };
                
                // Also listen for MODEL_ROOT_LOADED_EVENT as a fallback
                const onModelRootLoaded = () => {
                  try {
                    if (viewerInstance && viewerInstance.model) {
                      searchForMidElements(viewerInstance, safeCallback);
                      if (viewerInstance.removeEventListener) {
                        viewerInstance.removeEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, onModelRootLoaded);
                      }
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in onModelRootLoaded:', err);
                  }
                };
                
                // Also listen for SELECTION_CHANGED_EVENT as another indicator for MID search
                const onSelectionChanged = () => {
                  try {
                    if (viewerInstance && viewerInstance.model && !viewerInstance.model._midSearchDone) {
                      viewerInstance.model._midSearchDone = true; // Prevent multiple searches
                      searchForMidElements(viewerInstance, safeCallback);
                    }
                    // Report selection to parent so product panel can sync (group/product selection in SVF)
                    if (onSelectionChangeRef.current && typeof viewerInstance.getSelection === 'function') {
                      const dbIds = viewerInstance.getSelection();
                      onSelectionChangeRef.current(Array.isArray(dbIds) ? dbIds : []);
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in onSelectionChanged:', err);
                  }
                };

                try {
                  viewerInstance.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
                  viewerInstance.addEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, onModelRootLoaded);
                  viewerInstance.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, onSelectionChanged);
                } catch (err) {
                  console.error('[Viewer] Error adding event listeners:', err);
                }
                
                // Fallback timeout if events don't fire (keep SELECTION_CHANGED so product selection in viewer keeps working)
                setTimeout(() => {
                  try {
                    if (viewerInstance && viewerInstance.model) {
                      searchForMidElements(viewerInstance, safeCallback);
                      if (viewerInstance.removeEventListener) {
                        viewerInstance.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
                        viewerInstance.removeEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, onModelRootLoaded);
                      }
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in timeout fallback:', err);
                  }
                }, 5000);
              } catch (err) {
                console.error('[Viewer] Error in waitForModelAndSearch:', err);
              }
            };
            
            // Helper function to search for elements with MID/ prefix
            const searchForMidElements = (viewerInstance, callback) => {
              try {
                // Validate inputs
                if (!viewerInstance) {
                  console.error('[Viewer] searchForMidElements: viewerInstance is null/undefined');
                  if (callback && typeof callback === 'function') callback([]);
                  return;
                }
                
                if (!callback || typeof callback !== 'function') {
                  console.error('[Viewer] searchForMidElements: callback is not a function');
                  return;
                }
                
                // Get the model from the viewer instance
                const model = viewerInstance.model;
                if (!model) {
                  if (callback) callback([]);
                  return;
                }
                
                if (!model.getPropertyDb || typeof model.getPropertyDb !== 'function') {
                  if (callback) callback([]);
                  return;
                }
                
                const propertyDb = model.getPropertyDb();
                if (!propertyDb) {
                  if (callback) callback([]);
                  return;
                }
                
                // Try different methods to get object IDs depending on model type
                // IMPORTANT: We need actual object IDs (dbIds), not fragment indices
                
                // NEW APPROACH: Use viewer.getProperties() instead of propertyDb.getObjectProperties()
                // The property panel uses viewer.getProperties(), so we should too
                const foundMidElements = [];
                let testedCount = 0;
                const testRange = 50000; // Expanded range to catch more objects
                
                const testNextId = () => {
                  if (testedCount >= testRange) {
                    if (callback) callback(foundMidElements);
                    return;
                  }
                  
                  const dbId = testedCount++;
                  // Use viewer.getProperties() - this is what the property panel uses
                  viewerInstance.getProperties(dbId, (props) => {
                    try {
                      if (props) {
                        let allProperties = [];
                        
                        // CRITICAL: The viewer.getProperties() returns props.properties as an array
                        // Each property has displayName, displayValue, displayCategory
                        if (props.properties && Array.isArray(props.properties)) {
                          allProperties = allProperties.concat(props.properties);
                        }
                        
                        // Also check categories structure (if present)
                        if (props.categories && Array.isArray(props.categories)) {
                          props.categories.forEach(cat => {
                            if (cat.properties && Array.isArray(cat.properties)) {
                              cat.properties.forEach(prop => {
                                allProperties.push({
                                  ...prop,
                                  category: cat.name || cat.displayName || 'General'
                                });
                              });
                            }
                          });
                        }
                        
                        // Check props.properties.Data (if it's an object, not array)
                        if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                          if (props.properties.Data && typeof props.properties.Data === 'object') {
                            Object.keys(props.properties.Data).forEach(key => {
                              allProperties.push({
                                displayName: key,
                                name: key,
                                displayValue: props.properties.Data[key],
                                value: props.properties.Data[key],
                                category: 'Data'
                              });
                            });
                          }
                          // Check ALL property categories in props.properties object
                          Object.keys(props.properties).forEach(catKey => {
                            const catValue = props.properties[catKey];
                            if (catValue && typeof catValue === 'object' && !Array.isArray(catValue)) {
                              Object.keys(catValue).forEach(propKey => {
                                allProperties.push({
                                  displayName: propKey,
                                  name: propKey,
                                  displayValue: catValue[propKey],
                                  value: catValue[propKey],
                                  category: catKey
                                });
                              });
                            }
                          });
                        }
                        
                        // Check props.Data (capital D) - direct access
                        if (props.Data && typeof props.Data === 'object' && !Array.isArray(props.Data)) {
                          Object.keys(props.Data).forEach(key => {
                            allProperties.push({
                              displayName: key,
                              name: key,
                              displayValue: props.Data[key],
                              value: props.Data[key]
                            });
                          });
                        }
                        
                        // Filter for MID/ prefix
                        const midProps = allProperties.filter(p => {
                          if (!p) return false;
                          const name = String(p.displayName || p.name || '').toLowerCase();
                          const value = String(p.displayValue || p.value || '').toLowerCase();
                          return name.startsWith('mid/') || value.startsWith('mid/');
                        });
                        
                        if (midProps.length > 0) {
                          foundMidElements.push({
                            dbId: dbId,
                            name: props.name || `Element ${dbId}`,
                            properties: midProps,
                            allProperties: allProperties
                          });
                        }
                      }
                    } catch (err) {
                      // Continue on error
                    }
                    
                    // Continue (batch every 100 IDs to avoid blocking UI)
                    if (testedCount % 100 === 0) {
                      setTimeout(testNextId, 5);
                    } else {
                      testNextId();
                    }
                  }, () => {
                    // No properties for this ID, continue
                    if (testedCount % 100 === 0) {
                      setTimeout(testNextId, 5);
                    } else {
                      testNextId();
                    }
                  });
                };
                
                // Start immediately
                testNextId();
                return;
                
                // OLD CODE BELOW - not executing due to return above
                // eslint-disable-next-line no-unreachable
                let objectIds = [];
                
                // Method 1: Try propertyDb.getObjectIds() first - this is the most reliable for SVF2
                if (propertyDb.getObjectIds && typeof propertyDb.getObjectIds === 'function') {
                  try {
                    objectIds = propertyDb.getObjectIds();
                  } catch (err) {
                    // Ignore errors
                  }
                }
                
                // Method 2: Try getAllObjectIds on propertyDb
                if (objectIds.length === 0 && propertyDb.getAllObjectIds && typeof propertyDb.getAllObjectIds === 'function') {
                  try {
                    objectIds = propertyDb.getAllObjectIds();
                  } catch (err) {
                    // Ignore errors
                  }
                }
                
                // Method 3: getObjectIds() - standard method on model
                if (objectIds.length === 0 && model.getObjectIds && typeof model.getObjectIds === 'function') {
                  try {
                    objectIds = model.getObjectIds();
                  } catch (err) {
                    // Ignore errors
                  }
                }
                
                // Method 4: Try getAllLeafNodes() - for SVF2 models
                if (objectIds.length === 0 && model.getAllLeafNodes && typeof model.getAllLeafNodes === 'function') {
                  try {
                    objectIds = model.getAllLeafNodes();
                  } catch (err) {
                    // Ignore errors
                  }
                }
                
                // Method 5: Try getAllObjectIds() on model if available
                if (objectIds.length === 0 && model.getAllObjectIds && typeof model.getAllObjectIds === 'function') {
                  try {
                    objectIds = model.getAllObjectIds();
                  } catch (err) {
                    // Ignore errors
                  }
                }
                
                // Note: getFragmentList() gives fragment indices (0, 1, 2, ...), not object IDs (dbIds)
                // We should NOT use this for property queries as it will cause errors with getBulkProperties
                
                // Helper function to process objects once we have object IDs
                const processObjects = () => {
                  try {
                    const totalObjects = objectIds.length;
                    
                    if (totalObjects === 0) {
                      if (callback) callback([]);
                      return;
                    }
                    
                    const midElements = [];
                    
                    // Validate propertyDb is still available
                    if (!propertyDb) {
                      console.error('[Viewer] processObjects: propertyDb is null');
                      if (callback) callback([]);
                      return;
                    }
                    
                    // Try using getBulkProperties for better performance (processes multiple objects at once)
                    if (propertyDb && propertyDb.getBulkProperties && typeof propertyDb.getBulkProperties === 'function') {
                      // Process in batches to avoid overwhelming the API
                      const batchSize = 100;
                      let currentBatch = 0;
                    
                    const processBatch = () => {
                      const startIndex = currentBatch * batchSize;
                      const endIndex = Math.min(startIndex + batchSize, totalObjects);
                      const batchIds = objectIds.slice(startIndex, endIndex);
                      
                      if (batchIds.length === 0) {
                        if (callback) callback(midElements);
                        return;
                      }
                      
                      propertyDb.getBulkProperties(batchIds, (results) => {
                        try {
                          if (!results || !Array.isArray(results)) {
                            currentBatch++;
                            processBatch();
                            return;
                          }
                          
                          results.forEach((result, idx) => {
                            if (!result) return;
                            
                            const dbId = batchIds[idx];
                            const props = result;
                            
                            // Extract all properties from different possible structures
                            let allProperties = [];
                            
                            // Method 1: Direct properties array
                            if (props.properties && Array.isArray(props.properties)) {
                              allProperties = allProperties.concat(props.properties);
                            }
                            
                            // Method 2: Categories structure
                            if (props.categories && Array.isArray(props.categories)) {
                              props.categories.forEach(category => {
                                if (category.properties && Array.isArray(category.properties)) {
                                  allProperties = allProperties.concat(category.properties);
                                }
                              });
                            }
                            
                            // Method 3: Check data section directly
                            if (props.data) {
                              // If data is an array, it might contain properties
                              if (Array.isArray(props.data)) {
                                allProperties = allProperties.concat(props.data);
                              }
                              // If data is an object, check for nested properties
                              else if (typeof props.data === 'object') {
                                // Check if data has properties
                                if (props.data.properties && Array.isArray(props.data.properties)) {
                                  allProperties = allProperties.concat(props.data.properties);
                                }
                                // Check if data has categories
                                if (props.data.categories && Array.isArray(props.data.categories)) {
                                  props.data.categories.forEach(category => {
                                    if (category.properties && Array.isArray(category.properties)) {
                                      allProperties = allProperties.concat(category.properties);
                                    }
                                  });
                                }
                                // Check all keys in data object for property-like structures
                                Object.keys(props.data).forEach(key => {
                                  const value = props.data[key];
                                  if (Array.isArray(value)) {
                                    // Check if array contains property objects
                                    value.forEach(item => {
                                      if (item && typeof item === 'object' && (item.displayName || item.name || item.value)) {
                                        allProperties.push(item);
                                      }
                                    });
                                  } else if (value && typeof value === 'object' && (value.displayName || value.name || value.value)) {
                                    allProperties.push(value);
                                  }
                                });
                              }
                            }
                            
                            // Method 4: Look for a "Data" key in the props object (capital D)
                            if (props.Data) {
                              const dataSection = props.Data;
                              if (Array.isArray(dataSection)) {
                                allProperties = allProperties.concat(dataSection);
                              } else if (dataSection.properties && Array.isArray(dataSection.properties)) {
                                allProperties = allProperties.concat(dataSection.properties);
                              } else if (typeof dataSection === 'object') {
                                // Treat each key-value pair as a potential property
                                Object.keys(dataSection).forEach(key => {
                                  const value = dataSection[key];
                                  allProperties.push({
                                    displayName: key,
                                    name: key,
                                    displayValue: value,
                                    value: value
                                  });
                                });
                              }
                            }
                            
                            // Method 5: Check props.properties.Data (where MID properties are stored)
                            if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                              if (props.properties.Data && typeof props.properties.Data === 'object') {
                                Object.keys(props.properties.Data).forEach(key => {
                                  allProperties.push({
                                    displayName: key,
                                    name: key,
                                    displayValue: props.properties.Data[key],
                                    value: props.properties.Data[key],
                                    category: 'Data'
                                  });
                                });
                              }
                              
                              // Also check other categories in props.properties
                              Object.keys(props.properties).forEach(categoryKey => {
                                if (categoryKey === 'Data') return; // Already processed
                                const categoryProps = props.properties[categoryKey];
                                if (categoryProps && typeof categoryProps === 'object') {
                                  Object.keys(categoryProps).forEach(key => {
                                    allProperties.push({
                                      displayName: key,
                                      name: key,
                                      displayValue: categoryProps[key],
                                      value: categoryProps[key],
                                      category: categoryKey
                                    });
                                  });
                                }
                              });
                            }
                            
                            // Check if any property name or value starts with "MID/"
                            const midProperties = allProperties.filter(prop => {
                              if (!prop) return false;
                              // Check both property name and value for MID/ prefix (case-sensitive)
                              const propName = prop.displayName || prop.name || prop.attributeName || prop.key || '';
                              const propValue = prop.displayValue || prop.value || prop.attributeValue || '';
                              const nameStr = String(propName);
                              const valueStr = String(propValue);
                              const hasMidPrefix = nameStr.startsWith('MID/') || valueStr.startsWith('MID/');
                              
                              return hasMidPrefix;
                            });
                            
                            if (midProperties.length > 0) {
                              const name = props.name || `Element ${dbId}`;
                              midElements.push({
                                dbId: dbId,
                                name: name,
                                properties: midProperties,
                                allProperties: allProperties // Include all properties for renderMidElementsTree
                              });
                            }
                          });
                        } catch (err) {
                          console.error('[Viewer] Error processing batch:', err);
                        }
                        
                        currentBatch++;
                        processBatch();
                      }, (err) => {
                        console.error('[Viewer] Error in getBulkProperties:', err);
                        currentBatch++;
                        processBatch();
                      });
                    };
                    
                    processBatch();
                    } else {
                      // Fallback to individual queries
                      if (!propertyDb || !propertyDb.getObjectProperties || typeof propertyDb.getObjectProperties !== 'function') {
                      console.error('[Viewer] processObjects: getObjectProperties is not available');
                      if (callback) callback([]);
                      return;
                    }
                    
                    let index = 0;
                    const processNext = () => {
                      try {
                        if (index >= totalObjects) {
                          if (callback) callback(midElements);
                          return;
                        }
                        const dbId = objectIds[index++];
                        if (dbId === undefined || dbId === null) {
                          processNext();
                          return;
                        }
                        propertyDb.getObjectProperties(dbId, (props) => {
                          try {
                            if (props) {
                              let allProperties = [];
                              
                              // Method 1: Direct properties array
                              if (props.properties && Array.isArray(props.properties)) {
                                allProperties = allProperties.concat(props.properties);
                              }
                              // Method 2: Categories structure
                              else if (props.categories && Array.isArray(props.categories)) {
                                props.categories.forEach(category => {
                                  if (category.properties && Array.isArray(category.properties)) {
                                    allProperties = allProperties.concat(category.properties);
                                  }
                                });
                              }
                              // Method 3: Check data section (user mentioned this)
                              if (props.data) {
                                // If data is an array, it might contain properties
                                if (Array.isArray(props.data)) {
                                  allProperties = allProperties.concat(props.data);
                                }
                                // If data is an object, check for nested properties
                                else if (typeof props.data === 'object') {
                                  // Check if data has properties
                                  if (props.data.properties && Array.isArray(props.data.properties)) {
                                    allProperties = allProperties.concat(props.data.properties);
                                  }
                                  // Check if data has categories
                                  if (props.data.categories && Array.isArray(props.data.categories)) {
                                    props.data.categories.forEach(category => {
                                      if (category.properties && Array.isArray(category.properties)) {
                                        allProperties = allProperties.concat(category.properties);
                                      }
                                    });
                                  }
                                  // Check all keys in data object for property-like structures
                                  Object.keys(props.data).forEach(key => {
                                    const value = props.data[key];
                                    if (Array.isArray(value)) {
                                      // Check if array contains property objects
                                      value.forEach(item => {
                                        if (item && typeof item === 'object' && (item.displayName || item.name || item.value)) {
                                          allProperties.push(item);
                                        }
                                      });
                                    } else if (value && typeof value === 'object' && (value.displayName || value.name || value.value)) {
                                      allProperties.push(value);
                                    }
                                  });
                                }
                              }
                              // Method 4: Check props.Data (capital D)
                              if (props.Data) {
                                const dataSection = props.Data;
                                if (Array.isArray(dataSection)) {
                                  allProperties = allProperties.concat(dataSection);
                                } else if (dataSection.properties && Array.isArray(dataSection.properties)) {
                                  allProperties = allProperties.concat(dataSection.properties);
                                } else if (typeof dataSection === 'object') {
                                  // Treat each key-value pair as a potential property
                                  Object.keys(dataSection).forEach(key => {
                                    const value = dataSection[key];
                                    allProperties.push({
                                      displayName: key,
                                      name: key,
                                      displayValue: value,
                                      value: value
                                    });
                                  });
                                }
                              }
                              // Method 5: Check props.properties.Data (where MID properties are stored)
                              if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                                if (props.properties.Data && typeof props.properties.Data === 'object') {
                                  Object.keys(props.properties.Data).forEach(key => {
                                    allProperties.push({
                                      displayName: key,
                                      name: key,
                                      displayValue: props.properties.Data[key],
                                      value: props.properties.Data[key],
                                      category: 'Data'
                                    });
                                  });
                                }
                              }
                              // Method 6: Fallback - check all keys
                              else {
                                Object.keys(props).forEach(key => {
                                  if (key !== 'name' && key !== 'dbId' && Array.isArray(props[key])) {
                                    allProperties = allProperties.concat(props[key]);
                                  } else if (key !== 'name' && key !== 'dbId' && typeof props[key] === 'object' && props[key] !== null) {
                                    if (props[key].properties) {
                                      allProperties = allProperties.concat(props[key].properties);
                                    }
                                  }
                                });
                              }
                              
                              const midProperties = allProperties.filter(prop => {
                                if (!prop) return false;
                                // Check both property name and value for MID/ prefix
                                const propName = prop.displayName || prop.name || prop.attributeName || prop.key || '';
                                const propValue = prop.displayValue || prop.value || prop.attributeValue || '';
                                const nameStr = String(propName);
                                const valueStr = String(propValue);
                                return nameStr.startsWith('MID/') || valueStr.startsWith('MID/');
                              });
                              
                              if (midProperties.length > 0) {
                                const name = props.name || `Element ${dbId}`;
                                midElements.push({
                                  dbId: dbId,
                                  name: name,
                                  properties: midProperties,
                                  allProperties: allProperties
                                });
                              }
                            }
                          } catch (err) {
                            console.error('[Viewer] Error processing individual property:', err);
                          }
                          processNext();
                        }, (err) => {
                          console.error('[Viewer] Error getting object properties:', err);
                          processNext();
                        });
                      } catch (err) {
                        console.error('[Viewer] Error in processNext:', err);
                        if (callback) callback(midElements);
                      }
                    };
                    processNext();
                    }
                  } catch (err) {
                    console.error('[Viewer] Error in processObjects:', err);
                    if (callback) callback([]);
                  }
                };
                
                // If we found object IDs, process them
                // eslint-disable-next-line no-unreachable
                if (objectIds.length > 0) {
                  processObjects();
                  return;
                }
                
                // If still no object IDs, wait for propertyDb to initialize
                if (objectIds.length === 0) {
                  // Wait for propertyDb to be ready (check every 500ms, up to 10 seconds)
                  let waitAttempts = 0;
                  const maxWaitAttempts = 20;
                  
                  const checkPropertyDb = () => {
                    waitAttempts++;
                    
                    // Re-check propertyDb from model each time (it might not be ready initially)
                    const currentPropertyDb = model.getPropertyDb();
                    if (currentPropertyDb) {
                      
                      // Try currentPropertyDb.getObjectIds()
                      if (currentPropertyDb.getObjectIds && typeof currentPropertyDb.getObjectIds === 'function') {
                        try {
                          const ids = currentPropertyDb.getObjectIds();
                          if (ids && ids.length > 0) {
                            // Set objectIds and continue with search inline
                            objectIds = ids;
                            
                            // Now perform the search with the found IDs
                            const totalObjs = objectIds.length;
                            
                            if (totalObjs === 0) {
                              if (callback) callback([]);
                              return;
                            }
                            
                            const midElems = [];
                            
                            // Try using getBulkProperties
                            if (currentPropertyDb.getBulkProperties) {
                              
                              const batchSize = 100;
                              let currentBatch = 0;
                              
                              const processBatch = () => {
                                const startIndex = currentBatch * batchSize;
                                const endIndex = Math.min(startIndex + batchSize, totalObjs);
                                const batchIds = objectIds.slice(startIndex, endIndex);
                                
                                if (batchIds.length === 0) {
                                  if (callback) callback(midElems);
                                  return;
                                }
                                
                                currentPropertyDb.getBulkProperties(batchIds, (results) => {
                                  try {
                                    if (!results || !Array.isArray(results)) {
                                      currentBatch++;
                                      processBatch();
                                      return;
                                    }
                                    
                                    results.forEach((result, idx) => {
                                      if (!result) return;
                                      
                                      const dbId = batchIds[idx];
                                      const props = result;
                                      
                                      // Extract all properties
                                      let allProperties = [];
                                      
                                      // Method 1: Direct properties array
                                      if (props.properties && Array.isArray(props.properties)) {
                                        allProperties = allProperties.concat(props.properties);
                                      }
                                      
                                      // Method 2: Categories structure
                                      if (props.categories && Array.isArray(props.categories)) {
                                        props.categories.forEach(category => {
                                          if (category.properties && Array.isArray(category.properties)) {
                                            allProperties = allProperties.concat(category.properties);
                                          }
                                        });
                                      }
                                      
                                      // Method 3: Check data section directly
                                      if (props.data) {
                                        if (Array.isArray(props.data)) {
                                          allProperties = allProperties.concat(props.data);
                                        } else if (typeof props.data === 'object') {
                                          if (props.data.properties && Array.isArray(props.data.properties)) {
                                            allProperties = allProperties.concat(props.data.properties);
                                          }
                                          if (props.data.categories && Array.isArray(props.data.categories)) {
                                            props.data.categories.forEach(category => {
                                              if (category.properties && Array.isArray(category.properties)) {
                                                allProperties = allProperties.concat(category.properties);
                                              }
                                            });
                                          }
                                          Object.keys(props.data).forEach(key => {
                                            const value = props.data[key];
                                            if (Array.isArray(value)) {
                                              value.forEach(item => {
                                                if (item && typeof item === 'object' && (item.displayName || item.name || item.value)) {
                                                  allProperties.push(item);
                                                }
                                              });
                                            } else if (value && typeof value === 'object' && (value.displayName || value.name || value.value)) {
                                              allProperties.push(value);
                                            }
                                          });
                                        }
                                      }
                                      
                                      // Method 4: Look for a "Data" key in the props object (capital D)
                                      if (props.Data) {
                                        const dataSection = props.Data;
                                        if (Array.isArray(dataSection)) {
                                          allProperties = allProperties.concat(dataSection);
                                        } else if (dataSection.properties && Array.isArray(dataSection.properties)) {
                                          allProperties = allProperties.concat(dataSection.properties);
                                        } else if (typeof dataSection === 'object') {
                                          Object.keys(dataSection).forEach(key => {
                                            const value = dataSection[key];
                                            allProperties.push({
                                              displayName: key,
                                              name: key,
                                              displayValue: value,
                                              value: value
                                            });
                                          });
                                        }
                                      }
                                      
                                      // Method 5: Check props.properties.Data (where MID properties are stored)
                                      if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                                        if (props.properties.Data && typeof props.properties.Data === 'object') {
                                          Object.keys(props.properties.Data).forEach(key => {
                                            allProperties.push({
                                              displayName: key,
                                              name: key,
                                              displayValue: props.properties.Data[key],
                                              value: props.properties.Data[key],
                                              category: 'Data'
                                            });
                                          });
                                        }
                                      }
                                      
                                      // Check for MID/ prefix
                                      const midProperties = allProperties.filter(prop => {
                                        if (!prop) return false;
                                        const propName = prop.displayName || prop.name || prop.attributeName || prop.key || '';
                                        const propValue = prop.displayValue || prop.value || prop.attributeValue || '';
                                        const hasMid = String(propName).startsWith('MID/') || String(propValue).startsWith('MID/');
                                        return hasMid;
                                      });
                                      
                                      if (midProperties.length > 0) {
                                        const name = props.name || `Element ${dbId}`;
                                        midElems.push({
                                          dbId: dbId,
                                          name: name,
                                          properties: midProperties,
                                          allProperties: allProperties
                                        });
                                      }
                                    });
                                  } catch (err) {
                                    // Error handling
                                  }
                                  
                                  currentBatch++;
                                  processBatch();
                                }, (err) => {
                                  currentBatch++;
                                  processBatch();
                                });
                              };
                              
                              processBatch();
                              return;
                            }
                            
                            // Fallback to individual fetching
                            const processNext = (index) => {
                              if (index >= totalObjs) {
                                if (callback) callback(midElems);
                                return;
                              }
                              
                              const dbId = objectIds[index];
                              currentPropertyDb.getObjectProperties(dbId, (props) => {
                                if (props) {
                                  let allProperties = [];
                                  if (props.properties) allProperties = allProperties.concat(props.properties);
                                  if (props.categories) {
                                    props.categories.forEach(cat => {
                                      if (cat.properties) allProperties = allProperties.concat(cat.properties);
                                    });
                                  }
                                  if (props.Data) {
                                    const dataSection = props.Data;
                                    if (typeof dataSection === 'object' && !Array.isArray(dataSection)) {
                                      Object.keys(dataSection).forEach(key => {
                                        allProperties.push({
                                          displayName: key,
                                          name: key,
                                          displayValue: dataSection[key],
                                          value: dataSection[key]
                                        });
                                      });
                                    }
                                  }
                                  if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                                    if (props.properties.Data && typeof props.properties.Data === 'object') {
                                      Object.keys(props.properties.Data).forEach(key => {
                                        allProperties.push({
                                          displayName: key,
                                          name: key,
                                          displayValue: props.properties.Data[key],
                                          value: props.properties.Data[key],
                                          category: 'Data'
                                        });
                                      });
                                    }
                                  }
                                  
                                  const midProps = allProperties.filter(p => {
                                    const name = p.displayName || p.name || '';
                                    const value = p.displayValue || p.value || '';
                                    return String(name).startsWith('MID/') || String(value).startsWith('MID/');
                                  });
                                  
                                  if (midProps.length > 0) {
                                    midElems.push({
                                      dbId: dbId,
                                      name: props.name || `Element ${dbId}`,
                                      properties: midProps,
                                      allProperties: allProperties
                                    });
                                  }
                                }
                                processNext(index + 1);
                              }, () => processNext(index + 1));
                            };
                            processNext(0);
                            return;
                          }
                        } catch (err) {
                          // Error getting object IDs
                        }
                      }
                    }
                    
                    // Also try the original propertyDb reference
                    if (propertyDb && propertyDb.getObjectIds && typeof propertyDb.getObjectIds === 'function') {
                      try {
                        const ids = propertyDb.getObjectIds();
                        if (ids && ids.length > 0) {
                          objectIds = ids;
                          // Continue with the search by calling the search function recursively
                          searchForMidElements(viewerInstance, callback);
                          return;
                        }
                      } catch (err) {
                        // Error handling
                      }
                    }
                    
                    if (waitAttempts < maxWaitAttempts) {
                      setTimeout(checkPropertyDb, 500);
                    } else {
                      // Last resort: try to get object IDs by querying properties individually
                      // We'll test a range of potential dbIds to find valid ones
                      if (propertyDb && propertyDb.getObjectProperties && typeof propertyDb.getObjectProperties === 'function') {
                        const testIds = [];
                        // Test a reasonable range - start with 0-1000, then expand if we find matches
                        for (let i = 0; i < 1000; i++) {
                          testIds.push(i);
                        }
                        
                        let testedCount = 0;
                        const foundMidElements = [];
                        
                        const testNextId = () => {
                          if (testedCount >= testIds.length) {
                            if (callback) callback(foundMidElements);
                            return;
                          }
                          
                          const dbId = testIds[testedCount++];
                          propertyDb.getObjectProperties(dbId, (props) => {
                            if (props) {
                              let allProperties = [];
                              
                              // Method 1: Direct properties array
                              if (props.properties && Array.isArray(props.properties)) {
                                allProperties = allProperties.concat(props.properties);
                              }
                              // Method 2: Categories structure
                              else if (props.categories && Array.isArray(props.categories)) {
                                props.categories.forEach(category => {
                                  if (category.properties && Array.isArray(category.properties)) {
                                    allProperties = allProperties.concat(category.properties);
                                  }
                                });
                              }
                              // Method 3: Check data section
                              if (props.data) {
                                if (Array.isArray(props.data)) {
                                  allProperties = allProperties.concat(props.data);
                                } else if (typeof props.data === 'object') {
                                  if (props.data.properties && Array.isArray(props.data.properties)) {
                                    allProperties = allProperties.concat(props.data.properties);
                                  }
                                  if (props.data.categories && Array.isArray(props.data.categories)) {
                                    props.data.categories.forEach(category => {
                                      if (category.properties && Array.isArray(category.properties)) {
                                        allProperties = allProperties.concat(category.properties);
                                      }
                                    });
                                  }
                                  Object.keys(props.data).forEach(key => {
                                    const value = props.data[key];
                                    if (Array.isArray(value)) {
                                      value.forEach(item => {
                                        if (item && typeof item === 'object' && (item.displayName || item.name || item.value)) {
                                          allProperties.push(item);
                                        }
                                      });
                                    } else if (value && typeof value === 'object' && (value.displayName || value.name || value.value)) {
                                      allProperties.push(value);
                                    }
                                  });
                                }
                              }
                              // Method 4: Check props.Data (capital D)
                              if (props.Data) {
                                const dataSection = props.Data;
                                if (Array.isArray(dataSection)) {
                                  allProperties = allProperties.concat(dataSection);
                                } else if (dataSection.properties && Array.isArray(dataSection.properties)) {
                                  allProperties = allProperties.concat(dataSection.properties);
                                } else if (typeof dataSection === 'object') {
                                  Object.keys(dataSection).forEach(key => {
                                    const value = dataSection[key];
                                    allProperties.push({
                                      displayName: key,
                                      name: key,
                                      displayValue: value,
                                      value: value
                                    });
                                  });
                                }
                              }
                              // Method 5: Check props.properties.Data (where MID properties are stored)
                              if (props.properties && typeof props.properties === 'object' && !Array.isArray(props.properties)) {
                                if (props.properties.Data && typeof props.properties.Data === 'object') {
                                  Object.keys(props.properties.Data).forEach(key => {
                                    allProperties.push({
                                      displayName: key,
                                      name: key,
                                      displayValue: props.properties.Data[key],
                                      value: props.properties.Data[key],
                                      category: 'Data'
                                    });
                                  });
                                }
                              }
                              // Method 6: Fallback - check all keys
                              else {
                                Object.keys(props).forEach(key => {
                                  if (key !== 'name' && key !== 'dbId' && Array.isArray(props[key])) {
                                    allProperties = allProperties.concat(props[key]);
                                  } else if (key !== 'name' && key !== 'dbId' && typeof props[key] === 'object' && props[key] !== null) {
                                    if (props[key].properties) {
                                      allProperties = allProperties.concat(props[key].properties);
                                    }
                                  }
                                });
                              }
                              
                              const midProperties = allProperties.filter(prop => {
                                if (!prop) return false;
                                const propName = prop.displayName || prop.name || prop.attributeName || prop.key || '';
                                const propValue = prop.displayValue || prop.value || prop.attributeValue || '';
                                const nameStr = String(propName);
                                const valueStr = String(propValue);
                                return nameStr.startsWith('MID/') || valueStr.startsWith('MID/');
                              });
                              
                              if (midProperties.length > 0) {
                                foundMidElements.push({
                                  dbId: dbId,
                                  name: props.name || `Element ${dbId}`,
                                  properties: midProperties,
                                  allProperties: allProperties
                                });
                              }
                            }
                            
                            // Continue testing (with a small delay every 10 IDs to avoid blocking)
                            if (testedCount % 10 === 0) {
                              setTimeout(testNextId, 10);
                            } else {
                              testNextId();
                            }
                          }, () => {
                            // Error or no properties for this ID, continue
                            if (testedCount % 10 === 0) {
                              setTimeout(testNextId, 10);
                            } else {
                              testNextId();
                            }
                          });
                        };
                        
                        // Start testing
                        testNextId();
                        return;
                      }
                      if (callback) callback([]);
                    }
                  };
                  
                  // eslint-disable-next-line no-unreachable
                  checkPropertyDb();
                  return;
                }
              } catch (err) {
                console.error('[Viewer] Error in searchForMidElements:', err);
                if (callback && typeof callback === 'function') {
                  try {
                    callback([]);
                  } catch (callbackErr) {
                    console.error('[Viewer] Error in searchForMidElements callback:', callbackErr);
                  }
                }
              }
            };
            
            // Ensure viewer has proper dimensions
            const resizeViewer = () => {
              if (viewer && viewerContainer.current) {
                const width = viewerContainer.current.clientWidth;
                const height = viewerContainer.current.clientHeight;
                if (width > 0 && height > 0) {
                  viewer.resize(width, height);
                }
              }
            };
            
            // Store resize handler for cleanup
            resizeHandlerRef.current = resizeViewer;
            
            // Resize immediately and on window resize
            setTimeout(resizeViewer, 100);
            window.addEventListener('resize', resizeViewer);
            
            // If svfUrl is a manifest URL (for SVF2), use Document.load() with the manifest URL
            // Check if it's a manifest URL or a URN
            const isManifestUrl = svfUrl.includes('/manifest') || svfUrl.startsWith('https://developer.api.autodesk.com/modelderivative');
            
            if (isUrn || isManifestUrl) {
              const onLoad = (doc) => {
                if (!doc) {
                  setError('Failed to load document');
                  setLoading(false);
                  return;
                }
                
                try {
                  const root = doc.getRoot();
                  
                  // Find the viewable by GUID if provided, otherwise use default
                  let viewable = null;
                  if (viewGuid) {
                    // First try: Use the built-in findByGuid method if available
                    try {
                      if (root.findByGuid) {
                        viewable = root.findByGuid(viewGuid);
                      }
                    } catch (err) {
                      // findByGuid might not be available
                    }
                    
                    // Second try: Search for all geometry viewables and filter by GUID
                    if (!viewable) {
                      try {
                        const allViewables = root.search({ type: 'geometry' });
                        if (allViewables && allViewables.length > 0) {
                          for (let i = 0; i < allViewables.length; i++) {
                            const v = allViewables[i];
                            // Check both v.guid and v.data.guid (GUID might be in data object)
                            if (v && (v.guid === viewGuid || (v.data && v.data.guid === viewGuid))) {
                              viewable = v;
                              break;
                            }
                          }
                        }
                      } catch (err) {
                        // Search might fail
                      }
                    }
                    
                    // Third try: Recursive search through root
                    if (!viewable) {
                      const findViewableByGuid = (item) => {
                        if (!item) return null;
                        
                        // Check item.guid and item.data.guid
                        if (item.guid === viewGuid || (item.data && item.data.guid === viewGuid)) {
                          return item;
                        }
                        
                        // Recursively search children
                        if (item.children) {
                          for (let i = 0; i < item.children.length; i++) {
                            const found = findViewableByGuid(item.children[i]);
                            if (found) return found;
                          }
                        }
                        
                        return null;
                      };
                      viewable = findViewableByGuid(root);
                    }
                  }
                  
                  // Fallback to default geometry only if we couldn't find the specific view
                  if (!viewable) {
                    viewable = root.getDefaultGeometry();
                  }
                  
                  if (viewable) {
                    viewer.loadDocumentNode(doc, viewable).then(() => {
                      waitForModelAndSearch(viewer);
                      
                      setTimeout(() => {
                        if (viewer && viewerContainer.current) {
                          const width = viewerContainer.current.clientWidth;
                          const height = viewerContainer.current.clientHeight;
                          if (width > 0 && height > 0) {
                            viewer.resize(width, height);
                          }
                        }
                      }, 100);
                      setLoading(false);
                    }).catch((err) => {
                      setError(`Error loading model: ${err.message}`);
                      setLoading(false);
                    });
                  } else {
                    setError('No viewables found in document');
                    setLoading(false);
                  }
                } catch (err) {
                  setError(`Error loading document: ${err.message}`);
                  setLoading(false);
                }
              };
              
              const onError = (errorCode, errorMsg) => {
                const errorMessage = errorMsg || (typeof errorCode === 'string' ? errorCode : 'Unknown error');
                setError(`Error loading document: ${errorMessage}`);
                setLoading(false);
              };
              
              // For SVF2, Document.load() accepts the URN directly
              // The URN should be a base64-encoded string (which it already is)
              try {
                Autodesk.Viewing.Document.load(svfUrl, onLoad, onError);
              } catch (err) {
                setError(`Error loading document: ${err.message || 'Unknown error'}`);
                setLoading(false);
              }
              return;
            }
            
            // Backend handles polling, downloading, uploading to OSS, and returns URL
            // Fetch the URL from the backend
            fetch(svfUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            })
              .then(async response => {
                if (!response.ok) {
                  const errorText = await response.text();
                  let errorDetails = errorText;
                  try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = errorJson.error || errorJson.details || errorText;
                  } catch (e) {
                    // Not JSON, use as-is
                  }
                  throw new Error(`Failed to get SVF URL: ${response.status} ${response.statusText} - ${errorDetails}`);
                }
                return response.json();
              })
              .then(({ url, isUrn: responseIsUrn }) => {
                if (!url) {
                  throw new Error('No URL returned from backend');
                }
                
                // If backend returned a URN (for SVF2), use Document.load() with the URN directly
                if (responseIsUrn) {
                  const onLoad = (doc) => {
                    if (!doc) {
                      setError('Failed to load document');
                      setLoading(false);
                      return;
                    }
                    
                    try {
                      const root = doc.getRoot();
                      
                  // Find the viewable by GUID if provided, otherwise use default
                  let viewable = null;
                  if (viewGuid) {
                    // First try: Use the built-in findByGuid method if available
                    try {
                      if (root.findByGuid) {
                        viewable = root.findByGuid(viewGuid);
                      }
                    } catch (err) {
                      // findByGuid might not be available
                    }
                    
                    // Second try: Search for all geometry viewables and filter by GUID
                    if (!viewable) {
                      try {
                        const allViewables = root.search({ type: 'geometry' });
                        if (allViewables && allViewables.length > 0) {
                          for (let i = 0; i < allViewables.length; i++) {
                            const v = allViewables[i];
                            // Check both v.guid and v.data.guid (GUID might be in data object)
                            if (v && (v.guid === viewGuid || (v.data && v.data.guid === viewGuid))) {
                              viewable = v;
                              break;
                            }
                          }
                        }
                      } catch (err) {
                        // Search might fail
                      }
                    }
                    
                    // Third try: Recursive search through root
                    if (!viewable) {
                      const findViewableByGuid = (item) => {
                        if (!item) return null;
                        
                        // Check item.guid and item.data.guid
                        if (item.guid === viewGuid || (item.data && item.data.guid === viewGuid)) {
                          return item;
                        }
                        
                        // Recursively search children
                        if (item.children) {
                          for (let i = 0; i < item.children.length; i++) {
                            const found = findViewableByGuid(item.children[i]);
                            if (found) return found;
                          }
                        }
                        
                        return null;
                      };
                      viewable = findViewableByGuid(root);
                    }
                  }
                  
                  // Fallback to default geometry only if we couldn't find the specific view
                  if (!viewable) {
                    viewable = root.getDefaultGeometry();
                  }
                      
                      if (viewable) {
                        viewer.loadDocumentNode(doc, viewable).then(() => {
                          // Wait for model to fully load using event listeners
                          waitForModelAndSearch(viewer);
                          
                          setTimeout(() => {
                            if (viewer && viewerContainer.current) {
                              const width = viewerContainer.current.clientWidth;
                              const height = viewerContainer.current.clientHeight;
                              if (width > 0 && height > 0) {
                                viewer.resize(width, height);
                              }
                            }
                          }, 100);
                          setLoading(false);
                        }).catch((err) => {
                          setError(`Error loading model: ${err.message}`);
                          setLoading(false);
                        });
                      } else {
                        setError('No viewables found in document');
                        setLoading(false);
                      }
                    } catch (err) {
                      setError(`Error loading document: ${err.message}`);
                      setLoading(false);
                    }
                  };
                  
                  const onError = (error) => {
                    setError(`Error loading document: ${error.message || 'Unknown error'}`);
                    setLoading(false);
                  };
                  
                  Autodesk.Viewing.Document.load(url, onLoad, onError);
                  return;
                }
                
                // If the URL points to bubble.json, use Document.load()
                // Otherwise, use loadModel() for direct SVF files
                if (url.includes('bubble.json') || url.endsWith('.json')) {
                  
                  const onLoad = (doc) => {
                    if (!doc) {
                      setError('Failed to load document');
                      setLoading(false);
                      return;
                    }
                    
                    try {
                      const root = doc.getRoot();
                      
                      // Find the viewable by GUID if provided, otherwise use default
                      let viewable = null;
                      
                      if (viewGuid) {
                        // First try: Use the built-in findByGuid method if available
                        try {
                          if (root.findByGuid) {
                            viewable = root.findByGuid(viewGuid);
                          }
                        } catch (err) {
                          // findByGuid might not be available
                        }
                        
                        // Second try: Search for all geometry viewables and filter by GUID
                        if (!viewable) {
                          try {
                            const allViewables = root.search({ type: 'geometry' });
                            if (allViewables && allViewables.length > 0) {
                              for (let i = 0; i < allViewables.length; i++) {
                                const v = allViewables[i];
                                // Check both v.guid and v.data.guid (GUID might be in data object)
                                if (v && (v.guid === viewGuid || (v.data && v.data.guid === viewGuid))) {
                                  viewable = v;
                                  break;
                                }
                              }
                            }
                          } catch (err) {
                            // Search might fail
                          }
                        }
                        
                        // Third try: Recursive search through root
                        if (!viewable) {
                          const findViewableByGuid = (item) => {
                            if (!item) return null;
                            
                            // Check item.guid and item.data.guid
                            if (item.guid === viewGuid || (item.data && item.data.guid === viewGuid)) {
                              return item;
                            }
                            
                            // Recursively search children
                            if (item.children) {
                              for (let i = 0; i < item.children.length; i++) {
                                const found = findViewableByGuid(item.children[i]);
                                if (found) return found;
                              }
                            }
                            
                            return null;
                          };
                          viewable = findViewableByGuid(root);
                        }
                      }
                      
                      // Fallback to default geometry only if we couldn't find the specific view
                      if (!viewable) {
                        viewable = root.getDefaultGeometry();
                      }
                      
                      // If viewable exists, check if it has a valid path
                      if (viewable) {
                        try {
                          viewable.getPath();
                        } catch (pathErr) {
                          viewable = null; // Try to find another viewable
                        }
                      }
                      
                      // If no valid viewable, try to find one manually
                      if (!viewable) {
                        // Get all items in the document
                        const searchResults = root.search({ type: 'geometry' });
                        
                        if (searchResults && searchResults.length > 0) {
                          // Try the first result
                          viewable = searchResults[0];
                        }
                      }
                      
                      // If still no viewable, try getRoot().getDefaultGeometry() with error handling
                      if (!viewable) {
                        try {
                          viewable = root.getDefaultGeometry();
                        } catch (err) {
                          // Error getting default geometry
                        }
                      }
                      
                      if (viewable) {
                        viewer.loadDocumentNode(doc, viewable).then((model) => {
                          // Wait for model to fully load, then search for MID/ elements
                          waitForModelAndSearch(viewer);
                          
                          // Resize viewer after model loads to ensure proper rendering
                          setTimeout(() => {
                            if (viewer && viewerContainer.current) {
                              const width = viewerContainer.current.clientWidth;
                              const height = viewerContainer.current.clientHeight;
                              if (width > 0 && height > 0) {
                                viewer.resize(width, height);
                              }
                            }
                          }, 100);
                          setLoading(false);
                        }).catch((err) => {
                          // Try loading without specifying a viewable (let viewer choose)
                          try {
                            // For SVF2, try loading the first available viewable
                            const allViewables = doc.getRoot().search({ type: 'geometry' });
                            if (allViewables && allViewables.length > 0) {
                              viewer.loadDocumentNode(doc, allViewables[0]).then(() => {
                                // Wait for model to fully load using event listeners
                                waitForModelAndSearch(viewer);
                                
                                setTimeout(() => {
                                  if (viewer && viewerContainer.current) {
                                    const width = viewerContainer.current.clientWidth;
                                    const height = viewerContainer.current.clientHeight;
                                    if (width > 0 && height > 0) {
                                      viewer.resize(width, height);
                                    }
                                  }
                                }, 100);
                                setLoading(false);
                              }).catch((altErr) => {
                                setError(`Error loading model: ${altErr.message}`);
                                setLoading(false);
                              });
                            } else {
                              setError(`Error loading model: ${err.message}`);
                              setLoading(false);
                            }
                          } catch (altErr) {
                            setError(`Error loading document: ${err.message}`);
                            setLoading(false);
                          }
                        });
                      } else {
                        setError('No viewables found in document');
                        setLoading(false);
                      }
                    } catch (err) {
                      setError(`Error loading document: ${err.message}`);
                      setLoading(false);
                    }
                  };
                  
                  const onError = (errorCode, errorMsg) => {
                    setError(`Error loading document: ${errorMsg} (${errorCode})`);
                    setLoading(false);
                  };
                  
                  Autodesk.Viewing.Document.load(url, onLoad, onError);
                } else {
                  // Direct SVF file - use loadModel()
                  const loadOptions = {
                    env: 'AutodeskProduction',
                    useConsolidation: true,
                    useADP: false
                  };
                  
                  viewer.loadModel(url, loadOptions, () => {
                    // Wait for model to fully load using event listeners
                    waitForModelAndSearch(viewer);
                    
                    // Resize viewer after model loads to ensure proper rendering
                    setTimeout(() => {
                      if (viewer && viewerContainer.current) {
                        const width = viewerContainer.current.clientWidth;
                        const height = viewerContainer.current.clientHeight;
                        if (width > 0 && height > 0) {
                          viewer.resize(width, height);
                        }
                      }
                    }, 100);
                    setLoading(false);
                  }, (errorCode, errorMsg) => {
                    setError(`Error loading model: ${errorMsg} (${errorCode})`);
                    setLoading(false);
                  });
                }
              })
              .catch(err => {
                console.error('[Viewer] Error processing SVF:', err);
                setError(`Error processing SVF: ${err.message || 'Unknown error'}`);
                setLoading(false);
              });
            } catch (err) {
              console.error('[Viewer] Error in Initializer callback:', err);
              setError(`Error creating viewer: ${err.message || 'Unknown error'}`);
              setLoading(false);
            }
          }, (errorCode, errorMsg) => {
            console.error('[Viewer] Initializer error:', errorCode, errorMsg);
            setError(`Error initializing Autodesk Viewer: ${errorMsg || 'Unknown error'} (${errorCode || 'N/A'})`);
            setLoading(false);
          });
          } catch (initErr) {
            console.error('[Viewer] Error calling Initializer:', initErr);
            setError(`Error calling Autodesk Initializer: ${initErr.message || 'Unknown error'}`);
            setLoading(false);
          }
        } catch (err) {
          console.error('[Viewer] Error in initViewer:', err);
          setError(`Error initializing viewer: ${err.message || 'Unknown error'}`);
          setLoading(false);
        }
      };

    // Wrap initViewer in try-catch to catch any synchronous errors
    try {
      initViewer().catch((err) => {
        if (isMounted) {
          console.error('[Viewer] Error in initViewer promise:', err);
          setError(`Failed to initialize viewer: ${err.message || 'Unknown error'}`);
          setLoading(false);
        }
      });
    } catch (err) {
      if (isMounted) {
        console.error('[Viewer] Error calling initViewer:', err);
        setError(`Failed to initialize viewer: ${err.message || 'Unknown error'}`);
        setLoading(false);
      }
    }

    // Cleanup
    return () => {
      isMounted = false;
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      if (viewerInstance.current) {
        try {
          viewerInstance.current.finish();
        } catch (e) {
          // Ignore cleanup errors
        }
        viewerInstance.current = null;
      }
    };
  }, [propSvfUrl, propToken, propIsUrn, propViewGuid]);

  return (
    <div className="viewer-container">
      {loading && !error && (
        <div className="viewer-loading">
          <div className="spinner"></div>
          <p className="loading-title">{t('loading3DModel')}</p>
          <p className="loading-subtitle">{t('loading3DModelSubtitle')}</p>
        </div>
      )}
      {error && (
        <div className="viewer-error">
          <h2>{t('error')}</h2>
          <p>{error}</p>
        </div>
      )}
      <div ref={viewerContainer} className="viewer-canvas" style={{ display: error ? 'none' : 'block' }}></div>
    </div>
  );
}

export default Viewer;

