import { Page } from "@strapi/strapi/admin";
import { useLocation } from "react-router-dom";
import { ProtectedRolesCreatePage } from "./CreatePage";
import { PERMISSIONS } from "./constants";
import { ProtectedRolesEditPage } from "./EditPage";
import { ProtectedRolesListPage } from "./ListPage";
import { ROLES_BASE } from "./paths";

const Roles = () => {
  const { pathname: path } = useLocation();
  const isCreate = path === `${ROLES_BASE}/new` || path.endsWith("/roles/new");
  const editMatch = path.match(/\/settings\/api-permissions\/roles\/([^/]+)$/);
  const editId = editMatch && editMatch[1] !== "new" ? editMatch[1] : null;

  return (
    <Page.Protect permissions={PERMISSIONS.accessRoles}>
      {isCreate && <ProtectedRolesCreatePage />}
      {editId && <ProtectedRolesEditPage id={editId} />}
      {!isCreate && !editId && <ProtectedRolesListPage />}
    </Page.Protect>
  );
};

export default Roles;
