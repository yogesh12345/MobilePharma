export type EffPerm = {
  code: string;
  resource: string;
  action: string;
  scopeType?: string;
  scopeID?: number | null;
};

const normalize = (value?: string | null) => (value ?? "").toLowerCase();

const parsePermission = (permission: EffPerm) => {
  const resource = normalize(permission.resource);
  const action = normalize(permission.action);

  if (resource.includes(":") && !action) {
    const [parsedResource, parsedAction] = resource.split(":");
    return {
      resource: parsedResource,
      action: parsedAction ?? "",
    };
  }

  return { resource, action };
};

export function normalizePermList(raw: unknown): EffPerm[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((permission: any) => ({
    code: permission.code ?? permission.Code ?? "",
    resource:
      permission.resource ??
      permission.Resource ??
      permission.code ??
      permission.Code ??
      "",
    action: permission.action ?? permission.Action ?? "",
    scopeType: permission.scopeType ?? permission.ScopeType,
    scopeID: permission.scopeID ?? permission.ScopeID,
  }));
}

export function can(
  permissions: EffPerm[] | undefined,
  resource: string,
  action?: string,
) {
  if (!permissions) return false;

  if (
    permissions.some((permission) => parsePermission(permission).resource === "admin")
  ) {
    return true;
  }

  return permissions.some((permission) => {
    const parsed = parsePermission(permission);
    if (parsed.resource !== normalize(resource)) return false;
    if (action && parsed.action !== normalize(action)) return false;
    return true;
  });
}
