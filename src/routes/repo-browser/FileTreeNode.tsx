import { useState } from 'react';
import { ChevronRight, Folder, File, Trash2, Copy, Info } from 'lucide-react';
import type { TreeNode } from './FileTree';
import { formatBytes } from '../../lib/repoUtils';
import DeleteFileDialog from './FileActions';

interface FileTreeNodeProps {
  node: TreeNode;
  repoId: string;
  repoType: 'model' | 'dataset';
  depth: number;
}

export default function FileTreeNode({ node, repoId, repoType, depth }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [copied, setCopied] = useState(false);

  const indentStyle = { paddingLeft: `${depth * 16 + 8}px` };

  function handleCopyUrl() {
    const typeSegment = repoType === 'model' ? 'models' : 'datasets';
    const url = `https://huggingface.co/${typeSegment}/${repoId}/blob/main/${node.path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1 hover:bg-secondary rounded cursor-pointer transition-colors group"
          style={indentStyle}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-foreground text-sm">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                repoId={repoId}
                repoType={repoType}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="flex items-center gap-2 py-1 hover:bg-secondary rounded transition-colors group"
        style={indentStyle}
      >
        {/* Indent spacer to align with directories */}
        <span className="w-3.5 flex-shrink-0" />
        <File className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-foreground text-sm flex-1 truncate">{node.name}</span>
        {node.size !== undefined && (
          <span className="text-xs text-muted-foreground flex-shrink-0 pr-2">
            {formatBytes(node.size)}
          </span>
        )}

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
          {/* Copy HF URL */}
          <button
            onClick={handleCopyUrl}
            title={copied ? 'Copied!' : 'Copy HF URL'}
            className="p-1 rounded hover:bg-secondary-foreground/10 cursor-pointer transition-colors"
          >
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : 'text-muted-foreground hover:text-foreground'}`} />
          </button>

          {/* Metadata popover */}
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            title="View metadata"
            className="p-1 rounded hover:bg-secondary-foreground/10 cursor-pointer transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>

          {/* Delete file */}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete file"
            className="p-1 rounded hover:bg-secondary-foreground/10 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Metadata popover */}
      {showMetadata && (
        <div
          className="ml-8 mb-1 p-2 bg-secondary rounded text-xs text-muted-foreground space-y-1"
          style={{ marginLeft: `${depth * 16 + 32}px` }}
        >
          <div><span className="text-foreground font-medium">Path:</span> {node.path}</div>
          {node.size !== undefined && (
            <div><span className="text-foreground font-medium">Size:</span> {formatBytes(node.size)}</div>
          )}
          {node.oid && (
            <div className="break-all"><span className="text-foreground font-medium">OID (SHA):</span> {node.oid}</div>
          )}
        </div>
      )}

      {/* Delete file dialog */}
      <DeleteFileDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        filePath={node.path}
        repoId={repoId}
        repoType={repoType}
        onDeleted={() => setDeleteDialogOpen(false)}
      />
    </>
  );
}
