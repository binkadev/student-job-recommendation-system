// Presentation only. Backend validates role, ownership and transitions again.
export function getCompanyJobActions(status: string, companyStatus: string) {
  return {
    edit: status === "DRAFT",
    submit: status === "DRAFT" && companyStatus === "VERIFIED",
    withdraw: status === "PENDING_APPROVAL",
    returnToDraft: ["REJECTED", "CLOSED", "EXPIRED"].includes(status),
    close: ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "REJECTED", "EXPIRED"].includes(status),
  };
}
