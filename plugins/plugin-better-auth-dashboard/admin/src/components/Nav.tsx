import { Divider } from "@strapi/design-system";
import { useAuth } from "@strapi/strapi/admin";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { PLUGIN_ID } from "../pluginId";
import { type DashLinkStore, getDashLinks } from "../utils/dashPages";
import { SubNav } from "./SubNav";

type NavProps = {
  isFullPage?: boolean;
  orgEnabled?: boolean;
};

const Nav = ({ isFullPage = false, orgEnabled = false }: NavProps) => {
  const { formatMessage } = useIntl();
  const checkUserHasPermissions = useAuth(
    "DashboardNav",
    (state) => state.checkUserHasPermissions,
  );
  const dashLinks = getDashLinks();
  const [sections, setSections] = useState<DashLinkStore[string][]>([]);

  useEffect(() => {
    let isCurrent = true;

    const loadAuthorizedSections = async () => {
      const authorizedSections = await Promise.all(
        Object.values(dashLinks).map(async (section) => ({
          ...section,
          links: (
            await Promise.all(
              section.links.map(async (link) => {
                const permissions = link.permissions ?? [];
                const hasPermission =
                  permissions.length === 0 ||
                  (await checkUserHasPermissions(permissions)).length > 0;

                return hasPermission ? link : null;
              }),
            )
          ).filter((link) => link !== null),
        })),
      );

      if (isCurrent) {
        setSections(
          authorizedSections
            .filter((section) => section.links.length > 0)
            .sort(
              (a, b) =>
                (a.priority ?? 0) - (b.priority ?? 0) ||
                a.id.localeCompare(b.id),
            ),
        );
      }
    };

    loadAuthorizedSections();

    return () => {
      isCurrent = false;
    };
  }, [checkUserHasPermissions, dashLinks]);

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
                .map((link) => {
                  return (
                    <SubNav.Link
                      to={`/plugins/${PLUGIN_ID}/${link.to.replace(/^\/+/, "")}`}
                      key={link.id}
                      label={formatMessage(link.intlLabel)}
                      data-testid={`nav-${link.id}`}
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
