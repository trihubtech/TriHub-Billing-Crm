

import { useState, useEffect, useCallback, useRef } from "react";

export default function DataTable({
  columns,
  data = [],
  total = 0,
  page = 1,
  pageSize = 20,
  totalPages = 1,
  loading = false,
  onPageChange,
  onPageSizeChange,
  onSearch,
  onSort,
  searchPlaceholder = "Search…",
  emptyMessage = "No records found",
  emptyIcon = "fa-solid fa-inbox",
  actions,
  onRowClick,
  className = "",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const debounceRef = useRef(null);

  
  const handleSearch = useCallback(
    (value) => {
      setSearchTerm(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch?.(value);
      }, 300);
    },
    [onSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  
  const pageSizes = [10, 20, 50, 100];

  
  const getPageRange = () => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  return (
    <div className={`datatable-wrapper ${className}`}>
      {}
      <div className="datatable-toolbar">
        <div className="datatable-search">
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-transparent border-end-0">
              <i className="fa-solid fa-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              id="datatable-search-input"
            />
            {searchTerm && (
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => handleSearch("")}
                type="button"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        <div className="datatable-toolbar-right">
          <div className="datatable-pagesize">
            <select
              className="form-select form-select-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              id="datatable-pagesize-select"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
          </div>
          {actions && <div className="datatable-actions">{actions}</div>}
        </div>
      </div>

      {}
      <div className="table-responsive">
        <table className="table table-hover table-sm align-middle datatable-table mb-0">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.style}
                  className={`${col.className || ""} ${col.sortable ? "sortable" : ""}`}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  {col.label}
                  {col.sortable && (
                    <i className="fa-solid fa-sort fa-xs ms-1 text-muted"></i>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              
              Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="skeleton-line"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              
              <tr>
                <td colSpan={columns.length} className="text-center py-5">
                  <div className="datatable-empty">
                    <i className={`${emptyIcon} fa-3x text-muted mb-3`}></i>
                    <p className="text-muted mb-0">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              
              data.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "cursor-pointer" : ""}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClassName || ""} style={col.cellStyle} data-label={col.label || ""}>
                      {col.render ? col.render(row, idx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {}
      {totalPages > 1 && (
        <div className="datatable-pagination">
          <small className="text-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </small>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => onPageChange?.(page - 1)}>
                  <i className="fa-solid fa-chevron-left fa-xs"></i>
                </button>
              </li>
              {getPageRange().map((p) => (
                <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                  <button className="page-link" onClick={() => onPageChange?.(p)}>{p}</button>
                </li>
              ))}
              <li className={`page-item ${page >= totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => onPageChange?.(page + 1)}>
                  <i className="fa-solid fa-chevron-right fa-xs"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
