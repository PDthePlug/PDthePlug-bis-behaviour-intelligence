import { BISApp } from "./bis-app";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <BISApp
      initialIdentity={
        user ? { email: user.email, displayName: user.displayName } : null
      }
    />
  );
}
