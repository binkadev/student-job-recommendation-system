import { Component, Suspense, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { LoadingState } from "../../components/feedback/LoadingState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { Button } from "../../components/ui/Button";

class ContentBoundary extends Component<{ children: ReactNode; routeKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; routeKey: string }>) {
    if (this.state.failed && previous.routeKey !== this.props.routeKey) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <PageContainer>
      <ErrorState message="Không thể tải trang. Hãy tải lại hoặc chọn mục khác trong menu." />
      <Button className="mt-4" onClick={() => window.location.reload()}>Tải lại trang</Button>
    </PageContainer>;
    return this.props.children;
  }
}

// Keep navigation mounted while a route downloads or fails to load.
export function RouteContent() {
  const location = useLocation();
  return <ContentBoundary routeKey={location.pathname}>
    <Suspense fallback={<PageContainer><LoadingState message="Đang tải trang..." /></PageContainer>}><Outlet /></Suspense>
  </ContentBoundary>;
}
