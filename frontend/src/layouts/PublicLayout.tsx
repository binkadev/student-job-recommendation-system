import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { PublicHeader } from "../components/layout/PublicHeader";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <Outlet />
      <Footer />
    </div>
  );
}
