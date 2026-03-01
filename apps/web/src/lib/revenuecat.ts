import { Purchases } from "@revenuecat/purchases-js";

const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_PUBLIC_API_KEY as string;
const entitlementId = process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID as string;

let configured = false;
let purchases: Purchases | null = null;
let configuredAppUserId: string | null = null;

export function configurePurchases(appUserId?: string) {
  if (typeof window === "undefined") return;
  const resolvedAppUserId = appUserId || "guest-user";

  if (!configured) {
    purchases = Purchases.configure({ apiKey, appUserId: resolvedAppUserId });
    configuredAppUserId = resolvedAppUserId;
    configured = true;
    return;
  }

  if (purchases && configuredAppUserId !== resolvedAppUserId) {
    configuredAppUserId = resolvedAppUserId;
    void purchases.changeUser(resolvedAppUserId).catch(() => undefined);
  }
}

export async function presentPaywall(target: HTMLElement) {
  if (!purchases) configurePurchases();
  if (!purchases) return;
  await purchases.presentPaywall({ htmlTarget: target });
}

export async function getClientProStatus(): Promise<boolean> {
  try {
    if (!purchases) configurePurchases();
    if (!purchases) return false;
    const info: any = await purchases.getCustomerInfo();
    return Boolean(info?.entitlements?.active?.[entitlementId]);
  } catch {
    return false;
  }
}
