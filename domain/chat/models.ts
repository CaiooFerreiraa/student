export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};
