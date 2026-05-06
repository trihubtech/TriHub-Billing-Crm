import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import PageHeader from "../components/shared/PageHeader";
import DataTable from "../components/shared/DataTable";
import ConfirmModal from "../components/shared/ConfirmModal";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canAddInvoices = hasPermission(user, "can_add_invoices");
  const canViewInvoices = hasPermission(user, "can_view_invoices");
  const canEditInvoices = hasPermission(user, "can_edit_invoices");
  const canDeleteInvoices = hasPermission(user, "can_delete_invoices");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/invoices?page=${page}&pageSize=${pageSize}&search=${search}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/invoices/${deleteId}`);
      toast.success("Invoice deleted");
      setDeleteId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const statusColors = { PAID: "success", PARTIAL: "warning", UNPAID: "danger" };

  const columns = [
    { key: "code", label: "Invoice #", style: { width: "100px" }, render: (row) => <span className="fw-semibold text-primary">{row.code}</span> },
    { key: "date", label: "Date", style: { width: "100px" }, render: (row) => new Date(String(row.date).replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "customer_name", label: "Customer", render: (row) => <><div className="fw-medium">{row.customer_name}</div><small className="text-muted">{row.customer_mobile}</small></> },
    { key: "grand_total", label: "Total", style: { width: "120px" }, cellClassName: "text-end fw-semibold", render: (row) => `₹${formatCurrency(row.grand_total)}` },
    {
      key: "balance",
      label: "Balance",
      style: { width: "110px" },
      cellClassName: "text-end",
      render: (row) => {
        const balance = Number(row.balance || 0);
        if (balance === 0) return <span className="text-muted">₹0.00</span>;
        if (balance < 0) return <span className="text-danger">Due: ₹{formatCurrency(Math.abs(balance))}</span>;
        return <span className="text-success">Adv: ₹{formatCurrency(balance)}</span>;
      },
    },
    { key: "status", label: "Status", style: { width: "90px" }, render: (row) => <span className={`badge bg-${statusColors[row.status]} bg-opacity-10 text-${statusColors[row.status]}`} style={{ fontSize: "0.7rem" }}>{row.status}</span> },
  ];

  if (canViewInvoices || canEditInvoices || canDeleteInvoices) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "120px" },
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          {canViewInvoices && (
            <button className="btn btn-link btn-sm p-0 text-info" title="View" onClick={(event) => { event.stopPropagation(); navigate(`/invoices/${row.id}/view`); }}>
              <i className="fa-solid fa-eye"></i>
            </button>
          )}
          {canEditInvoices && (
            <button className="btn btn-link btn-sm p-0 text-primary" title="Edit" onClick={(event) => { event.stopPropagation(); navigate(`/invoices/${row.id}/edit`); }}>
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          )}
          {canDeleteInvoices && (
            <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={(event) => { event.stopPropagation(); setDeleteId(row.id); }}>
              <i className="fa-solid fa-trash"></i>
            </button>
          )}
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader title="Invoices" icon="fa-solid fa-file-invoice" subtitle={`${total} invoices`}>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: "120px" }} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} id="invoice-status-filter">
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          {canAddInvoices && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/invoices/new")} id="new-invoice-btn">
              <i className="fa-solid fa-plus me-1"></i>New Invoice
            </button>
          )}
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        onRowClick={canViewInvoices ? (row) => navigate(`/invoices/${row.id}/view`) : undefined}
        searchPlaceholder="Search invoices..."
        emptyMessage="No invoices found"
        emptyIcon="fa-solid fa-file-invoice"
      />

      <ConfirmModal show={!!deleteId} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} message="Deleting this invoice will restore the stock for all items. Continue?" />
    </div>
  );
}
