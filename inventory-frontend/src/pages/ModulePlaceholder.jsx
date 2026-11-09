export default function ModulePlaceholder({ title, description, endpoint }) {
  return (
    <section className="module-placeholder">
      <div className="page-heading">
        <h1>{title}</h1>

        <p className="muted">{description}</p>
      </div>

      <div className="panel">
        <span className="development-label">Frontend under development</span>

        <h2>{title} Management</h2>

        <p>We have already implemented the Laravel API for this module.</p>

        <p>
          In the upcoming steps, we will connect this page to Laravel using
          Axios and build the appropriate tables and forms.
        </p>

        <div className="endpoint-box">
          <strong>Laravel API Endpoint</strong>
          <code>{endpoint}</code>
        </div>
      </div>
    </section>
  );
}
