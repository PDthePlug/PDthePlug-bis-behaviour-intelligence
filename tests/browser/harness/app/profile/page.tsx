import { ProfileDashboard } from "../../../../../app/profile/profile-dashboard";

export default function Page() {
  return <ProfileDashboard initialIdentity={{ email: "browser.learner@example.test", displayName: "Browser Learner" }} />;
}
