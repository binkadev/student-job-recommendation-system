import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { PublicHeader } from "../components/layout/PublicHeader";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
