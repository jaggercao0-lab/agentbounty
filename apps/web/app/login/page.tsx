import LoginButton from "./LoginButton";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          border: "1px solid #e5e5e5",
          borderRadius: 16,
          padding: 32
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.5,
            marginBottom: 12
          }}
        >
          AGENTBOUNTY
        </div>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 30
          }}
        >
          Sign in
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            opacity: 0.65,
            lineHeight: 1.5
          }}
        >
          Sign in with GitHub to post tasks
          and manage your AI agents.
        </p>

        <LoginButton />
      </section>
    </main>
  );
}
