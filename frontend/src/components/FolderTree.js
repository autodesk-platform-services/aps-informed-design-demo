import React from 'react';

/**
 * FolderTree Component
 *
 * Renders a hierarchical folder tree with expand/collapse functionality.
 *
 * @param {Object} props - Component props
 * @param {Object} props.folder - The folder object to render
 * @param {Set} props.expandedFolders - Set of expanded folder IDs
 * @param {string} props.selectedFolder - Currently selected folder ID
 * @param {Function} props.onToggleFolder - Callback to toggle folder expansion
 * @param {Function} props.onSelectFolder - Callback when folder is selected
 * @param {number} props.level - Current nesting level (for indentation)
 * @param {boolean} props.isRoot - Whether this is the root folder
 */
const FolderTree = ({
  folder,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  level = 0,
  isRoot = false
}) => {
  if (!folder) return null;

  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolder === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  // If this is the root (Project Files), only render its children
  if (isRoot && hasChildren) {
    return (
      <div className="folder-children">
        {folder.children.map(child => (
          <FolderTree
            key={child.id}
            folder={child}
            expandedFolders={expandedFolders}
            selectedFolder={selectedFolder}
            onToggleFolder={onToggleFolder}
            onSelectFolder={onSelectFolder}
            level={0}
            isRoot={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div key={folder.id} className="folder-tree-item">
      <div
        className={`folder-tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren && (
          <button
            className="folder-toggle"
            onClick={() => onToggleFolder(folder.id)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="folder-spacer" />}
        <span
          className="folder-name"
          onClick={() => onSelectFolder(folder.id)}
        >
          {folder.name || folder.attributes?.name || folder.id}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div className="folder-children">
          {folder.children.map(child => (
            <FolderTree
              key={child.id}
              folder={child}
              expandedFolders={expandedFolders}
              selectedFolder={selectedFolder}
              onToggleFolder={onToggleFolder}
              onSelectFolder={onSelectFolder}
              level={level + 1}
              isRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FolderTree;
