import { createBrowserRouter, Navigate } from "react-router-dom";
import { adminRoutes, authRoutes, candidateRoutes, publicRoutes, recruiterRoutes } from "../../constants/routes";
import { AdminLayout } from "../../layouts/AdminLayout";
import { CandidateLayout } from "../../layouts/CandidateLayout";
import { PublicLayout } from "../../layouts/PublicLayout";
import { RecruiterLayout } from "../../layouts/RecruiterLayout";
import { AuthFlowPage } from "../../pages/auth/AuthFlowPage";
import { LoginPage } from "../../pages/auth/LoginPage";
import { CandidateApplicationsPage } from "../../pages/candidate/CandidateApplicationsPage";
import { CandidateCvsPage } from "../../pages/candidate/CandidateCvsPage";
import { CandidateDashboardPage } from "../../pages/candidate/CandidateDashboardPage";
import { CandidateInterviewsPage } from "../../pages/candidate/CandidateInterviewsPage";
import { CandidateInvitationsPage } from "../../pages/candidate/CandidateInvitationsPage";
import { CandidateJobsPage } from "../../pages/candidate/CandidateJobsPage";
import { CandidateMessagesPage } from "../../pages/candidate/CandidateMessagesPage";
import { CandidateNotificationsPage } from "../../pages/candidate/CandidateNotificationsPage";
import { CandidateProfilePage } from "../../pages/candidate/CandidateProfilePage";
import { CandidateSettingsPage } from "../../pages/candidate/CandidateSettingsPage";
import { ForbiddenPage } from "../../pages/errors/ForbiddenPage";
import { NotFoundPage } from "../../pages/errors/NotFoundPage";
import { PlaceholderPage } from "../../pages/PlaceholderPage";
import { AdminAnalyticsPage } from "../../pages/admin/AdminAnalyticsPage";
import { AdminApplicationsPage } from "../../pages/admin/AdminApplicationsPage";
import { AdminCategoriesPage } from "../../pages/admin/AdminCategoriesPage";
import { AdminCompaniesPage } from "../../pages/admin/AdminCompaniesPage";
import { AdminContentPage } from "../../pages/admin/AdminContentPage";
import { AdminCvRecommendationPage } from "../../pages/admin/AdminCvRecommendationPage";
import { AdminDashboardPage } from "../../pages/admin/AdminDashboardPage";
import { AdminJobsPage } from "../../pages/admin/AdminJobsPage";
import { AdminReportsPage } from "../../pages/admin/AdminReportsPage";
import { AdminSystemSettingsPage } from "../../pages/admin/AdminSystemSettingsPage";
import { AdminUsersPage } from "../../pages/admin/AdminUsersPage";
import { CareerResourcesPage } from "../../pages/public/CareerResourcesPage";
import { CompaniesPage } from "../../pages/public/CompaniesPage";
import { CompanyDetailPage } from "../../pages/public/CompanyDetailPage";
import { HomePage } from "../../pages/public/HomePage";
import { JobDetailPage } from "../../pages/public/JobDetailPage";
import { JobsPage } from "../../pages/public/JobsPage";
import { PublicInfoPage } from "../../pages/public/PublicInfoPage";
import { RecruiterCandidatesPage } from "../../pages/recruiter/RecruiterCandidatesPage";
import { RecruiterCompanyPage } from "../../pages/recruiter/RecruiterCompanyPage";
import { RecruiterDashboardPage } from "../../pages/recruiter/RecruiterDashboardPage";
import { RecruiterInterviewsPage } from "../../pages/recruiter/RecruiterInterviewsPage";
import { RecruiterJobsPage } from "../../pages/recruiter/RecruiterJobsPage";
import { RecruiterMembersPage } from "../../pages/recruiter/RecruiterMembersPage";
import { RecruiterReportsPage } from "../../pages/recruiter/RecruiterReportsPage";
import { RecruiterSettingsPage } from "../../pages/recruiter/RecruiterSettingsPage";
import { GuestRoute, ProtectedRoute, PublicRoute, RoleRoute } from "../../routes/RouteGuards";
import type { AppRoute } from "../../types/navigation";

