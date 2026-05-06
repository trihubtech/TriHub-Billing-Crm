

export default function PageHeader({
  title,
  subtitle,
  icon,
  children, 
}) {
  return (
    <div className="page-header" id="page-header">
      <div className="page-header-left">
        <h5 className="page-title mb-0">
          {icon && <i className={`${icon} me-2 text-primary`}></i>}
          {title}
        </h5>
        {subtitle && <small className="text-muted">{subtitle}</small>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
