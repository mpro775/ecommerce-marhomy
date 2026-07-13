import { createContext, useContext, type ReactNode } from 'react';

export const PERMISSIONS={
  dashboardRead:'dashboard:read',productsRead:'products:read',productsWrite:'products:write',
  categoriesRead:'categories:read',categoriesWrite:'categories:write',brandsRead:'brands:read',brandsWrite:'brands:write',
  attributesRead:'attributes:read',attributesWrite:'attributes:write',filtersRead:'filters:read',filtersWrite:'filters:write',
  mediaRead:'media:read',mediaWrite:'media:write',quoteRequestsRead:'quote_requests:read',quoteRequestsWrite:'quote_requests:write',
  quoteRequestsAssign:'quote_requests:assign',quoteRequestsExport:'quote_requests:export',contactsRead:'contacts:read',
  notificationsRead:'notifications:read',notificationsWrite:'notifications:write',analyticsRead:'analytics:read',
  teamRead:'team:read',teamWrite:'team:write',auditRead:'audit:read'
}as const;

const PermissionContext=createContext<ReadonlySet<string>>(new Set());
export function PermissionProvider({permissions,children}:{permissions:string[];children:ReactNode}){
  return <PermissionContext.Provider value={new Set(permissions)}>{children}</PermissionContext.Provider>;
}
export function usePermissions(){
  const permissions=useContext(PermissionContext);
  return{has:(permission:string)=>permissions.has(permission),hasAny:(...required:string[])=>required.some(permission=>permissions.has(permission))};
}

export const pagePermissions:Record<string,string[]>={
  dashboard:[PERMISSIONS.dashboardRead],requests:[PERMISSIONS.quoteRequestsRead],contacts:[PERMISSIONS.contactsRead],
  notifications:[PERMISSIONS.notificationsRead],products:[PERMISSIONS.productsRead],categories:[PERMISSIONS.categoriesRead],
  brands:[PERMISSIONS.brandsRead],attributes:[PERMISSIONS.attributesRead],filters:[PERMISSIONS.filtersRead],media:[PERMISSIONS.mediaRead],
  team:[PERMISSIONS.teamRead],reports:[PERMISSIONS.quoteRequestsExport,PERMISSIONS.productsRead],audit:[PERMISSIONS.auditRead]
};
export function canOpenPage(permissions:ReadonlySet<string>,page:string){
  const pageKey=page.split(':')[0]??'';
  const required: string[]=pagePermissions[pageKey]??[];
  return required.length>0&&required.some(permission=>permissions.has(permission));
}
