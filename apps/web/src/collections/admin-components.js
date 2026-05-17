const discardChangesControl = {
  path: "./components/admin/DiscardChangesLink.tsx",
  exportName: "DiscardChangesLink",
};

export function withDiscardChangesControl(admin = {}) {
  return {
    ...admin,
    components: {
      ...admin.components,
      edit: {
        ...admin.components?.edit,
        beforeDocumentControls: [
          discardChangesControl,
          ...(admin.components?.edit?.beforeDocumentControls ?? []),
        ],
      },
    },
  };
}
