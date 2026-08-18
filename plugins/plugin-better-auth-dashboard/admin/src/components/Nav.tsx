import { Divider } from "@strapi/design-system";
import { useAuth } from "@strapi/strapi/admin";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useQueryClient } from "react-query";
import { PLUGIN_ID } from "../pluginId";
import {
  DASH_LINK_AVAILABILITY_STALE_TIME,
  type DashLinkStore,
  getDashLinkAvailabilityQueryKey,
  getDashLinks,
  resolveDashLinkAvailability,
} from "../utils/dashPages";
import { SubNav } from "./SubNav";

type NavProps = {
  isFullPage?: boolean;
};

const Nav = ({ isFullPage = false }: NavProps) => {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
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
                const [hasPermission, isAvailable] = await Promise.all([
                  permissions.length === 0
                    ? true
                    : checkUserHasPermissions(permissions).then(
                        (authorizedPermissions) =>
                          authorizedPermissions.length > 0,
                      ),
                  queryClient.fetchQuery(
                    getDashLinkAvailabilityQueryKey(link),
                    () => resolveDashLinkAvailability(link),
                    { staleTime: DASH_LINK_AVAILABILITY_STALE_TIME },
                  ),
                ]);

                return hasPermission && isAvailable ? link : null;
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
  }, [checkUserHasPermissions, dashLinks, queryClient]);

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
              {section.links.map((link) => {
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
