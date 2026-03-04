import React from 'react';
import { normalizeDbId } from '../utils/helpers';

/**
 * ElementsTree Component
 *
 * Renders a hierarchical tree of Model Instance Data (MID) elements grouped by category and product.
 * Supports element selection, expansion, and displays detailed properties.
 *
 * @param {Object} props - Component props
 * @param {Array} props.midElements - Array of MID element objects
 * @param {Map} props.releaseCategories - Map of release categories
 * @param {Set} props.selectedElements - Set of selected element dbIds
 * @param {Function} props.onSelectElements - Callback when elements selection changes
 * @param {Set} props.expandedCategories - Set of expanded category names
 * @param {Function} props.onToggleCategory - Callback to toggle category expansion
 * @param {Set} props.expandedProducts - Set of expanded product keys
 * @param {Function} props.onToggleProduct - Callback to toggle product expansion
 * @param {Set} props.expandedElements - Set of expanded element keys
 * @param {Function} props.onToggleElement - Callback to toggle element expansion
 * @param {boolean} props.isDataExchange - Whether viewing data exchange file
 */
const ElementsTree = ({
  midElements,
  releaseCategories,
  selectedElements,
  onSelectElements,
  expandedCategories,
  onToggleCategory,
  expandedProducts,
  onToggleProduct,
  expandedElements,
  onToggleElement,
  isDataExchange = false
}) => {
  if (!midElements || midElements.length === 0) {
    return <p style={{ padding: '10px', color: '#666' }}>No products found.</p>;
  }

  // Helper function to find property value
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

  // Group elements by category and product
  const categoriesMap = new Map();

  midElements.forEach((element) => {
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

    let categoryKey = null;
    if (releaseId && projectId && folderUrn) {
      const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
      const formattedAccessId = `${cleanProjectId}|${folderUrn}`;
      categoryKey = `${releaseId}|||${formattedAccessId}|||ACC`;
    }

    const releaseInfo = categoryKey ? releaseCategories.get(categoryKey) : null;
    let category = releaseInfo
      ? (typeof releaseInfo === 'string' ? releaseInfo : releaseInfo.category || 'Unknown Category')
      : 'Unknown Category';

    const productNameProp = element.properties.find(prop => {
      const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
      return propName === 'MID/productName';
    });

    let productName = 'Unknown Product';
    if (productNameProp) {
      productName = String(productNameProp.value || productNameProp.displayValue || productNameProp.attributeValue || 'Unknown Product').trim();
      if (!productName || productName === '') {
        productName = 'Unknown Product';
      }
    }

    // If category is "Unknown Category", try to infer from product name or element name
    if (category === 'Unknown Category') {
      const nameToCheck = productName.toLowerCase() + ' ' + (element.name || '').toLowerCase();
      if (nameToCheck.includes('window')) {
        category = 'Windows';
      } else if (nameToCheck.includes('door')) {
        category = 'Doors';
      } else if (nameToCheck.includes('wall')) {
        category = 'Walls';
      } else if (nameToCheck.includes('floor') || nameToCheck.includes('slab')) {
        category = 'Floors';
      } else if (nameToCheck.includes('roof') || nameToCheck.includes('ceiling')) {
        category = 'Roofs';
      } else if (nameToCheck.includes('column') || nameToCheck.includes('beam') || nameToCheck.includes('structural')) {
        category = 'Structural';
      } else if (nameToCheck.includes('balcony') || nameToCheck.includes('stair') || nameToCheck.includes('equipment')) {
        category = 'Specialty Equipment';
      }
    }

    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, new Map());
    }
    const productsMap = categoriesMap.get(category);

    if (!productsMap.has(productName)) {
      productsMap.set(productName, []);
    }
    productsMap.get(productName).push(element);
  });

  const categories = Array.from(categoriesMap.entries())
    .map(([category, productsMap]) => {
      const products = Array.from(productsMap.entries())
        .map(([productName, elements]) => ({
          productName,
          elements
        }))
        .sort((a, b) => {
          if (a.productName === 'Unknown Product') return 1;
          if (b.productName === 'Unknown Product') return -1;
          return a.productName.localeCompare(b.productName);
        });

      const totalCategoryElements = products.reduce((sum, p) => sum + p.elements.length, 0);

      return {
        category,
        products,
        elementCount: totalCategoryElements
      };
    })
    .sort((a, b) => {
      if (a.category === 'Unknown Category') return 1;
      if (b.category === 'Unknown Category') return -1;
      return a.category.localeCompare(b.category);
    });

  const totalElements = midElements.length;
  const selectedCount = selectedElements.size;
  const allSelected = totalElements > 0 && selectedCount === totalElements;

  const handleSelectAll = (checked) => {
    if (checked) {
      const allDbIds = new Set(midElements.map(el => normalizeDbId(el.dbId)).filter(dbId => dbId !== null));
      onSelectElements(allDbIds);
    } else {
      onSelectElements(new Set());
    }
  };

  const handleCategorySelect = (categoryData, checked) => {
    const newSelected = new Set(selectedElements);
    if (checked) {
      categoryData.products.forEach(product => {
        product.elements.forEach(el => {
          const dbId = normalizeDbId(el.dbId);
          if (dbId !== null) newSelected.add(dbId);
        });
      });
    } else {
      categoryData.products.forEach(product => {
        product.elements.forEach(el => {
          const dbId = normalizeDbId(el.dbId);
          if (dbId !== null) newSelected.delete(dbId);
        });
      });
    }
    onSelectElements(newSelected);
  };

  const handleProductSelect = (product, checked) => {
    const newSelected = new Set(selectedElements);
    if (checked) {
      product.elements.forEach(el => {
        const dbId = normalizeDbId(el.dbId);
        if (dbId !== null) newSelected.add(dbId);
      });
    } else {
      product.elements.forEach(el => {
        const dbId = normalizeDbId(el.dbId);
        if (dbId !== null) newSelected.delete(dbId);
      });
    }
    onSelectElements(newSelected);
  };

  const handleElementSelect = (element, checked) => {
    const newSelected = new Set(selectedElements);
    const dbId = normalizeDbId(element.dbId);
    if (checked) {
      if (dbId !== null) newSelected.add(dbId);
    } else {
      if (dbId !== null) newSelected.delete(dbId);
    }
    onSelectElements(newSelected);
  };

  return (
    <div className="mid-browser-tree">
      <div className="mid-tree-select-all">
        <label className="mid-tree-checkbox-label">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="mid-tree-checkbox"
          />
          <span className="mid-tree-checkbox-text">Select All</span>
        </label>
      </div>
      {categories.map((categoryData) => {
        const category = categoryData.category;
        const isCategoryExpanded = expandedCategories.has(category);

        return (
          <div key={category} className="mid-category-group">
            <div className="mid-category-header">
              <label className="mid-category-name mid-tree-node" onClick={() => onToggleCategory(category)}>
                <input
                  type="checkbox"
                  checked={categoryData.products.every(p =>
                    p.elements.every(el => selectedElements.has(normalizeDbId(el.dbId)))
                  )}
                  onChange={(e) => handleCategorySelect(categoryData, e.target.checked)}
                  className="mid-tree-checkbox"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="mid-tree-node-label">{category} ({categoryData.elementCount})</span>
                <button
                  type="button"
                  className="mid-category-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategory(category);
                  }}
                  aria-label={isCategoryExpanded ? 'Collapse' : 'Expand'}
                >
                  <span className={`mid-category-toggle-icon ${isCategoryExpanded ? 'expanded' : ''}`}>
                    ▶
                  </span>
                </button>
              </label>
            </div>
            {isCategoryExpanded && (
              <div className="mid-category-products">
                {categoryData.products.map((product) => {
                  const productKey = `${category}-${product.productName}`;
                  const isProductExpanded = expandedProducts.has(productKey);
                  const allProductElementsSelected = product.elements.every(el => selectedElements.has(normalizeDbId(el.dbId)));

                  return (
                    <div key={productKey} className="mid-product-group">
                      <div className="mid-product-header">
                        <label className="mid-product-name mid-tree-node" onClick={() => onToggleProduct(productKey)}>
                          <input
                            type="checkbox"
                            checked={allProductElementsSelected}
                            onChange={(e) => handleProductSelect(product, e.target.checked)}
                            className="mid-tree-checkbox"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="mid-tree-node-label">{product.productName} ({product.elements.length})</span>
                          <button
                            type="button"
                            className="mid-product-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleProduct(productKey);
                            }}
                            aria-label={isProductExpanded ? 'Collapse' : 'Expand'}
                          >
                            <span className={`mid-product-toggle-icon ${isProductExpanded ? 'expanded' : ''}`}>
                              ▶
                            </span>
                          </button>
                        </label>
                      </div>
                      {isProductExpanded && (
                        <div className="mid-product-elements">
                          {product.elements.map((element) => (
                            <ElementItem
                              key={`${category}-${product.productName}-${element.dbId}`}
                              element={element}
                              category={category}
                              productName={product.productName}
                              isExpanded={expandedElements.has(`${category}-${product.productName}-${element.dbId}`)}
                              isSelected={selectedElements.has(normalizeDbId(element.dbId))}
                              onToggle={onToggleElement}
                              onSelect={handleElementSelect}
                              isDataExchange={isDataExchange}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * ElementItem Component
 * Renders a single element with its properties and details
 */
const ElementItem = ({ element, category, productName, isExpanded, isSelected, onToggle, onSelect, isDataExchange }) => {
  const elementKey = `${category}-${productName}-${element.dbId}`;

  // Helper to find property value from allProperties
  const findPropertyValue = (propName) => {
    const propertiesToSearch = element.allProperties || element.properties || [];
    for (const prop of propertiesToSearch) {
      const name = String(prop.name || prop.displayName || prop.attributeName || '').trim();
      if (name === propName) {
        const value = prop.value || prop.displayValue || prop.attributeValue;
        return value !== undefined && value !== null ? String(value) : null;
      }
    }
    return null;
  };

  const level = findPropertyValue('Level') || findPropertyValue('level');
  const host = findPropertyValue('Host') || findPropertyValue('host');
  const typeName = findPropertyValue('Type Name') || findPropertyValue('TypeName') || findPropertyValue('typeName');
  const releaseNumber = findPropertyValue('MID/releaseNumber');
  const representation = findPropertyValue('MID/representation');
  const authoringApp = findPropertyValue('MID/authoringApp');
  const isConfigurable = findPropertyValue('MID/isConfigurable');

  // Identity Data fields
  const identityData = {
    keynote: findPropertyValue('Keynote'),
    model: findPropertyValue('Model'),
    manufacturer: findPropertyValue('Manufacturer'),
    url: findPropertyValue('URL') || findPropertyValue('U'),
    description: findPropertyValue('Description'),
    cost: findPropertyValue('Cost'),
    classification: findPropertyValue('Classification'),
    typeComments: findPropertyValue('Type Comments') || findPropertyValue('Type Comm...'),
    assemblyDescription: findPropertyValue('Assembly Description') || findPropertyValue('Assembly D...'),
    assemblyCode: findPropertyValue('Assembly Code') || findPropertyValue('Assembly C...'),
    typeMark: findPropertyValue('Type Mark'),
    typeImage: findPropertyValue('Type Image'),
    codeName: findPropertyValue('Code Name')
  };

  const hasIdentityData = Object.values(identityData).some(value => value !== null && value !== undefined && value !== '');

  // Collect parameter pairs
  const allProps = element.allProperties || element.properties || [];
  const parameterPairs = [];

  // First, check for Base64 encoded inputs field
  const inputsBase64 = findPropertyValue('MID/inputsBase64Encoded');
  if (inputsBase64) {
    try {
      const decodedString = atob(inputsBase64);
      const decodedParams = JSON.parse(decodedString);

      if (Array.isArray(decodedParams)) {
        decodedParams.forEach(param => {
          if (param.name && param.value !== undefined) {
            parameterPairs.push({ name: param.name, value: param.value });
          } else if (typeof param === 'object') {
            Object.entries(param).forEach(([key, value]) => {
              parameterPairs.push({ name: key, value: value });
            });
          }
        });
      } else if (typeof decodedParams === 'object') {
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
    const parameterName = findPropertyValue('MID/parameterName');
    const parameterValue = findPropertyValue('MID/parameterValue');
    if (parameterName && parameterValue) {
      parameterPairs.push({ name: parameterName, value: parameterValue });
    }

    const parameterProps = allProps.filter(prop => {
      const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
      return propName.startsWith('MID/parameter') &&
             propName !== 'MID/parameterName' &&
             propName !== 'MID/parameterValue' &&
             propName !== 'MID/inputsBase64Encoded' &&
             (propName.includes('Name') || propName.includes('Value'));
    });

    const parameterGroups = {};
    parameterProps.forEach(prop => {
      const propName = String(prop.name || prop.displayName || prop.attributeName || '').trim();
      const propValue = prop.value || prop.displayValue || prop.attributeValue || '';

      const match = propName.match(/MID\/parameter(\d+)(Name|Value)/);
      if (match) {
        const index = match[1];
        const type = match[2];

        if (!parameterGroups[index]) {
          parameterGroups[index] = {};
        }
        parameterGroups[index][type.toLowerCase()] = propValue;
      } else {
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

    Object.values(parameterGroups).forEach(group => {
      if (group.name && group.value) {
        parameterPairs.push({ name: group.name, value: group.value });
      }
    });
  }

  const hasDetails = level || host || typeName || releaseNumber || representation || authoringApp || isConfigurable || hasIdentityData || parameterPairs.length > 0;

  // For data exchange instances, use Family Name instead of Component Name
  let displayName = element.name;
  if (isDataExchange) {
    let familyName = findPropertyValue('Family Name');

    if (!familyName) {
      for (const prop of allProps) {
        const propName = String(prop.name || prop.displayName || prop.attributeName || prop.key || '').trim();

        if (propName === 'Family Name') {
          const value = prop.value || prop.displayValue || prop.attributeValue;
          if (value !== undefined && value !== null) {
            const valueStr = String(value).trim();
            if (valueStr !== '' && valueStr.toLowerCase() !== 'standard') {
              familyName = valueStr;
              break;
            }
          }
        }
      }
    }

    if (familyName) {
      displayName = familyName;
    }
  }

  return (
    <div className="mid-element-wrapper">
      <div className="mid-element-header-row">
        <label className="mid-element-item mid-tree-node" style={{ flex: 1 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(element, e.target.checked)}
            className="mid-tree-checkbox"
          />
          <span className="mid-tree-node-label">{displayName}</span>
        </label>
        {hasDetails && (
          <button
            type="button"
            className="mid-element-toggle"
            onClick={() => onToggle(elementKey)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`mid-element-toggle-icon ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          </button>
        )}
      </div>
      {isExpanded && hasDetails && (
        <div className="mid-element-details">
          {releaseNumber && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Release:</span>
              <span className="mid-element-detail-value">{String(releaseNumber)}</span>
            </div>
          )}
          {typeName && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Type Name:</span>
              <span className="mid-element-detail-value">{String(typeName)}</span>
            </div>
          )}
          {level && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Level:</span>
              <span className="mid-element-detail-value">{String(level)}</span>
            </div>
          )}
          {host && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Host:</span>
              <span className="mid-element-detail-value">{String(host)}</span>
            </div>
          )}
          {representation && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Representation:</span>
              <span className="mid-element-detail-value">{String(representation)}</span>
            </div>
          )}
          {authoringApp && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Authoring App:</span>
              <span className="mid-element-detail-value">{String(authoringApp)}</span>
            </div>
          )}
          {isConfigurable !== null && isConfigurable !== undefined && (
            <div className="mid-element-detail-item">
              <span className="mid-element-detail-label">Is Configurable:</span>
              <span className="mid-element-detail-value">{String(isConfigurable)}</span>
            </div>
          )}
          {hasIdentityData && (
            <div className="mid-element-parameters" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
              <div className="mid-element-parameters-header">Identity Data</div>
              <div className="mid-element-parameters-list">
                {identityData.keynote && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Keynote:</span>
                    <span className="mid-element-parameter-value">{String(identityData.keynote)}</span>
                  </div>
                )}
                {identityData.model && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Model:</span>
                    <span className="mid-element-parameter-value">{String(identityData.model)}</span>
                  </div>
                )}
                {identityData.manufacturer && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Manufacturer:</span>
                    <span className="mid-element-parameter-value">{String(identityData.manufacturer)}</span>
                  </div>
                )}
                {identityData.url && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">URL:</span>
                    <span className="mid-element-parameter-value">
                      <a href={String(identityData.url)} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline' }}>
                        {String(identityData.url)}
                      </a>
                    </span>
                  </div>
                )}
                {identityData.description && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Description:</span>
                    <span className="mid-element-parameter-value">{String(identityData.description)}</span>
                  </div>
                )}
                {identityData.cost && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Cost:</span>
                    <span className="mid-element-parameter-value">{String(identityData.cost)}</span>
                  </div>
                )}
                {identityData.classification && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Classification:</span>
                    <span className="mid-element-parameter-value">{String(identityData.classification)}</span>
                  </div>
                )}
                {identityData.typeComments && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Type Comments:</span>
                    <span className="mid-element-parameter-value">{String(identityData.typeComments)}</span>
                  </div>
                )}
                {identityData.assemblyDescription && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Assembly Description:</span>
                    <span className="mid-element-parameter-value">{String(identityData.assemblyDescription)}</span>
                  </div>
                )}
                {identityData.assemblyCode && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Assembly Code:</span>
                    <span className="mid-element-parameter-value">{String(identityData.assemblyCode)}</span>
                  </div>
                )}
                {identityData.typeMark && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Type Mark:</span>
                    <span className="mid-element-parameter-value">{String(identityData.typeMark)}</span>
                  </div>
                )}
                {identityData.typeImage && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Type Image:</span>
                    <span className="mid-element-parameter-value">{String(identityData.typeImage)}</span>
                  </div>
                )}
                {identityData.codeName && (
                  <div className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">Code Name:</span>
                    <span className="mid-element-parameter-value">{String(identityData.codeName)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {parameterPairs.length > 0 && (
            <div className="mid-element-parameters">
              <div className="mid-element-parameters-header">Parameters</div>
              <div className="mid-element-parameters-list">
                {parameterPairs.map((pair, idx) => (
                  <div key={idx} className="mid-element-parameter-item">
                    <span className="mid-element-parameter-name">{String(pair.name)}:</span>
                    <span className="mid-element-parameter-value">{String(pair.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ElementsTree;
