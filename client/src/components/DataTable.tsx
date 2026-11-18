import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import styles from './DataTable.module.css';

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Hide the header text visually; screen readers still hear it. */
  hideHeader?: boolean;
  align?: 'left' | 'right';
  /** CSS width of the column, such as "96px" or "30%". */
  width?: string;
  cell: (row: T) => ReactNode;
  /** With rowHref, this cell holds the link that makes the whole row clickable. */
  isRowLink?: boolean;
}

interface DataTableProps<T> {
  /** Describes the table for screen readers. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  /** Below this width the table scrolls horizontally inside its card. */
  minWidth?: number;
  /** relaxed: 20px row padding (Documents). regular: 68px rows (Link views). */
  density?: 'relaxed' | 'regular';
}

/** A card with a tinted header row and hover rows. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  minWidth = 700,
  density = 'relaxed',
}: DataTableProps<T>) {
  return (
    <div className={styles.card}>
      <div className={styles.scroller} role="region" aria-label={caption} tabIndex={0}>
        <table className={cx(styles.table, styles[density])} style={{ minWidth }}>
          <caption className="visually-hidden">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" className={cx(column.align === 'right' && styles.right)}>
                  {column.hideHeader ? <span className="visually-hidden">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr key={rowKey(row)} className={cx(styles.row, href && styles.linkRow)}>
                  {columns.map((column) => (
                    <td key={column.id} className={cx(column.align === 'right' && styles.right)}>
                      {href && column.isRowLink ? (
                        <Link to={href} className={styles.rowLink}>
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
