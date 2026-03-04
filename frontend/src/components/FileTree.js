import React from 'react';

/**
 * FileTree Component
 *
 * Renders a hierarchical file/folder tree for project files, with special handling for RVT files.
 *
 * @param {Object} props - Component props
 * @param {Object} props.item - The file/folder item to render
 * @param {Set} props.expandedFiles - Set of expanded file/folder IDs
 * @param {Object} props.selectedFile - Currently selected file object
 * @param {Function} props.onToggleExpand - Callback to toggle item expansion
 * @param {Function} props.onSelectFile - Callback when file is selected
 * @param {number} props.level - Current nesting level (for indentation)
 * @param {boolean} props.isRoot - Whether this is the root item
 */
const FileTree = ({
  item,
  expandedFiles,
  selectedFile,
  onToggleExpand,
  onSelectFile,
  level = 0,
  isRoot = false
}) => {
  if (!item) return null;

  const isExpanded = expandedFiles.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const itemName = item.name || item.attributes?.displayName || item.attributes?.name || '';
  const isFile = item.type === 'file' || item.type === 'items' || item.attributes?.extension?.type === 'rvt' || (itemName && itemName.toLowerCase().endsWith('.rvt'));
  const isRvtFile = isFile && (itemName?.toLowerCase().endsWith('.rvt') || item.attributes?.extension?.type === 'rvt');
  const hasChildren = item.children && item.children.length > 0;

  if (isRoot && hasChildren) {
    return (
      <div className="folder-children">
        {item.children.map(child => (
          <FileTree
            key={child.id}
            item={child}
            expandedFiles={expandedFiles}
            selectedFile={selectedFile}
            onToggleExpand={onToggleExpand}
            onSelectFile={onSelectFile}
            level={0}
            isRoot={false}
          />
        ))}
      </div>
    );
  }

  const handleSelect = () => {
    if (isRvtFile) {
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
        className={`folder-tree-node ${isSelected ? 'selected' : ''} ${isFile && !isRvtFile ? 'disabled' : ''}`}
        style={{
          paddingLeft: `${level * 20 + 8}px`,
          paddingRight: '8px'
        }}
      >
        {hasChildren && (
          <button
            className="folder-toggle"
            onClick={() => onToggleExpand(item.id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="folder-spacer" />}
        <span
          className={isRvtFile ? 'selectable-file' : ''}
          onClick={(e) => {
            e.stopPropagation();
            handleSelect();
          }}
          style={{
            cursor: isRvtFile ? 'pointer' : (isFile ? 'not-allowed' : 'default'),
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
            <FileTree
              key={child.id}
              item={child}
              expandedFiles={expandedFiles}
              selectedFile={selectedFile}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              level={level + 1}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileTree;
