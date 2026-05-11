"use client";

import { useState } from "react";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "login_failed");
      }
      window.location.reload();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">Admin</p>
        <h1>Private product control</h1>
        <p>Sign in to manage templates, runs, designs, products, and storefront collections.</p>
      </div>

      <form className="pg-admin-login" onSubmit={handleSubmit}>
        <label className="pg-selector-group">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="pg-selector-group">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="pg-error-copy">{error}</p> : null}
        <button type="submit" className="pg-primary-button" disabled={loading}>
          {loading ? "SIGNING IN..." : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}
