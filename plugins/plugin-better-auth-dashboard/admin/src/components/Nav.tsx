import { Divider } from "@strapi/design-system";
import { useRBAC } from "@strapi/strapi/admin";
import { useIntl } from "react-intl";
import { PERMISSIONS } from "../constants";
import { getTranslation } from "../utils/getTranslation";
import { SubNav } from "./SubNav";

const sections = [
  {
    id: "api-roles",
    intlLabel: {
      id: getTranslation("settings.general"),
      defaultMessage: "General",
    },
    links: [
      {
        id: "overview",
        intlLabel: {
          id: getTranslation("settings.overview"),
          defaultMessage: "Overview",
        },
        to: "/plugins/better-auth-dashboard/overview",
        testid: "nav-overview",
      },
      {
        id: "users",
        intlLabel: {
          id: getTranslation("settings.users"),
          defaultMessage: "User Management",
        },
        to: "/plugins/better-auth-dashboard/users",
        testid: "nav-users",
      },
      {
        id: "organizations",
        intlLabel: {
          id: getTranslation("settings.organizations"),
          defaultMessage: "Organization Management",
        },
        to: "/plugins/better-auth-dashboard/organizations",
        testid: "nav-organizations",
      },
    ],
  },
];

type NavProps = {
  isFullPage?: boolean;
  orgEnabled?: boolean;
};

const Nav = ({ isFullPage = false, orgEnabled = false }: NavProps) => {
  const { formatMessage } = useIntl();

  const overviewRBAC = useRBAC(PERMISSIONS.overview);
  const userRBAC = useRBAC(PERMISSIONS.user);
  const organizationRBAC = useRBAC(PERMISSIONS.organization);

  return (
    <SubNav.Main>
      {!isFullPage && (
        <>
          <SubNav.Header label="Authentication" />
          <Divider />
        </>
      )}
      <SubNav.Content>
        {isFullPage && (
          <>
            <SubNav.Header label="Authentication" />
            <Divider />
          </>
        )}
        <SubNav.Sections data-testid="main-nav">
          {sections.map((section) => (
            <SubNav.Section
              key={section.id}
              label={formatMessage(section.intlLabel)}
            >
              {section.links
                .filter((link) => orgEnabled || link.id !== "organizations")
                .filter((link) => {
                  if (link.id === "overview") {
                    return overviewRBAC.allowedActions.canRead;
                  }
                  if (link.id === "users") {
                    return userRBAC.allowedActions.canRead;
                  }
                  if (link.id === "organizations") {
                    return organizationRBAC.allowedActions.canRead;
                  }
                  return true;
                })
                .map((link) => {
                  return (
                    <SubNav.Link
                      to={link.to}
                      key={link.id}
                      label={formatMessage(link.intlLabel)}
                      data-testid={link.testid}
                    >
                      {formatMessage(link.intlLabel)}
                    </SubNav.Link>
                  );
                })}
            </SubNav.Section>
          ))}
        </SubNav.Sections>
      </SubNav.Content>
    </SubNav.Main>
  );
};

export { Nav };
