import { auth } from "@clerk/nextjs/server";
import CreateQuizForm from "./create-quiz-form";

export default async function CreateQuizPage() {
  await auth.protect();
  return <CreateQuizForm />;
}
