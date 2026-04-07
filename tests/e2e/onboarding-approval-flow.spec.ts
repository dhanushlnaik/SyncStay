import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { MediaAssetType, OnboardingStatus, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "SyncStay!234";

async function signUpUser(page: Page, input: {
  name: string;
  email: string;
  password: string;
}) {
  await page.goto("/auth/sign-up");
  await page.getByPlaceholder("Full name").fill(input.name);
  await page.getByPlaceholder("owner@yourhotel.in").fill(input.email);
  await page.getByPlaceholder("Create password").fill(input.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/auth\/verify-email/);
}

async function promoteAdmin(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const authUser = await prisma.authUser.findUnique({ where: { email } });
  if (!user || !authUser) {
    throw new Error(`Unable to find user rows for ${email}`);
  }

  await prisma.$transaction([
    prisma.authUser.update({
      where: { id: authUser.id },
      data: {
        role: "MASTER_ADMIN",
        emailVerified: true,
        isActive: true,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: UserRole.MASTER_ADMIN,
        ownerApprovalStatus: OnboardingStatus.APPROVED,
        isActive: true,
      },
    }),
  ]);
}

async function createOwnerSubmission(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const authUser = await prisma.authUser.findUnique({ where: { email } });
  if (!user || !authUser) {
    throw new Error(`Unable to find owner rows for ${email}`);
  }

  const stamp = Date.now().toString().slice(-6);
  const slug = `e2e-${stamp}-${Math.random().toString(36).slice(2, 7)}`;

  const hotel = await prisma.hotel.create({
    data: {
      name: `E2E Demo Hotel ${stamp}`,
      slug,
      ownerId: user.id,
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      postalCode: "302001",
      timezone: "Asia/Kolkata",
      currency: "INR",
      registrationStatus: "PENDING_REVIEW",
    },
  });

  await prisma.$transaction([
    prisma.authUser.update({
      where: { id: authUser.id },
      data: {
        role: "OWNER",
        emailVerified: true,
        isActive: true,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: UserRole.OWNER,
        ownerApprovalStatus: OnboardingStatus.SUBMITTED,
        isActive: true,
      },
    }),
    prisma.ownerProfile.upsert({
      where: { userId: user.id },
      update: {
        legalBusinessName: `E2E Hospitality ${stamp}`,
        gstin: `08ABCDE${stamp.slice(0, 4)}F1Z5`,
        pan: `ABCDE${stamp.slice(0, 4)}F`,
        contactPhone: "+91-9999999999",
        addressLine1: "MI Road",
        city: "Jaipur",
        state: "Rajasthan",
        country: "India",
        postalCode: "302001",
      },
      create: {
        userId: user.id,
        legalBusinessName: `E2E Hospitality ${stamp}`,
        gstin: `08ABCDE${stamp.slice(0, 4)}F1Z5`,
        pan: `ABCDE${stamp.slice(0, 4)}F`,
        contactPhone: "+91-9999999999",
        addressLine1: "MI Road",
        city: "Jaipur",
        state: "Rajasthan",
        country: "India",
        postalCode: "302001",
      },
    }),
    prisma.ownerOnboarding.upsert({
      where: { userId: user.id },
      update: {
        status: OnboardingStatus.SUBMITTED,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      },
      create: {
        userId: user.id,
        status: OnboardingStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    }),
    prisma.propertyRegistration.create({
      data: {
        ownerId: user.id,
        hotelId: hotel.id,
        status: OnboardingStatus.SUBMITTED,
        legalPropertyName: `E2E Property ${stamp}`,
        displayName: `E2E Property ${stamp}`,
        slug: `property-${slug}`,
        addressLine1: "MI Road",
        city: "Jaipur",
        state: "Rajasthan",
        country: "India",
        postalCode: "302001",
        contactEmail: email,
        contactPhone: "+91-9999999999",
      },
    }),
    prisma.mediaAsset.createMany({
      data: [
        MediaAssetType.GSTIN_DOC,
        MediaAssetType.PAN_DOC,
        MediaAssetType.TRADE_LICENSE_DOC,
        MediaAssetType.ADDRESS_PROOF_DOC,
      ].map((assetType) => ({
        ownerId: user.id,
        hotelId: hotel.id,
        assetType,
        visibility: "PRIVATE",
        cloudinaryPublicId: `syncstay/e2e/${slug}/${assetType.toLowerCase()}`,
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/syncstay/sample.jpg",
      })),
      skipDuplicates: true,
    }),
  ]);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("owner onboarding is approved by admin and gains dashboard access", async ({ browser }) => {
  test.setTimeout(120_000);

  const stamp = Date.now();
  const adminEmail = `admin.e2e.${stamp}@syncstay.test`;
  const ownerEmail = `owner.e2e.${stamp}@syncstay.test`;

  const adminContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const ownerContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const adminPage = await adminContext.newPage();
  const ownerPage = await ownerContext.newPage();

  await signUpUser(adminPage, {
    name: "E2E Admin",
    email: adminEmail,
    password: PASSWORD,
  });

  await signUpUser(ownerPage, {
    name: "E2E Owner",
    email: ownerEmail,
    password: PASSWORD,
  });

  await promoteAdmin(adminEmail);
  await createOwnerSubmission(ownerEmail);

  await adminContext.clearCookies();
  await adminPage.goto("/auth/sign-in");
  await adminPage.getByPlaceholder("owner@lotushaven.in").fill(adminEmail);
  await adminPage.getByPlaceholder("Enter password").fill(PASSWORD);
  await adminPage.getByRole("button", { name: "Sign In" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard/);

  await adminPage.goto("/admin/onboarding");
  await expect(adminPage.getByText("Onboarding Review Queue")).toBeVisible();
  await expect(adminPage.getByText(ownerEmail)).toBeVisible();

  const ownerCard = adminPage.locator("div.rounded-2xl").filter({
    has: adminPage.getByText(ownerEmail),
  });

  await ownerCard.getByRole("button", { name: "Review" }).first().click();
  await expect(ownerCard.getByText("Owner Profile")).toBeVisible();
  await ownerCard.getByRole("button", { name: "Approve" }).first().click();

  await expect
    .poll(async () => {
      const row = await prisma.user.findUnique({
        where: { email: ownerEmail },
        select: { ownerApprovalStatus: true },
      });
      return row?.ownerApprovalStatus;
    })
    .toBe("APPROVED");

  await ownerContext.clearCookies();
  await ownerPage.goto("/auth/sign-in");
  await ownerPage.getByPlaceholder("owner@lotushaven.in").fill(ownerEmail);
  await ownerPage.getByPlaceholder("Enter password").fill(PASSWORD);
  await ownerPage.getByRole("button", { name: "Sign In" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard/);

  await ownerPage.goto("/inventory");
  await expect(ownerPage).toHaveURL(/\/inventory/);

  await adminContext.close();
  await ownerContext.close();
});
