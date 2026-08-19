import { Avatar } from 'antd';
import { ApartmentOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DepartmentTreeNode } from '@/types/masterData.types';
import styles from './DepartmentOrgChart.module.css';

/**
 * The company's department hierarchy, drawn as an org chart.
 *
 * Every value on a node is real: `name`, `manager.fullName` and `employeeCount`
 * come straight from `GET /departments/tree`. Nothing is derived, estimated or
 * padded — a department with no manager says so, and a department with nobody in
 * it shows 0.
 *
 * STRUCTURE, NOT DECORATION. The markup is nested `<ul>`/`<li>`, so the tree a
 * sighted reader sees in the connector lines is the same tree a screen reader
 * walks (§11); the lines themselves are CSS borders on `::before`/`::after` and
 * carry no information of their own. Children lay out three per row, which is
 * what the design asks for; each row draws its own rail, so a department with six
 * children stays legible instead of overflowing the card.
 *
 * DEPTH. Collapsed (the default) it shows each root plus its direct children,
 * which is what fits in the right-hand column. `expanded` recurses the whole tree
 * — the page's "Xem toàn bộ" toggle. Collapsed nodes that hide something say how
 * many, rather than looking like leaves.
 */

export interface DepartmentOrgChartProps {
  /** Roots of `GET /departments/tree`; each root gets its own branch. */
  roots: DepartmentTreeNode[];
  /** `false` = roots + direct children only. */
  expanded: boolean;
  emptyText: string;
}

/** First letter of the manager's name, for the root node's avatar. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function OrgNode({
  node,
  depth,
  expanded,
}: {
  node: DepartmentTreeNode;
  depth: number;
  expanded: boolean;
}) {
  const { t } = useTranslation();
  const children = node.children ?? [];
  const showChildren = children.length > 0 && (expanded || depth === 0);
  const hiddenChildren = children.length > 0 && !showChildren ? children.length : 0;
  const isRoot = depth === 0;

  return (
    <li className={styles.branch}>
      <div className={isRoot ? styles.rootCard : styles.card}>
        {isRoot ? (
          <Avatar
            size={40}
            className={styles.avatar}
            icon={node.manager ? undefined : <UserOutlined />}
          >
            {node.manager ? initial(node.manager.fullName) : undefined}
          </Avatar>
        ) : (
          <span className={styles.tile} aria-hidden="true">
            <ApartmentOutlined />
          </span>
        )}
        <div className={styles.body}>
          <span className={styles.name} title={node.name}>
            {node.name}
          </span>
          {isRoot && (
            <span className={styles.manager}>
              {node.manager ? node.manager.fullName : t('settings.departments.noManager')}
            </span>
          )}
          <span className={styles.headcount}>
            {t('settings.departments.headcount', { count: node.employeeCount })}
          </span>
          {hiddenChildren > 0 && (
            <span className={styles.hidden}>
              {t('settings.departments.orgHiddenChildren', { count: hiddenChildren })}
            </span>
          )}
        </div>
      </div>

      {showChildren && (
        <ul className={styles.children}>
          {children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} expanded={expanded} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DepartmentOrgChart({ roots, expanded, emptyText }: DepartmentOrgChartProps) {
  if (roots.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  return (
    <div className={styles.scroller}>
      <ul className={styles.tree}>
        {roots.map((root) => (
          <OrgNode key={root.id} node={root} depth={0} expanded={expanded} />
        ))}
      </ul>
    </div>
  );
}