function routeElement(route: AppRoute) {
  if (route.path === "/") return <HomePage />;
  if (route.path === "/jobs") return <JobsPage />;
  if (route.path === "/jobs/:jobId") return <JobDetailPage />;
  if (route.path === "/companies") return <CompaniesPage />;
  if (route.path === "/companies/:companyId") return <CompanyDetailPage />;
  if (route.path === "/career-resources" || route.path === "/career-resources/:slug") return <CareerResourcesPage />;
  if (route.path === "/about") return <PublicInfoPage title="Giới thiệu" description="Thông tin tổng quan về hệ thống gợi ý việc làm dựa trên CV và hồ sơ cá nhân." />;
  if (route.path === "/contact") return <PublicInfoPage title="Liên hệ" description="Kênh liên hệ hỗ trợ ứng viên, nhà tuyển dụng và quản trị hệ thống." />;
  if (route.path === "/privacy-policy") return <PublicInfoPage title="Chính sách bảo mật" description="Quy định về thu thập, lưu trữ và sử dụng dữ liệu hồ sơ, CV và thông tin tuyển dụng." />;
  if (route.path === "/terms") return <PublicInfoPage title="Điều khoản sử dụng" description="Điều kiện sử dụng nền tảng, trách nhiệm người dùng và quy định đăng tin tuyển dụng." />;
  if (route.path === "/login") return <LoginPage />;
  if (route.path === "/register") return <AuthFlowPage type="register" />;
  if (route.path === "/register/candidate") return <AuthFlowPage type="candidate" />;
  if (route.path === "/register/recruiter") return <AuthFlowPage type="recruiter" />;
  if (route.path === "/forgot-password") return <AuthFlowPage type="forgot" />;
  if (route.path === "/reset-password") return <AuthFlowPage type="reset" />;
  return <PlaceholderPage route={route} />;
}

function candidateRouteElement(route: AppRoute) {
  switch (route.path) {
    case "/candidate/dashboard":
      return <CandidateDashboardPage />;
    case "/candidate/jobs":
      return <CandidateJobsPage />;
    case "/candidate/jobs/:jobId":
      return <CandidateJobsPage mode="detail" />;
    case "/candidate/jobs/recommended":
      return <CandidateJobsPage mode="recommended" />;
    case "/candidate/jobs/saved":
      return <CandidateJobsPage mode="saved" />;
    case "/candidate/jobs/saved-searches":
      return <CandidateJobsPage mode="saved-searches" />;
    case "/candidate/profile":
      return <CandidateProfilePage />;
    case "/candidate/profile/edit":
      return <CandidateProfilePage mode="edit" />;
    case "/candidate/profile/preferences":
      return <CandidateProfilePage mode="preferences" />;
    case "/candidate/cvs":
      return <CandidateCvsPage />;
    case "/candidate/cvs/upload":
      return <CandidateCvsPage mode="upload" />;
    case "/candidate/cvs/:cvId":
      return <CandidateCvsPage mode="detail" />;
    case "/candidate/cvs/:cvId/analysis":
      return <CandidateCvsPage mode="analysis" />;
    case "/candidate/cvs/:cvId/edit-extracted-data":
      return <CandidateCvsPage mode="edit-extracted" />;
    case "/candidate/cvs/:cvId/review":
      return <CandidateCvsPage mode="review" />;
    case "/candidate/applications":
      return <CandidateApplicationsPage />;
    case "/candidate/applications/:applicationId":
      return <CandidateApplicationsPage mode="detail" />;
    case "/candidate/applications/:applicationId/status":
      return <CandidateApplicationsPage mode="status" />;
    case "/candidate/interviews":
      return <CandidateInterviewsPage />;
    case "/candidate/interviews/:interviewId":
      return <CandidateInterviewsPage mode="detail" />;
    case "/candidate/invitations":
      return <CandidateInvitationsPage />;
    case "/candidate/invitations/:invitationId":
      return <CandidateInvitationsPage mode="detail" />;
    case "/candidate/messages":
    case "/candidate/messages/:conversationId":
      return <CandidateMessagesPage />;
    case "/candidate/notifications":
      return <CandidateNotificationsPage />;
    case "/candidate/settings":
      return <CandidateSettingsPage section="main" />;
    case "/candidate/settings/account":
      return <CandidateSettingsPage section="account" />;
    case "/candidate/settings/security":
      return <CandidateSettingsPage section="security" />;
    case "/candidate/settings/privacy":
      return <CandidateSettingsPage section="privacy" />;
    case "/candidate/settings/notifications":
      return <CandidateSettingsPage section="notifications" />;
    default:
      return <PlaceholderPage route={route} />;
  }
}

