import type { DepartmentTreeNode } from '@/types/masterData.types';

/** Pure helpers for the nested `GET /departments/tree` payload. */

export interface FlatDepartmentNode {
  node: DepartmentTreeNode;
  /** 0 for a root department, 1 for its children, and so on. */
  depth: number;
}

/** Depth-first flatten, preserving the backend's `sortOrder, name` ordering. */
export function flattenDepartmentTree(
  nodes: DepartmentTreeNode[] | undefined,
  depth = 0,
): FlatDepartmentNode[] {
  if (!nodes?.length) {
    return [];
  }
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenDepartmentTree(node.children, depth + 1),
  ]);
}

/**
 * The ids of `rootId` and every department below it.
 *
 * Used to keep a department (and its own descendants) out of its parent picker:
 * the backend answers `DEPARTMENT_CYCLE` for those, so offering them would be
 * offering a guaranteed error.
 */
export function collectSubtreeIds(
  nodes: DepartmentTreeNode[] | undefined,
  rootId: number,
): Set<number> {
  const found = findNode(nodes, rootId);
  const ids = new Set<number>();
  if (!found) {
    ids.add(rootId);
    return ids;
  }
  const walk = (node: DepartmentTreeNode) => {
    ids.add(node.id);
    node.children?.forEach(walk);
  };
  walk(found);
  return ids;
}

function findNode(
  nodes: DepartmentTreeNode[] | undefined,
  id: number,
): DepartmentTreeNode | undefined {
  for (const node of nodes ?? []) {
    if (node.id === id) {
      return node;
    }
    const inChildren = findNode(node.children, id);
    if (inChildren) {
      return inChildren;
    }
  }
  return undefined;
}

/**
 * AntD's `Table` renders `children` as expandable rows, but it also renders an
 * expand arrow for any row whose `children` is an empty array. Stripping the
 * empty arrays keeps leaf departments free of a useless arrow.
 */
export function toTableTreeData(nodes: DepartmentTreeNode[] | undefined): DepartmentTreeNode[] {
  return (nodes ?? []).map((node) => {
    const children = toTableTreeData(node.children);
    return children.length > 0
      ? { ...node, children }
      : ({ ...node, children: undefined } as unknown as DepartmentTreeNode);
  });
}
