import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { PageShell } from "./components/PageShell";
import { RequireAuth, RequireAdmin } from "./components/RequireAuth";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { CompetencyDetailPage } from "./pages/CompetencyDetailPage";
import { NewCompetencyPage } from "./pages/NewCompetencyPage";
import { AdminPage } from "./pages/AdminPage";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { MyProjectsPage } from "./pages/MyProjectsPage";
import {
  StandardsPage,
  QualificationsListPage,
  QualificationDetailPage,
  AssessmentToolsListPage,
  AssessmentToolDetailPage,
  FgosListPage,
  FgosDetailPage,
  StrategicSessionPage,
} from "./pages/WorkspacePages";

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "search", Component: SearchPage },
      { path: "competency/:id", Component: CompetencyDetailPage },
      { path: "new", Component: NewCompetencyPage },
      {
        path: "my-projects",
        element: (
          <RequireAuth>
            <WorkspaceShell>
              <MyProjectsPage />
            </WorkspaceShell>
          </RequireAuth>
        ),
      },
      {
        path: "strategic-session",
        element: (
          <RequireAuth>
            <StrategicSessionPage />
          </RequireAuth>
        ),
      },
      {
        path: "standards",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <StandardsPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "qualifications",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <QualificationsListPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "qualifications/:id",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <QualificationDetailPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "assessment-tools",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <AssessmentToolsListPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "assessment-tools/:id",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <AssessmentToolDetailPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "fgos",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <FgosListPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "fgos/:id",
        element: (
          <RequireAdmin>
            <WorkspaceShell>
              <FgosDetailPage />
            </WorkspaceShell>
          </RequireAdmin>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      { path: "integration", Component: IntegrationPage },
      { path: "login", Component: LoginPage },
    ],
  },
]);
