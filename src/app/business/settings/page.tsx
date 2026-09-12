import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

import BusinessSettingsClient from "./BusinessSettingsClient";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: { ownerId: user.id },
    include: { loyaltyProgram: true },
  });

  if (!business) redirect("/business/setup");

  return (
    <BusinessSettingsClient
      business={{
        id: business.id,
        name: business.name,
        address: business.address,
        businessType: business.businessType,
        googleReviewUrl: business.googleReviewUrl,
        instagramHandle: business.instagramHandle,
        youtubeHandle: business.youtubeHandle,
        loyaltyProgram: business.loyaltyProgram
          ? {
              id: business.loyaltyProgram.id,
              programName: business.loyaltyProgram.programName,
              requiredVisits: business.loyaltyProgram.requiredVisits,
              rewardTitle: business.loyaltyProgram.rewardTitle,
              rewardDescription: business.loyaltyProgram.rewardDescription,
              rewardValidityDays: business.loyaltyProgram.rewardValidityDays,
              verificationMethod: business.loyaltyProgram.verificationMethod,
              isActive: business.loyaltyProgram.isActive,
            }
          : null,
      }}
    />
  );
}
