import React from 'react';

/**
 * DxFileTree Component
 *
 * Renders a hierarchical file/folder tree for data exchange files.
 * Automatically identifies and enables .json, .dx, and files in "Data Exchanges" folders.
 *
 * @param {Object} props - Component props
 * @param {Object} props.item - The file/folder item to render
 * @param {Set} props.expandedFiles - Set of expanded file/folder IDs
 * @param {Object} props.selectedFile - Currently selected file object
 * @param {Function} props.onToggleExpand - Callback to toggle item expansion
 * @param {Function} props.onSelectFile - Callback when file is selected
 * @param {number} props.level - Current nesting level (for indentation)
 * @param {boolean} props.isRoot - Whether this is the root item
 * @param {string} props.parentName - Name of parent folder (for "Data Exchanges" detection)
 */
const DxFileTree = ({
  item,
  expandedFiles,
  selectedFile,
  onToggleExpand,
  onSelectFile,
  level = 0,
  isRoot = false,
  parentName = ''
}) => {
  if (!item) return null;

  const isExpanded = expandedFiles.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const itemName = item.name || item.attributes?.displayName || item.attributes?.name || '';
  const isFile = item.type === 'file' || item.type === 'items';

  // Check if parent folder is "Data Exchanges" - if so, treat all files as data exchange files
  const isInDataExchangeFolder = parentName && (
    parentName.toLowerCase().includes('data exchange') ||
    parentName.toLowerCase() === 'data exchanges' ||
    parentName.toLowerCase() === 'dataexchange' ||
    parentName.toLowerCase() === 'dataexchanges'
  );

  // A file is a data exchange file if:
  // 1. It has .json or .dx extension, OR
  // 2. It has fileType === 'data-exchange' or FDX extension type, OR
  // 3. It's in a "Data Exchanges" folder (include all files in that folder)
  const extType = item.attributes?.extension?.type || '';
  const isDxFile = isFile && (
    itemName?.toLowerCase().endsWith('.json') ||
    itemName?.toLowerCase().endsWith('.dx') ||
    extType === 'json' ||
    extType === 'data-exchange' ||
    extType.includes('FDX') ||
    item.attributes?.fileType === 'data-exchange' ||
    isInDataExchangeFolder
  );

  const hasChildren = item.children && item.children.length > 0;

  if (isRoot && hasChildren) {
    return (
      <div className="folder-children">
        {item.children.map(child => (
          <DxFileTree
            key={child.id}
            item={child}
            expandedFiles={expandedFiles}
            selectedFile={selectedFile}
            onToggleExpand={onToggleExpand}
            onSelectFile={onSelectFile}
            level={0}
            isRoot={false}
            parentName={itemName}
          />
        ))}
      </div>
    );
  }

  const handleToggle = () => {
    onToggleExpand(item.id);
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    // Allow clicking on any file in Data Exchanges folder, or files that match DX criteria
    if (isDxFile || (isFile && isInDataExchangeFolder)) {
      // Try multiple possible ID locations
      const fileId = item.id ||
                    item.attributes?.id ||
                    item.data?.id ||
                    item.relationships?.storage?.data?.id ||
                    item.storageId ||
                    item.attributes?.storageId;
      const fileName = itemName || item.id;
      const filePath = item.path || itemName;
      if (fileId) {
        onSelectFile({
          id: fileId,
          path: filePath,
          name: fileName,
          item: item
        });
      }
    }
  };

  return (
    <div key={item.id} className="folder-tree-item">
      <div
        className={`folder-tree-node ${isSelected ? 'selected' : ''} ${isFile && !isDxFile ? 'disabled' : ''}`}
        style={{
          paddingLeft: `${level * 20 + 8}px`,
          paddingRight: '8px'
        }}
      >
        {hasChildren && (
          <button
            className="folder-toggle"
            onClick={handleToggle}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="folder-spacer" />}
        <span
          className={isDxFile ? 'selectable-file' : (isFile ? '' : '')}
          onClick={handleSelect}
          style={{
            cursor: (isDxFile || (isFile && isInDataExchangeFolder)) ? 'pointer' : (isFile ? 'not-allowed' : 'default'),
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0
          }}
        >
          <span style={{ flexShrink: 0, lineHeight: '1.5' }}>{isFile ? '📄' : '📁'}</span>
          <span style={{
            flex: 1,
            minWidth: 0,
            wordBreak: 'break-word',
            lineHeight: '1.5',
            whiteSpace: 'normal'
          }}>
            {item.name || item.attributes?.displayName || item.attributes?.name || item.id}
          </span>
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div className="folder-children">
          {item.children.map(child => (
            <DxFileTree
              key={child.id}
              item={child}
              expandedFiles={expandedFiles}
              selectedFile={selectedFile}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              level={level + 1}
              isRoot={false}
              parentName={itemName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DxFileTree;
