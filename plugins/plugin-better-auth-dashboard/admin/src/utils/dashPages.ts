import { Page, type StrapiApp } from "@strapi/strapi/admin";
import {
  type ComponentProps,
  type ComponentType,
  createElement,
  type ReactNode,
} from "react";
import { useQuery } from "react-query";
import type { RouteObject } from "react-router-dom";
import { PLUGIN_ID } from "../pluginId";

type DashSection = Exclude<
  Parameters<StrapiApp["router"]["addSettingsLink"]>[0],
  string
> & { priority?: number };

export type DashLink = Parameters<
  StrapiApp["router"]["addSettingsLink"]
>[1][number] & {
  isAvailable?: () => boolean | Promise<boolean>;
};

type StoredDashLink = Omit<DashLink, "Component">;

export type DashLinkStore = {
  [key: string]: DashSection & {
    links: StoredDashLink[];
  };
};

export const DASH_LINK_AVAILABILITY_STALE_TIME = 5 * 60 * 1000;

export const getDashLinkAvailabilityQueryKey = (link: StoredDashLink) => [
  PLUGIN_ID,
  "link-availability",
  link.id,
  link.to,
];

export const resolveDashLinkAvailability = async (
  link: StoredDashLink,
): Promise<boolean> => {
  try {
    return (await link.isAvailable?.()) ?? true;
  } catch {
    return false;
  }
};

let currentStore: DashLinkStore = {};

export const getDashLinks = (): DashLinkStore => currentStore;

export type ReturnInitDash = {
  /**
   * Adds a link to the dashboard settings section
   * @param section The section to which the link should be added. Can be a string (section id) or an object with id and intlLabel properties
   * @param link The link to be added to the section. Should have id, intlLabel, to, and permissions properties
   */
  addDashLink: (
    section: Parameters<StrapiApp["router"]["addSettingsLink"]>[0] & {
      priority?: number;
    },
    link: DashLink,
  ) => void;
  addDashSection: (
    section: Exclude<
      Parameters<StrapiApp["router"]["addSettingsLink"]>[0],
      string
    > & {
      priority?: number;
    },
  ) => void;
  /**
   * Retrieves the current state of the dashboard links store
   * @returns The current state of the dashboard links store, which is an object where keys are section ids and values are section details including links
   */
  getDashLinks: () => DashLinkStore;
};

type routeOverride = RouteObject;

type routerOverride = Omit<StrapiApp["router"], "_routes"> & {
  _routes: routeOverride[];
};

const RouteProtector = Page.Protect as ComponentType<
  Omit<ComponentProps<typeof Page.Protect>, "children">
>;

const AvailabilityProtector = ({
  link,
  children,
}: {
  link: StoredDashLink;
  children?: ReactNode;
}) => {
  const { data: isAvailable, isLoading } = useQuery<boolean>({
    queryKey: getDashLinkAvailabilityQueryKey(link),
    queryFn: () => resolveDashLinkAvailability(link),
    staleTime: DASH_LINK_AVAILABILITY_STALE_TIME,
  });

  if (isLoading) return createElement(Page.Loading);
  if (!isAvailable) return createElement(Page.NoPermissions);

  return children;
};

export const initDash = (app: StrapiApp): ReturnInitDash => {
  const store: DashLinkStore = {};
  currentStore = store;

  const addDashLink: ReturnInitDash["addDashLink"] = (section, link) => {
    const router = app.router as unknown as routerOverride;

    const storeIndex = router._routes.findIndex(
      (route) => route.path === `plugins/${PLUGIN_ID}/*`,
    );

    const route = router._routes[storeIndex];

    if (section)
      if (!route) {
        throw new Error(
          `Dashboard route for plugin ${PLUGIN_ID} was not found`,
        );
      }

    if (!route.children) {
      route.children = [];
    }

    route.children?.push(mapLinkToRoute(link));

    const sectionId = typeof section === "string" ? section : section.id;
    const existing = store[sectionId];

    if (!existing) {
      if (typeof section === "string") {
        throw new Error(`Dashboard section ${sectionId} does not exist`);
      }

      store[sectionId] = {
        ...section,
        links: [],
      };
    } else if (
      typeof section.priority === "number" &&
      section.priority !== existing.priority
    ) {
      console.warn(
        "[DASH] Only the first instance of section can declare its priority.",
      );
    }

    store[sectionId].links.push(link);
  };

  const addDashSection: ReturnInitDash["addDashSection"] = (section) => {
    const existing = store[section.id];

    if (existing) {
      console.warn("[DASH] A section with this ID already exists.");
      return;
    }

    store[section.id] = {
      ...section,
      links: [],
    };
  };

  const getDashLinks: ReturnInitDash["getDashLinks"] = () => {
    return store;
  };

  return {
    addDashLink,
    addDashSection,
    getDashLinks,
  };
};

/**
 * Maps a link to a route object
 * @param link The link object to be mapped to a route
 * @returns A route object compatible with react-router-dom
 */
const mapLinkToRoute = (link: DashLink): RouteObject => {
  if (!link.Component)
    throw new Error(
      `Link with id ${link.to} does not have a Component property`,
    );

  const permissions = link.permissions;
  const hasPermissions = Array.isArray(permissions) && permissions.length > 0;

  return {
    path: `${link.to.replace(/^\/+|\/+$/g, "")}/*`,
    lazy: async () => {
      const mod = await link.Component!();
      const Component = ("default" in mod ? mod.default : mod) as ComponentType;

      return {
        Component: () =>
          createElement(
            AvailabilityProtector,
            { link },
            hasPermissions
              ? createElement(
                  RouteProtector,
                  { permissions },
                  createElement(Component),
                )
              : createElement(Component),
          ),
      };
    },
  };
};
