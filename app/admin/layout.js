import { cookies } from "next/headers";

import AdminLoginForm from "../../components/admin/AdminLoginForm.jsx";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { getAdminSession } from "../../lib/auth.js";

export default function AdminLayout({ children }) {
  const session = getAdminSession(cookies());

  if (!session) {
    return <AdminLoginForm />;
  }

  return <AdminShell session={session}>{children}</AdminShell>;
}
