import { auth } from "@clerk/nextjs/server";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  await auth.protect();
  return <SettingsForm />;
}
