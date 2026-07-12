import { mock } from "bun:test";

export const TEST_CLERK_USER_ID = "user_lumina_integration_tests";

mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: TEST_CLERK_USER_ID }),
  currentUser: async () => ({
    id: TEST_CLERK_USER_ID,
    firstName: "Caio",
    lastName: "Martins",
    username: null,
    primaryEmailAddressId: "email_integration_tests",
    emailAddresses: [{
      id: "email_integration_tests",
      emailAddress: process.env.DEMO_USER_EMAIL ?? "caio@lumina.local",
    }],
  }),
}));
