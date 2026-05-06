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

export default function Bills() {
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

  const canAddBills = hasPermission(user, "can_add_bills");
  const canViewBills = hasPermission(user, "can_view_bills");
  const canEditBills = hasPermission(user, "can_edit_bills");
  const canDeleteBills = hasPermission(user, "can_delete_bills");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/bills?page=${page}&pageSize=${pageSize}&search=${search}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      setData(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load bills");
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
      await api.delete(`/bills/${deleteId}`);
      toast.success("Bill deleted");
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
    { key: "code", label: "Bill #", style: { width: "90px" }, render: (row) => <span className="fw-semibold text-primary">{row.code}</span> },
    { key: "vendor_invoice_number", label: "Vendor Inv#", style: { width: "120px" }, render: (row) => <small>{row.vendor_invoice_number}</small> },
    { key: "date", label: "Date", style: { width: "100px" }, render: (row) => new Date(String(row.date).replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "vendor_name", label: "Vendor", render: (row) => <div className="fw-medium">{row.vendor_name}</div> },
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

  if (canViewBills || canEditBills || canDeleteBills) {
    columns.push({
      key: "actions",
      label: "",
      style: { width: "80px" },
      render: (row) => (
        <div className="d-flex gap-2 justify-content-end align-items-center">
          {canViewBills && (
            <button className="btn btn-link btn-sm p-0 text-secondary" title="View / Print" onClick={(event) => { event.stopPropagation(); navigate(`/bills/${row.id}/view`); }}>
              <i className="fa-solid fa-print"></i>
            </button>
          )}
          {canEditBills && (
            <button className="btn btn-link btn-sm p-0 text-primary" title="Edit" onClick={(event) => { event.stopPropagation(); navigate(`/bills/${row.id}/edit`); }}>
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          )}
          {canDeleteBills && (
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
      <PageHeader title="Bills" icon="fa-solid fa-file-invoice-dollar" subtitle={`${total} bills`}>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: "120px" }} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          {canAddBills && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/bills/new")} id="new-bill-btn">
              <i className="fa-solid fa-plus me-1"></i>New Bill
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
        onRowClick={canViewBills ? (row) => navigate(`/bills/${row.id}/view`) : undefined}
        searchPlaceholder="Search bills..."
        emptyMessage="No bills found"
        emptyIcon="fa-solid fa-file-invoice-dollar"
      />

      <ConfirmModal show={!!deleteId} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} message="Deleting this bill will reverse the stock additions. Continue?" />
    </div>
  );
}
