import { describe, it, expect } from 'vitest';
import { buildTree } from './FileTree';
import type { ListFileEntry } from '../../queries/useRepoFiles';

function mockFile(path: string, size = 100): ListFileEntry {
  return { type: 'file', path, size, oid: undefined, lfs: undefined } as unknown as ListFileEntry;
}

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('builds a flat list into a hierarchical tree', () => {
    const files = [
      mockFile('README.md'),
      mockFile('src/main.py'),
      mockFile('src/utils.py'),
    ];
    const tree = buildTree(files);
    expect(tree).toHaveLength(2); // README.md + src/
    const src = tree.find((n) => n.name === 'src');
    expect(src).toBeDefined();
    expect(src!.type).toBe('directory');
    expect(src!.children).toHaveLength(2);
  });

  it('sorts directories before files at each level', () => {
    const files = [
      mockFile('zebra.txt'),
      mockFile('alpha/file.txt'),
      mockFile('beta/file.txt'),
      mockFile('aardvark.txt'),
    ];
    const tree = buildTree(files);
    // directories first: alpha, beta, then files: aardvark.txt, zebra.txt
    expect(tree[0].name).toBe('alpha');
    expect(tree[1].name).toBe('beta');
    expect(tree[2].name).toBe('aardvark.txt');
    expect(tree[3].name).toBe('zebra.txt');
  });

  it('handles deeply nested paths', () => {
    const files = [mockFile('a/b/c/deep.txt')];
    const tree = buildTree(files);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('a');
    expect(tree[0].type).toBe('directory');
    const b = tree[0].children![0];
    expect(b.name).toBe('b');
    const c = b.children![0];
    expect(c.name).toBe('c');
    const deepFile = c.children![0];
    expect(deepFile.name).toBe('deep.txt');
    expect(deepFile.type).toBe('file');
  });

  it('preserves file size on leaf nodes', () => {
    const files = [mockFile('model.safetensors', 1024)];
    const tree = buildTree(files);
    expect(tree[0].size).toBe(1024);
  });
});
