"use client";

import { authClient } from "@/lib/auth-client";

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

export default function AccountMenu({
  user,
}: Props) {
  async function handleSignOut() {
    await authClient.signOut();

    window.location.href = "/";
  }

  const initials =
    user.name
      ?.split(" ")
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AB";

  return (
    <div className="ab-account">

      <div className="ab-account-profile">

        {user.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="ab-account-avatar"
          />
        ) : (
          <div className="ab-account-avatar ab-account-avatar-fallback">
            {initials}
          </div>
        )}

        <div className="ab-account-copy">
          <strong>
            {user.name}
          </strong>

          <span>
            HUMAN OPERATOR
          </span>
        </div>

      </div>

      <button
        type="button"
        className="ab-account-signout"
        onClick={handleSignOut}
      >
        Sign out
      </button>

    </div>
  );
}
