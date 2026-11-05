import { RouteContent } from "../app/router/RouteContent";
import { Footer } from "../components/layout/Footer";
import { PublicHeader } from "../components/layout/PublicHeader";

export function PublicLayout() {
  return (
    <div className="neo-app flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <PublicHeader />
      <div className="flex-1">
        <RouteContent />
      </div>
      <Footer />
    </div>
  );
}
