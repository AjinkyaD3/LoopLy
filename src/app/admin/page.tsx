import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import SubscriptionToggleButton from "@/components/SubscriptionToggleButton";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

/**
 * Internal admin panel — manual subscription activation only (no payment gateway yet).
 * Not linked from anywhere in the business-owner UI; admins are promoted via
 * scratch/make-admin.js and reach this page by URL.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">You do not have access to this page.</p>
      </div>
    );
  }

  const businesses = await prisma.business.findMany({
    include: {
      owner: { select: { name: true, email: true } },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl p-4 py-6 sm:p-6 sm:py-8">
      <PageHeader
        title="Admin — Subscriptions"
        subtitle="Manually activate or deactivate a business subscription. Payment-gateway automation is not built yet."
      />

      <Card padded={false} className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Business</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Owner email</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Created</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Subscription</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {businesses.map((b) => {
              const status = b.subscription?.status ?? "INACTIVE";
              return (
                <tr key={b.id}>
                  <td className="px-4 py-2 text-slate-900">{b.name}</td>
                  <td className="px-4 py-2 text-slate-600">{b.owner.email}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={status === "ACTIVE" ? "success" : "neutral"}>{status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <SubscriptionToggleButton businessId={b.id} currentStatus={status} />
                  </td>
                </tr>
              );
            })}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No businesses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
