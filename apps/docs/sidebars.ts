import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Better Auth',
      collapsed: false,
      link: {
        type: 'doc',
        id: 'better-auth/better-auth',
      },
      items: [
        'better-auth/installation',
        'better-auth/configuration',
        'better-auth/schema',
        'better-auth/emails',
        'better-auth/client-setup',
        'better-auth/server-usage',
        'better-auth/plugins',
        'better-auth/public-api',
        'better-auth/owner-middleware',
      ],
    },
    {
      type: 'category',
      label: 'Dashboard',
      link: {
        type: 'doc',
        id: 'dashboard/dashboard',
      },
      items: [
        'dashboard/installation',
        'dashboard/mcp',
        'dashboard/dash-api',
        'dashboard/screen-api',
        'dashboard/edit-view-panel',
      ],
    },
    {
      type: 'category',
      label: 'API Permissions',
      link: {
        type: 'doc',
        id: 'api-permissions/api-permissions',
      },
      items: [
        'api-permissions/installation',
        'api-permissions/configuration',
        'api-permissions/session-resolver',
        'api-permissions/admin-panel',
        'api-permissions/how-it-works',
      ],
    },
    {
      type: 'doc',
      id: 'migration',
      label: 'Migrate from U&P',
    },
  ],
};

export default sidebars;
