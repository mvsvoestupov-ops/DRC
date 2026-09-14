import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { CompetencyDetailPage } from "./pages/CompetencyDetailPage";
import { NewCompetencyPage } from "./pages/NewCompetencyPage";
import { AdminPage } from "./pages/AdminPage";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "search",
        Component: SearchPage,
      },
      {
        path: "competency/:id",
        Component: CompetencyDetailPage,
      },
      {
        path: "new",
        Component: NewCompetencyPage,
      },
      {
        path: "admin",
        Component: AdminPage,
      },
      {
        path: "integration",
        Component: IntegrationPage,
      },
      {
        path: "login",
        Component: LoginPage,
      },
    ],
  },
]);