function recruiterRouteElement(route: AppRoute) {
  switch (route.path) {
    case "/recruiter/dashboard":
      return <RecruiterDashboardPage />;
    case "/recruiter/company":
      return <RecruiterCompanyPage />;
    case "/recruiter/company/edit":
      return <RecruiterCompanyPage mode="edit" />;
    case "/recruiter/company/verification":
      return <RecruiterCompanyPage mode="verification" />;
    case "/recruiter/jobs":
      return <RecruiterJobsPage />;
    case "/recruiter/jobs/create":
      return <RecruiterJobsPage mode="create" />;
    case "/recruiter/jobs/:jobId":
      return <RecruiterJobsPage mode="detail" />;
    case "/recruiter/jobs/:jobId/edit":
      return <RecruiterJobsPage mode="edit" />;
    case "/recruiter/jobs/:jobId/preview":
      return <RecruiterJobsPage mode="preview" />;
    case "/recruiter/jobs/:jobId/statistics":
      return <RecruiterJobsPage mode="statistics" />;
    case "/recruiter/campaigns":
    case "/recruiter/campaigns/:campaignId":
      return <RecruiterJobsPage />;
    case "/recruiter/candidates":
      return <RecruiterCandidatesPage />;
    case "/recruiter/candidates/:candidateId":
      return <RecruiterCandidatesPage mode="detail" />;
    case "/recruiter/candidates/:candidateId/evaluation":
      return <RecruiterCandidatesPage mode="evaluation" />;
    case "/recruiter/pipeline":
      return <RecruiterCandidatesPage mode="pipeline" />;
    case "/recruiter/recommended-candidates":
      return <RecruiterCandidatesPage mode="recommended" />;
    case "/recruiter/saved-candidates":
      return <RecruiterCandidatesPage mode="saved" />;
    case "/recruiter/candidate-search":
      return <RecruiterCandidatesPage mode="search" />;
    case "/recruiter/interviews":
      return <RecruiterInterviewsPage />;
    case "/recruiter/interviews/create":
      return <RecruiterInterviewsPage mode="create" />;
    case "/recruiter/interviews/:interviewId":
      return <RecruiterInterviewsPage mode="detail" />;
    case "/recruiter/messages":
    case "/recruiter/messages/:conversationId":
      return <CandidateMessagesPage />;
    case "/recruiter/reports":
      return <RecruiterReportsPage />;
    case "/recruiter/members":
      return <RecruiterMembersPage />;
    case "/recruiter/members/invite":
      return <RecruiterMembersPage mode="invite" />;
    case "/recruiter/settings":
      return <RecruiterSettingsPage section="main" />;
    case "/recruiter/settings/account":
      return <RecruiterSettingsPage section="account" />;
    case "/recruiter/settings/recruitment-process":
      return <RecruiterSettingsPage section="recruitment-process" />;
    case "/recruiter/settings/email-templates":
      return <RecruiterSettingsPage section="email-templates" />;
    case "/recruiter/settings/notifications":
      return <RecruiterSettingsPage section="notifications" />;
    case "/recruiter/settings/security":
      return <RecruiterSettingsPage section="security" />;
    default:
      return <PlaceholderPage route={route} />;
  }
}

