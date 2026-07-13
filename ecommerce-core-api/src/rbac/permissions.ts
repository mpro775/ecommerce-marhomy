export const PERMISSIONS={
  dashboardRead:'dashboard:read',productsRead:'products:read',productsWrite:'products:write',
  productModelsRead:'product-models:read',productModelsWrite:'product-models:write',
  categoriesRead:'categories:read',categoriesWrite:'categories:write',brandsRead:'brands:read',brandsWrite:'brands:write',
  specificationsRead:'specifications:read',specificationsWrite:'specifications:write',mediaRead:'media:read',mediaWrite:'media:write',
  catalogImportsRead:'catalog-imports:read',catalogImportsWrite:'catalog-imports:write',
  quoteRequestsRead:'quote-requests:read',quoteRequestsWrite:'quote-requests:write',quoteRequestsAssign:'quote-requests:assign',
  quoteRequestsExport:'quote-requests:export',contactsRead:'contacts:read',contactsWrite:'contacts:write',
  notificationsRead:'notifications:read',notificationsWrite:'notifications:write',analyticsRead:'analytics:read',
  teamRead:'team:read',teamWrite:'team:write',auditRead:'audit:read',systemManage:'system:manage',
} as const;
