import {
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Loader,
  Searchbar,
  SearchForm,
} from "@strapi/design-system";
import { Pencil, Plus, Trash } from "@strapi/icons";
import { Page, useNotification, useRBAC } from "@strapi/strapi/admin";
import type React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useOutletContext } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { client, getAuthHeaders } from "../../client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PERMISSIONS } from "../../constants";
import { PLUGIN_ID } from "../../pluginId";
import { withContext } from "../../utils/dashContext";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { OrganizationDetail } from "./OrganizationDetail";

const PAGE_SIZE = 25;

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Wrap = styled.div`
  padding: 28px 32px;
  background: #f6f6f9;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #32324d;
  letter-spacing: -0.03em;
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 12px;
  color: #8e8ea9;
`;

// ─── Table card ───────────────────────────────────────────────────────────────

const TableCard = styled.div`
  background: #ffffff;
  border: 1px solid #eaeaef;
  border-radius: 10px;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TH = styled.th`
  text-align: left;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 700;
  color: #8e8ea9;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid #eaeaef;
  background: #fafafa;
  white-space: nowrap;
  &:first-child { padding-left: 20px; }
  &:last-child  { padding-right: 20px; }
`;

const THCheck = styled(TH)`
  width: 44px;
`;

const THActions = styled(TH)`
  width: 80px;
`;

const TD = styled.td`
  padding: 11px 14px;
  font-size: 12px;
  color: #32324d;
  border-bottom: 1px solid #f5f5f9;
  vertical-align: middle;
  &:first-child { padding-left: 20px; }
  &:last-child  { padding-right: 20px; }
`;

const TDCheck = styled(TD)`
  width: 44px;
`;

const TDActions = styled(TD)`
  width: 80px;
`;

const TR = styled.tr<{ $selected?: boolean; $i?: number }>`
  animation: ${fadeUp} 280ms ease both;
  animation-delay: ${(p) => (p.$i ?? 0) * 25}ms;
  background: ${(p) => (p.$selected ? "#f0f0ff" : "transparent")};
  transition: background 120ms ease;
  &:hover td { background: ${(p) => (p.$selected ? "#e8e8ff" : "#fafafe")}; }
  &:last-child td { border-bottom: none; }
`;

// ─── Slug chip ────────────────────────────────────────────────────────────────

const SlugChip = styled.span`
  display: inline-block;
  background: #f5f5f9;
  color: #666687;
  border: 1px solid #eaeaef;
  border-radius: 6px;
  padding: 2px 6px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 11px;
`;

// ─── Member count chip ────────────────────────────────────────────────────────

const CountChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  background: #f0f0ff;
  color: #4945ff;
`;

// ─── Misc text ────────────────────────────────────────────────────────────────

const OrgName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #32324d;
`;

const DateText = styled.span`
  font-size: 11px;
  color: #b8b8c7;
  font-variant-numeric: tabular-nums;
`;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const Toolbar = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
`;

// ─── Org avatar ───────────────────────────────────────────────────────────────

const OrgLogoFallback = styled.div<{ $bg: string; $fg: string }>`
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  user-select: none;
`;

const ORG_COLORS = [
  { bg: "#EAF5FF", fg: "#0C75AF" },
  { bg: "#F0F0FF", fg: "#4945FF" },
  { bg: "#EAFBE7", fg: "#328048" },
  { bg: "#FFF3D3", fg: "#8E6A00" },
  { bg: "#FCECEA", fg: "#D02B20" },
  { bg: "#F6ECFC", fg: "#8312D1" },
];

