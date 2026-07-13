import { createContext, useContext, type ReactNode } from 'react';
export const PERMISSIONS={
  dashboardRead:'dashboard:read',productsRead:'products:read',productsWrite:'products:write',
  productModelsRead:'product-models:read',productModelsWrite:'product-models:write',categoriesRead:'categories:read',categoriesWrite:'categories:write',
  brandsRead:'brands:read',brandsWrite:'brands:write',specificationsRead:'specifications:read',specificationsWrite:'specifications:write',
  catalogImportsRead:'catalog-imports:read',catalogImportsWrite:'catalog-imports:write',mediaRead:'media:read',mediaWrite:'media:write',
  quoteRequestsRead:'quote-requests:read',quoteRequestsWrite:'quote-requests:write',quoteRequestsAssign:'quote-requests:assign',
  quoteRequestsExport:'quote-requests:export',contactsRead:'contacts:read',notificationsRead:'notifications:read',
  notificationsWrite:'notifications:write',analyticsRead:'analytics:read',teamRead:'team:read',teamWrite:'team:write',auditRead:'audit:read',
}as const;
const PermissionContext=createContext<ReadonlySet<string>>(new Set());
export function PermissionProvider({permissions,children}:{permissions:string[];children:ReactNode}){return <PermissionContext.Provider value={new Set(permissions)}>{children}</PermissionContext.Provider>;}
export function usePermissions(){const permissions=useContext(PermissionContext);return{has:(permission:string)=>permissions.has(permission),hasAny:(...required:string[])=>required.some(permission=>permissions.has(permission))};}
export const pagePermissions:Record<string,string[]>={dashboard:[PERMISSIONS.dashboardRead],requests:[PERMISSIONS.quoteRequestsRead],contacts:[PERMISSIONS.contactsRead],
  notifications:[PERMISSIONS.notificationsRead],products:[PERMISSIONS.productsRead],categories:[PERMISSIONS.categoriesRead],brands:[PERMISSIONS.brandsRead],
  specifications:[PERMISSIONS.specificationsRead],imports:[PERMISSIONS.catalogImportsRead],media:[PERMISSIONS.mediaRead],team:[PERMISSIONS.teamRead],
  reports:[PERMISSIONS.quoteRequestsExport,PERMISSIONS.productsRead],audit:[PERMISSIONS.auditRead]};
export function canOpenPage(permissions:ReadonlySet<string>,page:string){const required=pagePermissions[page.split(':')[0]??'']??[];return required.length>0&&required.some(permission=>permissions.has(permission));}
