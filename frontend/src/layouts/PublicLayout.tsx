import { Outlet } from "react-router-dom";
import { Footer } from "../components/layout/Footer";
import { PublicHeader } from "../components/layout/PublicHeader";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fc]">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <PublicHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
