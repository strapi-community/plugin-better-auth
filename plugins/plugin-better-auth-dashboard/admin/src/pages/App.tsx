import { Box } from "@strapi/design-system";
import { BackButton, Layouts, Page } from "@strapi/strapi/admin";
import { Outlet } from "react-router-dom";
import { Nav } from "../components/Nav";

const RESPONSIVE_DEFAULT_SPACING = {
  initial: 4,
  medium: 6,
  large: 10,
};

const App = () => {
  return (
    <div
      data-testid="dashboard-root"
      style={{ display: "flex", flex: "1 1 auto", minHeight: "100vh" }}
    >
      <Layouts.Root sideNav={<Nav />}>
        <Page.Title>Authentication</Page.Title>
        <Box
          display={{ initial: "block", medium: "none" }}
          paddingLeft={RESPONSIVE_DEFAULT_SPACING}
          paddingRight={RESPONSIVE_DEFAULT_SPACING}
          paddingTop={RESPONSIVE_DEFAULT_SPACING}
        >
          <BackButton fallback="/plugins/better-auth-dashboard" />
        </Box>
        <Outlet />
      </Layouts.Root>
    </div>
  );
};

export { App };
