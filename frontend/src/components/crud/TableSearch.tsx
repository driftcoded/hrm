import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './TableSearch.module.css';

/**
 * Search box for a list screen's filter bar.
 *
 * Submits on Enter / the search button rather than on every keystroke: the value
 * goes into the URL and triggers a request, and one request per typed character
 * would be both noisy and pointless. `allowClear` fires `onSearch('')`, so
 * clearing the box removes the filter.
 *
 * `defaultValue` (not `value`) because the URL is the source of truth and only
 * this input writes it — the initial render is the one time it has to be read.
 */
export interface TableSearchProps {
  defaultValue?: string;
  onSearch: (value: string) => void;
  /** Placeholder describing what is actually searched, e.g. "mã hoặc tên". */
  placeholder: string;
  disabled?: boolean;
}

export function TableSearch({ defaultValue, onSearch, placeholder, disabled }: TableSearchProps) {
  const { t } = useTranslation();

  return (
    <Input.Search
      className={styles.search}
      defaultValue={defaultValue}
      placeholder={placeholder}
      allowClear
      disabled={disabled}
      enterButton
      aria-label={t('layout.search')}
      onSearch={(value) => onSearch(value.trim())}
    />
  );
}
