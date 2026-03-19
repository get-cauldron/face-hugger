import type { ListFileEntry } from '../../queries/useRepoFiles';
import FileTreeNode from './FileTreeNode';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  oid?: string;
  children?: TreeNode[];
}

/**
 * Builds a hierarchical tree from a flat list of file entries.
 * Directories are sorted before files at each level (both alphabetically).
 */
export function buildTree(files: ListFileEntry[]): TreeNode[] {
  const root: Map<string, TreeNode> = new Map();

  for (const file of files) {
    const parts = file.path.split('/');
    let currentMap = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!currentMap.has(part)) {
        const node: TreeNode = isLast
          ? {
              name: part,
              path: currentPath,
              type: file.type === 'directory' ? 'directory' : 'file',
              size: file.size,
              oid: file.oid,
              children: file.type === 'directory' ? [] : undefined,
            }
          : {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
        currentMap.set(part, node);
      }

      const node = currentMap.get(part)!;
      if (!isLast) {
        if (!node.children) node.children = [];
        // Build a temporary map from existing children for the next level
        const childMap = new Map<string, TreeNode>();
        for (const child of node.children) {
          childMap.set(child.name, child);
        }
        // Replace currentMap with a proxy that updates children
        currentMap = new Proxy(childMap, {
          get(target, prop) {
            if (prop === 'has') return (k: string) => target.has(k);
            if (prop === 'get') return (k: string) => target.get(k);
            if (prop === 'set')
              return (k: string, v: TreeNode) => {
                target.set(k, v);
                node.children = Array.from(target.values());
                return true;
              };
            return (target as unknown as Record<string | symbol, unknown>)[prop];
          },
        }) as Map<string, TreeNode>;
      }
    }
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    const dirs = nodes
      .filter((n) => n.type === 'directory')
      .sort((a, b) => a.name.localeCompare(b.name));
    const fileNodes = nodes
      .filter((n) => n.type === 'file')
      .sort((a, b) => a.name.localeCompare(b.name));
    const sorted = [...dirs, ...fileNodes];
    for (const node of sorted) {
      if (node.children) {
        node.children = sortNodes(node.children);
      }
    }
    return sorted;
  }

  return sortNodes(Array.from(root.values()));
}

interface FileTreeProps {
  files: ListFileEntry[];
  repoId: string;
  repoType: 'model' | 'dataset';
  onNavigateToUpload?: () => void;
}

export default function FileTree({ files, repoId, repoType, onNavigateToUpload }: FileTreeProps) {
  const tree = buildTree(files);

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
        <p className="text-sm font-medium">This repository is empty</p>
        {onNavigateToUpload && (
          <button
            onClick={onNavigateToUpload}
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            Upload files to get started
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="font-mono text-sm">
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          repoId={repoId}
          repoType={repoType}
          depth={0}
        />
      ))}
    </div>
  );
}