function adminRouteElement(route: AppRoute) {
  switch (route.path) {
    case "/admin/dashboard":
      return <AdminDashboardPage />;
    case "/admin/users":
      return <AdminUsersPage />;
    case "/admin/users/:userId":
      return <AdminUsersPage mode="detail" />;
    case "/admin/recruiters":
      return <AdminUsersPage mode="recruiters" />;
    case "/admin/recruiters/:recruiterId":
      return <AdminUsersPage mode="detail" />;
    case "/admin/companies":
      return <AdminCompaniesPage />;
    case "/admin/companies/:companyId":
      return <AdminCompaniesPage mode="detail" />;
    case "/admin/companies/:companyId/verification":
      return <AdminCompaniesPage mode="verification" />;
    case "/admin/jobs":
      return <AdminJobsPage />;
    case "/admin/jobs/pending":
      return <AdminJobsPage mode="pending" />;
    case "/admin/jobs/:jobId":
      return <AdminJobsPage mode="detail" />;
    case "/admin/jobs/:jobId/review":
      return <AdminJobsPage mode="review" />;
    case "/admin/applications":
      return <AdminApplicationsPage />;
    case "/admin/applications/:applicationId":
      return <AdminApplicationsPage mode="detail" />;
    case "/admin/categories":
    case "/admin/categories/industries":
    case "/admin/categories/job-titles":
    case "/admin/categories/skills":
    case "/admin/categories/locations":
    case "/admin/categories/job-types":
    case "/admin/categories/experience-levels":
      return <AdminCategoriesPage />;
    case "/admin/cv-analysis":
      return <AdminCvRecommendationPage />;
    case "/admin/cv-analysis/errors":
      return <AdminCvRecommendationPage mode="errors" />;
    case "/admin/recommendation-system":
      return <AdminCvRecommendationPage mode="recommendation" />;
    case "/admin/recommendation-system/configuration":
      return <AdminCvRecommendationPage mode="configuration" />;
    case "/admin/content":
      return <AdminContentPage />;
    case "/admin/content/articles":
      return <AdminContentPage mode="article" />;
    case "/admin/content/banners":
      return <AdminContentPage mode="banner" />;
    case "/admin/content/pages":
      return <AdminContentPage mode="page" />;
    case "/admin/reports":
      return <AdminReportsPage />;
    case "/admin/reports/:reportId":
      return <AdminReportsPage mode="detail" />;
    case "/admin/analytics":
      return <AdminAnalyticsPage />;
    case "/admin/audit-logs":
      return <AdminAnalyticsPage mode="audit" />;
    case "/admin/system-settings":
      return <AdminSystemSettingsPage />;
    default:
      return <PlaceholderPage route={route} />;
  }
}

export const appRouter = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          ...publicRoutes.map((route) => ({ path: route.path, element: routeElement(route) })),
          {
            element: <GuestRoute />,
            children: authRoutes.map((route) => ({ path: route.path, element: routeElement(route) })),
          },
          { path: "/403", element: <ForbiddenPage /> },
          { path: "/404", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleRoute role="candidate" />,
        children: [
          {
            path: "/candidate",
            element: <CandidateLayout />,
            children: [
              { index: true, element: <Navigate to="/candidate/dashboard" replace /> },
              ...candidateRoutes.map((route) => ({ path: route.path.replace("/candidate/", ""), element: candidateRouteElement(route) })),
            ],
          },
        ],
      },
      {
        element: <RoleRoute role="recruiter" />,
        children: [
          {
            path: "/recruiter",
            element: <RecruiterLayout />,
            children: [
              { index: true, element: <Navigate to="/recruiter/dashboard" replace /> },
              ...recruiterRoutes.map((route) => ({ path: route.path.replace("/recruiter/", ""), element: recruiterRouteElement(route) })),
            ],
          },
        ],
      },
      {
        element: <RoleRoute role="admin" />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/dashboard" replace /> },
              ...adminRoutes.map((route) => ({ path: route.path.replace("/admin/", ""), element: adminRouteElement(route) })),
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