function OrgAvatar({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return (
      <Box
        tag="img"
        src={logo}
        alt=""
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  const color = ORG_COLORS[(name.charCodeAt(0) || 0) % ORG_COLORS.length];
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <OrgLogoFallback $bg={color.bg} $fg={color.fg}>
      {initials}
    </OrgLogoFallback>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  teamsEnabled: boolean;
}

export function OrganizationsPage({ teamsEnabled }: Props) {
  const rbac = useRBAC(PERMISSIONS.organization);
  const qc = useQueryClient();
  const { toggleNotification } = useNotification();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);

  const offset = (page - 1) * PAGE_SIZE;

  const orgsQuery = useQuery({
    queryKey: ["dash-organizations", page, search],
    queryFn: async () => {
      const result = await client.dash.listOrganizations({
        query: {
          limit: PAGE_SIZE,
          offset,
          sortBy: "createdAt",
          sortOrder: "desc",
          ...(search ? { search } : {}),
        },
      });
      if (result.error)
        throw new Error(result.error.message ?? "Failed to load organizations");
      return result.data;
    },
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const result = await client.dash.organization.delete(
        { organizationId },
        withContext({ organizationId }, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Delete failed");
    },
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({ type: "success", message: "Organization deleted" });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete organization",
      });
    },
  });

  const deleteManyMutation = useMutation({
    mutationFn: async (organizationIds: string[]) => {
      const result = await client.dash.organization.deleteMany(
        {},
        withContext({ organizationIds } as never, getAuthHeaders()),
      );
      if (result.error)
        throw new Error(result.error.message ?? "Delete failed");
      return result.data;
    },
    onSuccess: (_data, organizationIds) => {
      setConfirmDeleteMany(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dash-organizations"] });
      toggleNotification({
        type: "success",
        message: `${organizationIds.length} organization${organizationIds.length !== 1 ? "s" : ""} deleted`,
      });
    },
    onError: (err: Error) => {
      toggleNotification({
        type: "danger",
        message: err.message ?? "Failed to delete organizations",
      });
    },
  });

  const orgs =
    orgsQuery.data && "organizations" in orgsQuery.data
      ? orgsQuery.data.organizations
      : [];
  const total =
    orgsQuery.data && "total" in orgsQuery.data ? orgsQuery.data.total : 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const allSelected = orgs.length > 0 && orgs.every((o) => selected.has(o.id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orgs.map((o) => o.id)));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <Wrap data-testid="organizations-page">
      <PageHeader>
        <TitleBlock>
          <PageTitle>Organizations</PageTitle>
          <PageSubtitle>{total.toLocaleString()} total</PageSubtitle>
        </TitleBlock>
        {rbac.allowedActions.canCreate && (
          <Button
            startIcon={<Plus />}
            onClick={() => setShowCreate(true)}
            data-testid="create-org-btn"
          >
            Create organization
          </Button>
        )}
      </PageHeader>

      <Toolbar>
        <SearchForm onSubmit={handleSearch}>
          <Searchbar
            clearLabel="Clear"
            name="search"
            placeholder="Search organizations…"
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
            onClear={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            Search organizations
          </Searchbar>
        </SearchForm>

        {someSelected && rbac.allowedActions.canDelete && (
          <Button
            variant="danger-light"
            size="S"
            onClick={() => setConfirmDeleteMany(true)}
            data-testid="delete-selected-orgs-btn"
          >
            Delete {selected.size} selected
          </Button>
        )}
      </Toolbar>

      {orgsQuery.isError && (
        <div style={{ color: "#d02b20", fontSize: 12, padding: "8px 0" }}>
          {orgsQuery.error instanceof Error
            ? orgsQuery.error.message
            : "An error occurred"}
        </div>
      )}

      <TableCard>
        {orgsQuery.isLoading ? (
          <Flex justifyContent="center" padding={8}>
            <Loader>Loading organizations…</Loader>
          </Flex>
        ) : (
          <Table>
            <thead>
              <tr>
                {rbac.allowedActions.canDelete && (
                  <THCheck>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </THCheck>
                )}
                <TH>Name</TH>
                <TH>Slug</TH>
                <TH>Members</TH>
                <TH>Created</TH>
                <THActions />
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <TD
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#8e8ea9",
                    }}
                    data-testid="orgs-empty"
                  >
                    {search
                      ? `No organizations matching "${search}"`
                      : "No organizations found"}
                  </TD>
                </tr>
              ) : (
                orgs.map((org, i) => (
                  <TR
                    key={org.id}
                    $selected={selected.has(org.id)}
                    $i={i}
                    data-testid="org-row"
                  >
                    {rbac.allowedActions.canDelete && (
                      <TDCheck>
                        <Checkbox
                          checked={selected.has(org.id)}
                          onCheckedChange={() => toggleSelect(org.id)}
                          aria-label={`Select ${org.name}`}
                        />
                      </TDCheck>
                    )}
                    <TD>
                      <Flex alignItems="center" gap={2}>
                        <OrgAvatar name={org.name} logo={org.logo} />
                        <OrgName>{org.name}</OrgName>
                      </Flex>
                    </TD>
                    <TD>
                      <SlugChip>{org.slug}</SlugChip>
                    </TD>
                    <TD>
                      <CountChip>{org.memberCount}</CountChip>
                    </TD>
                    <TD>
                      <DateText>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </DateText>
                    </TD>
                    <TDActions>
                      <Flex gap={1} justifyContent="flex-end">
                        {rbac.allowedActions.canUpdate && (
                          <IconButton
                            label="Edit organization"
                            onClick={() => setDetailOrgId(org.id)}
                            data-testid="edit-org-btn"
                          >
                            <Pencil />
                          </IconButton>
                        )}
                        {rbac.allowedActions.canDelete && (
                          <IconButton
                            label="Delete organization"
                            onClick={() => setConfirmDelete(org.id)}
                            data-testid="delete-org-btn"
                          >
                            <Trash />
                          </IconButton>
                        )}
                      </Flex>
                    </TDActions>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        )}
      </TableCard>

      {pageCount > 1 && (
        <Flex justifyContent="flex-end">
          <Flex gap={2}>
            <Button
              variant="tertiary"
              size="S"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="tertiary"
              size="S"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      )}

      {rbac.allowedActions.canCreate && showCreate && (
        <CreateOrganizationDialog
          teamsEnabled={teamsEnabled}
          onClose={() => setShowCreate(false)}
        />
      )}

      {rbac.allowedActions.canUpdate && detailOrgId && (
        <OrganizationDetail
          organizationId={detailOrgId}
          teamsEnabled={teamsEnabled}
          onClose={() => setDetailOrgId(null)}
        />
      )}

      {rbac.allowedActions.canDelete && confirmDelete && (
        <ConfirmDialog
          title="Delete organization"
          message="Are you sure you want to delete this organization? All members and teams will be removed. This action cannot be undone."
          confirmLabel="Delete"
          loading={deleteMutation.isLoading}
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {rbac.allowedActions.canDelete && confirmDeleteMany && (
        <ConfirmDialog
          title={`Delete ${selected.size} organization${selected.size !== 1 ? "s" : ""}`}
          message={`Are you sure you want to delete ${selected.size} organization${selected.size !== 1 ? "s" : ""}? This action cannot be undone.`}
          confirmLabel="Delete all"
          loading={deleteManyMutation.isLoading}
          onConfirm={() => deleteManyMutation.mutate([...selected])}
          onCancel={() => setConfirmDeleteMany(false)}
        />
      )}
    </Wrap>
  );
}

export default function ProtectedOrganizationsPage() {
  const { teamsEnabled } = useOutletContext<{ teamsEnabled: boolean }>();

  return (
    <Page.Protect
      permissions={PERMISSIONS.organization.filter(
        (p) => p.action === `plugin::${PLUGIN_ID}.organization.read`,
      )}
    >
      <OrganizationsPage teamsEnabled={teamsEnabled} />
    </Page.Protect>
  );
}
